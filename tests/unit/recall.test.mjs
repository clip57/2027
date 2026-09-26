// I11: sesje recall 22:00 — liczba zgodna z planem CFA, zapis przez `setting` (bez nowego typu zdarzenia).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { recallDays, recallKey, recallStats, recallDone } from '../../src/core/calc/recall.js';
import { resolveDay } from '../../src/core/resolver.js';
import { SRC } from '../../src/core/data.js';

test('dni recall = sesje recall z planu CFA (stat.recall) i slot 22:00 w planie dnia', () => {
  const days = recallDays();
  assert.equal(days.length, SRC.cfa.D.stat.recall);
  for (const d of days) assert.equal(resolveDay(d).cfa.recall, true, d);
  assert.ok(!days.some(d => [5, 6].includes(resolveDay(d).weekday)), 'bez piątków i sobót');
});

test('odhaczenie recall: zdarzenie `setting`, ostatnia zmiana wygrywa, statystyka do wczoraj', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  const [a, b] = recallDays();
  await s.record('setting', { key: recallKey(a), value: true });
  await s.record('setting', { key: recallKey(b), value: true });
  await s.record('setting', { key: recallKey(b), value: false });
  assert.equal(recallDone(s.state.settings, a), true);
  assert.equal(recallDone(s.state.settings, b), false);
  assert.deepEqual([...s.events.values()].map(e => e.t), ['setting', 'setting', 'setting']);
  const st = recallStats(s.state.settings, b);
  assert.deepEqual([st.done, st.due, st.doneDue, st.total], [1, recallDays().indexOf(b), 1, SRC.cfa.D.stat.recall]);
});
