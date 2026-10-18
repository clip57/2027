// Kontrola spójności planu CFA i planu dnia — bez plików źródłowych użytkownika (czyta tylko src/data/*.json i resolver).
// Uruchomienie: node tools/verify/plan_check.mjs        (kod wyjścia 1, jeśli są BŁĘDY; OSTRZEŻENIA nie psują wyniku)
// Cel: wychwycić po wymianie planu CFA to, czego nie widzą testy jednostkowe — bloki bez slotu, sloty bez bloku, rozbieżności godzin,
// nakładanie się slotów, recall niezgodny z harmonogramem, liczby w `stat` niezgodne z blokami, wyjście poza limit zdarzeń.
import { SRC, cfaByDay } from '../../src/core/data.js';
import { resolveDay, PLAN_START, PLAN_END } from '../../src/core/resolver.js';
import { addDays, weekday } from '../../src/core/dates.js';
import { CFA_BLOCKS, CFA_PLAN_VERSION } from '../../src/core/storage/validate.js';

const D = SRC.cfa.D, errors = [], warns = [];
const err = m => errors.push(m), warn = m => warns.push(m);
const toMin = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const eq = (a, b, what) => { if (a !== b) err(`${what}: jest ${a}, oczekiwano ${b}`); };

// ---------- 1. Integralność danych planu ----------
const B = D.bloki;
eq(B.length, D.stat.bloki, 'stat.bloki vs liczba bloków');
B.forEach((b, i) => { if (b.nr !== i + 1) err(`numeracja: pozycja ${i + 1} ma nr ${b.nr}`); });
if (B.length > CFA_BLOCKS) err(`plan ma ${B.length} bloków, limit zdarzeń cfa.done = ${CFA_BLOCKS} (validate.js) — zdarzenia trafią do kwarantanny`);
const seen = new Set();
for (const b of B) {
  const k = `${b.data} ${b.blok} ${b.godz}`;   // sesja mocka (S1/S2) ma 3 bloki o tej samej literze — rozróżnia je godzina
  if (b.tryb !== 'MOCK') { if (seen.has(k)) err(`duplikat bloku ${k}`); seen.add(k); }
  if (!/^\d{2}:\d{2}–\d{2}:\d{2}$/.test(b.godz)) err(`blok ${b.nr}: format godziny „${b.godz}”`);
  else { const [f, t] = b.godz.split('–'); if (toMin(t) - toMin(f) !== 53 && b.tryb !== 'MOCK') warn(`blok ${b.nr} (${k}): długość ${toMin(t) - toMin(f)} min (zwykle 53)`); }
}
for (let i = 1; i < B.length; i++) if (B[i].data < B[i - 1].data || (B[i].data === B[i - 1].data && B[i].godz < B[i - 1].godz)) err(`kolejność: blok ${B[i].nr} przed ${B[i - 1].nr}`);
eq(B[0].data, D.stat.start, 'pierwszy blok vs stat.start'); eq(B[B.length - 1].data, D.stat.end, 'ostatni blok vs stat.end');
const days = [...new Set(B.map(b => b.data))];
eq(days.length, D.stat.dni, 'stat.dni vs liczba dni z blokami');
for (const [k, n] of Object.entries(D.stat.kat)) eq(B.filter(b => b.kategoria === k).length, n, `stat.kat[${k}]`);
for (const [k, n] of Object.entries(D.stat.tryb)) eq(B.filter(b => b.tryb === k).length, n, `stat.tryb[${k}]`);
for (const m of D.mockCFA) { const n = B.filter(b => b.data === m && b.tryb === 'MOCK').length; if (!n) err(`dzień mocka ${m} nie ma bloków trybu MOCK`); }
const mockDays = new Set(B.filter(b => b.tryb === 'MOCK').map(b => b.data));
for (const d of mockDays) if (!D.mockCFA.includes(d)) err(`bloki MOCK w dniu ${d}, którego nie ma w mockCFA`);
// recall
eq(D.nightRecall.length + D.recallSessions.length, D.stat.recall, 'stat.recall vs nightRecall + recallSessions');
eq(D.nightRecall.length, D.nightDates.length, 'nightRecall vs nightDates');
for (const r of D.nightRecall) if (r.data < D.stat.start || r.data > D.stat.end) err(`recall ${r.data} poza zakresem planu`);
for (const d of D.noNightDates) if (D.nightDates.includes(d)) err(`${d} jest jednocześnie w nightDates i noNightDates`);
if (D.exam && SRC.cfa.exam && D.recallSessions.some(r => r.data > SRC.cfa.exam)) warn('sesje końcowe recall po dacie egzaminu');
for (const r of D.recallSessions) if (r.data <= D.stat.end) warn(`sesja końcowa recall ${r.data} mieści się w okresie planu (widok dnia ją pominie lub zdubluje)`);

// ---------- 2. Resolver: każdy dzień planu projektu ----------
const sets = { dayChecked: 0 }, overlaps = [], nowWarn = [], nowErr = [], okOverlap = [];
for (let d = D.stat.start < PLAN_START ? D.stat.start : PLAN_START; d <= (PLAN_END < '2027-01-01' ? PLAN_END : D.stat.end); d = addDays(d, 1)) {
  if (d > D.stat.end) break;
  const r = resolveDay(d); sets.dayChecked++;
  const planned = (cfaByDay[d] || []);
  // blok w planie ⇒ dokładnie jeden slot, który go niesie (cfa[] zawiera blok), z zgodną godziną
  const carried = r.slots.flatMap(s => (s.cfa || []).map(b => ({ b, s })));
  for (const b of planned) {
    const hits = carried.filter(x => x.b.nr === b.nr);
    if (hits.length !== 1) { err(`${d}: blok ${b.nr} (${b.blok} ${b.godz}) niesiony przez ${hits.length} slotów`); continue; }
    const { s } = hits[0], [f, t] = b.godz.split('–');
    if (!r.outside || true) { if (s.from !== f && !(r.cfa.isMock)) err(`${d}: blok ${b.blok} ${b.godz} ≠ slot ${s.id} ${s.from}–${s.to}`); }
  }
  // brak „zjedzonych” bloków: liczba bloków w widoku = liczba w planie
  if (r.cfa.blocks.length !== planned.length) err(`${d}: resolveDay.cfa.blocks=${r.cfa.blocks.length}, plan=${planned.length}`);
  // recall: widok ⇔ harmonogram
  const wantRecall = D.nightDates.includes(d);
  if (!!r.cfa.recall !== wantRecall) err(`${d}: recall w widoku=${!!r.cfa.recall}, w harmonogramie=${wantRecall}`);
  if (r.outside) continue;   // dni poza planem (D-103c: 16–17.10 mają tylko bloki CFA): widok „Dziś” pokazuje „Poza planem”, układ slotów i karty „Teraz” nie istnieją
  // sloty dnia: kolejność i nakładanie (poza snem, który przechodzi przez północ)
  const rolesOf = Object.fromEntries(r.slots.map(s => [s.id, s]));
  const sl = r.slots.filter(s => s.to > s.from).map(s => ({ id: s.id, f: toMin(s.from), t: toMin(s.to), title: s.title }));
  const sorted = [...sl].sort((a, b) => a.f - b.f || a.t - b.t);
  for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length && sorted[j].f < sorted[i].t; j++) {
    const a = rolesOf[sorted[i].id], b = rolesOf[sorted[j].id], pair = `${d} ${a.from}–${a.to} „${a.title}” ∩ ${b.from}–${b.to} „${b.title}”`;
    const cfaSlot = [a, b].find(x => x.role === 'cfa'), other = cfaSlot === a ? b : a;
    // Zamierzone (D-101, decyzja użytkownika): posiłek 20:15 zostaje w trakcie bloku M
    if (cfaSlot && other.role === 'meal' && other.domain === 'diet' && cfaSlot.cfa?.some(x => x.blok === 'M')) okOverlap.push([`nakładanie ${pair.slice(11)} (zamierzone, D-101: posiłek 20:15 w bloku M w dni bez treningu)`, d]);
    // Znane, 5-minutowe (D-101): „Zmywanie popołudniowe” 17:33–17:45 kończy się po starcie bloku K 17:40; karta „Teraz” wskazuje wtedy blok K (kolejność slotów)
    else if (cfaSlot && other.title === 'Zmywanie popołudniowe' && cfaSlot.cfa?.some(x => x.blok === 'K')) okOverlap.push([`nakładanie ${pair.slice(11)} (5 min, znane od D-101)`, d]);
    else if (!r.outside) overlaps.push(pair);
  }
  // „Teraz” (kopia currentSlot z src/modules/dzis.js — wygrywa OSTATNI pasujący slot): w każdej minucie bloku (poza sesjami mocka)
  // aktualny slot powinien być slotem tego bloku. Rozbieżność = karta „Teraz” pokaże inną czynność niż blok CFA.
  const cur = t => { let c = null; for (const s of r.slots) if (s.from <= t && (s.to > s.from ? t < s.to : true)) c = s; return c; };
  const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const bad = {};
  for (const b of planned.filter(b => !/^S\d$/.test(b.blok))) for (let m = toMin(b.godz.slice(0, 5)); m < toMin(b.godz.slice(6)); m++) {
    const c = cur(hm(m)); if (c && (c.cfa || []).includes(b)) continue;
    const e = (bad[`${b.blok}|${c ? c.title : '—'}`] ||= { mins: [], meal: false }); e.mins.push(m); e.meal ||= c?.role === 'meal';
  }
  for (const [k, e] of Object.entries(bad)) {
    const [blok, title] = k.split('|');
    const msg = `„teraz” pokazuje „${title}” zamiast bloku ${blok} przez ${e.mins.length} min (od ${hm(e.mins[0])} do ${hm(e.mins[e.mins.length - 1] + 1)})`;
    (e.meal ? nowWarn : nowErr).push([msg + (e.meal ? ' — posiłek w bloku (D-101)' : ''), d]);
  }
}
const compress = ds => ds.length > 4 ? `${ds[0]} … ${ds[ds.length - 1]} (${ds.length} dni)` : ds.join(', ');
const groupMsgs = (list, f) => { const g = {}; for (const [m, d] of list) (g[m] ||= []).push(d); for (const [m, ds] of Object.entries(g)) f(`${m} — ${compress(ds)}`); };
groupMsgs(okOverlap, warn); groupMsgs(nowWarn, warn); groupMsgs(nowErr, err);
const grouped = {};
for (const o of overlaps) { const k = o.slice(11); (grouped[k] ||= []).push(o.slice(0, 10)); }
for (const [k, ds] of Object.entries(grouped)) err(`nakładanie slotów: ${k} — ${compress(ds)}`);

// ---------- Raport ----------
console.log(`Wersja planu: ${D.version} | bloków: ${B.length} (${D.stat.start} → ${D.stat.end}) | dni sprawdzonych w resolverze: ${sets.dayChecked} | CFA_PLAN_VERSION=${CFA_PLAN_VERSION} | limit CFA_BLOCKS=${CFA_BLOCKS}`);
for (const w of warns) console.log('  UWAGA   ', w);
for (const e of errors) console.log('  BŁĄD    ', e);
console.log(`\nBŁĘDÓW: ${errors.length}, OSTRZEŻEŃ: ${warns.length}`);
process.exit(errors.length ? 1 : 0);
