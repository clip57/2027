import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDay, phaseFor } from '../../src/core/resolver.js';
import { SRC } from '../../src/core/data.js';
import { range } from '../../src/core/dates.js';

const ALL = [...range('2026-09-21', '2027-03-31')];

test('fazy kalendarzowe D-017', () => {
  assert.equal(phaseFor('2026-09-20'), null);
  assert.equal(phaseFor('2026-09-21'), 0);
  assert.equal(phaseFor('2026-10-11'), 0);
  assert.equal(phaseFor('2026-10-12'), 1);
  assert.equal(phaseFor('2026-11-15'), 1);
  assert.equal(phaseFor('2026-11-16'), 2);
});

test('każdy dzień 21.09.2026–31.03.2027: 32 sloty z godzinami szablonu (D-004)', () => {
  const tpl = SRC.dayTemplate.slots.map(s => `${s.from}-${s.to}`).join();
  for (const d of ALL) {
    const r = resolveDay(d);
    assert.equal(r.slots.length, 32, d);
    assert.equal(r.slots.map(s => `${s.from}-${s.to}`).join(), tpl, d);
  }
});

test('typy dni i dieta T/NT (D-018)', () => {
  const exp = { 1: ['strength_sauna', 'T'], 2: ['strength', 'T'], 3: ['cardio_sauna', 'T'], 4: ['rest_sauna2', 'NT'], 5: ['strength', 'T'], 6: ['strength_sauna', 'T'], 7: ['swim', 'T'] };
  for (const d of ALL) { const r = resolveDay(d); assert.deepEqual([r.dayType, r.dietVariant], exp[r.weekday], d); }
});

test('kcal dnia = RAZEM z właściwego PDF', () => {
  assert.equal(resolveDay('2026-09-21').kcal, 2629); // pn F0 T
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

test('suplementy: tauryna codziennie (D-014), cynk czw+nd, D-015 do 21.03.2027', () => {
  for (const d of ALL) {
    const r = resolveDay(d);
    const s = r.doses.map(x => x.supp);
    assert.ok(s.includes('tauryna'), d);
    assert.equal(s.includes('cynk'), r.weekday === 4 || r.weekday === 7, d);
    for (const t of ['boswellia', 'glukozamina']) assert.equal(s.includes(t), d <= '2027-03-21', `${t} ${d}`);
    assert.equal(s.filter(x => x === 'chondroityna').length, d <= '2027-03-21' ? 2 : 0, d);
    assert.equal(s.filter(x => x === 'witamina_c').length, 3, d);
  }
});

test('suplementy przypięte do slotów wg godziny', () => {
  const r = resolveDay('2026-09-21');
  const at = id => r.slots.find(s => s.id === id).doses.map(d => d.supp).sort().join();
  assert.equal(at('slot.0853'), 'boswellia,d3_k2,omega3,witamina_c');
  assert.equal(at('slot.1010'), 'l_teanina');
  assert.equal(at('slot.1213'), 'glukozamina,witamina_c');
  assert.equal(at('slot.1640'), 'kolagen,tauryna,witamina_c');
  assert.equal(at('slot.2200'), 'glicyna,magnez_glicynian,melatonina');
  const total = r.slots.reduce((n, s) => n + s.doses.length, 0);
  assert.equal(total, r.doses.length, 'każda dawka w dokładnie jednym slocie');
});

test('CFA: 8 bloków dziennie w planie, mock zastępuje A–D, E/F wolne (D-019, I-10)', () => {
  for (const d of ALL) {
    const r = resolveDay(d);
    const cfaSlots = r.slots.filter(s => s.role === 'cfa');
    const n = cfaSlots.reduce((a, s) => a + s.cfa.length, 0);
    if (d <= '2026-11-11') assert.equal(n, 8, d); else assert.equal(n, 0, d);
    if (SRC.cfa.D.mockCFA.includes(d)) {
      assert.deepEqual(cfaSlots.slice(0, 4).map(s => s.title), ['Mock CFA — sesja 1', 'Mock CFA — sesja 1', 'Mock CFA — sesja 2', 'Mock CFA — sesja 2']);
      assert.deepEqual(cfaSlots.slice(4, 6).map(s => s.title), ['Wolne', 'Wolne']);
    }
  }
});

test('posiłki i suplementy w dniu mocka bez zmian godzin (D-019)', () => {
  const a = resolveDay('2026-10-26'), b = resolveDay('2026-10-19');
  const meals = r => r.slots.filter(s => s.role === 'meal').map(s => `${s.from}:${s.kcal}`).join();
  assert.equal(meals(a), meals(b));
  assert.deepEqual(a.doses.map(d => d.time + d.supp), b.doses.map(d => d.time + d.supp));
});

test('recall: brak w pt i sob oraz po 11.11; 38 sesji w planie', () => {
  let n = 0;
  for (const d of ALL) { const r = resolveDay(d); if (r.cfa.recall) n++; if (r.weekday === 5 || r.weekday === 6) assert.equal(r.cfa.recall, false, d); }
  assert.equal(n, 38);
});

test('trening: liczba serii wg fazy', () => {
  const s = d => resolveDay(d).training.reduce((a, e) => a + e.seriesToday, 0);
  assert.equal(s('2026-09-21'), 10); // UPPER 1 F0
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
  exp.forEach((e, i) => assert.equal(resolveDay(`2026-09-${21 + i}`).sessionLabel, e));
});

test('D-039: linia źródła bloku CFA', () => {
  const a = resolveDay('2026-09-21').slots.find(s => s.id === 'slot.0800').cfa[0];
  assert.equal(cfaSourceLine(a), 'Curriculum 2026 Vol 1 (QM), s. 3–13 (11 s.)');
});

test('podpunkty posiłków: nazwa i kcal z właściwej fazy i wariantu', () => {
  const lunch = d => resolveDay(d).slots.find(s => s.id === 'slot.1213').items.find(i => i.kind === 'meal');
  assert.equal(lunch('2026-09-21').kcal, 465);
  assert.ok(lunch('2026-10-12').kcal > 465, 'Faza 1: większa porcja makaronu');
  const post = resolveDay('2026-09-24').slots.find(s => s.id === 'slot.2015').items[0];
  assert.deepEqual([post.text, post.kcal], ['Posiłek po saunie (20:15)', 114]);
});
