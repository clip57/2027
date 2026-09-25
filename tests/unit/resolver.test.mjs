import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDay, phaseFor, templateFor, dayPlan } from '../../src/core/resolver.js';
import { SRC } from '../../src/core/data.js';
import { range } from '../../src/core/dates.js';

// Od 21.09 — kilka dni przed startem planu (CFA 25.09.2026, Faza 0 26.09.2026 — D-086, D-087) — do końca suplementów i dalej
const ALL = [...range('2026-09-21', '2027-03-31')];
const START = '2026-09-25';
const EXC = SRC.week.exceptions;

test('fazy kalendarzowe D-017 (F0 od 26.09.2026 — D-087; F1 i F2 bez zmian)', () => {
  assert.equal(phaseFor('2026-09-21'), null);
  assert.equal(phaseFor('2026-09-25'), null);
  assert.equal(phaseFor('2026-09-26'), 0);
  assert.equal(phaseFor('2026-10-11'), 0);
  assert.equal(phaseFor('2026-10-12'), 1);
  assert.equal(phaseFor('2026-11-15'), 1);
  assert.equal(phaseFor('2026-11-16'), 2);
});

test('każdy dzień 21.09.2026–31.03.2027: sloty z godzinami szablonu — 34, soboty 33 (D-004, D-086, D-087)', () => {
  for (const d of ALL) {
    const r = resolveDay(d);
    const sat = r.weekday === 6 && !SRC.cfa.D.mockCFA.includes(d);
    assert.equal(r.slots.length, sat ? 33 : 34, d);
    assert.equal(r.slots.map(s => `${s.from}-${s.to}`).join(), templateFor(d).map(s => `${s.from}-${s.to}`).join(), d);
  }
});

test('typy dni i dieta T/NT (D-018)', () => {
  const exp = { 1: ['strength_sauna', 'T'], 2: ['strength', 'T'], 3: ['cardio_sauna', 'T'], 4: ['rest_sauna2', 'NT'], 5: ['strength', 'T'], 6: ['strength_sauna', 'T'], 7: ['swim', 'T'] };
  for (const d of ALL) {
    const r = resolveDay(d);
    if (EXC[d]?.dayType) assert.deepEqual([r.dayType, r.dietVariant], [EXC[d].dayType, EXC[d].diet || exp[r.weekday][1]], d);   // D-087
    else assert.deepEqual([r.dayType, r.dietVariant], exp[r.weekday], d);
  }
});

test('kcal dnia = RAZEM z właściwego PDF', () => {
  assert.equal(resolveDay('2026-09-28').kcal, 2629); // pn F0 T
  assert.equal(resolveDay('2026-09-21').kcal, 2629); // przed startem planu: jadłospis Fazy 0 (jak dotąd)
  assert.equal(resolveDay('2026-09-24').kcal, 2332); // czw F0 NT
  assert.equal(resolveDay('2026-10-12').kcal, 2784); // pn F1 T
  assert.equal(resolveDay('2026-11-19').kcal, 2668); // czw F2 NT
  assert.equal(resolveDay('2026-11-16').kcal, 2965); // pn F2 T
});

test('slot sauny: czwartek i dni bez sauny = „Wolne” (D-018)', () => {
  const sauna = d => resolveDay(d).slots.find(s => s.id === 'slot.1945').title;
  assert.equal(sauna('2026-09-21'), 'Sauna');
  assert.equal(sauna('2026-09-22'), 'Wolne');
  assert.equal(sauna('2026-09-23'), 'Sauna');
  assert.equal(sauna('2026-09-24'), 'Wolne');
  assert.equal(sauna('2026-09-27'), 'Wolne');
});

test('posiłek 20:15: czwartek „Posiłek po saunie”, 114 kcal; dni T 230 kcal', () => {
  const post = d => resolveDay(d).slots.find(s => s.id === 'slot.2015');
  assert.equal(post('2026-09-24').mealName, 'Posiłek po saunie');
  assert.equal(post('2026-09-24').kcal, 114);
  assert.equal(post('2026-09-21').kcal, 230);
});

test('suplementy: tauryna codziennie (D-014), cynk czw+nd, D-015 25.09.2026–21.03.2027 (D-087)', () => {
  for (const d of ALL) {
    const r = resolveDay(d);
    const s = r.doses.map(x => x.supp);
    assert.ok(s.includes('tauryna'), d);
    assert.equal(s.includes('cynk'), r.weekday === 4 || r.weekday === 7, d);
    const on = d >= START && d <= '2027-03-21';
    for (const t of ['boswellia', 'glukozamina']) assert.equal(s.includes(t), on, `${t} ${d}`);
    assert.equal(s.filter(x => x === 'chondroityna').length, on ? 2 : 0, d);
    assert.equal(s.filter(x => x === 'witamina_c').length, 3, d);
  }
});

test('suplementy przypięte do slotów wg godziny', () => {
  const r = resolveDay('2026-09-28');
  const at = id => r.slots.find(s => s.id === id).doses.map(d => d.supp).sort().join();
  assert.equal(at('slot.0853'), 'boswellia,d3_k2,omega3,witamina_c');
  assert.equal(at('slot.1010'), 'l_teanina');
  assert.equal(at('slot.1213'), '');
  assert.equal(at('slot.1220'), '');
  assert.equal(at('slot.1313'), 'glukozamina,witamina_c');
  assert.equal(at('slot.1640'), 'kolagen,tauryna,witamina_c');
  assert.equal(at('slot.2200'), 'glicyna,magnez_glicynian,melatonina');
  const total = r.slots.reduce((n, s) => n + s.doses.length, 0);
  assert.equal(total, r.doses.length, 'każda dawka w dokładnie jednym slocie');
});

test('CFA: 9 bloków dziennie, soboty 8 (bez E, zakupy), 25.09 — 4; mock w A–E, F wolne (D-019, D-036, D-086, D-087)', () => {
  for (const d of ALL) {
    const r = resolveDay(d);
    const mock = SRC.cfa.D.mockCFA.includes(d), sat = r.weekday === 6 && !mock;
    const cfaSlots = r.slots.filter(s => s.role === 'cfa');
    assert.deepEqual(cfaSlots.map(s => s.from), ['08:00', '09:10', '10:10', '11:20', '12:20', '13:30', '14:30', '15:30', '16:40'].filter(t => !sat || t !== '12:20'), d);
    const n = cfaSlots.reduce((a, s) => a + s.cfa.length, 0);
    if (d === START) assert.equal(n, 4, d);
    else if (d > START && d <= '2026-11-11') assert.equal(n, sat ? 8 : 9, d); else assert.equal(n, 0, d);
    if (d < START) assert.ok(cfaSlots.every(s => s.title === 'Brak bloku CFA'), d);
    if (SRC.cfa.D.mockCFA.includes(d)) {
      assert.deepEqual(cfaSlots.slice(0, 4).map(s => s.title), ['Mock CFA — sesja 1', 'Mock CFA — sesja 1', 'Mock CFA — sesja 2', 'Mock CFA — sesja 2']);
      // E (12:20–13:13) = kontynuacja sesji 2 do 13:00 (D-086), F wolne (D-036)
      assert.deepEqual(cfaSlots.slice(4, 6).map(s => [s.title, s.desc]), [['Mock CFA — sesja 2', 'Kontynuacja sesji (10:45–13:00)'], ['Wolne', 'Dzień mocka — brak bloku w planie (D-036)']]);
      assert.deepEqual(cfaSlots.slice(6).map(s => s.title), ['CFA blok G', 'CFA blok H', 'CFA blok I']);
    } else if (d === START) {
      assert.deepEqual(cfaSlots.map(s => s.title), ['Wolne', 'Wolne', 'Wolne', 'Wolne', 'Wolne', 'CFA blok F', 'CFA blok G', 'CFA blok H', 'CFA blok I']);
    } else if (d > START && d <= '2026-11-11') {
      assert.deepEqual(cfaSlots.map(s => s.title), [...(sat ? 'ABCDFGHI' : 'ABCDEFGHI')].map(l => `CFA blok ${l}`), d);
    }
  }
});

test('CFA: każdy blok w slocie o godzinach z planu (D-086); sesje mocka w pierwszym slocie sesji', () => {
  let placed = 0;
  for (const d of range(START, '2026-11-11')) {
    const r = resolveDay(d);
    for (const s of r.slots.filter(x => x.role === 'cfa')) for (const b of s.cfa) {
      placed++;
      if (b.blok.startsWith('S')) assert.equal(s.id, b.blok === 'S1' ? 'slot.0800' : 'slot.1010', `${d} ${b.nr}`);
      else assert.equal(b.godz, `${s.from}–${s.to}`, `${d} ${b.nr}`);
    }
    assert.deepEqual(r.cfa.blocks.map(b => b.nr), SRC.cfa.D.bloki.filter(b => b.data === d).map(b => b.nr), d);
  }
  assert.equal(placed, SRC.cfa.D.bloki.length, 'wszystkie 432 bloki w planie dnia');
});

test('posiłki i suplementy w dniu mocka bez zmian godzin (D-019)', () => {
  const a = resolveDay('2026-10-26'), b = resolveDay('2026-10-19');
  const meals = r => r.slots.filter(s => s.role === 'meal').map(s => `${s.from}:${s.kcal}`).join();
  assert.equal(meals(a), meals(b));
  assert.deepEqual(a.doses.map(d => d.time + d.supp), b.doses.map(d => d.time + d.supp));
});

test('recall: brak w pt i sob, przed 25.09 i po 11.11; 34 sesje w planie (D-086)', () => {
  let n = 0;
  for (const d of ALL) {
    const r = resolveDay(d); if (r.cfa.recall) n++;
    if (r.weekday === 5 || r.weekday === 6 || d < START || d > '2026-11-11') assert.equal(r.cfa.recall, false, d);
  }
  assert.equal(n, 34);
  assert.equal(n, SRC.cfa.D.stat.recall);
});

test('trening: liczba serii wg fazy', () => {
  const s = d => resolveDay(d).training.reduce((a, e) => a + e.seriesToday, 0);
  assert.equal(s('2026-09-28'), 10); // UPPER 1 F0
  assert.equal(s('2026-10-12'), 18); // UPPER 1 F1
  assert.equal(s('2026-11-16'), 26); // UPPER 1 F2
  assert.equal(resolveDay('2026-09-24').training, null);
});

// --- Poprawki po teście akceptacyjnym (D-038, D-039, D-040, D-001)
import { cfaSourceLine } from '../../src/core/resolver.js';
const SUPP_WORDS = /chondroityn|cynk|boswelli|d3|omega|askorbinian|witamina c|l-teanin|glukozamin|kolagen|tauryn|kreatyn|glicyn|magnez|melatonin/i;

test('D-001: żaden widoczny podpunkt slotu nie powtarza suplementów (wszystkie dni)', () => {
  for (const d of ALL) for (const s of resolveDay(d).slots)
    for (const i of s.items) assert.ok(!SUPP_WORDS.test(i.text), `${d} ${s.from}: „${i.text}”`);
});

test('D-038: pomiar wagi i ciśnienia', () => {
  const t = resolveDay('2026-09-22').slots[0].items.map(i => i.text);
  assert.ok(t.includes('Pomiar wagi i ciśnienia na czczo po toalecie.'));
  assert.ok(!t.includes('Pomiar wagi na czczo po toalecie.'));
});

test('D-040: nazwa treningu w nagłówku dnia', () => {
  const exp = ['UPPER 1 + sauna', 'LOWER 1', 'Rower + ABS + sauna', 'Bez treningu, 2 × sauna', 'UPPER 2', 'LOWER 2 + sauna', 'Basen'];
  [...range('2026-10-05', '2026-10-11')].forEach((d, i) => assert.equal(resolveDay(d).sessionLabel, exp[i], d));
  assert.deepEqual(['25', '26', '27'].map(d => resolveDay(`2026-09-${d}`).sessionLabel), ['Bez treningu', 'LOWER 2 + sauna', 'Bez treningu, 2 × sauna']); // D-087
});

test('D-039: linia źródła bloku CFA', () => {
  const a = resolveDay('2026-09-25').slots.find(s => s.id === 'slot.1330').cfa[0];   // pierwszy blok planu: 25.09, 13:30 (D-087)
  assert.equal(cfaSourceLine(a), 'Curriculum 2026 Vol 1 (QM), s. 3–13 (11 s.)');
});

test('podpunkty posiłków: nazwa i kcal z właściwej fazy i wariantu', () => {
  const lunch = d => resolveDay(d).slots.find(s => s.id === 'slot.1313').items.find(i => i.kind === 'meal');
  assert.equal(lunch('2026-09-28').kcal, 465);
  assert.ok(lunch('2026-10-12').kcal > 465, 'Faza 1: większa porcja makaronu');
  const post = resolveDay('2026-09-24').slots.find(s => s.id === 'slot.2015').items[0];
  assert.deepEqual([post.text, post.kcal], ['Posiłek po saunie (20:15)', 114]);
});
