// Synchronizacja przez chmurę — warstwa urządzenia (D-078, Etap 2): konfiguracja wpisana lokalnie, logowanie, hasło
// szyfrowania, „Synchronizuj teraz”, błędy sieci i sesji. Lokalny FAŁSZYWY serwer; adresy, klucze i konta fikcyjne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { exportBundle } from '../../src/core/sync/bundle.js';
import { CloudError } from '../../src/core/sync/cloud-api.js';
import { META } from '../../src/core/sync/cloud.js';
import { MIN_ITERATIONS } from '../../src/core/sync/crypto.js';
import { LOCAL, checkConfig, saveConfig, loadConfig, cloudStatus, signIn, unlock, signOut, resetDevice, syncNow,
  describeError, describeResult } from '../../src/core/sync/cloud-local.js';
import { fakeSupabase } from './helpers/fake-supabase.mjs';

const KEY = 'sb_publishable_TESTOWYklucz0000';                 // fikcyjny
const PASS = 'fikcyjne hasło szyfrowania testu';
const EMAIL = 'test@example.invalid', PWD = 'fikcyjne-haslo-konta';
const IT = { iterations: MIN_ITERATIONS };
const fakeJwt = payload => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'podpis'].join('.');

function server() { const srv = fakeSupabase({ anonKey: KEY }); srv.addUser(EMAIL, PWD); return srv; }
async function device(srv, { adapter = new MemoryAdapter() } = {}) {
  const store = await new Store(adapter).open();
  return { store, adapter, deps: { fetch: srv.fetch } };
}
async function ready(srv, D, { first = false } = {}) {
  await saveConfig(D.store, { url: srv.url, key: KEY });
  await signIn(D.store, { email: EMAIL, password: PWD }, D.deps);
  return unlock(D.store, { passphrase: PASS, confirm: first ? PASS : undefined, ...IT }, D.deps);
}
const metaDump = a => JSON.stringify([...a.meta.entries()]);

test('konfiguracja: Publishable Key i adres projektu; klucze sekretne odrzucane', () => {
  assert.deepEqual(checkConfig({ url: ' https://abcd1234.supabase.co/ ', key: ` ${KEY} ` }), { url: 'https://abcd1234.supabase.co', key: KEY });
  assert.equal(checkConfig({ url: 'abcd1234.supabase.co', key: KEY }).url, 'https://abcd1234.supabase.co');
  assert.equal(checkConfig({ url: 'https://abcd1234.supabase.co/rest/v1', key: KEY }).url, 'https://abcd1234.supabase.co');
  assert.equal(checkConfig({ url: 'http://localhost:54321', key: KEY }).url, 'http://localhost:54321');
  assert.equal(checkConfig({ url: 'https://x.supabase.co', key: fakeJwt({ role: 'anon' }) }).key.split('.').length, 3);   // starszy klucz anon
  assert.throws(() => checkConfig({ url: 'https://x.supabase.co', key: 'sb_secret_TESTOWYklucz0000' }), { code: 'secret-key' });
  assert.throws(() => checkConfig({ url: 'https://x.supabase.co', key: fakeJwt({ role: 'service_role' }) }), { code: 'secret-key' });
  assert.throws(() => checkConfig({ url: 'https://x.supabase.co', key: 'cokolwiek' }), { code: 'bad-config' });
  assert.throws(() => checkConfig({ url: 'http://x.supabase.co', key: KEY }), { code: 'bad-config' });
  assert.throws(() => checkConfig({ url: 'https://x.supabase.co/sciezka', key: KEY }), { code: 'bad-config' });
  assert.throws(() => checkConfig({ url: '', key: KEY }), { code: 'bad-config' });
});

test('pełny przebieg na dwóch urządzeniach: konfiguracja → logowanie → hasło → synchronizacja', async () => {
  const srv = server();
  const A = await device(srv), B = await device(srv);
  assert.equal((await cloudStatus(A.store)).step, 'config');
  await saveConfig(A.store, { url: srv.url, key: KEY });
  assert.equal((await cloudStatus(A.store)).step, 'login');
  await assert.rejects(signIn(A.store, { email: EMAIL, password: 'złe hasło' }, A.deps), { code: 'bad-credentials' });
  await assert.rejects(signIn(A.store, { email: '', password: '' }, A.deps), { code: 'missing' });
  await signIn(A.store, { email: EMAIL, password: PWD }, A.deps);
  assert.equal((await cloudStatus(A.store)).step, 'unlock');
  // pierwsze urządzenie: wymagane powtórzenie hasła (literówka byłaby nieodwracalna)
  await assert.rejects(unlock(A.store, { passphrase: PASS, ...IT }, A.deps), { code: 'need-confirm' });
  await assert.rejects(unlock(A.store, { passphrase: PASS, confirm: PASS + 'x', ...IT }, A.deps), { code: 'confirm-mismatch' });
  assert.equal(srv.keys.size, 0);
  assert.deepEqual(await unlock(A.store, { passphrase: PASS, confirm: PASS, ...IT }, A.deps), { created: true, persistent: true });
  await A.store.record('inv.count', { prod: 'banan', qty: 240, date: '2026-09-27' });
  let st = await cloudStatus(A.store);
  assert.equal(st.step, 'ready'); assert.equal(st.pending, 1); assert.equal(st.user.email, EMAIL);
  const r = await syncNow(A.store, A.deps);
  assert.deepEqual([r.pushed, r.applied], [1, 0]);
  st = await cloudStatus(A.store);
  assert.equal(st.pending, 0); assert.ok(st.lastSync);

  // drugie urządzenie: bez powtórzenia, błędne hasło szyfrowania wykryte weryfikatorem
  await saveConfig(B.store, { url: srv.url, key: KEY });
  await signIn(B.store, { email: EMAIL, password: PWD }, B.deps);
  await assert.rejects(unlock(B.store, { passphrase: 'zupełnie inne hasło', ...IT }, B.deps), { code: 'bad-passphrase' });
  assert.equal((await cloudStatus(B.store)).step, 'unlock');
  assert.equal((await unlock(B.store, { passphrase: PASS, ...IT }, B.deps)).created, false);
  const rb = await syncNow(B.store, B.deps);
  assert.equal(rb.applied, 1);
  assert.deepEqual([...B.store.events.keys()], [...A.store.events.keys()]);
  assert.match(describeResult(rb), /Pobrane z chmury: 1/);
  assert.match(describeResult({ applied: 0, pushed: 0, rejected: [] }), /wszystko aktualne/);
});

test('klucze i sesja przetrwają ponowne uruchomienie; hasło nie jest nigdzie zapisane; nic nie trafia do 2027-sync.json', async () => {
  const srv = server();
  const A = await device(srv);
  await ready(srv, A, { first: true });
  await A.store.record('cfa.done', { block: 3, done: true });
  // „ponowne uruchomienie”: nowy Store na tej samej bazie
  const again = await new Store(A.adapter).open();
  const st = await cloudStatus(again);
  assert.equal(st.step, 'ready'); assert.equal(st.persistentKeys, true);
  assert.equal((await syncNow(again, A.deps)).pushed, 1);
  const k = await A.adapter.getMeta(LOCAL.keys);
  assert.equal(k.enc.extractable, false); assert.equal(k.mac.extractable, false);
  assert.ok(!metaDump(A.adapter).includes(PASS) && !metaDump(A.adapter).includes(PWD));
  const bundle = JSON.stringify(await exportBundle(again));
  for (const s of [KEY, 'cloud.', srv.url, 'refresh_token', 'access_token']) assert.ok(!bundle.includes(s), s);
});

test('wylogowanie usuwa sesję i klucze (kursor zostaje); inne konto zeruje stan synchronizacji', async () => {
  const srv = server(); srv.addUser('drugi@example.invalid', 'fikcyjne-haslo-2');
  const A = await device(srv);
  await ready(srv, A, { first: true });
  await A.store.record('inv.count', { prod: 'banan', qty: 100, date: '2026-09-27' });
  await syncNow(A.store, A.deps);
  await signOut(A.store, A.deps);
  assert.ok(srv.log.some(([m, p]) => m === 'POST' && p === '/auth/v1/logout'));
  assert.equal((await cloudStatus(A.store)).step, 'login');
  assert.equal(await A.adapter.getMeta(LOCAL.keys), null);
  assert.ok((await A.adapter.getMeta(META.acked)).length === 1);
  await signIn(A.store, { email: 'drugi@example.invalid', password: 'fikcyjne-haslo-2' }, A.deps);
  assert.equal(await A.adapter.getMeta(META.acked), null);
  assert.equal(await A.adapter.getMeta(META.cursor), null);
});

test('brak sieci: czytelny błąd, dane lokalne bez zmian, ponowienie po powrocie połączenia', async () => {
  const srv = server();
  let offline = false;
  const A = await device(srv);
  A.deps.fetch = (...a) => (offline ? Promise.reject(new TypeError('Failed to fetch')) : srv.fetch(...a));
  await ready(srv, A, { first: true });
  await A.store.record('inv.count', { prod: 'banan', qty: 100, date: '2026-09-27' });
  offline = true;
  const e = await syncNow(A.store, A.deps).catch(x => x);
  assert.equal(e.code, 'network');
  assert.match(describeError(e), /Dane są bezpieczne na tym urządzeniu/);
  assert.match(describeError(e, 'signin'), /adres projektu/);
  assert.equal(A.store.allEvents().length, 1);
  assert.equal((await cloudStatus(A.store)).pending, 1);
  offline = false;
  assert.equal((await syncNow(A.store, A.deps)).pushed, 1);
});

test('wygasła sesja: odświeżenie w tle; nieważny token odświeżania = ponowne logowanie bez ponownego hasła szyfrowania', async () => {
  const srv = server();
  const A = await device(srv);
  await ready(srv, A, { first: true });
  srv.expireAll();                                                   // token dostępu odrzucany przez serwer
  assert.equal((await syncNow(A.store, A.deps)).pushed, 0);
  const s = await A.adapter.getMeta(LOCAL.session);
  await A.adapter.setMeta(LOCAL.session, { ...s, refresh_token: 'nieważny', expires_at: 0 });
  await assert.rejects(syncNow(A.store, A.deps), { code: 'signed-out' });
  assert.equal((await cloudStatus(A.store)).step, 'login');
  await signIn(A.store, { email: EMAIL, password: PWD }, A.deps);
  assert.equal((await cloudStatus(A.store)).step, 'ready');       // to samo konto: klucze zachowane
});

test('jedna runda naraz; bez hasła szyfrowania i bez konfiguracji synchronizacja się nie uruchamia', async () => {
  const srv = server();
  const A = await device(srv);
  await assert.rejects(syncNow(A.store, A.deps), { code: 'not-configured' });
  await saveConfig(A.store, { url: srv.url, key: KEY });
  await signIn(A.store, { email: EMAIL, password: PWD }, A.deps);
  await assert.rejects(syncNow(A.store, A.deps), { code: 'locked' });
  await unlock(A.store, { passphrase: PASS, confirm: PASS, ...IT }, A.deps);
  const [a, b] = await Promise.allSettled([syncNow(A.store, A.deps), syncNow(A.store, A.deps)]);
  assert.equal(a.status, 'fulfilled');
  assert.equal(b.reason?.code, 'busy');
});

test('zmiana projektu i odłączenie urządzenia: stan chmury zapomniany, dane lokalne nietknięte', async () => {
  const srv = server();
  const A = await device(srv);
  await ready(srv, A, { first: true });
  await A.store.record('inv.count', { prod: 'banan', qty: 100, date: '2026-09-27' });
  await syncNow(A.store, A.deps);
  await saveConfig(A.store, { url: srv.url, key: 'sb_publishable_INNYklucz000000' });      // ten sam projekt, nowy klucz
  assert.equal((await cloudStatus(A.store)).step, 'ready');
  await saveConfig(A.store, { url: 'https://inny-projekt.supabase.co', key: KEY });          // inny projekt
  const st = await cloudStatus(A.store);
  assert.equal(st.step, 'login'); assert.equal(st.pending, 1);
  assert.equal(await A.adapter.getMeta(LOCAL.keys), null);
  await resetDevice(A.store, A.deps);
  assert.equal(await loadConfig(A.store), null);
  assert.equal((await cloudStatus(A.store)).step, 'config');
  assert.equal(A.store.allEvents().length, 1);
});

test('komunikaty błędów po polsku dla typowych sytuacji', () => {
  const m = (code, status) => describeError(new CloudError('x', code, status));
  assert.match(m('http', 404), /schema\.sql/);
  assert.match(m('http', 503), /wstrzymany/);
  assert.match(m('http', 429), /Odczekaj/);
  assert.match(m('unauthorized', 401), /Publishable Key/);
  assert.match(m('forbidden', 403), /RLS/);
  assert.match(m('bad-passphrase'), /hasło szyfrowania/i);
  assert.match(m('signed-out'), /zaloguj się ponownie/);
  assert.equal(describeError(new Error('inny błąd')), 'inny błąd');
});
