// Integralność synchronizacji: zgodność w przód, odzyskiwanie z kwarantanny, zbieżność niezależnych zmian (NAPRAWA sync).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { exportBundle, preview, apply } from '../../src/core/sync/bundle.js';
import { stockAt } from '../../src/core/calc/inventory.js';
import { consumptionForDay } from '../../src/core/calc/consumption.js';
import { sha256 } from '../../src/core/hash.js';

const open = async (a = new MemoryAdapter()) => new Store(a).open();
const rt = o => JSON.parse(JSON.stringify(o));
const FUTURE = { id: 'x.future:1', hlc: '1790000000000:0000:dfut', dev: 'dfut', t: 'x.future', d: { note: 'nowa wersja' }, at: '2026-09-23T10:00:00Z', v: 1 };
const reseal = async f => { f.count = f.events.length; f.sha256 = await sha256(JSON.stringify([...f.events].sort((a, b) => (a.id < b.id ? -1 : 1)))); return f; };
const sync = async (from, to) => apply(to, await preview(to, rt(await exportBundle(from))));

test('zdarzenie z nowszej wersji: zostaje w bazie po otwarciu, nie trafia do kwarantanny, jest raportowane', async () => {
  const a = new MemoryAdapter();
  const s = await open(a);
  await s.record('inv.count', { prod: 'banan', qty: 240, date: '2026-09-22' });
  await a.putRaw([FUTURE]);
  const s2 = await open(a);
  assert.equal((await a.getAllEvents()).length, 2, 'nic nie zostało usunięte');
  assert.equal((await a.getQuarantine()).length, 0);
  assert.equal(s2.health.quarantined, 0);
  assert.deepEqual(s2.state.unprocessed, { count: 1, types: { 'x.future': 1 } });
  assert.equal(stockAt(s2.state.inv, 'banan', '2026-09-22'), 240, 'znane zdarzenia przetwarzane normalnie');
});

test('import pliku ze zdarzeniem z nowszej wersji: nie blokuje zapasów, zdarzenie zachowane i przekazywane dalej', async () => {
  const mac = await open();
  await mac.record('inv.count', { prod: 'banan', qty: 240, date: '2026-09-22' });
  const file = rt(await exportBundle(mac));
  file.events.push(FUTURE); await reseal(file);
  const phone = await open();
  const pv = await preview(phone, file);
  assert.equal(pv.ok, true, pv.errors.join());
  assert.equal(pv.future.count, 1);
  assert.equal(pv.file.device, mac.device);
  await apply(phone, pv);
  assert.equal(stockAt(phone.state.inv, 'banan', '2026-09-22'), 240, 'zapasy zaktualizowane mimo nieznanego zdarzenia');
  assert.ok(phone.events.has('x.future:1'), 'zdarzenie zachowane');
  const again = rt(await exportBundle(phone));
  assert.ok(again.events.some(e => e.id === 'x.future:1'), 'ponowny eksport zawiera zdarzenie (nie ginie po drodze)');
});

test('uszkodzone zdarzenie (znany typ, zła treść) nadal trafia do kwarantanny i blokuje import z czytelnym błędem', async () => {
  const phone = await open();
  const f = rt(await exportBundle(await open()));
  f.events.push({ ...FUTURE, id: 'bad:1', t: 'inv.count', d: { prod: 'banan', qty: -5, date: '2026-09-22' } });
  await reseal(f);
  const pv = await preview(phone, f);
  assert.equal(pv.ok, false);
  assert.match(pv.errors[0], /uszkodzonych/);
});

test('odzyskiwanie: zdarzenia przeniesione do kwarantanny przez starszą wersję wracają do bazy', async () => {
  const a = new MemoryAdapter();
  await open(a);
  const lost = { id: 'inv.dayshift:old1', hlc: '1790000000000:0001:dold', dev: 'dold', t: 'inv.dayshift', d: { date: '2026-09-23', dir: 1 }, at: '2026-09-23T10:00:00Z', v: 1 };
  await a.addQuarantine({ at: '2026-09-23T11:00:00Z', reason: 'nieznany typ zdarzenia: inv.dayshift', raw: lost });
  const s = await open(a);
  assert.equal(s.health.restored, 1);
  assert.ok(s.events.has(lost.id));
  assert.ok((await a.getAllEvents()).some(e => e.id === lost.id), 'zapisane trwale w bazie');
  assert.equal((await a.getQuarantine()).length, 1, 'kopia w kwarantannie nienaruszona');
  assert.equal((await open(a)).health.restored, 0, 'odzyskiwanie nie powtarza się');
});

test('synchronizacja w obu kierunkach z niezależnymi zmianami: oba urządzenia zbiegają się do tego samego stanu', async () => {
  const desk = await open(), phone = await open();
  await desk.record('inv.count', { prod: 'banan', qty: 240, date: '2026-09-22' });
  await sync(desk, phone);                                                                 // komputer -> iPhone
  assert.equal(stockAt(phone.state.inv, 'banan', '2026-09-22'), 240);
  await phone.record('inv.move', { prod: 'banan', qty: 600, date: '2026-09-23', kind: 'purchase' }); // niezależnie na iPhonie
  await desk.record('inv.move', { prod: 'banan', qty: 120, date: '2026-09-23', kind: 'purchase' });  // niezależnie na komputerze
  await sync(phone, desk);                                                                 // iPhone -> komputer
  await sync(desk, phone);                                                                 // komputer -> iPhone
  const exp = 240 + 600 + 120 - (consumptionForDay('2026-09-23').banan || 0);
  assert.equal(stockAt(desk.state.inv, 'banan', '2026-09-23'), exp, 'oba zakupy zachowane (zmiany addytywne)');
  assert.equal(stockAt(phone.state.inv, 'banan', '2026-09-23'), exp);
  assert.equal(desk.allEvents().length, phone.allEvents().length);
});

test('konflikt: dwie inwentaryzacje tego samego dnia na różnych urządzeniach — wygrywa późniejsza, identycznie na obu', async () => {
  const desk = await open(), phone = await open();
  await desk.record('inv.count', { prod: 'kefir', qty: 500, date: '2026-09-24' });
  await new Promise(r => setTimeout(r, 5));
  await phone.record('inv.count', { prod: 'kefir', qty: 300, date: '2026-09-24' });
  await sync(desk, phone); await sync(phone, desk);
  assert.equal(stockAt(desk.state.inv, 'kefir', '2026-09-24'), 300);
  assert.equal(stockAt(phone.state.inv, 'kefir', '2026-09-24'), 300);
});

test('import tego samego pliku drugi raz niczego nie dodaje (brak duplikatów)', async () => {
  const desk = await open(), phone = await open();
  await desk.record('inv.count', { prod: 'banan', qty: 240, date: '2026-09-22' });
  const f = rt(await exportBundle(desk));
  assert.equal(await apply(phone, await preview(phone, f)), 1);
  assert.equal((await preview(phone, f)).fresh.length, 0);
});

test('regresja: głęboko zagnieżdżony pakiet prywatny przechodzi walidację i nie trafia do kwarantanny', async () => {
  const deep = { format: '2027-private', schema: 1, sections: [{ id: 's', title: 't', blocks: [{ type: 'table', rows: [['a', 'b'], ['c', 'd']] }] }] };
  const a = new MemoryAdapter();
  const s = await open(a);
  await s.record('private.pack', { pack: deep });
  const s2 = await open(a);
  assert.equal(s2.health.quarantined, 0);
  assert.deepEqual(s2.state.privatePack, deep);
});

test('D-088: zdarzenia z dni przed startem planu (21–24.09) zostają w dzienniku, pliku synchronizacji i stanie po imporcie', async () => {
  const mac = await open();
  await mac.record('train.set', { date: '2026-09-21', ex: 'x_e2e', set: 1, done: true, kg: 40, reps: 8 });
  await mac.record('train.session', { date: '2026-09-22', minutes: 55 });
  await mac.record('inv.count', { prod: 'banan', qty: 240, date: '2026-09-22' });
  await mac.record('inv.move', { prod: 'banan', qty: 120, date: '2026-09-23', kind: 'purchase' });
  const file = rt(await exportBundle(mac));
  assert.equal(file.count, 4, 'eksport zawiera wszystkie zdarzenia sprzed startu');
  const phone = await open();
  const pv = await preview(phone, file);
  assert.equal(pv.ok, true, pv.errors.join());
  await apply(phone, pv);
  assert.equal(phone.events.size, 4);
  assert.deepEqual(phone.state.train, mac.state.train, 'stan treningu identyczny na obu urządzeniach');
  assert.equal(phone.state.trainSessions['2026-09-22'].minutes, 55);
  assert.equal(stockAt(phone.state.inv, 'banan', '2026-09-24'), 360, 'zakup 23.09 liczony, bez zużycia przed startem');
  assert.equal(stockAt(phone.state.inv, 'banan', '2026-09-28'), 360 - (consumptionForDay('2026-09-27').banan || 0) - consumptionForDay('2026-09-28').banan, 'odliczanie od 27.09 (D-090)');
  await apply(phone, await preview(phone, file));
  assert.equal(phone.events.size, 4, 'ponowny import idempotentny');
});
