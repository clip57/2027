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
      // D-097: zakupy w czwartki (19:05 do 06.01, 15:30 od 07.01), także w pierwszy czwartek planu 08.10 (D-100); bez zakupów poza planem; soboty bez zakupów
      const exp = r.weekday !== 4 || r.outside || r.cfa.isMock || ['2026-11-05', '2026-12-24'].includes(x.date) ? null : ['2026-10-22', '2026-10-29'].includes(x.date) ? '17:45' : x.date >= '2027-01-07' ? '15:30' : '19:05';   // D-101: 05.11 bez zakupów; D-103: 22 i 29.10 zakupy 17:45, 24.12 bez zakupów
      assert.equal(x.shopping, exp, `${x.date}: zakupy w czwartek (D-097)`);
      assert.equal(x.zero, false, `${x.date}: Dzień zero usunięty z kalendarza (D-100)`);
      assert.equal(!!x.noDiet, !!r.noDiet, x.date);
      assert.equal(x.blocks, r.blocks?.short || null, `${x.date}: weekendowe bloki (D-096)`);
    });
  }
  const first = weekSummary('2026-10-12');
  assert.deepEqual(first.map(x => x.outside), [true, true, true, false, false, false, false], 'D-102: plan od czwartku 15.10 — 12–14.10 historia');
  assert.deepEqual(weekSummary('2026-10-08').map(x => x.outside), [true, true, true, true, true, true, true], 'tydzień 05–11.10 — przed początkiem planu');
  assert.deepEqual(first.map(x => x.training), ['Poza planem', 'Poza planem', 'Poza planem', 'Bez treningu', 'Bez treningu', 'LOWER 2', 'Basen'], '15–16.10 bez treningu, treningi od 17.10 (D-103)');
  assert.deepEqual(first.slice(3).map(x => x.diet), ['NT', 'NT', 'T', 'T']);
  assert.deepEqual(first.map(x => !!x.noDiet), [false, false, false, false, false, false, false]);
  assert.deepEqual(weekSummary('2026-10-19').map(x => x.training), ['UPPER 1', 'LOWER 1', 'Rower + ABS', 'Bez treningu', 'Bez treningu', 'LOWER 2', 'Basen'], '19–25.10: bez sauny w dni z blokiem M, czwartek bez sauny, 23.10 bez treningu (D-103)');
  assert.deepEqual(weekSummary('2026-11-03').map(x => x.training), ['UPPER 1', ...Array(6).fill('Bez treningu')], '02–08.11: poniedziałek jeszcze z treningiem, od 03.11 przerwa');
  assert.deepEqual(weekSummary('2026-11-12').map(x => x.training), ['Bez treningu', 'Bez treningu', 'Bez treningu', 'Bez treningu, 2 × sauna', 'UPPER 2', 'LOWER 2 + sauna', 'Basen'], '09–15.11: do 11.11 przerwa, od 12.11 nominalny tydzień');
  const last = weekSummary('2027-03-28');
  assert.deepEqual(last.map(x => x.outside), [false, false, false, false, false, false, false], '22–28.03 w planie (koniec 28.03)');
  assert.ok(weekSummary('2027-03-29').every(x => x.outside), 'od 29.03 poza planem');
});
