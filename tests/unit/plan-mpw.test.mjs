// Plan MPW (D-095, D-096, D-116): spójność planu z mpw.json (392 bloki, 119 dni, 20.11.2026–20.03.2027, egzamin 21.03.2027), nowe typy zdarzeń
// `mpw.done` / `mpw.err.*`, zakładka MPW 12.11.2026–21.03.2027 (potem CFA), dzień bez zmian w szablonie godzin, integracje (uwaga, ⌘K, .ics).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SRC, mpwByDay } from '../../src/core/data.js';
import { addDays, dayName, range } from '../../src/core/dates.js';
import { MPW_BLOCKS, validateEvent, CFA_PLAN_VERSION } from '../../src/core/storage/validate.js';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { resolveDay } from '../../src/core/resolver.js';
import { byId, isTab, modulesOn } from '../../src/modules/registry.js';
import { mpwSources, mpwFreeDays, mpwDaySpan } from '../../src/core/calc/mpw.js';
import { attention } from '../../src/core/calc/attention.js';
import { cfaPace } from '../../src/core/calc/cfa.js';
import { planEvents } from '../../src/core/ics.js';
import { buildIndex, search } from '../../src/core/search.js';
import mpwJson from '../../src/data/mpw.json' with { type: 'json' };
import { exportBundle, preview, apply } from '../../src/core/sync/bundle.js';

const D = SRC.mpw.D, B = D.bloki;
// D-120: plan z pliku (daty i godziny z planu MPW) — przesunięcia decyzją tylko w danych aplikacji (`week.studyMoves`)
const RAW = mpwJson.D.bloki, rawByDay = RAW.reduce((m, b) => ((m[b.data] ||= []).push(b), m), {}), MOVES = SRC.week.studyMoves.mpw;
// Plan v8 (D-096) po D-116: 392 bloki, 119 dni — 114 × 3 (A–C 15:30–18:23) + 5 × 10 (P1–P7 8:00–15:23 + A–C) w 6–7.03, 13–14.03, 20.03;
// start 20.11 (zamiast 16.11), bloki także 24–27.12 (dni wolne tylko 19–20.02)
const START = '2026-11-20', END = '2027-03-20', FREE = ['2027-02-19', '2027-02-20'];
const LONG = ['2027-03-06', '2027-03-07', '2027-03-13', '2027-03-14', '2027-03-20'];
const SLOTS_AG = ['08:00–08:53', '09:10–10:03', '10:10–11:03', '11:20–12:13', '12:20–13:13', '13:30–14:23', '14:30–15:23'];

test('MPW v8 (D-116): 392 bloki 1–392, 119 dni 20.11–20.03 (114 × 3 + 5 × 10: P1–P7 w godzinach slotów A–G), bloki także 24–27.12, dni wolne 19–20.02, egzamin 21.03.2027 11:00', () => {
  assert.equal(B.length, 392);
  assert.deepEqual(B.map(b => b.nr), [...Array(392)].map((_, i) => i + 1));
  assert.deepEqual([D.stat.start, D.stat.end, SRC.mpw.exam, SRC.mpw.examTime], [START, END, '2027-03-21', '11:00']);
  assert.deepEqual(Object.keys(mpwByDay).sort(), [...range(START, END)].filter(d => !FREE.includes(d)));
  assert.deepEqual(mpwFreeDays(), [['2027-02-19', '2027-02-20']]);
  assert.deepEqual(['2026-12-24', '2026-12-25', '2026-12-26', '2026-12-27'].map(d => mpwByDay[d].map(b => b.blok).join('')), ['ABC', 'ABC', 'ABC', 'ABC'], 'D-116: bloki MPW w święta');
  for (const b of B) assert.equal(b.dzien, dayName(b.data), `nr ${b.nr}`);
  const tmpl = SRC.dayTemplate.slots.filter(s => s.role === 'cfa').slice(0, 7).map(s => `${s.from}–${s.to}`);
  assert.deepEqual(tmpl, SLOTS_AG, 'P1–P7 = godziny slotów CFA A–G');
  for (const [d, list] of Object.entries(rawByDay)) {
    const long = LONG.includes(d), abc = list.filter(b => !b.blok.startsWith('P'));
    assert.equal(list.map(b => b.blok).join(''), long ? 'P1P2P3P4P5P6P7ABC' : 'ABC', d);
    if (long) assert.deepEqual(list.slice(0, 7).map(b => b.godz), SLOTS_AG, d);
    const sim = D.mockCFA.includes(d);
    assert.deepEqual(abc.map(b => b.godz), sim ? ['15:30–16:30', '16:30–17:30', '17:30–18:30'] : ['15:30–16:23', '16:30–17:23', '17:30–18:23'], d);
  }
  // w aplikacji: D-120 (`studyMoves`) albo D-097 (czwartki od 07.01 — A–C 30 min później); plan z pliku w `godz_src` / `data_src`
  for (const [i, b] of B.entries()) {
    const r = RAW[i], mv = MOVES[b.nr], thu = r.data >= '2027-01-07' && new Date(`${r.data}T12:00`).getDay() === 4 && !r.blok.startsWith('P');
    if (mv) assert.deepEqual([b.data, b.godz.slice(0, 5), b.godz_src, b.data_src ?? b.data], [...mv.split(' '), r.godz, r.data], `nr ${b.nr}`);
    else assert.deepEqual([b.data, b.godz], [r.data, thu ? r.godz.replace(/\d\d:\d\d/g, t => { const x = +t.slice(0, 2) * 60 + +t.slice(3) + 30; return `${String(x / 60 | 0).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; }) : r.godz], `nr ${b.nr}`);
    assert.equal(b.godz.slice(6) > b.godz.slice(0, 5) || b.godz.startsWith('23'), true);
  }
  assert.ok(RAW.every(b => !('godz_src' in b)), 'mpw.json bez zmian — przesunięcia tylko w danych aplikacji (week.mpwShift, week.studyMoves)');
  assert.ok(B.every(b => b.egzamin === 'MPW'));
  assert.ok(MPW_BLOCKS >= B.length, 'plan mieści się w limicie walidacji');
});

test('MPW: statystyki, fazy i symulacje zgodne z blokami', () => {
  const count = key => B.reduce((m, b) => ((m[b[key]] = (m[b[key]] || 0) + 1), m), {});
  assert.deepEqual(count('kategoria'), D.stat.kat);
  assert.deepEqual(count('tryb'), D.stat.tryb);
  assert.equal(D.stat.dni, Object.keys(mpwByDay).length);
  for (const f of Object.values(D.faza)) assert.equal(B.filter(b => b.data >= f.od && b.data <= f.do).length, f.bl);
  assert.equal(D.mockCFA.length, 5);
  for (const d of D.mockCFA) { assert.ok(mpwByDay[d].filter(b => !b.blok.startsWith('P')).every(b => b.tryb === 'SYMULACJA'), d); assert.match(D.simTest[d], /^\d\d\.\d\d\.\d{4}$/); }
  assert.equal(B.filter(b => b.tryb === 'SYMULACJA').length, 15);
  assert.ok(B.filter(b => b.blok.startsWith('P')).every(b => b.tryb === 'POWTÓRKA CAŁOŚCI'), 'P1–P7 — powtórka całości');
  // Źródła pierwszego przejścia: każdy blok FP dokładnie w jednym źródle
  const src = mpwSources();
  assert.equal(src.reduce((n, s) => n + s.nrs.length, 0), D.stat.kat['Prawo MPW'] + D.stat.kat['Literatura MPW']);
  // v8: literatura w pierwszym przejściu do fpEnd; prawo (265 bloków) także w fazie 2 — do 20.03
  assert.ok(B.filter(b => b.data > D.fpEnd).every(b => b.tryb !== 'LITERATURA – FIRST PASS'), 'literatura do fpEnd');
});

test('mpw.done i mpw.err.*: walidacja, stan niezależny od CFA (ten sam numer bloku), LWW, usunięcie wpisu', async () => {
  const ev = (t, d) => ({ id: `${t}:x`, hlc: '1790000000000:0000:dtest', dev: 'dtest', t, d, v: 1 });
  assert.equal(validateEvent(ev('mpw.done', { block: 392, done: true })), null);
  assert.ok(validateEvent(ev('mpw.done', { block: MPW_BLOCKS + 1, done: true })));
  assert.ok(validateEvent(ev('mpw.done', { block: 0, done: true })));
  assert.equal(validateEvent(ev('mpw.err.put', { id: 'e_1', data: { egz: 'MPW', temat: 'x' } })), null);
  assert.equal(validateEvent(ev('mpw.err.del', { id: 'e_1' })), null);
  const s = await new Store(new MemoryAdapter()).open();
  assert.deepEqual([s.state.mpwDone.size, s.state.mpwErrors], [0, []]);
  await s.record('mpw.done', { block: 1, done: true });
  await s.record('cfa.done', { block: 2, done: true, plan: CFA_PLAN_VERSION });
  assert.deepEqual([[...s.state.mpwDone], [...s.state.cfaDone]], [[1], [2]]);
  await s.record('mpw.done', { block: 1, done: false });
  await s.record('mpw.err.put', { id: 'e_1', data: { egz: 'MPW', temat: 'KSH', rodzaj: 'pośpiech' } });
  await s.record('cfa.err.put', { id: 'e_1', data: { egz: 'CFA', temat: 'FI' } });
  assert.equal(s.state.mpwDone.size, 0);
  assert.deepEqual(s.state.mpwErrors.map(e => e.temat), ['KSH']);
  assert.deepEqual(s.state.cfaErrors.map(e => e.temat), ['FI'], 'ten sam identyfikator wpisu w obu planach — osobne rekordy');
  await s.record('mpw.err.del', { id: 'e_1' });
  assert.deepEqual([s.state.mpwErrors.length, s.state.cfaErrors.length], [0, 1]);
});

test('Zakładka (D-095, D-116): CFA do 11.11.2026, MPW 12.11.2026–21.03.2027 (egzamin MPW), od 22.03.2027 znów CFA; drugi plan nauki w „Więcej”; w grupie „Nauka” moduł z zakładką pierwszy', () => {
  assert.deepEqual([byId.mpw.tabFrom, byId.mpw.tabUntil], ['2026-11-12', SRC.mpw.exam]);
  assert.deepEqual([byId.cfa.tabUntil, byId.cfa.tabFrom], [addDays(byId.mpw.tabFrom, -1), addDays(SRC.mpw.exam, 1)]);
  const tabs = d => modulesOn(d).filter(m => m.tab).map(m => m.id);
  const nauka = d => modulesOn(d).filter(m => m.group === 'Nauka').map(m => m.id);
  assert.deepEqual(tabs('2026-09-29'), ['dzis', 'dieta', 'trening', 'cfa']);
  assert.deepEqual(tabs('2026-11-11'), ['dzis', 'dieta', 'trening', 'cfa']);
  assert.deepEqual(tabs('2026-11-12'), ['dzis', 'dieta', 'trening', 'mpw']);
  assert.deepEqual(tabs('2027-03-21'), ['dzis', 'dieta', 'trening', 'mpw']);
  assert.deepEqual(tabs('2027-03-22'), ['dzis', 'dieta', 'trening', 'cfa']);
  assert.deepEqual(tabs('2027-12-31'), ['dzis', 'dieta', 'trening', 'cfa']);
  assert.deepEqual([nauka('2026-10-01'), nauka('2026-11-20'), nauka('2027-04-01')], [['cfa', 'mpw'], ['mpw', 'cfa'], ['cfa', 'mpw']]);
  assert.equal(modulesOn('2026-11-20').length, 13, 'z modułem Kalendarz (D-097)');
  assert.ok(!isTab(byId.mpw, '2026-11-11') && isTab(byId.mpw, '2026-11-12') && !isTab(byId.mpw, '2027-03-22'));
  assert.ok(isTab(byId.cfa, '2026-11-11') && !isTab(byId.cfa, '2026-11-12') && !isTab(byId.cfa, '2027-03-21') && isTab(byId.cfa, '2027-03-22'));
});

test('Dzień z MPW: bloki w resolverze, szablon godzin bez zmian (decyzja 29.09.2026), symulacja; D-116 — bloki CFA E–G w swoich slotach', () => {
  const r = resolveDay('2026-11-24');   // wtorek: MPW A–C (13–15) i CFA E–G
  assert.deepEqual([r.mpw.inPlan, r.mpw.blocks.map(b => b.nr), r.mpw.isSim], [true, [13, 14, 15], false]);
  // D-120: szablon bez zmian, poza 22:00 — blok MPW C zamiast „Wieczoru wolnego”
  assert.deepEqual(r.slots.map(s => `${s.id} ${s.from}–${s.to}`), SRC.dayTemplate.slots.map(s => (s.id === 'slot.2200' ? 'slot.mpw.C.2200 22:00–22:53' : `${s.id} ${s.from}–${s.to}`)));
  // bloki MPW A–C w karcie „Nauka MPW” (D-095) — slot w ich czasie je nazywa (bez treści bloków); blok bez slotu nauki (22:00) ma własny slot
  assert.deepEqual(r.slots.filter(s => s.mpw).map(s => `${s.from} ${s.mpw.blok}`), ['22:00 C']);
  assert.deepEqual(r.slots.filter(s => (s.cfa || []).length).map(s => s.title), ['CFA blok E', 'CFA blok F', 'CFA blok G'], 'D-116: plan CFA równolegle');
  assert.deepEqual(r.slots.filter(s => s.title === 'Nauka MPW').map(s => `${s.from} ${s.desc}`),
    ['15:30 Blok A 15:30–16:23 — w karcie „Nauka MPW”', '16:40 Blok B 16:40–17:33 — w karcie „Nauka MPW”', '22:00 Blok C 22:00–22:53 — w karcie „Nauka MPW”']);
  assert.ok(!JSON.stringify(r.slots).includes(r.mpw.blocks[0].temat), 'bez tematów bloków MPW w slotach');
  assert.equal(resolveDay('2027-02-27').mpw.isSim, true);
  assert.deepEqual([resolveDay('2026-12-25').mpw.inPlan, resolveDay('2026-12-25').mpw.blocks.length], [true, 3], 'D-116: bloki MPW w święta');
  assert.deepEqual([resolveDay('2027-02-19').mpw.inPlan, resolveDay('2027-02-19').mpw.blocks.length], [true, 0]);
  assert.deepEqual([resolveDay('2026-11-19').mpw.inPlan, resolveDay('2026-11-20').mpw.inPlan, resolveDay('2027-03-21').mpw.inPlan], [false, true, false]);
  // D-096: P1–P7 w slotach A–G, A–C w karcie
  const p = resolveDay('2027-03-06');
  assert.deepEqual(p.slots.filter(s => s.mpw).map(s => `${s.from} ${s.mpw.blok}`), ['08:00 P1', '09:10 P2', '10:10 P3', '11:20 P4', '12:20 P5', '13:30 A', '14:30 B', '15:30 C', '17:00 P6', '22:00 P7'], 'D-120: symulacja 13:30–16:30, P6 17:00, P7 22:00');
  assert.equal(p.mpw.blocks.length, 10);
});

test('Wymaga uwagi (D-116): zaległe bloki CFA i MPW równolegle — MPW do egzaminu MPW, CFA do końca planu CFA (termin egzaminu nieznany)', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  const ids = d => attention(s.state, { today: d }).map(x => x.id);
  assert.deepEqual(ids('2026-11-11'), []);
  assert.deepEqual(ids('2026-11-20'), [], 'pierwszy dzień obu planów — bez zaległości');
  const mpw = attention(s.state, { today: '2026-11-24' }).find(x => x.id === 'mpw');
  assert.equal(mpw.text, `Zaległe bloki MPW: ${cfaPace(B, new Set(), '2026-11-24').overdue.length}`);
  assert.equal(mpw.href, '#/mpw?v=harmonogram&zal=1');
  assert.ok(ids('2026-11-24').includes('cfa'));
  await s.recordMany(B.filter(b => b.data < '2026-11-24').map(b => ['mpw.done', { block: b.nr, done: true }]));
  assert.ok(!ids('2026-11-24').includes('mpw'));
  assert.ok(!ids('2027-03-22').includes('mpw'), 'po egzaminie MPW');
  assert.ok(ids('2027-05-12').includes('cfa') && !ids('2027-05-13').includes('cfa'));
});

test('.ics: bloki MPW w godzinach planu MPW; symulacja jako jedno wydarzenie 15:30–18:30', () => {
  const NOW = new Date('2026-11-01T12:00:00Z');
  const day = planEvents('2026-11-24', ['mpw'], NOW).join('\n');
  assert.equal((day.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.match(day, /DTSTART;TZID=Europe\/Warsaw:20261124T153000/);
  assert.match(day, /DTSTART;TZID=Europe\/Warsaw:20261124T164000/);
  assert.match(day, /DTEND;TZID=Europe\/Warsaw:20261124T225300/);   // D-120: C 22:00–22:53
  assert.match(day, /UID:2026-11-24-mpw-A@p2027/);
  const sim = planEvents('2027-02-27', ['mpw'], NOW).join('\n');
  assert.equal((sim.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(sim, /SUMMARY:Symulacja egzaminu MPW/);
  assert.match(sim, /DTSTART;TZID=Europe\/Warsaw:20270227T112000/);
  assert.match(sim, /DTEND;TZID=Europe\/Warsaw:20270227T142000/);
  const p6 = planEvents('2027-03-06', ['mpw'], NOW).join('\n');
  assert.equal((p6.match(/BEGIN:VEVENT/g) || []).length, 8, 'P1–P7 osobno i symulacja jako jedno wydarzenie (D-120)');
  const z = planEvents('2026-11-29', ['mpw'], NOW).join('\n');   // D-120: blok C z soboty 28.11 i blok C niedzieli — różne identyfikatory
  assert.equal(new Set(z.match(/UID:[^\r\n]+/g)).size, 4);
  assert.equal((planEvents('2027-03-07', ['mpw'], NOW).join('\n').match(/BEGIN:VEVENT/g) || []).length, 10, 'P1–P7 i A–C');
  assert.equal(planEvents('2026-11-17', ['cfa'], NOW).length, 0, 'bez bloków CFA przed 20.11 (D-116)');
  assert.equal((planEvents('2026-11-24', ['cfa'], NOW).join('\n').match(/BEGIN:VEVENT/g) || []).length, 3, 'CFA E–G równolegle z MPW');
});

test('⌘K: bloki MPW i error log MPW', () => {
  const idx = buildIndex({ mpwErrors: [{ id: 'e1', temat: '[TEST] próg wezwania', rodzaj: 'pośpiech' }] }, '2026-11-17');
  assert.ok(search(idx, 'kodeks cywilny zdolnosc prawna').some(x => x.kind === 'mpw' && x.href === '#/mpw?v=dzien&d=2026-11-20'));
  assert.ok(search(idx, 'powtorka calego materialu').some(x => x.kind === 'mpw' && x.href === '#/mpw?v=dzien&d=2027-03-06'));
  assert.ok(search(idx, 'prog wezwania').some(x => x.kind === 'mpwerr' && x.href === '#/mpw?v=log'));
  assert.ok(search(idx, 'mpw').some(x => x.kind === 'mod'));
});

test('Synchronizacja plikiem: postęp i error log MPW między urządzeniami (format 2027-sync bez zmian), import idempotentny', async () => {
  const phone = await new Store(new MemoryAdapter()).open(), mac = await new Store(new MemoryAdapter()).open();
  await phone.recordMany([['mpw.done', { block: 1, done: true }], ['mpw.err.put', { id: 'e_p', data: { egz: 'MPW', temat: '[TEST] A' } }]]);
  await mac.record('mpw.done', { block: 2, done: true });
  const rt = o => JSON.parse(JSON.stringify(o));
  const file = rt(await exportBundle(phone));
  assert.deepEqual(Object.keys(file).sort(), ['count', 'device', 'events', 'exportedAt', 'format', 'schema', 'sha256']);
  await apply(mac, await preview(mac, file));
  await apply(phone, await preview(phone, rt(await exportBundle(mac))));
  assert.deepEqual([[...phone.state.mpwDone].sort(), [...mac.state.mpwDone].sort()], [[1, 2], [1, 2]]);
  assert.deepEqual(mac.state.mpwErrors.map(e => e.temat), ['[TEST] A']);
  assert.equal((await preview(mac, file)).fresh.length, 0);
});

test('B6 (audyt 23.10.2026): czas nauki MPW dnia z godzin bloków — czwartki od 07.01 o 16:00, symulacje, P1–P7', () => {
  const s = d => mpwDaySpan(mpwByDay[d]);
  assert.deepEqual(s('2026-11-20').all, { n: 3, from: '15:30', to: '18:23', min: 159 }, 'zwykły dzień: A–C od 15:30');
  assert.equal(s('2026-11-20').sim, null);
  assert.deepEqual(s('2027-01-07').all, { n: 3, from: '16:00', to: '18:53', min: 159 }, 'czwartek od 07.01: od 16:00 (D-097)');
  assert.deepEqual([s('2027-02-21').sim, s('2027-02-21').rest], [{ n: 3, from: '16:40', to: '19:40', min: 180 }, null], 'symulacja 180 min (D-120: 16:40–19:40)');
  assert.deepEqual([s('2027-03-06').rest.from, s('2027-03-06').rest.to, s('2027-03-06').rest.n, s('2027-03-06').sim.from], ['08:00', '22:53', 7, '13:30'], 'P1–P7 (P7 o 22:00) i symulacja 13:30');
  assert.deepEqual(mpwDaySpan([]), { all: null, sim: null, rest: null });
  for (const [d, bl] of Object.entries(mpwByDay)) assert.equal(s(d).all.from, bl.map(b => b.godz.slice(0, 5)).sort()[0], d);
});
