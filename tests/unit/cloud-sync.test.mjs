// Synchronizacja przez chmurę (D-078, Etap 1): dwa „urządzenia” (osobne bazy w pamięci) i lokalny FAŁSZYWY serwer
// zgodny z REST Supabase. Dane i konta wyłącznie fikcyjne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { exportBundle } from '../../src/core/sync/bundle.js';
import { createCloudClient, CloudError } from '../../src/core/sync/cloud-api.js';
import { setupKeys, syncOnce, forgetCloudState, META, PUSH_BATCH } from '../../src/core/sync/cloud.js';
import { MIN_ITERATIONS } from '../../src/core/sync/crypto.js';
import { fakeSupabase, memoryStorage } from './helpers/fake-supabase.mjs';

const PASS = 'fikcyjne hasło szyfrowania testu';
const EMAIL = 'test@example.invalid', PWD = 'fikcyjne-haslo-konta';
const OPT = { iterations: MIN_ITERATIONS };            // szybsze wyprowadzenie klucza w testach

async function device(srv, { email = EMAIL, password = PWD } = {}) {
  const store = await new Store(new MemoryAdapter()).open();
  const client = createCloudClient({ url: srv.url, anonKey: srv.anonKey, fetch: srv.fetch, storage: memoryStorage() });
  await client.signIn(email, password);
  const { keys } = await setupKeys(client, PASS, OPT);
  return { store, client, keys, sync: (o = {}) => syncOnce({ store, client, keys, ...o }) };
}
const ids = s => [...s.events.keys()].sort();
const stateOf = s => JSON.stringify({ ...s.state, lww: undefined, superseded: s.state.superseded.map(e => e.id).sort(),
  cfaDone: [...s.state.cfaDone].sort() }, (k, v) => (v instanceof Map ? [...v.entries()] : v));

test('dwa urządzenia: zbieżność, idempotencja, brak duplikatów', async () => {
  const srv = fakeSupabase(); srv.addUser(EMAIL, PWD);
  const A = await device(srv), B = await device(srv);
  await A.store.record('inv.count', { prod: 'banan', qty: 240, date: '2026-09-27' });
  await A.store.record('cfa.done', { block: 1, done: true });
  await B.store.record('train.set', { date: '2026-09-28', ex: 'ex.pon.1', set: 1, done: true, kg: 40, reps: 8, rir: 2 });
  const a1 = await A.sync(), b1 = await B.sync(), a2 = await A.sync();
  assert.deepEqual([a1.pushed, b1.applied, b1.pushed, a2.applied], [2, 2, 1, 1]);
  assert.deepEqual(ids(A.store), ids(B.store));
  assert.equal(stateOf(A.store), stateOf(B.store));
  assert.equal(srv.events.length, 3);
  const again = [await A.sync(), await B.sync()];                 // kolejne rundy niczego nie zmieniają
  assert.deepEqual(again.map(r => [r.applied, r.pushed]), [[0, 0], [0, 0]]);
  assert.equal(srv.events.length, 3);
});

test('serwer nie widzi treści ani identyfikatorów zdarzeń (także pakietu prywatnego)', async () => {
  const srv = fakeSupabase(); srv.addUser(EMAIL, PWD);
  const A = await device(srv);
  await A.store.record('inv.count', { prod: 'banan', qty: 240, date: '2026-09-27' });
  await A.store.record('private.pack', { pack: { format: '2027-private', sections: [{ id: 'rek-s1', title: '[DANE TESTOWE]', blocks: [{ type: 'p', text: '[DANE TESTOWE] fragment' }] }] } });
  await A.sync();
  const server = JSON.stringify([srv.events, [...srv.keys.values()]]);
  for (const s of ['banan', 'inv.count', 'private', 'DANE TESTOWE', ...ids(A.store)]) assert.ok(!server.includes(s), s);
  const B = await device(srv); await B.sync();
  assert.equal(B.store.state.privatePack.sections[0].title, '[DANE TESTOWE]');
});

test('konflikt: ta sama pozycja zmieniona na obu urządzeniach — oba wybierają późniejszą zmianę (reduce bez zmian)', async () => {
  const srv = fakeSupabase(); srv.addUser(EMAIL, PWD);
  const A = await device(srv), B = await device(srv);
  await A.store.record('setting', { key: 'shopWeekday', value: 5 });
  await new Promise(r => setTimeout(r, 5));
  await B.store.record('setting', { key: 'shopWeekday', value: 6 });   // późniejsza
  await A.sync(); await B.sync(); await A.sync();
  assert.equal(A.store.state.settings.shopWeekday, 6);
  assert.equal(B.store.state.settings.shopWeekday, 6);
  assert.equal(A.store.state.superseded.length, 1);                     // przegrana zmiana zostaje w historii
});

test('zdarzenie nieznanego typu (nowsza wersja) przechodzi przez chmurę i jest zachowane (D-056)', async () => {
  const srv = fakeSupabase(); srv.addUser(EMAIL, PWD);
  const A = await device(srv), B = await device(srv);
  const future = { id: 'x.future:t1', hlc: '1790000000000:0000:dfut', dev: 'dfut', t: 'x.future', d: { a: 1 }, at: '2026-09-28T10:00:00Z', v: 2 };
  await A.store.appendMany([future], 'test');
  await A.sync(); await B.sync();
  assert.ok(B.store.events.has('x.future:t1'));
  assert.equal(B.store.state.unprocessed.count, 1);
});

test('zapas kursora: wiersz zatwierdzony później z niższym numerem nie zostaje pominięty', async () => {
  for (const [overlap, expectSeen] of [[1000, true], [0, false]]) {
    const srv = fakeSupabase(); srv.addUser(EMAIL, PWD);
    const A = await device(srv), B = await device(srv), C = await device(srv);
    await A.store.record('cfa.done', { block: 2, done: true });
    srv.holdNextInsert(); await A.sync();                 // numer 1 nadany, transakcja jeszcze niewidoczna
    await B.store.record('cfa.done', { block: 3, done: true });
    await B.sync();                                       // numer 2 widoczny
    await C.sync({ overlap });                            // C widzi tylko numer 2 → kursor 2
    srv.release();                                        // „spóźniona” transakcja A zatwierdzona
    await C.sync({ overlap });
    assert.equal(C.store.state.cfaDone.has(2), expectSeen, `overlap=${overlap}`);
  }
});

test('nowe urządzenie: błędne hasło szyfrowania odrzucone, poprawne pobiera wszystko', async () => {
  const srv = fakeSupabase(); srv.addUser(EMAIL, PWD);
  const A = await device(srv);
  await A.store.record('cfa.done', { block: 5, done: true }); await A.sync();
  const client = createCloudClient({ url: srv.url, anonKey: srv.anonKey, fetch: srv.fetch, storage: memoryStorage() });
  await client.signIn(EMAIL, PWD);
  await assert.rejects(setupKeys(client, 'to nie jest to hasło', OPT), { code: 'bad-passphrase' });
  const B = await device(srv); await B.sync();
  assert.ok(B.store.state.cfaDone.has(5));
});

test('pierwsze urządzenia jednocześnie: jedne parametry klucza (konflikt przy zapisie obsłużony)', async () => {
  const srv = fakeSupabase(); srv.addUser(EMAIL, PWD);
  const mk = async () => { const c = createCloudClient({ url: srv.url, anonKey: srv.anonKey, fetch: srv.fetch, storage: memoryStorage() }); await c.signIn(EMAIL, PWD); return c; };
  const [c1, c2] = [await mk(), await mk()];
  const res = await Promise.all([setupKeys(c1, PASS, OPT), setupKeys(c2, PASS, OPT)]);
  assert.equal(res.filter(r => r.created).length, 1);
  assert.equal(srv.keys.size, 1);
});

test('logowanie i sesja: złe hasło konta, odświeżenie wygasłego tokenu, rotacja, wylogowanie', async () => {
  const srv = fakeSupabase(); srv.addUser(EMAIL, PWD);
  const storage = memoryStorage();
  const client = createCloudClient({ url: srv.url, anonKey: srv.anonKey, fetch: srv.fetch, storage });
  await assert.rejects(client.signIn(EMAIL, 'złe'), { code: 'bad-credentials' });
  const s1 = await client.signIn(EMAIL, PWD);
  srv.expireAll();                                              // token odrzucony przez serwer → odświeżenie i ponowienie
  assert.equal(await client.getKeyInfo(), null);
  const s2 = await storage.get('cloud.session');
  assert.notEqual(s2.refresh_token, s1.refresh_token);          // rotacja tokenu odświeżania
  await client.signOut();
  await assert.rejects(client.getKeyInfo(), { code: 'signed-out' });
});

test('RLS: inny użytkownik nie widzi cudzych wierszy; klucz anon bez tokenu nie ma dostępu', async () => {
  const srv = fakeSupabase(); srv.addUser(EMAIL, PWD); srv.addUser('drugi@example.invalid', 'inne-fikcyjne-haslo');
  const A = await device(srv);
  await A.store.record('cfa.done', { block: 7, done: true }); await A.sync();
  const other = createCloudClient({ url: srv.url, anonKey: srv.anonKey, fetch: srv.fetch, storage: memoryStorage() });
  await other.signIn('drugi@example.invalid', 'inne-fikcyjne-haslo');
  assert.deepEqual(await other.pullEvents(0, 100), []);
  assert.equal(await other.getKeyInfo(), null);
  await assert.rejects(other.pushEvents((await A.client.user()).id, [{ sid: 'x', blob: 'y' }]), { code: 'forbidden' });
  const res = await srv.fetch(`${srv.url}/rest/v1/events?select=sid`, { headers: { apikey: srv.anonKey } });
  assert.equal(res.status, 401);
});

test('kopia przed pobraniem z chmury najwyżej raz dziennie; ręczny import nadal zawsze z kopią', async () => {
  const srv = fakeSupabase(); srv.addUser(EMAIL, PWD);
  const A = await device(srv), B = await device(srv);
  const day1 = () => new Date('2026-09-28T08:00:00Z'), day2 = () => new Date('2026-09-29T08:00:00Z');
  await A.store.record('cfa.done', { block: 1, done: true }); await A.sync();
  assert.equal((await B.sync({ now: day1 })).backup, true);
  await A.store.record('cfa.done', { block: 2, done: true }); await A.sync();
  assert.equal((await B.sync({ now: day1 })).backup, false);
  await A.store.record('cfa.done', { block: 3, done: true }); await A.sync();
  assert.equal((await B.sync({ now: day2 })).backup, true);
  assert.equal((await B.store.adapter.getBackups()).length, 2);
  const before = (await B.store.adapter.getBackups()).length;
  await B.store.appendMany([{ ...B.store.makeEvent('cfa.done', { block: 9, done: true }) }], 'import pliku');
  assert.equal((await B.store.adapter.getBackups()).length, before + 1);
});

test('uszkodzony wiersz odrzucony i zgłoszony; pozostałe zastosowane; kursor przesunięty', async () => {
  const srv = fakeSupabase(); srv.addUser(EMAIL, PWD);
  const A = await device(srv), B = await device(srv);
  await A.store.record('cfa.done', { block: 1, done: true });
  await A.store.record('cfa.done', { block: 2, done: true });
  await A.sync();
  srv.events[0].blob = srv.events[0].blob.slice(0, -4) + 'AAAA';
  const r = await B.sync();
  assert.equal(r.rejected.length, 1);
  assert.equal(r.applied, 1);
  assert.equal(await B.store.adapter.getMeta(META.cursor), 2);
});

test('przerwana wysyłka wznawia się od miejsca przerwania (partie potwierdzone nie są wysyłane ponownie)', async () => {
  const srv = fakeSupabase(); srv.addUser(EMAIL, PWD);
  const A = await device(srv);
  const many = [...Array(PUSH_BATCH + 10)].map((_, i) => A.store.makeEvent('cfa.done', { block: (i % 400) + 1, done: true }));
  await A.store.appendMany(many, 'test');
  let calls = 0;
  const failing = { ...A.client, pushEvents: async (...a) => { if (++calls === 2) throw new CloudError('Brak połączenia z chmurą', 'network'); return A.client.pushEvents(...a); } };
  await assert.rejects(syncOnce({ store: A.store, client: failing, keys: A.keys }), { code: 'network' });
  assert.equal(srv.events.length, PUSH_BATCH);
  const r = await A.sync();
  assert.equal(r.pushed, 10);
  assert.equal(srv.events.length, PUSH_BATCH + 10);
});

test('ręczna synchronizacja plikiem działa obok chmury; wyłączenie chmury czyści tylko jej stan', async () => {
  const srv = fakeSupabase(); srv.addUser(EMAIL, PWD);
  const A = await device(srv), B = await device(srv);
  await A.store.record('cfa.done', { block: 4, done: true }); await A.sync(); await B.sync();
  const bundle = await exportBundle(B.store);
  assert.equal(bundle.format, '2027-sync');
  assert.ok(bundle.events.some(e => e.d?.block === 4));
  const n = B.store.events.size;
  await forgetCloudState(B.store);
  assert.equal(await B.store.adapter.getMeta(META.cursor), null);
  assert.equal(B.store.events.size, n);
  const r = await B.sync();                                   // ponowne włączenie: pełne pobranie i wysyłka bez duplikatów
  assert.deepEqual([r.applied, srv.events.length], [0, 1]);
});

test('konfiguracja: odrzuca adres inny niż https (poza localhost) i brak klucza', () => {
  assert.throws(() => createCloudClient({ url: 'http://example.com', anonKey: 'k', storage: memoryStorage() }), { code: 'bad-config' });
  assert.throws(() => createCloudClient({ url: 'https://x.supabase.co', anonKey: '', storage: memoryStorage() }), { code: 'bad-config' });
});
