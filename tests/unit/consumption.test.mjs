import test from 'node:test';
import assert from 'node:assert/strict';
import { consumptionForDay } from '../../src/core/calc/consumption.js';
import { catalogById } from '../../src/core/data.js';
import { addDays } from '../../src/core/dates.js';

// D-100: kalendarz od 08.10.2026, 08.10 bez diety, dieta od 09.10, trening od 10.10 — ogólna logika na dniach bez wyjątków (wtorek 13.10, Faza 0, dzień T)
test('dzień treningowy F0 (T) = porcje ZAPASY v31 poza decyzjami D-021 i nowymi suplementami', () => {
  const u = consumptionForDay('2026-10-13');
  for (const [id, it] of Object.entries(catalogById)) {
    if (it.daily_v31 == null) continue;
    const exp = { szczypiorek: 5, melisa: 2 }[id] ?? it.daily_v31;
    assert.ok(Math.abs((u[id] || 0) - exp) < 1e-9, `${id}: ${u[id]} ≠ ${exp}`);
  }
  assert.equal(u.chondroityna, 2); assert.equal(u.glukozamina, 1); assert.equal(u.boswellia, 1);
  assert.equal(u.cynk, undefined, 'cynk nieśledzony (D-016)');
});

test('czwartek (NT): bez kefiru, siemienia, ostropestu, kakao, wanilii, banana i 2 g cynamonu; tauryna zostaje', () => {
  const t = consumptionForDay('2026-10-13'), n = consumptionForDay('2026-10-15');
  for (const id of ['kefir', 'siemie_lniane', 'ostropest', 'kakao', 'wanilia', 'banan']) assert.equal(n[id], undefined, id);
  assert.equal(n.cynamon, 3); assert.equal(t.cynamon, 5);
  assert.equal(n.tauryna, 2); assert.equal(n.bialko_kfd, 30); assert.equal(n.orzech_brazylijski, 4);
});

test('Faza 1 i 2: owies/makaron/ryż/chleb rosną automatycznie (D-003)', () => {
  const f0 = consumptionForDay('2026-10-13'), f1 = consumptionForDay('2026-10-20'), f2 = consumptionForDay('2026-11-24');   // wtorki: Faza 0, 1 (od 19.10), 2 (od 23.11)
  assert.deepEqual([f0.platki_owsiane, f0.penne, f0.ryz_parboiled, f0.chleb_zytni], [70, 70, 70, 35]);
  assert.deepEqual([f1.platki_owsiane, f1.penne, f1.ryz_parboiled, f1.chleb_zytni], [85, 85, 85, 35]);
  assert.deepEqual([f2.platki_owsiane, f2.penne, f2.ryz_parboiled, f2.chleb_zytni], [85, 100, 100, 70]);
});

test('suplementy czasowe 08.10.2026–28.03.2027 (172 dni planu; zapas 180 starcza z nadwyżką 8); dni poza planem (do 07.10 i po 28.03) — bez zużycia', () => {
  assert.equal(consumptionForDay('2026-09-29').glukozamina, undefined);
  assert.equal(consumptionForDay('2026-09-30').glukozamina, undefined, 'dni przed 08.10 usunięte z kalendarza (D-100)');
  assert.equal(consumptionForDay('2026-10-07').glukozamina, undefined);
  assert.equal(consumptionForDay('2026-10-08').glukozamina, 1);
  assert.equal(consumptionForDay('2027-03-28').glukozamina, 1);
  assert.equal(consumptionForDay('2027-03-29').glukozamina, undefined);
  assert.deepEqual(consumptionForDay('2026-10-07'), {}, 'przed startem kalendarza');
  assert.deepEqual(consumptionForDay('2027-03-29'), {}, 'po końcu planu');
  const days = []; for (let d = '2026-10-08'; d <= '2027-03-28'; d = addDays(d, 1)) days.push(consumptionForDay(d));
  assert.equal(days.length, 172);
  assert.deepEqual(['boswellia', 'chondroityna', 'glukozamina'].map(k => days.reduce((a, c) => a + (c[k] || 0), 0)), [172, 344, 172],
    '172 dni planu: 172 / 344 / 172 kapsułek (zapas 180 / 360 / 180)');
});

test('D-100: 08–09.10 bez diety (zużycie tylko suplementów i dodatków), od 10.10 zużycie wg diety dnia (10.10 T); święta i 07–11.11 — dieta NT', () => {
  const nt = consumptionForDay('2026-10-15'), t = consumptionForDay('2026-10-13'), d8 = consumptionForDay('2026-10-08');
  assert.equal(d8.banan, undefined); assert.equal(d8.platki_owsiane, undefined); assert.equal(d8.kefir, undefined);
  assert.equal(d8.glukozamina, 1, 'suplementy 08.10 jak w planie');
  assert.equal(consumptionForDay('2026-10-09').platki_owsiane, undefined, '09.10 — też bez diety (D-100)');
  assert.ok(nt.platki_owsiane > 0 && consumptionForDay('2026-10-10').platki_owsiane > 0, 'od 10.10 dieta (płatki w NT i T)');
  assert.equal(consumptionForDay('2026-10-10').banan, t.banan, '10.10 — UPPER 1 (T)');
  for (const d of ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']) assert.equal(consumptionForDay(d).banan, undefined, d);   // NT jak w czwartek: bez banana
  assert.equal(consumptionForDay('2026-10-13').cynamon, 5, 'wtorek 13.10 — dzień T (LOWER 1)');
  assert.equal(consumptionForDay('2026-12-26').banan, undefined, 'święta — dieta NT');
});
