import test from 'node:test';
import assert from 'node:assert/strict';
import { consumptionForDay } from '../../src/core/calc/consumption.js';
import { catalogById } from '../../src/core/data.js';
import { addDays } from '../../src/core/dates.js';

// Tydzień 28.09–04.10.2026 ma wyjątki treningu i diety (D-096) — ogólna logika na tygodniu bez wyjątków (05.10, Faza 0)
test('poniedziałek F0 (T) = porcje ZAPASY v31 poza decyzjami D-021 i nowymi suplementami', () => {
  const u = consumptionForDay('2026-10-05');
  for (const [id, it] of Object.entries(catalogById)) {
    if (it.daily_v31 == null) continue;
    const exp = { szczypiorek: 5, melisa: 2 }[id] ?? it.daily_v31;
    assert.ok(Math.abs((u[id] || 0) - exp) < 1e-9, `${id}: ${u[id]} ≠ ${exp}`);
  }
  assert.equal(u.chondroityna, 2); assert.equal(u.glukozamina, 1); assert.equal(u.boswellia, 1);
  assert.equal(u.cynk, undefined, 'cynk nieśledzony (D-016)');
});

test('czwartek (NT): bez kefiru, siemienia, ostropestu, kakao, wanilii, banana i 2 g cynamonu; tauryna zostaje', () => {
  const t = consumptionForDay('2026-10-05'), n = consumptionForDay('2026-10-08');
  for (const id of ['kefir', 'siemie_lniane', 'ostropest', 'kakao', 'wanilia', 'banan']) assert.equal(n[id], undefined, id);
  assert.equal(n.cynamon, 3); assert.equal(t.cynamon, 5);
  assert.equal(n.tauryna, 2); assert.equal(n.bialko_kfd, 30); assert.equal(n.orzech_brazylijski, 4);
});

test('Faza 1 i 2: owies/makaron/ryż/chleb rosną automatycznie (D-003)', () => {
  const f0 = consumptionForDay('2026-10-05'), f1 = consumptionForDay('2026-10-12'), f2 = consumptionForDay('2026-11-16');
  assert.deepEqual([f0.platki_owsiane, f0.penne, f0.ryz_parboiled, f0.chleb_zytni], [70, 70, 70, 35]);
  assert.deepEqual([f1.platki_owsiane, f1.penne, f1.ryz_parboiled, f1.chleb_zytni], [85, 85, 85, 35]);
  assert.deepEqual([f2.platki_owsiane, f2.penne, f2.ryz_parboiled, f2.chleb_zytni], [85, 100, 100, 70]);
});

test('suplementy czasowe 30.09.2026–28.03.2027 (D-097: 180 dni); Dzień zero 29.09 i dni poza planem — bez zużycia', () => {
  assert.equal(consumptionForDay('2026-09-29').glukozamina, undefined);
  assert.equal(consumptionForDay('2026-09-30').glukozamina, 1);
  assert.equal(consumptionForDay('2027-03-28').glukozamina, 1);
  assert.equal(consumptionForDay('2027-03-29').glukozamina, undefined);
  assert.deepEqual(consumptionForDay('2026-09-29'), {}, 'Dzień zero — bez diety i suplementów');
  assert.deepEqual(consumptionForDay('2027-03-29'), {}, 'po końcu planu');
  const days = []; for (let d = '2026-09-30'; d <= '2027-03-28'; d = addDays(d, 1)) days.push(consumptionForDay(d));
  assert.deepEqual(['boswellia', 'chondroityna', 'glukozamina'].map(k => days.reduce((a, c) => a + (c[k] || 0), 0)), [180, 360, 180],
    'zapas na 180 dni: 180 / 360 / 180 kapsułek');
});

test('D-096: tydzień 28.09–04.10 — zużycie wg diety dnia (03.10 NT, 30.09–02.10 T); od 05.10 jak w planie tygodnia', () => {
  const nt = consumptionForDay('2026-10-08'), t = consumptionForDay('2026-10-05');
  for (const d of ['2026-10-03']) assert.equal(consumptionForDay(d).banan, nt.banan, d);
  for (const d of ['2026-09-30', '2026-10-01', '2026-10-02']) assert.equal(consumptionForDay(d).banan, t.banan, d);
  assert.equal(consumptionForDay('2026-10-01').cynamon, 5, 'czwartek 01.10 — dzień T (LOWER 1)');
  assert.equal(consumptionForDay('2026-12-26').banan, undefined, 'święta — dieta NT');
});
