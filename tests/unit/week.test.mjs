// I3: tydzień zgodny z resolverem dnia dla 12 kolejnych tygodni (od tygodnia startu planu).
import test from 'node:test';
import assert from 'node:assert/strict';
import { weekSummary, mondayOf } from '../../src/core/calc/week.js';
import { resolveDay } from '../../src/core/resolver.js';
import { addDays } from '../../src/core/dates.js';

test('Tydzień = 7 dni od poniedziałku, każdy dzień zgodny z resolveDay (58 tygodni — od Dnia zero 23.11.2026 do końca planu 31.12.2027, D-117, D-121)', () => {
  let monday = mondayOf('2026-11-25');
  assert.equal(monday, '2026-11-23');
  for (let w = 0; w < 58; w++, monday = addDays(monday, 7)) {   // do 02.01.2028 (koniec planu 31.12.2027 — D-117)
    const week = weekSummary(addDays(monday, 3));
    assert.equal(week.length, 7);
    week.forEach((x, i) => {
      const r = resolveDay(addDays(monday, i));
      assert.equal(x.date, r.date);
      assert.deepEqual([x.training, x.diet, x.kcal, x.cfa, x.recall, x.mock, x.outside], [r.sessionLabel, r.dietVariant, r.kcal, r.cfa.blocks.length, r.cfa.recall, r.cfa.isMock, r.outside], x.date);
      // D-097: zakupy w czwartki (19:05 do 06.01, 15:30 07.01–18.03, od 25.03 znów 19:05 — D-116); bez zakupów poza planem; soboty bez zakupów
      const exp = r.weekday !== 4 || r.outside || r.cfa.isMock || ['2026-12-24', '2026-12-31'].includes(x.date) ? null : x.date >= '2027-01-07' && x.date <= '2027-03-18' ? '15:30' : '19:05';   // D-121: 24.12 bez treningu i sauny; D-109: 31.12 bez zakupów
      assert.equal(x.shopping, exp, `${x.date}: zakupy w czwartek (D-097)`);
      assert.equal(x.zero, x.date === '2026-11-23', `${x.date}: Dzień zero tylko 23.11.2026 (D-121)`);
      assert.equal(!!x.noDiet, !!r.noDiet, x.date);
      assert.equal(x.blocks, r.blocks?.short || null, `${x.date}: weekendowe bloki (D-096)`);
    });
  }
  const first = weekSummary('2026-11-25');
  assert.deepEqual(weekSummary('2026-11-18').map(x => x.outside), Array(7).fill(true), 'D-121: tydzień 16–22.11 — przed początkiem planu (ukryty)');
  assert.deepEqual(first.map(x => x.outside), Array(7).fill(false), 'plan od Dnia zero 23.11');
  assert.deepEqual(first.map(x => x.training), ['Dzień zero', 'LOWER 1', 'Rower + ABS + sauna', 'Bez treningu, 2 × sauna', 'UPPER 2', 'LOWER 2 + sauna', 'Basen'], '23.11 Dzień zero, od 24.11 tydzień nominalny');
  assert.deepEqual(first.map(x => !!x.noDiet), [true, false, false, false, false, false, false], 'Dzień zero bez diety');
  assert.deepEqual(weekSummary('2026-12-10').map(x => x.training), ['UPPER 1 + sauna', 'LOWER 1', 'Rower + ABS + sauna', 'Bez treningu, 2 × sauna', 'UPPER 2', 'Bez treningu', 'Basen'], 'D-121: 12.12 bez treningu (LOWER 2 odwołany)');
  assert.deepEqual(weekSummary('2026-12-10').map(x => x.diet), ['T', 'T', 'T', 'NT', 'T', 'NT', 'T']);
  assert.deepEqual(weekSummary('2026-12-24').map(x => x.training), ['UPPER 1 + sauna', 'LOWER 1', 'Rower + ABS + sauna', 'Bez treningu', 'Bez treningu', 'Bez treningu', 'Bez treningu'], 'D-121: 24.12 bez sauny; święta bez treningu');
  const last = weekSummary('2027-03-28');
  assert.deepEqual(last.map(x => x.outside), [false, false, false, false, false, false, false], '22–28.03 w planie');
  assert.ok(weekSummary('2027-03-29').every(x => !x.outside), 'od 29.03 dalej w planie (D-116)');
  assert.ok(weekSummary('2027-06-30').every(x => !x.outside), 'lipiec 2027 w planie (D-117)');
  assert.deepEqual(weekSummary('2027-12-31').map(x => x.outside), [false, false, false, false, false, true, true], 'koniec planu 31.12.2027 (D-117)');
});
