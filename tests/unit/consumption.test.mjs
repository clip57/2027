import test from 'node:test';
import assert from 'node:assert/strict';
import { consumptionForDay } from '../../src/core/calc/consumption.js';
import { catalogById } from '../../src/core/data.js';
import { addDays } from '../../src/core/dates.js';

// D-121: plan od Dnia zero 23.11.2026 (bez diety i suplementów), dieta od 24.11 — ogólna logika na dniach bez wyjątków (wtorek 24.11, Faza 0, dzień T)
test('dzień treningowy F0 (T) = porcje ZAPASY v31 poza decyzjami D-021 i nowymi suplementami', () => {
  const u = consumptionForDay('2026-11-24');
  for (const [id, it] of Object.entries(catalogById)) {
    if (it.daily_v31 == null) continue;
    const exp = { szczypiorek: 5, melisa: 2 }[id] ?? it.daily_v31;
    assert.ok(Math.abs((u[id] || 0) - exp) < 1e-9, `${id}: ${u[id]} ≠ ${exp}`);
  }
  assert.equal(u.chondroityna, 2); assert.equal(u.glukozamina, 1); assert.equal(u.boswellia, 1);
  assert.equal(u.cynk, undefined, 'cynk nieśledzony (D-016)');
});

test('czwartek (NT): bez kefiru, siemienia, ostropestu, kakao, wanilii, banana i 2 g cynamonu; tauryna zostaje', () => {
  const t = consumptionForDay('2026-11-24'), n = consumptionForDay('2026-11-26');   // wtorek T, czwartek NT (obie w Fazie 0)
  for (const id of ['kefir', 'siemie_lniane', 'ostropest', 'kakao', 'wanilia', 'banan']) assert.equal(n[id], undefined, id);
  assert.equal(n.cynamon, 3); assert.equal(t.cynamon, 5);
  assert.equal(n.tauryna, 2); assert.equal(n.bialko_kfd, 30); assert.equal(n.orzech_brazylijski, 4);
});

test('Faza 1 i 2: owies/makaron/ryż/chleb rosną automatycznie (D-003)', () => {
  const f0 = consumptionForDay('2026-12-01'), f1 = consumptionForDay('2026-12-08'), f2 = consumptionForDay('2027-01-12');   // wtorki: Faza 0 (do 06.12), 1 (07.12–10.01), 2 (od 11.01) — D-121
  assert.deepEqual(consumptionForDay('2026-11-24'), consumptionForDay('2026-12-01'), 'Faza 0 trwa do 06.12: wtorki 24.11 i 01.12 jednakowe');
  assert.deepEqual([f0.platki_owsiane, f0.penne, f0.ryz_parboiled, f0.chleb_zytni], [70, 70, 70, 35]);
  assert.deepEqual([f1.platki_owsiane, f1.penne, f1.ryz_parboiled, f1.chleb_zytni], [85, 85, 85, 35]);
  assert.deepEqual([f2.platki_owsiane, f2.penne, f2.ryz_parboiled, f2.chleb_zytni], [85, 100, 100, 70]);
});

test('suplementy czasowe 24.11.2026–30.04.2027 (D-121: 158 dni); Dzień zero 23.11 i dni wcześniejsze — bez zużycia', () => {
  for (const d of ['2026-09-29', '2026-10-18', '2026-11-20', '2026-11-22', '2026-11-23']) { assert.equal(consumptionForDay(d).glukozamina, undefined, `${d}: bez zużycia (D-121)`); assert.deepEqual(consumptionForDay(d), {}, d); }
  assert.equal(consumptionForDay('2026-11-24').glukozamina, 1);
  assert.equal(consumptionForDay('2027-04-30').glukozamina, 1);
  assert.equal(consumptionForDay('2027-05-01').glukozamina, undefined, 'D-121: od 01.05.2027 bez chondroityny, boswellii i glukozaminy');
  assert.ok(consumptionForDay('2027-12-31').platki_owsiane > 0, 'plan diety do 31.12.2027');
  assert.deepEqual(consumptionForDay('2028-01-01'), {}, 'po końcu planu');
  const days = []; for (let d = '2026-11-24'; d <= '2027-12-31'; d = addDays(d, 1)) days.push(consumptionForDay(d));
  assert.equal(days.length, 403);
  assert.deepEqual(['boswellia', 'chondroityna', 'glukozamina'].map(k => days.reduce((a, c) => a + (c[k] || 0), 0)), [158, 316, 158],
    '158 dni (24.11–30.04): 158 / 316 / 158 kapsułek');
});

test('D-121: od 24.11 zużycie wg diety dnia — 12.12 i 24.12 dni nietreningowe (NT); święta — dieta NT', () => {
  const nt = consumptionForDay('2026-11-26'), t = consumptionForDay('2026-11-24');
  assert.ok(consumptionForDay('2026-11-24').platki_owsiane > 0, '24.11 — pierwszy dzień diety (T)');
  for (const d of ['2026-12-12', '2026-12-24']) {
    assert.equal(consumptionForDay(d).banan, undefined, `${d}: bez treningu (D-121) — dieta NT, bez banana`);
    assert.equal(consumptionForDay(d).cynamon, nt.cynamon, `${d} — dieta NT`);
  }
  assert.equal(consumptionForDay('2026-11-29').banan, t.banan, '29.11 — niedziela z basenem (T)');
  assert.ok(consumptionForDay('2026-12-05').banan > 0, '05.12 — sobota LOWER 2: dieta T');
  assert.equal(consumptionForDay('2026-12-26').banan, undefined, 'święta — dieta NT');
});
