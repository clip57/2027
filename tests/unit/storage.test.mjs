import test from 'node:test';
import assert from 'node:assert/strict';
import { Store, StorageError } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { stockAt } from '../../src/core/calc/inventory.js';

const open = async (a = new MemoryAdapter()) => new Store(a).open();

test('zapis + weryfikacja + odczyt po ponownym otwarciu (trwałość)', async () => {
  const a = new MemoryAdapter();
  const s = await open(a);
  await s.record('cfa.done', { block: 5, done: true });
  const s2 = await open(a);
  assert.ok(s2.state.cfaDone.has(5));
  assert.equal(s2.device, s.device, 'identyfikator urządzenia jest trwały');
});

test('błąd zapisu: wyjątek, stan „błąd”, brak zmiany danych, kolejne zapisy zablokowane (brak cichego trybu pamięci)', async () => {
  const a = new MemoryAdapter();
  const s = await open(a);
  a.fail.write = true;
  await assert.rejects(() => s.record('cfa.done', { block: 1, done: true }), StorageError);
  assert.equal(s.health.ok, false);
  assert.match(s.health.error, /NIE zostały zapisane/);
  assert.equal(s.state.cfaDone.has(1), false);
  a.fail.write = false;
  await assert.rejects(() => s.record('cfa.done', { block: 2, done: true }), StorageError, 'po błędzie zapis zablokowany do odświeżenia');
});

test('błąd weryfikacji odczytem jest wykrywany', async () => {
  const a = new MemoryAdapter();
  const s = await open(a);
  a.fail.verify = true;
  await assert.rejects(() => s.record('setting', { key: 'x', value: 1 }), /Weryfikacja zapisu/);
});

test('baza niedostępna: open() zgłasza błąd, zapis niemożliwy', async () => {
  const a = new MemoryAdapter(); a.fail.open = true;
  await assert.rejects(() => new Store(a).open(), StorageError);
});

test('uszkodzone zdarzenia trafiają do kwarantanny, reszta działa', async () => {
  const a = new MemoryAdapter();
  const s = await open(a);
  await s.record('cfa.done', { block: 7, done: true });
  await a.putRaw([{ id: 'bad1', t: 'cfa.done', d: { block: 9999, done: true }, hlc: 'x', dev: 'd' }, { junk: true }]);
  const s2 = await open(a);
  assert.equal(s2.health.quarantined, 2);
  assert.ok(s2.state.cfaDone.has(7));
  assert.equal((await a.getQuarantine()).length, 2);
  const s3 = await open(a);
  assert.equal(s3.health.quarantined, 0, 'kwarantanna nie powtarza się');
});

test('walidacja odrzuca niepoprawne dane przed zapisem', async () => {
  const s = await open();
  await assert.rejects(() => s.record('inv.count', { prod: 'banan', qty: -5, date: '2026-09-22' }), /niepoprawna treść/);
  await assert.rejects(() => s.record('cat.upsert', { item: { id: 'banan', name: 'x', unit: 'g' } }), /niepoprawna/);
  await assert.rejects(() => s.record('nieznany', {}), /nieznany typ/);
});

test('LWW: późniejsza zmiana wygrywa, poprzednia zostaje w historii', async () => {
  const s = await open();
  await s.record('cfa.done', { block: 3, done: true });
  await s.record('cfa.done', { block: 3, done: false });
  assert.equal(s.state.cfaDone.has(3), false);
  assert.equal(s.state.superseded.length, 1);
});

test('recordMany (B8): te same zdarzenia co kolejne record(), jedna transakcja, jedno przeliczenie; błąd odrzuca całość', async () => {
  const a = new MemoryAdapter();
  const s = await new Store(a).open();
  let puts = 0, emits = 0;
  const put = a.putEvents.bind(a); a.putEvents = async l => { puts++; return put(l); };
  s.on(() => emits++);
  const evs = await s.recordMany([['inv.count', { prod: 'banan', qty: 240, date: '2026-09-26' }], ['inv.move', { prod: 'banan', qty: 120, date: '2026-09-26', kind: 'purchase' }]]);
  assert.equal(evs.length, 2);
  assert.deepEqual([puts, emits], [1, 1]);
  assert.ok(evs[0].hlc < evs[1].hlc, 'kolejność HLC jak przy kolejnych zapisach');
  assert.equal((await a.getAllEvents()).length, 2);
  const seq = await new Store(new MemoryAdapter()).open();
  for (const [t, d] of evs.map(e => [e.t, e.d])) await seq.record(t, d);
  for (const d of ['2026-09-26', '2026-09-30']) assert.equal(stockAt(s.state.inv, 'banan', d), stockAt(seq.state.inv, 'banan', d), d);
  await assert.rejects(() => s.recordMany([['inv.count', { prod: 'kefir', qty: 1, date: '2026-09-26' }], ['inv.count', { prod: 'kefir', qty: -1, date: '2026-09-26' }]]), /niepoprawne/);
  assert.equal(s.events.size, 2, 'nic nie zapisano przy błędzie jednej treści');
  assert.deepEqual(await s.recordMany([]), []);
});
