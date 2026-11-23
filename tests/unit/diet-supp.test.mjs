import test from 'node:test';
import assert from 'node:assert/strict';
import { dietSummary, phaseDiff } from '../../src/core/calc/diet.js';
import { SRC } from '../../src/core/data.js';
import { consumptionForDay } from '../../src/core/calc/consumption.js';
import { range } from '../../src/core/dates.js';
import { scheduleFor, supplementOverview } from '../../src/core/calc/supplements.js';

test('zestawienie diety zgodne z PDF po zmianie skyru na 75 g (sumy, procenty, metoda — D-104)', () => {
  const s = dietSummary(0, 'T');
  assert.equal(s.total.kcal, 2595);
  assert.equal(s.atwater, 2504.4);
  assert.equal(s.kcalGap, 90.6);
  assert.deepEqual(s.pct, { p: 29.5, c: 42.5, f: 28.0 });
  assert.equal(s.meals.length, 7);
  assert.equal(s.meals.find(m => m.id === 'breakfast').total.kcal, 612);
  assert.equal(s.meals.find(m => m.id === 'lunch').total.kcal, 448);
  assert.equal(s.spices.length, 18);
  assert.equal(s.optional.length, 10);
  assert.equal(dietSummary(2, 'NT').meals.find(m => m.id === 'post').name, 'Posiłek po saunie');
});

test('D-104: skyr 75 g w śniadaniu i lunchu we wszystkich 6 planach; sumy pozycji → posiłku → planu → Atwater → procenty przeliczone; zużycie 150 g dziennie; Zapasy 12 dni = 1800 g', () => {
  const near = (a, b, m) => assert.ok(Math.abs(a - b) < 0.051, `${m}: ${a} ≠ ${b}`);
  const KCAL = { T0: 2595, T1: 2750, T2: 2931, NT0: 2298, NT1: 2453, NT2: 2634 };   // było 2629 / 2784 / 2965 / 2332 / 2487 / 2668 (−34 kcal = 2 × 17 kcal skyru)
  assert.equal(SRC.diet.plans.length, 6);
  for (const p of SRC.diet.plans) {
    const tag = `${p.variant}${p.phase}`, skyr = p.meals.flatMap(m => m.items.filter(i => i.prod === 'skyr').map(i => [m.id, i]));
    assert.deepEqual(skyr.map(([id]) => id), ['breakfast', 'lunch'], tag);
    for (const [, i] of skyr) assert.deepEqual([i.label, i.use.qty, i.kcal, i.p, i.c, i.f], ['75', 75, 50, 9, 2.9, 0], `${tag}: skyr 75 g = 0,75 × (67 kcal, B 12,0, W 3,8, T 0)`);
    for (const m of p.meals) for (const k of ['kcal', 'p', 'c', 'f']) near(m.items.reduce((a, i) => a + i[k], 0), m.total[k], `${tag} ${m.id} ${k}`);
    for (const k of ['kcal', 'p', 'c', 'f']) near(p.meals.reduce((a, m) => a + m.total[k], 0), p.total[k], `${tag} razem ${k}`);
    const t = p.total, at = 4 * t.p + 4 * t.c + 9 * t.f;
    near(at, p.atwater_kcal, `${tag} Atwater`);
    near(100 * 4 * t.p / at, p.pct.p, `${tag} % B`); near(100 * 4 * t.c / at, p.pct.c, `${tag} % W`); near(100 * 9 * t.f / at, p.pct.f, `${tag} % T`);
    assert.equal(t.kcal, KCAL[tag], tag);
  }
  assert.deepEqual([...range('2026-11-24', '2026-11-30')].map(d => consumptionForDay(d).skyr), [150, 150, 150, 150, 150, 150, 150], 'skyr 150 g dziennie (75 + 75), także w dniach NT');
  const c = SRC.catalog.items.find(x => x.id === 'skyr');
  assert.deepEqual([c.daily_v31, c.maxLimit, c.packSize, c.note], [150, 1800, 400, '75 g Śniad. + 75 g Lunch'], 'Zapasy: 12 dni × 150 g, opakowanie 400 g bez zmian');
  assert.equal(c.maxLimit, 12 * c.daily_v31);
});

test('różnice między fazami: tylko gramatury węglowodanów', () => {
  const d01 = phaseDiff('T', 0, 1).map(x => `${x.name} ${x.from}→${x.to}`);
  assert.deepEqual(d01, ['Płatki owsiane zwykłe 70→85', 'Makaron penne pełnoziarnisty 70→85', 'Ryż biały parboiled 70→85']);
  const d12 = phaseDiff('T', 1, 2).map(x => x.name);
  assert.deepEqual(d12, ['Makaron penne pełnoziarnisty', 'Ryż biały parboiled', 'Chleb żytni na zakwasie bez drożdży']);
  assert.equal(phaseDiff('NT', 0, 0).length, 0);
});

test('plan suplementów: godziny, czwartek, niedziela, koniec zapasu', () => {
  const mon = scheduleFor('2027-01-04');   // poniedziałek treningowy z blokiem J (plan CFA 2027, D-116): kreatyna z posiłkiem 20:15, chondroityna z kolacją 20:50 (D-099)
  assert.deepEqual(mon.map(g => g.time), ['07:00', '09:00', '10:30', '13:20', '17:15', '20:15', '20:50', '22:00']);
  assert.deepEqual(scheduleFor('2026-11-24').map(g => g.time), ['07:00', '09:00', '10:30', '13:20', '17:15', '20:15', '21:00', '22:00'], '24.11 — pierwszy dzień suplementacji (D-121)');
  assert.deepEqual(scheduleFor('2026-11-27').map(g => g.time), ['07:00', '09:00', '10:30', '13:20', '17:15', '20:15', '21:00', '22:00']);
  assert.deepEqual(scheduleFor('2026-11-23'), [], '23.11 — Dzień zero: bez suplementów (D-121)');
  assert.deepEqual(scheduleFor('2026-12-06').map(g => g.time), ['07:00', '09:00', '10:30', '13:20', '17:15', '19:30', '21:00', '22:00'], 'niedziela z basenem: kreatyna 19:30');
  assert.ok(scheduleFor('2026-11-26').some(g => g.time === '20:15'), 'czwartek: kreatyna z posiłkiem 20:15');
  assert.deepEqual(mon[0].doses.map(d => d.name), ['Chondroityna']);
  assert.deepEqual(scheduleFor('2026-11-26')[0].doses.map(d => d.name), ['Chondroityna', 'Cynk'], 'czwartek: chondroityna + cynk');
  for (const d of ['2026-09-29', '2026-10-18', '2026-11-20', '2026-11-22']) assert.deepEqual(scheduleFor(d), [], `${d}: przed startem planu — bez dawek (D-121)`);
  assert.deepEqual(scheduleFor('2026-12-06')[0].doses.map(d => d.name), ['Chondroityna', 'Cynk'], 'niedziela: chondroityna + cynk');
  assert.ok(scheduleFor('2026-11-24').find(g => g.time === '17:15').doses.some(d => d.name === 'Tauryna'), 'D-014');
  assert.deepEqual(scheduleFor('2026-12-12').map(g => g.time), ['07:00', '09:00', '10:30', '13:20', '17:15', '20:15', '21:00', '22:00'], 'sobota 12.12 bez treningu (D-121): kreatyna z posiłkiem 20:15');
  assert.ok(scheduleFor('2027-04-30').find(g => g.time === '07:00'), '30.04.2027 — ostatni dzień chondroityny (D-121; wcześniej 31.12.2027 — D-117)');
  assert.equal(scheduleFor('2027-05-01').find(g => g.time === '07:00'), undefined, '01.05.2027 — bez chondroityny (D-121)');
  assert.ok(!scheduleFor('2027-05-01').flatMap(g => g.doses).some(d => ['boswellia', 'glukozamina', 'chondroityna'].includes(d.supp)), 'od 01.05 bez boswellii i glukozaminy');
  assert.ok(scheduleFor('2027-03-29').length > 0, '29.03.2027 — plan przedłużony (D-116)');
  assert.ok(scheduleFor('2027-07-01').length > 0, '01.07.2027 — plan przedłużony (D-117)');
  assert.deepEqual(scheduleFor('2028-01-01'), [], 'po końcu planu (31.12.2027) — brak dawek');
});

test('D-097: w czwartki od 07.01.2027 suplementy przed sauną o 17:45 zamiast 17:15 (obiad i bloki MPW +30 min)', () => {
  const at = (d, t) => scheduleFor(d).find(g => g.time === t)?.doses.map(x => x.name) ?? [];
  assert.deepEqual(at('2027-01-07', '17:15'), []);
  assert.deepEqual(at('2027-01-07', '17:45'), at('2027-01-06', '17:15'), 'te same preparaty co w inne dni');
  assert.deepEqual(at('2026-12-31', '17:15'), at('2027-01-06', '17:15'), 'czwartek do 06.01 — 17:15');
  assert.deepEqual(at('2027-01-08', '17:15'), at('2027-01-06', '17:15'), 'piątek od 07.01 — 17:15');
  assert.deepEqual(at('2027-01-08', '17:45'), []);
  // D-116: 17:45 tylko do ostatniego czwartku planu MPW (18.03); od 25.03 czwartek jak w tygodniu bazowym — 17:15
  assert.deepEqual(at('2027-03-18', '17:45'), at('2027-01-06', '17:15'));
  assert.deepEqual([at('2027-03-25', '17:45'), at('2027-03-25', '17:15')], [[], at('2027-01-06', '17:15')], '25.03 — 17:15');
  assert.deepEqual([at('2027-06-24', '17:45'), at('2027-06-24', '17:15')], [[], at('2027-01-06', '17:15')], 'czerwiec — 17:15');
});

test('przegląd preparatów: częstotliwość, okres, śledzenie stanu', () => {
  const o = supplementOverview('2026-11-26');   // czwartek bez bloku J
  const cynk = o.find(x => x.id === 'cynk');
  assert.deepEqual(cynk.weekdays, [4, 7]);
  assert.equal(cynk.tracked, false); // D-016
  assert.equal(cynk.daily, 1);
  const chon = o.find(x => x.id === 'chondroityna');
  assert.equal(chon.daily, 2);
  assert.deepEqual(chon.times, ['07:00', '21:00']);
  assert.deepEqual([chon.validity.from, chon.validity.until], ['2026-11-24', '2027-04-30'], 'D-121');
  assert.deepEqual(supplementOverview('2027-01-04').find(x => x.id === 'chondroityna').times, ['07:00', '20:50'], 'dzień z blokiem J (D-099)');
  assert.equal(supplementOverview('2026-11-23').find(x => x.id === 'chondroityna').active, false);
  assert.equal(supplementOverview('2026-11-23').find(x => x.id === 'chondroityna').daily, 0);
  assert.equal(supplementOverview('2027-04-30').find(x => x.id === 'chondroityna').active, true);
  assert.equal(supplementOverview('2027-05-01').find(x => x.id === 'chondroityna').active, false, 'D-121: do 30.04.2027');
  assert.equal(supplementOverview('2028-01-01').find(x => x.id === 'chondroityna').active, false);
  // D-097: czwartkowa dawka 17:45 od 07.01 nie czyni tauryny preparatem czasowym; godziny bez powtórzeń
  const taur = o.find(x => x.id === 'tauryna');
  assert.deepEqual([taur.validity, taur.active, taur.times], [null, true, ['17:15']]);
  assert.deepEqual(supplementOverview('2027-01-07').find(x => x.id === 'tauryna').times, ['17:15', '17:45']);
  assert.equal(o.find(x => x.id === 'witamina_c').times.length, 3);
});
