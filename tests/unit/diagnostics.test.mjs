// Diagnostyka danych (I8): kontrole tylko do odczytu na fikcyjnych zdarzeniach.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { diagnose } from '../../src/core/calc/diagnostics.js';
import { SRC } from '../../src/core/data.js';

const open = async () => new Store(new MemoryAdapter()).open();
const by = (list, id) => list.find(x => x.id === id);

test('diagnostyka: pusty dziennik — bez ostrzeżeń (poza brakiem stanów)', async () => {
  const s = await open();
  const d = diagnose(s.state, { today: '2026-10-05' });
  assert.equal(d.filter(x => x.level === 'warn').length, 0);
  assert.equal(by(d, 'unknown').level, 'info');
});

test('diagnostyka: ujemny stan, stara inwentaryzacja, blok CFA z przyszłą datą, kwarantanna, serie sprzed startu', async () => {
  const s = await open();
  const futureBlock = SRC.cfa.D.bloki.find(b => b.data > '2026-10-05');
  await s.recordMany([
    ['inv.count', { prod: 'banan', qty: 10, date: '2026-10-04' }],          // zużycie z planu > stan -> ujemny
    ['inv.count', { prod: 'kefir', qty: 5000, date: '2026-09-10' }],        // ponad 14 dni bez inwentaryzacji
    ['cfa.done', { block: futureBlock.nr, done: true }],
    ['train.set', { date: '2026-09-21', ex: 'x_test', set: 1, done: true }],
  ]);
  const d = diagnose(s.state, { today: '2026-10-05', quarantined: 2, cloud: { config: {}, pending: 3, lastSync: null } });
  assert.equal(by(d, 'neg').level, 'warn');
  assert.match(by(d, 'neg').detail, /Banan/);
  assert.equal(by(d, 'stale').level, 'info');
  assert.match(by(d, 'stale').detail, /Kefir/);
  assert.equal(by(d, 'cfa-future').level, 'warn');
  assert.equal(by(d, 'quarantine').level, 'warn');
  assert.equal(by(d, 'pre-start').level, 'info');
  assert.equal(by(d, 'cloud').level, 'warn');
  assert.equal(s.events.size, 4, 'diagnostyka niczego nie zapisuje');
});
