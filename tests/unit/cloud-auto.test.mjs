// Synchronizacja automatyczna (D-084): harmonogram (fałszywy zegar) i rundy na fałszywym serwerze. Dane i konta fikcyjne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAutoSync, classify, AUTO } from '../../src/core/sync/cloud-auto.js';
import { CloudError } from '../../src/core/sync/cloud-api.js';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { META } from '../../src/core/sync/cloud.js';
import { MIN_ITERATIONS } from '../../src/core/sync/crypto.js';
import { saveConfig, signIn, signOut, unlock, autoRound, setAutoEnabled, syncNow, cloudStatus } from '../../src/core/sync/cloud-local.js';
import { fakeSupabase } from './helpers/fake-supabase.mjs';

// ---------- fałszywy zegar: setTimeout/clearTimeout + przesuwanie czasu z opróżnianiem mikrozadań
function fakeClock() {
  let t = 0, id = 0; const q = new Map();
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  return {
    now: () => t,
    timers: { setTimeout: (fn, ms) => { q.set(++id, { at: t + ms, fn }); return id; }, clearTimeout: k => q.delete(k) },
    async advance(ms) {
      const end = t + ms;
      for (;;) {
        await flush();
        const next = [...q.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        t = next[1].at; q.delete(next[0]); next[1].fn();
      }
      t = end; await flush();
    },
    pending: () => q.size,
  };
}
// run: zapisuje wywołania; wynik/błąd sterowany przez test
function harness(opts = {}) {
  const clock = fakeClock(), calls = [];
  let result = () => ({ applied: 0, pushed: 0 }), visible = true, gate = null;
  const applied = [];
  const auto = createAutoSync({
    getStore: () => 'store', timers: clock.timers, now: clock.now, isVisible: () => visible,
    run: async (store, mode) => { calls.push(mode); if (gate) await gate; return result(mode); },
    onApplied: r => applied.push(r), ...opts,
  });
  return { auto, clock, calls, applied, setResult: f => { result = f; }, setVisible: v => { visible = v; },
    hold() { let open; gate = new Promise(r => { open = r; }); return () => { gate = null; open(); }; } };
}

test('grupowanie: seria szybkich zmian = jedna runda „push” po 1,5 s ciszy', async () => {
  const H = harness();
  for (let i = 0; i < 10; i++) { H.auto.changed(); await H.clock.advance(500); }
  assert.deepEqual(H.calls, []);
  await H.clock.advance(AUTO.debounce);
  assert.deepEqual(H.calls, ['push']);
  assert.equal(H.auto.state().phase, 'idle');
});

test('ciągłe zmiany: najpóźniej po 15 s od pierwszej (maxWait)', async () => {
  const H = harness();
  for (let i = 0; i < 40; i++) { H.auto.changed(); await H.clock.advance(1000); }
  assert.equal(H.calls.length, 2);                       // 15 s i 30 s
  assert.ok(H.calls.every(m => m === 'push'));
});

test('zmiana w trakcie rundy: jedna kolejna runda po zakończeniu (bez równoległych)', async () => {
  const H = harness();
  const open = H.hold();
  H.auto.kick();
  await H.clock.advance(0);
  assert.equal(H.auto.state().phase, 'running');
  H.auto.changed(); await H.clock.advance(AUTO.debounce);   // odliczenie w trakcie rundy → kolejka
  H.auto.resume(true);                                        // pełna ma pierwszeństwo
  assert.deepEqual(H.calls, ['full']);
  open(); await H.clock.advance(0);
  assert.deepEqual(H.calls, ['full', 'full']);
});

test('powrót do aplikacji: pełna runda najwyżej raz na 60 s; otwarcie aplikacji po 2,5 s', async () => {
  const H = harness();
  H.auto.boot(); await H.clock.advance(AUTO.bootDelay);
  assert.deepEqual(H.calls, ['full']);
  H.auto.resume(); await H.clock.advance(10000);
  assert.deepEqual(H.calls, ['full']);
  await H.clock.advance(AUTO.resumeGap);
  H.auto.resume(); await H.clock.advance(0);
  assert.deepEqual(H.calls, ['full', 'full']);
});

test('brak sieci: ponowienia z rosnącym odstępem; w tle bez ponowień; powrót sieci = od razu', async () => {
  const H = harness();
  H.setResult(() => { throw new CloudError('offline', 'network'); });
  H.auto.changed(); await H.clock.advance(AUTO.debounce);
  assert.equal(H.auto.state().phase, 'retry');
  await H.clock.advance(AUTO.backoff[0]); assert.equal(H.calls.length, 2);
  await H.clock.advance(AUTO.backoff[1]); assert.equal(H.calls.length, 3);
  await H.clock.advance(AUTO.backoff[2] - 1); assert.equal(H.calls.length, 3);
  H.setVisible(false); await H.clock.advance(AUTO.backoff[5] * 3);
  const inBg = H.calls.length;
  await H.clock.advance(AUTO.backoff[5] * 3); assert.equal(H.calls.length, inBg, 'w tle bez nowych prób');
  H.setVisible(true); H.setResult(() => ({ pushed: 1 }));
  H.auto.online(); await H.clock.advance(0);
  assert.equal(H.auto.state().phase, 'idle'); assert.equal(H.auto.state().failures, 0);
});

test('błąd wymagający działania (sesja, klucz, 404): wstrzymanie bez ponowień aż do kick()', async () => {
  for (const e of [new CloudError('x', 'signed-out'), new CloudError('x', 'locked'), new CloudError('x', 'http', 404), new CloudError('x', 'forbidden', 403)]) {
    const H = harness();
    H.setResult(() => { throw e; });
    H.auto.kick(); await H.clock.advance(0);
    assert.equal(H.auto.state().phase, 'paused', e.code);
    H.auto.changed(); H.auto.resume(true); H.auto.online(); await H.clock.advance(AUTO.backoff[5] * 2);
    assert.equal(H.calls.length, 1, `${e.code}: bez ponowień`);
    H.setResult(() => ({})); H.auto.kick(); await H.clock.advance(0);
    assert.equal(H.auto.state().phase, 'idle');
  }
  assert.equal(classify(new CloudError('x', 'http', 503)), 'transient');
  assert.equal(classify(new CloudError('x', 'http', 429)), 'transient');
});

test('inna karta synchronizuje (busy): ciche ponowienie po 5 s, bez licznika błędów', async () => {
  const H = harness(); let n = 0;
  H.setResult(() => { if (!n++) throw new CloudError('x', 'busy'); return {}; });
  H.auto.changed(); await H.clock.advance(AUTO.debounce);
  assert.equal(H.auto.state().phase, 'waiting'); assert.equal(H.auto.state().failures, 0);
  await H.clock.advance(AUTO.busyRetry);
  assert.deepEqual(H.calls, ['push', 'push']); assert.equal(H.auto.state().phase, 'idle');
});

test('zejście do tła: oczekująca wysyłka od razu; wyłączona chmura: brak rund po zmianach', async () => {
  const H = harness();
  H.auto.changed(); H.auto.flush(); await H.clock.advance(0);
  assert.deepEqual(H.calls, ['push']);
  H.setResult(() => ({ off: true }));
  H.auto.kick(); await H.clock.advance(0);
  assert.equal(H.auto.state().phase, 'off');
  H.auto.changed(); await H.clock.advance(60000);
  assert.deepEqual(H.calls, ['push', 'full']);
});

test('pobrane zmiany z innego urządzenia → onApplied (odświeżenie widoku); bez nich — nie', async () => {
  const H = harness();
  H.setResult(() => ({ applied: 0 })); H.auto.kick(); await H.clock.advance(0);
  H.setResult(() => ({ applied: 3 })); H.auto.kick(); await H.clock.advance(0);
  assert.equal(H.applied.length, 1);
});

// ---------- rundy na fałszywym serwerze
const KEY = 'sb_publishable_TESTOWYklucz0000', PASS = 'fikcyjne hasło szyfrowania testu', EMAIL = 'test@example.invalid', PWD = 'fikcyjne-haslo-konta';
async function device(srv, first) {
  const store = await new Store(new MemoryAdapter()).open(), deps = { fetch: srv.fetch };
  await saveConfig(store, { url: srv.url, key: KEY });
  await signIn(store, { email: EMAIL, password: PWD }, deps);
  await unlock(store, { passphrase: PASS, confirm: first ? PASS : undefined, iterations: MIN_ITERATIONS }, deps);
  return { store, deps, round: mode => autoRound(store, mode, deps) };
}

test('runda „push” bez zmian nie wysyła żadnego zapytania; dopisanie z chmury nie zapętla', async () => {
  const srv = fakeSupabase({ anonKey: KEY }); srv.addUser(EMAIL, PWD);
  const A = await device(srv, true), B = await device(srv);
  await A.store.record('cfa.done', { block: 1, done: true });
  assert.equal((await A.round('push')).pushed, 1);
  const n = srv.log.length;
  assert.equal((await A.round('push')).idle, true);
  assert.equal(srv.log.length, n, 'brak zapytań');
  const r = await B.round('full');
  assert.equal(r.applied, 1);
  const m = srv.log.length;
  assert.equal((await B.round('push')).idle, true, 'zdarzenie pobrane z chmury nie jest „do wysłania”');
  assert.equal(srv.log.length, m);
});

test('lekkie pobieranie: runda bez zmian pobiera tylko indeks; własne wiersze nie wracają', async () => {
  const srv = fakeSupabase({ anonKey: KEY }); srv.addUser(EMAIL, PWD);
  const A = await device(srv, true), B = await device(srv);
  for (let i = 1; i <= 300; i++) await A.store.record('cfa.done', { block: i, done: true });
  await A.round('full');
  await B.round('full');
  const full = srv.stats.bytesOut;
  srv.stats.bytesOut = 0;
  const r = await B.round('full');                          // nic nowego
  assert.deepEqual([r.applied, r.pulled], [0, 0]);
  assert.ok(srv.stats.bytesOut < 300 * 20, `indeks ${srv.stats.bytesOut} B`);
  assert.ok(srv.stats.bytesOut * 20 < full, `${srv.stats.bytesOut} B zamiast ${full} B`);
  srv.stats.bytesOut = 0;
  await A.round('full');                                    // A nie pobiera z powrotem treści własnych 300 wierszy
  assert.ok(srv.stats.bytesOut < 300 * 20, `A: ${srv.stats.bytesOut} B`);
});

test('zapis stanu tylko przy zmianie (lista potwierdzeń nie jest przepisywana w pustej rundzie)', async () => {
  const srv = fakeSupabase({ anonKey: KEY }); srv.addUser(EMAIL, PWD);
  const A = await device(srv, true);
  await A.store.record('cfa.done', { block: 1, done: true });
  await A.round('full'); await A.round('full');           // druga runda przesuwa kursor za własny wiersz — realna zmiana
  const writes = [];
  const orig = A.store.adapter.setMeta.bind(A.store.adapter);
  A.store.adapter.setMeta = (k, v) => { writes.push(k); return orig(k, v); };
  await A.round('full');
  assert.deepEqual(writes, [META.lastSync]);
});

test('przełącznik: wyłączona automatyczna — runda automatyczna nic nie robi; „Synchronizuj teraz” działa', async () => {
  const srv = fakeSupabase({ anonKey: KEY }); srv.addUser(EMAIL, PWD);
  const A = await device(srv, true);
  await setAutoEnabled(A.store, false);
  assert.equal((await cloudStatus(A.store)).auto, false);
  await A.store.record('cfa.done', { block: 1, done: true });
  const n = srv.log.length;
  assert.equal((await A.round('push')).off, true);
  assert.equal(srv.log.length, n);
  assert.equal((await syncNow(A.store, A.deps)).pushed, 1);
});

test('brak kluczy przy aktywnej sesji: błąd „locked” (wstrzymanie z komunikatem), wylogowanie: cicho wyłączona', async () => {
  const srv = fakeSupabase({ anonKey: KEY }); srv.addUser(EMAIL, PWD);
  const A = await device(srv, true);
  await A.store.adapter.setMeta('cloud.keys', null);
  await assert.rejects(A.round('full'), { code: 'locked' });
  await A.store.adapter.setMeta('cloud.session', null);
  assert.equal((await A.round('full')).off, true);
});

test('wygasła sesja: zgłaszana także po ponownym uruchomieniu (aż do logowania); celowe wylogowanie — cicho', async () => {
  const srv = fakeSupabase({ anonKey: KEY }); srv.addUser(EMAIL, PWD);
  const A = await device(srv, true);
  const s = await A.store.adapter.getMeta('cloud.session');
  await A.store.adapter.setMeta('cloud.session', { ...s, refresh_token: 'nieważny', expires_at: 0 });
  await assert.rejects(A.round('full'), { code: 'signed-out' });
  assert.equal(await A.store.adapter.getMeta('cloud.session'), null);
  await assert.rejects(A.round('full'), { code: 'signed-out' }, 'następne uruchomienie: nadal zgłaszana, nie „wyłączona”');
  await signIn(A.store, { email: EMAIL, password: PWD }, A.deps);
  assert.equal((await A.round('full')).off, undefined);
  await signOut(A.store, A.deps);
  assert.equal((await A.round('full')).off, true);
});
