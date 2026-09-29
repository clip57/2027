// I3: tydzień zgodny z resolverem dnia dla 12 kolejnych tygodni (od tygodnia startu planu).
import test from 'node:test';
import assert from 'node:assert/strict';
import { weekSummary, mondayOf } from '../../src/core/calc/week.js';
import { resolveDay } from '../../src/core/resolver.js';
import { SRC, mpwByDay } from '../../src/core/data.js';
import { addDays } from '../../src/core/dates.js';

test('Tydzień = 7 dni od poniedziałku, każdy dzień zgodny z resolveDay (28 tygodni)', () => {
  let monday = mondayOf('2026-09-25');
  assert.equal(monday, '2026-09-21');
  for (let w = 0; w < 28; w++, monday = addDays(monday, 7)) {   // do końca marca 2027 (weekendy D-096)
    const week = weekSummary(addDays(monday, 3));
    assert.equal(week.length, 7);
    week.forEach((x, i) => {
      const r = resolveDay(addDays(monday, i));
      assert.equal(x.date, r.date);
      assert.deepEqual([x.training, x.diet, x.kcal, x.cfa, x.recall, x.mock, x.outside], [r.sessionLabel, r.dietVariant, r.kcal, r.cfa.blocks.length, r.cfa.recall, r.cfa.isMock, r.outside], x.date);
      // D-097: zakupy w czwartki (19:05 do 06.01, 15:30 od 07.01), bez zakupów w tygodniu 28.09–04.10 i poza planem; soboty bez zakupów
      const exp = r.weekday !== 4 || r.outside || x.date === '2026-10-01' || r.cfa.isMock ? null : x.date >= '2027-01-07' ? '15:30' : '19:05';
      assert.equal(x.shopping, exp, `${x.date}: zakupy w czwartek (D-097)`);
      assert.equal(x.zero, x.date === '2026-09-29', x.date);
      assert.equal(x.blocks, r.blocks?.short || null, `${x.date}: weekendowe bloki (D-096)`);
    });
  }
  const first = weekSummary('2026-09-29');
  assert.deepEqual(first.map(x => x.outside), [true, true, false, false, false, false, false], 'D-088, D-097: 28.09 poza planem, 29.09 Dzień zero');
  assert.deepEqual(first.map(x => x.zero), [false, true, false, false, false, false, false]);
  const last = weekSummary('2027-03-28');
  assert.deepEqual(last.map(x => x.outside), [false, false, false, false, false, false, false], '22–28.03 w planie (koniec 28.03)');
  assert.ok(weekSummary('2027-03-29').every(x => x.outside), 'od 29.03 poza planem');
});
