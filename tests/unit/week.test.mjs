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
      // D-096: bez zakupów w soboty zjazdów, z blokami P1–P7 planu MPW i w święta
      const busy = SRC.week.blocks?.[x.date]?.kind === 'studia' || (mpwByDay[x.date] || []).some(b => b.blok.startsWith('P')) || SRC.week.exceptions?.[x.date]?.variant === null;
      assert.equal(x.shopping, r.weekday === 6 && !r.cfa.isMock && !r.outside && !busy, `${x.date}: zakupy w soboty (D-087, D-096)`);
      assert.equal(x.blocks, r.blocks?.short || null, `${x.date}: weekendowe bloki (D-096)`);
    });
  }
  const first = weekSummary('2026-09-25');
  assert.deepEqual(first.map(x => x.outside), [true, true, true, true, true, true, false], 'D-088, D-090: 21–26.09 poza planem');
  assert.equal(first[6].diet, 'NT');
  assert.equal(first[6].exception, 'D-087');
});
