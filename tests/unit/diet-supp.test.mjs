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
  const mon = scheduleFor('2026-10-05');
  assert.deepEqual(mon.map(g => g.time), ['07:00', '09:00', '10:30', '13:20', '17:15', '20:15', '21:00', '22:00']);
  assert.deepEqual(mon[0].doses.map(d => d.name), ['Chondroityna']);
  assert.deepEqual(scheduleFor('2026-10-08')[0].doses.map(d => d.name), ['Chondroityna', 'Cynk']);
  assert.deepEqual(scheduleFor('2026-09-28'), [], 'poza planem — przed Dniem zero (D-088, D-097)');
  assert.deepEqual(scheduleFor('2026-09-29'), [], 'Dzień zero — bez suplementów (D-097)');
  assert.deepEqual(scheduleFor('2026-09-30')[0].doses.map(d => d.name), ['Chondroityna'], 'pierwszy dzień suplementów czasowych (D-097)');
  assert.ok(scheduleFor('2026-09-30').find(g => g.time === '17:15').doses.some(d => d.name === 'Tauryna'), 'D-014');
  assert.ok(scheduleFor('2027-03-28').find(g => g.time === '07:00'), '28.03.2027 — ostatni dzień chondroityny (D-097)');
  assert.deepEqual(scheduleFor('2027-03-29'), [], 'po końcu planu (28.03.2027) — brak dawek');
});

test('D-097: w czwartki od 07.01.2027 suplementy przed sauną o 17:45 zamiast 17:15 (obiad i bloki MPW +30 min)', () => {
  const at = (d, t) => scheduleFor(d).find(g => g.time === t)?.doses.map(x => x.name) ?? [];
  assert.deepEqual(at('2027-01-07', '17:15'), []);
  assert.deepEqual(at('2027-01-07', '17:45'), at('2027-01-06', '17:15'), 'te same preparaty co w inne dni');
  assert.deepEqual(at('2026-12-31', '17:15'), at('2027-01-06', '17:15'), 'czwartek do 06.01 — 17:15');
  assert.deepEqual(at('2027-01-08', '17:15'), at('2027-01-06', '17:15'), 'piątek od 07.01 — 17:15');
  assert.deepEqual(at('2027-01-08', '17:45'), []);
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
  assert.deepEqual([chon.validity.from, chon.validity.until], ['2026-09-30', '2027-03-28']);
  assert.equal(supplementOverview('2026-09-29').find(x => x.id === 'chondroityna').active, false);
  assert.equal(supplementOverview('2026-09-29').find(x => x.id === 'chondroityna').daily, 0);
  assert.equal(supplementOverview('2027-03-28').find(x => x.id === 'chondroityna').active, true);
  assert.equal(supplementOverview('2027-03-29').find(x => x.id === 'chondroityna').active, false);
  // D-097: czwartkowa dawka 17:45 od 07.01 nie czyni tauryny preparatem czasowym; godziny bez powtórzeń
  const taur = o.find(x => x.id === 'tauryna');
  assert.deepEqual([taur.validity, taur.active, taur.times], [null, true, ['17:15']]);
  assert.deepEqual(supplementOverview('2027-01-07').find(x => x.id === 'tauryna').times, ['17:15', '17:45']);
  assert.equal(o.find(x => x.id === 'witamina_c').times.length, 3);
});
