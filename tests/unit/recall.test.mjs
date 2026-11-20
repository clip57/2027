// I11: sesje recall 22:00 — liczba zgodna z planem CFA, zapis przez `setting` (bez nowego typu zdarzenia).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { recallDays, recallKey, recallStats, recallDone } from '../../src/core/calc/recall.js';
import { resolveDay } from '../../src/core/resolver.js';
import { SRC } from '../../src/core/data.js';
import { addDays } from '../../src/core/dates.js';

test('D-116: plan CFA 2027 bez sesji recall 22:00 (nightRecall = []) — żaden dzień planu nie ma recall, slot 22:00 bez opisu sesji', () => {
  assert.deepEqual(SRC.cfa.D.nightRecall, []);
  assert.deepEqual(recallDays(), []);
  assert.equal(SRC.cfa.D.stat.recallEvening, 0);
  for (let d = SRC.cfa.D.stat.start; d <= SRC.cfa.D.stat.end; d = addDays(d, 1)) assert.equal(resolveDay(d).cfa.recall, false, d);
  assert.deepEqual(recallStats({}, '2027-01-10'), { total: 0, done: 0, due: 0, doneDue: 0 });
});

test('odhaczenie recall (I11): zdarzenie `setting`, ostatnia zmiana wygrywa — mechanizm zostaje dla dawnych zapisów', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  const [a, b] = ['2026-10-20', '2026-10-21'];
  await s.record('setting', { key: recallKey(a), value: true });
  await s.record('setting', { key: recallKey(b), value: true });
  await s.record('setting', { key: recallKey(b), value: false });
  assert.equal(recallDone(s.state.settings, a), true);
  assert.equal(recallDone(s.state.settings, b), false);
  assert.deepEqual([...s.events.values()].map(e => e.t), ['setting', 'setting', 'setting']);
  assert.equal(recallStats(s.state.settings, '2026-10-22').total, 0, 'dawne odhaczenia nie liczą się w planie 2027');
});
