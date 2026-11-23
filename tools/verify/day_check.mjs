// D-120: kontrola planu dnia po decyzjach o godzinach nauki — każdy dzień planu (resolveDay): ciągłość doby 07:00–23:00 (bez dziur i nakładek),
// każdy blok CFA i MPW w dokładnie jednym slocie o swojej godzinie, karta „Teraz” w każdej minucie bloku wskazuje blok, kolacja nie w trakcie bloku,
// każda dawka w jakimś slocie. Użycie: node tools/verify/day_check.mjs [od] [do] — kod wyjścia 1 przy błędzie.
import { resolveDay, PLAN_START, PLAN_END } from '../../src/core/resolver.js';
import { cfaByDay, mpwByDay } from '../../src/core/data.js';
import { addDays } from '../../src/core/dates.js';

const from = process.argv[2] || '2026-11-23', to = process.argv[3] || PLAN_END;
const m = t => +t.slice(0, 2) * 60 + +t.slice(3, 5), hm = n => `${String(n / 60 | 0).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const errs = {}, info = {}, add = (o, k, d) => (o[k] ||= []).push(d);
let days = 0;
for (let d = from < PLAN_START ? PLAN_START : from; d <= to; d = addDays(d, 1)) {
  const r = resolveDay(d); if (r.outside) continue; days++;
  const sl = r.slots.filter(s => s.from !== '23:00');
  // ciągłość
  let cur = m('07:00');
  for (const s of sl) {
    if (m(s.from) > cur) add(errs, `dziura ${hm(cur)}–${s.from} (przed „${s.title}”)`, d);
    if (m(s.from) < cur) add(errs, `nakładka od ${s.from} („${s.title}”)`, d);
    cur = Math.max(cur, m(s.to));
  }
  if (cur !== m('23:00')) add(errs, `koniec dnia ${hm(cur)} ≠ 23:00`, d);
  // bloki: slot o godzinie bloku, „Teraz”
  const now = t => { let c = null; for (const s of r.slots) if (s.from <= t && (s.to > s.from ? t < s.to : true)) c = s; return c; };
  const carriers = b => r.slots.filter(s => (s.cfa || []).includes(b) || s.mpw === b || (s.role === 'cfa' && !s.mpw && !(s.cfa || []).length && !s.block && /MPW/.test(s.title) && s.from < b.godz.slice(6) && s.to > b.godz.slice(0, 5)));
  for (const [P, b] of [...(cfaByDay[d] || []).map(b => ['CFA', b]), ...(mpwByDay[d] || []).map(b => ['MPW', b])]) {
    const c = carriers(b);
    if (!c.length) { if (!r.slots.some(s => s.block && (s.desc || '').includes(`blok ${b.blok} ${b.godz}`))) add(errs, `${P} ${b.blok} ${b.godz} bez slotu`, d); else add(info, `${P} ${b.blok} w godzinach zjazdu (pierwszeństwo zjazdu, bez zmian)`, d); continue; }
    for (let t = m(b.godz.slice(0, 5)); t < m(b.godz.slice(6)); t++) if (!c.includes(now(hm(t)))) { add(errs, `„Teraz” o ${hm(t)} pokazuje „${now(hm(t))?.title}” zamiast ${P} ${b.blok}`, d); break; }
  }
  // kolacja
  const sup = r.slots.filter(s => s.meal === 'supper');
  if (sup.length !== 1) add(errs, `kolacja w ${sup.length} slotach`, d);
  for (const s of sup) {
    const hit = [...(cfaByDay[d] || []), ...(mpwByDay[d] || [])].filter(b => b.godz.slice(0, 5) < s.to && b.godz.slice(6) > s.from);
    if (hit.length) add(errs, `kolacja ${s.from}–${s.to} w trakcie bloku ${hit.map(b => b.blok).join(', ')}`, d);
    add(info, `kolacja ${s.from}–${s.to} („${s.title}”)`, d);
  }
  // dawki
  const inSlot = r.slots.flatMap(s => s.doses || []);
  for (const x of r.doses) if (!inSlot.includes(x)) add(errs, `dawka ${x.time} ${x.supp} poza slotami`, d);
}
const comp = ds => ds.length > 6 ? `${ds.length} dni: ${ds.slice(0, 3).join(', ')} … ${ds.at(-1)}` : ds.join(', ');
console.log(`Dni sprawdzone: ${days} (${from}–${to})`);
for (const [k, ds] of Object.entries(info)) console.log(`  INFO   ${k} — ${comp(ds)}`);
for (const [k, ds] of Object.entries(errs)) console.log(`  BŁĄD   ${k} — ${comp(ds)}`);
console.log(`\nBŁĘDÓW: ${Object.keys(errs).length}`);
process.exit(Object.keys(errs).length ? 1 : 0);
