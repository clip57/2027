import test from 'node:test';
import assert from 'node:assert/strict';
import { consumptionForDay } from '../../src/core/calc/consumption.js';
import { catalogById } from '../../src/core/data.js';
import { addDays } from '../../src/core/dates.js';

// D-101: kalendarz od 12.10.2026, 12–15.10 bez treningu (dieta NT), regularny przebieg od 16.10 — ogólna logika na dniach bez wyjątków (wtorek 20.10, Faza 0, dzień T)
test('dzień treningowy F0 (T) = porcje ZAPASY v31 poza decyzjami D-021 i nowymi suplementami', () => {
  const u = consumptionForDay('2026-10-20');
  for (const [id, it] of Object.entries(catalogById)) {
    if (it.daily_v31 == null) continue;
    const exp = { szczypiorek: 5, melisa: 2 }[id] ?? it.daily_v31;
    assert.ok(Math.abs((u[id] || 0) - exp) < 1e-9, `${id}: ${u[id]} ≠ ${exp}`);
  }
  assert.equal(u.chondroityna, 2); assert.equal(u.glukozamina, 1); assert.equal(u.boswellia, 1);
  assert.equal(u.cynk, undefined, 'cynk nieśledzony (D-016)');
});

test('czwartek (NT): bez kefiru, siemienia, ostropestu, kakao, wanilii, banana i 2 g cynamonu; tauryna zostaje', () => {
  const t = consumptionForDay('2026-10-20'), n = consumptionForDay('2026-10-22');   // wtorek T, czwartek NT (obie w Fazie 0)
  for (const id of ['kefir', 'siemie_lniane', 'ostropest', 'kakao', 'wanilia', 'banan']) assert.equal(n[id], undefined, id);
  assert.equal(n.cynamon, 3); assert.equal(t.cynamon, 5);
  assert.equal(n.tauryna, 2); assert.equal(n.bialko_kfd, 30); assert.equal(n.orzech_brazylijski, 4);
});

test('Faza 1 i 2: owies/makaron/ryż/chleb rosną automatycznie (D-003)', () => {
  const f0 = consumptionForDay('2026-10-27'), f1 = consumptionForDay('2026-11-17'), f2 = consumptionForDay('2026-12-15');   // wtorki: Faza 0 (do 11.11), 1 (12.11–10.12), 2 (od 11.12) — D-103
  assert.deepEqual(consumptionForDay('2026-10-20'), consumptionForDay('2026-10-27'), 'Faza 0 trwa do 11.11: wtorki 20.10 i 27.10 jednakowe');
  assert.deepEqual([f0.platki_owsiane, f0.penne, f0.ryz_parboiled, f0.chleb_zytni], [70, 70, 70, 35]);
  assert.deepEqual([f1.platki_owsiane, f1.penne, f1.ryz_parboiled, f1.chleb_zytni], [85, 85, 85, 35]);
  assert.deepEqual([f2.platki_owsiane, f2.penne, f2.ryz_parboiled, f2.chleb_zytni], [85, 100, 100, 70]);
});

test('suplementy czasowe 15.10.2026–28.03.2027 (165 dni planu; zapas 180 starcza z nadwyżką 15); dni poza planem (do 14.10 i po 28.03) — bez zużycia', () => {
  for (const d of ['2026-09-29', '2026-10-08', '2026-10-12', '2026-10-14']) { assert.equal(consumptionForDay(d).glukozamina, undefined, `${d}: dni przed 15.10 — historia, bez zużycia (D-102)`); assert.deepEqual(consumptionForDay(d), {}, d); }
  assert.equal(consumptionForDay('2026-10-15').glukozamina, 1);
  assert.equal(consumptionForDay('2027-03-28').glukozamina, 1);
  assert.equal(consumptionForDay('2027-03-29').glukozamina, undefined);
  assert.deepEqual(consumptionForDay('2027-03-29'), {}, 'po końcu planu');
  const days = []; for (let d = '2026-10-15'; d <= '2027-03-28'; d = addDays(d, 1)) days.push(consumptionForDay(d));
  assert.equal(days.length, 165);
  assert.deepEqual(['boswellia', 'chondroityna', 'glukozamina'].map(k => days.reduce((a, c) => a + (c[k] || 0), 0)), [165, 330, 165],
    '165 dni planu: 165 / 330 / 165 kapsułek (zapas 180 / 360 / 180)');
});

test('D-102, D-103: od 15.10 zużycie wg diety dnia — 15–16.10 dni nietreningowe (NT), regularny przebieg od 17.10; 03–11.11 i święta — dieta NT; 12–15.11 wg nominalnego tygodnia', () => {
  const nt = consumptionForDay('2026-10-22'), t = consumptionForDay('2026-10-20');
  assert.equal(consumptionForDay('2026-10-15').banan, undefined, '15.10 — dzień nietreningowy, bez banana');
  assert.ok(consumptionForDay('2026-10-15').platki_owsiane > 0, '15.10 — dieta jest (NT)');
  assert.equal(consumptionForDay('2026-10-15').cynamon, nt.cynamon, '15.10 — dieta NT');
  assert.equal(consumptionForDay('2026-10-16').banan, undefined, '16.10 — dzień nietreningowy (NT): treningi od 17.10 (D-103)');
  assert.equal(consumptionForDay('2026-10-23').banan, undefined, '23.10 — bez treningu (K i L w oknie treningowym): NT');
  assert.equal(consumptionForDay('2026-10-17').banan, t.banan, '17.10 — LOWER 2 (T): pierwszy trening');
  for (const d of ['2026-11-03', '2026-11-05', '2026-11-07', '2026-11-08', '2026-11-11']) assert.equal(consumptionForDay(d).banan, undefined, `${d}: NT jak w czwartek — bez banana`);
  for (const d of ['2026-11-13', '2026-11-14', '2026-11-15']) assert.ok(consumptionForDay(d).banan > 0, `${d}: nominalny trening — dieta T`);
  assert.equal(consumptionForDay('2026-11-12').banan, undefined, '12.11 — czwartek nominalnie NT');
  assert.equal(consumptionForDay('2026-10-20').cynamon, 5, 'wtorek 20.10 — dzień T (LOWER 1)');
  assert.equal(consumptionForDay('2026-12-26').banan, undefined, 'święta — dieta NT');
});
