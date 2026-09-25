import test from 'node:test';
import assert from 'node:assert/strict';
import { dietSummary, phaseDiff } from '../../src/core/calc/diet.js';
import { scheduleFor, supplementOverview } from '../../src/core/calc/supplements.js';

test('zestawienie diety zgodne z PDF (sumy, procenty, metoda)', () => {
  const s = dietSummary(0, 'T');
  assert.equal(s.total.kcal, 2629);
  assert.equal(s.atwater, 2535.6);
  assert.equal(s.kcalGap, 93.4);
  assert.deepEqual(s.pct, { p: 30.1, c: 42.3, f: 27.7 });
  assert.equal(s.meals.length, 7);
  assert.equal(s.meals.find(m => m.id === 'breakfast').total.kcal, 629);
  assert.equal(s.spices.length, 18);
  assert.equal(s.optional.length, 10);
  assert.equal(dietSummary(2, 'NT').meals.find(m => m.id === 'post').name, 'Posiłek po saunie');
});

test('różnice między fazami: tylko gramatury węglowodanów', () => {
  const d01 = phaseDiff('T', 0, 1).map(x => `${x.name} ${x.from}→${x.to}`);
  assert.deepEqual(d01, ['Płatki owsiane zwykłe 70→85', 'Makaron penne pełnoziarnisty 70→85', 'Ryż biały parboiled 70→85']);
  const d12 = phaseDiff('T', 1, 2).map(x => x.name);
  assert.deepEqual(d12, ['Makaron penne pełnoziarnisty', 'Ryż biały parboiled', 'Chleb żytni na zakwasie bez drożdży']);
  assert.equal(phaseDiff('NT', 0, 0).length, 0);
});

test('plan suplementów: godziny, czwartek, niedziela, koniec zapasu', () => {
  const mon = scheduleFor('2026-09-28');
  assert.deepEqual(mon.map(g => g.time), ['07:00', '09:00', '10:30', '13:20', '17:15', '20:15', '21:00', '22:00']);
  assert.deepEqual(mon[0].doses.map(d => d.name), ['Chondroityna']);
  assert.deepEqual(scheduleFor('2026-10-01')[0].doses.map(d => d.name), ['Chondroityna', 'Cynk']);
  assert.deepEqual(scheduleFor('2026-09-24')[0].doses.map(d => d.name), ['Cynk'], 'suplementy czasowe dopiero od 25.09.2026 (D-086)');
  assert.deepEqual(scheduleFor('2026-09-25')[0].doses.map(d => d.name), ['Chondroityna'], 'pierwszy dzień suplementów czasowych');
  assert.ok(scheduleFor('2026-09-24').find(g => g.time === '17:15').doses.some(d => d.name === 'Tauryna'), 'D-014');
  assert.ok(scheduleFor('2027-03-25').find(g => g.time === '07:00'), '25.03.2027 — ostatni dzień chondroityny (D-086)');
  assert.equal(scheduleFor('2027-03-26').find(g => g.time === '07:00'), undefined, 'po 25.03.2027 brak porannej chondroityny');
});

test('przegląd preparatów: częstotliwość, okres, śledzenie stanu', () => {
  const o = supplementOverview('2026-10-01');
  const cynk = o.find(x => x.id === 'cynk');
  assert.deepEqual(cynk.weekdays, [4, 7]);
  assert.equal(cynk.tracked, false); // D-016
  assert.equal(cynk.daily, 1);
  const chon = o.find(x => x.id === 'chondroityna');
  assert.equal(chon.daily, 2);
  assert.deepEqual(chon.times, ['07:00', '21:00']);
  assert.deepEqual([chon.validity.from, chon.validity.until], ['2026-09-25', '2027-03-25']);
  assert.equal(supplementOverview('2026-09-24').find(x => x.id === 'chondroityna').active, false);
  assert.equal(supplementOverview('2026-09-24').find(x => x.id === 'chondroityna').daily, 0);
  assert.equal(supplementOverview('2027-03-25').find(x => x.id === 'chondroityna').active, true);
  assert.equal(supplementOverview('2027-03-26').find(x => x.id === 'chondroityna').active, false);
  assert.equal(o.find(x => x.id === 'witamina_c').times.length, 3);
});
