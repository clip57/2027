// Synchronizacja przez chmurę — warstwa urządzenia (D-078, Etap 2; D-081…D-083). Łączy rdzeń z Etapu 1 z interfejsem:
// konfiguracja projektu wpisana lokalnie, sesja, klucze szyfrowania, jedna runda „Synchronizuj teraz”, komunikaty błędów.
// Wszystko per urządzenie w magazynie `meta` IndexedDB — nic z tego nie trafia do repozytorium, paczki ani 2027-sync.json.
// Synchronizacja: przycisk „Synchronizuj teraz” oraz — gdy włączona na urządzeniu — rundy automatyczne (D-084, `cloud-auto.js`).
import { createCloudClient, CloudError } from './cloud-api.js';
import { setupKeys, syncOnce, forgetCloudState, pendingCount, META } from './cloud.js';

// `expired` — sesja wygasła (nieudane odświeżenie tokenu), w odróżnieniu od celowego wylogowania: automat zgłasza to przy
// każdym uruchomieniu, aż do ponownego logowania (D-084)
export const LOCAL = { config: 'cloud.config', keys: 'cloud.keys', owner: 'cloud.owner', session: 'cloud.session', auto: 'cloud.auto', expired: 'cloud.expired' };

// ---------- konfiguracja projektu (Project URL + Publishable Key)
const JWT = /^[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+$/;
const jwtRole = key => {
  try { return JSON.parse(atob(key.match(JWT)[1].replace(/-/g, '+').replace(/_/g, '/'))).role || null; } catch { return null; }
};
// Klucz publiczny jest z założenia jawny (RLS + wyłączona rejestracja + szyfrowanie po stronie urządzenia chronią dane).
// Klucze omijające RLS (sekretny `sb_secret_…`, starszy `service_role`) są odrzucane — nie mogą trafić na urządzenie.
export function checkConfig({ url, key } = {}) {
  let u = String(url || '').trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/, '');
  if (/^[a-z0-9-]+\.supabase\.co$/i.test(u)) u = `https://${u}`;
  if (!/^https:\/\/[^/\s]+$/.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(u))
    throw new CloudError('Adres projektu musi mieć postać https://<projekt>.supabase.co', 'bad-config');
  const k = String(key || '').trim();
  if (/^sb_secret_/.test(k)) throw new CloudError('To klucz SEKRETNY (sb_secret_…) — nie wolno go używać w aplikacji. Wklej Publishable Key (sb_publishable_…).', 'secret-key');
  if (JWT.test(k)) {
    const role = jwtRole(k);
    if (role === 'service_role') throw new CloudError('To klucz service_role — omija zabezpieczenia RLS i nie wolno go używać w aplikacji. Wklej Publishable Key (sb_publishable_…).', 'secret-key');
    if (role !== 'anon') throw new CloudError('Nierozpoznany klucz. Wklej Publishable Key (sb_publishable_…).', 'bad-config');
  } else if (!/^sb_publishable_[A-Za-z0-9_-]{8,}$/.test(k)) throw new CloudError('Nierozpoznany klucz. Wklej Publishable Key (zaczyna się od sb_publishable_).', 'bad-config');
  return { url: u, key: k };
}

export const loadConfig = async store => (await store.adapter.getMeta(LOCAL.config)) || null;

// Zmiana projektu = inny serwer: sesja, klucze i kursor poprzedniego projektu są zapominane (dane lokalne bez zmian)
export async function saveConfig(store, input) {
  const cfg = checkConfig(input);
  const prev = await loadConfig(store);
  if (prev && prev.url !== cfg.url) await resetDevice(store);
  await store.adapter.setMeta(LOCAL.config, cfg);
  return cfg;
}

// Interfejs `storage` klienta REST nad magazynem `meta`
export const metaStorage = adapter => ({
  get: async k => (await adapter.getMeta(k)) ?? null,
  set: (k, v) => adapter.setMeta(k, v),
  remove: k => adapter.setMeta(k, null),
});

export async function clientFor(store, { fetch, now } = {}) {
  const cfg = await loadConfig(store);
  if (!cfg) throw new CloudError('Synchronizacja w chmurze nie jest skonfigurowana na tym urządzeniu.', 'not-configured');
  return createCloudClient({ url: cfg.url, anonKey: cfg.key, storage: metaStorage(store.adapter), ...(fetch && { fetch }), ...(now && { now }) });
}

// ---------- klucze szyfrowania: nieeksportowalne CryptoKey w IndexedDB (hasło nie jest nigdzie zapisywane).
// Gdy przeglądarka nie potrafi zapisać CryptoKey, klucze zostają tylko w pamięci karty (hasło po ponownym uruchomieniu).
const volatile = new Map();   // urządzenie -> klucze niezapisane trwale
async function storeKeys(store, rec) {
  try { await store.adapter.setMeta(LOCAL.keys, rec); volatile.delete(store.device); return true; }
  catch { volatile.set(store.device, rec); await store.adapter.setMeta(LOCAL.keys, null).catch(() => {}); return false; }
}
async function readKeys(store, userId) {
  const rec = (await store.adapter.getMeta(LOCAL.keys)) || volatile.get(store.device) || null;
  return rec && rec.user === userId && rec.enc && rec.mac ? { enc: rec.enc, mac: rec.mac } : null;
}
async function dropKeys(store) { volatile.delete(store.device); await store.adapter.setMeta(LOCAL.keys, null); }

// ---------- stan do wyświetlenia (bez połączenia z siecią)
export async function cloudStatus(store) {
  const m = store.adapter;
  const config = await loadConfig(store);
  const session = config ? await m.getMeta(LOCAL.session) : null;
  const user = session?.user?.id ? session.user : null;
  const unlocked = user ? !!(await readKeys(store, user.id)) : false;
  const acked = new Set((await m.getMeta(META.acked)) || []);
  return {
    config, user, unlocked,
    persistentKeys: unlocked && !volatile.has(store.device),
    step: !config ? 'config' : !user ? 'login' : !unlocked ? 'unlock' : 'ready',
    lastSync: (await m.getMeta(META.lastSync)) || null,
    pending: store.allEvents().filter(e => !acked.has(e.id)).length,
    auto: (await m.getMeta(LOCAL.auto)) !== false,
  };
}

// ---------- logowanie / hasło szyfrowania / wylogowanie
export async function signIn(store, { email, password }, deps = {}) {
  if (!String(email || '').trim() || !password) throw new CloudError('Podaj e-mail i hasło konta.', 'missing');
  const client = await clientFor(store, deps);
  const s = await client.signIn(String(email).trim(), password);
  // Inne konto niż poprzednio na tym urządzeniu: kursor i potwierdzenia dotyczyły innych danych w chmurze
  const owner = await store.adapter.getMeta(LOCAL.owner);
  if (owner && owner !== s.user.id) { await forgetCloudState(store); await dropKeys(store); }
  await store.adapter.setMeta(LOCAL.owner, s.user.id);
  await store.adapter.setMeta(LOCAL.expired, null);
  return s.user;
}

// Pierwsze urządzenie (w chmurze brak parametrów szyfrowania) wymaga powtórzenia hasła — literówka byłaby nieodwracalna.
export async function unlock(store, { passphrase, confirm, iterations } = {}, deps = {}) {
  const client = await clientFor(store, deps);
  const user = await client.user();
  if (!user?.id) throw new CloudError('Nie zalogowano do chmury.', 'signed-out');
  if (!(await client.getKeyInfo())) {
    if (confirm === undefined || confirm === null) throw new CloudError('W chmurze nie ma jeszcze danych — to pierwsze urządzenie. Powtórz hasło szyfrowania.', 'need-confirm');
    if (confirm !== passphrase) throw new CloudError('Hasła szyfrowania nie są identyczne.', 'confirm-mismatch');
  }
  const { keys, created } = await setupKeys(client, passphrase, iterations ? { iterations } : {});
  const persistent = await storeKeys(store, { user: user.id, enc: keys.enc, mac: keys.mac });
  return { created, persistent };
}

// Wylogowanie: sesja i klucze znikają z urządzenia; kursor zostaje (to samo konto kontynuuje bez ponownego pobierania)
export async function signOut(store, deps = {}) {
  await dropKeys(store);
  await store.adapter.setMeta(LOCAL.expired, null);
  try { await (await clientFor(store, deps)).signOut(); } catch { await store.adapter.setMeta(LOCAL.session, null); }
}

// Odłączenie urządzenia: usuwa konfigurację, sesję, klucze i stan synchronizacji. Dane lokalne i dane w chmurze bez zmian.
export async function resetDevice(store, deps = {}) {
  try { if (await loadConfig(store)) await signOut(store, deps); } catch { /* offline — sesja i tak usunięta niżej */ }
  await dropKeys(store);
  for (const k of [LOCAL.session, LOCAL.owner, LOCAL.config, LOCAL.auto, LOCAL.expired]) await store.adapter.setMeta(k, null);
  await forgetCloudState(store);
}

// ---------- synchronizacja automatyczna (D-084): przełącznik per urządzenie, domyślnie włączona
export const autoEnabled = async store => (await store.adapter.getMeta(LOCAL.auto)) !== false;
export const setAutoEnabled = (store, on) => store.adapter.setMeta(LOCAL.auto, !!on);

// ---------- rundy: najwyżej jedna naraz (także między kartami — Web Locks, jeśli dostępne; odświeżanie tokenu też pod blokadą)
let running = false;
async function exclusive(fn) {
  if (running) throw new CloudError('Synchronizacja już trwa.', 'busy');
  running = true;
  try {
    const locks = globalThis.navigator?.locks;
    if (!locks?.request) return await fn();
    return await locks.request('p2027-cloud-sync', { ifAvailable: true }, lock => {
      if (!lock) throw new CloudError('Synchronizacja już trwa w innej karcie lub oknie aplikacji.', 'busy');
      return fn();
    });
  } finally { running = false; }
}

// Wygaśnięcie sesji w trakcie rundy (klient usuwa wtedy sesję) zapamiętywane — patrz LOCAL.expired
async function guarded(store, fn) {
  try { return await fn(); }
  catch (e) { if (e?.code === 'signed-out') await store.adapter.setMeta(LOCAL.expired, true).catch(() => {}); throw e; }
}

// „Synchronizuj teraz”: pełna runda (pobranie + wysyłka)
export function syncNow(store, deps = {}) {
  return exclusive(async () => {
    if (globalThis.navigator?.onLine === false) throw new CloudError('Brak połączenia z internetem.', 'network');
    const client = await clientFor(store, deps);
    const user = await client.user();
    if (!user?.id) throw new CloudError('Nie zalogowano do chmury.', 'signed-out');
    const keys = await readKeys(store, user.id);
    if (!keys) throw new CloudError('Podaj hasło szyfrowania.', 'locked');
    return guarded(store, () => syncOnce({ store, client, keys, ...(deps.now && { now: () => new Date(deps.now()) }) }));
  });
}

// Runda automatyczna. `{ off: true }` = nic do zrobienia bez udziału użytkownika (chmura nieskonfigurowana, wyłączona na
// urządzeniu, brak sesji po wylogowaniu, baza niedostępna) — bez sieci i bez komunikatu. Runda „push” bez zmian do wysłania
// kończy się bez żadnego zapytania. Brak kluczy przy aktywnej sesji = błąd `locked` (potrzebne hasło szyfrowania).
export function autoRound(store, mode = 'full', deps = {}) {
  return exclusive(async () => {
    if (!store?.health?.ok || !(await loadConfig(store)) || !(await autoEnabled(store))) return { off: true };
    const client = await clientFor(store, deps);
    const user = await client.user();
    if (!user?.id) {
      if (await store.adapter.getMeta(LOCAL.expired)) throw new CloudError('Sesja wygasła — zaloguj się ponownie.', 'signed-out');
      return { off: true };                                  // celowe wylogowanie: cicho
    }
    const keys = await readKeys(store, user.id);
    if (!keys) throw new CloudError('Podaj hasło szyfrowania, aby wznowić synchronizację.', 'locked');
    if (mode === 'push' && !(await pendingCount(store))) return { mode, idle: true, pulled: 0, applied: 0, pushed: 0, rejected: [] };
    if (globalThis.navigator?.onLine === false) throw new CloudError('Brak połączenia z internetem.', 'network');
    return guarded(store, () => syncOnce({ store, client, keys, mode, ...(deps.now && { now: () => new Date(deps.now()) }) }));
  });
}

// ---------- komunikaty dla użytkownika
export function describeError(e, during = 'sync') {
  const code = e?.code, st = e?.status;
  switch (code) {
    case 'network': return during === 'sync'
      ? 'Brak połączenia z chmurą. Dane są bezpieczne na tym urządzeniu — synchronizuj ponownie, gdy wróci internet.'
      : 'Nie można połączyć się z serwerem. Sprawdź połączenie z internetem i adres projektu (Project URL).';
    case 'signed-out': return 'Sesja wygasła — zaloguj się ponownie. Dane na tym urządzeniu są bezpieczne.';
    case 'locked': return 'Podaj hasło szyfrowania, aby wznowić synchronizację. Dane na tym urządzeniu są bezpieczne.';
    case 'bad-credentials': return 'Nieprawidłowy e-mail lub hasło konta.';
    case 'bad-passphrase': return 'Nieprawidłowe hasło szyfrowania. To hasło ustawione na pierwszym urządzeniu (inne niż hasło konta).';
    case 'unauthorized': return 'Serwer odrzucił klucz projektu. Sprawdź Project URL i Publishable Key w konfiguracji.';
    case 'forbidden': return 'Serwer odmówił dostępu (zasady RLS). Sprawdź, czy w projekcie uruchomiono tools/supabase/schema.sql.';
    case 'store': return 'Baza danych na tym urządzeniu jest niedostępna — synchronizacja wstrzymana, aby nie utracić danych.';
    case 'http':
      if (st === 404) return 'Nie znaleziono tabel synchronizacji. Uruchom tools/supabase/schema.sql w SQL Editor projektu.';
      if (st === 429) return 'Zbyt wiele prób w krótkim czasie. Odczekaj kilka minut.';
      if (st >= 500) return `Serwer chmury nie odpowiada poprawnie (HTTP ${st}). Projekt w planie bezpłatnym mógł zostać wstrzymany po 7 dniach bez aktywności — wznowisz go w panelu Supabase.`;
      return `Błąd serwera chmury (HTTP ${st}): ${e.message}`;
    default: return e?.message || String(e);
  }
}

export function describeResult(r) {
  let text = r.applied || r.pushed ? `Synchronizacja zakończona. Pobrane z chmury: ${r.applied}, wysłane: ${r.pushed}.` : 'Synchronizacja zakończona — wszystko aktualne.';
  if (r.backup) text += ' Przed dopisaniem zapisano kopię stanu.';
  if (r.rejected?.length) text += ` Pominięto ${r.rejected.length} wpisów z chmury, których nie da się odczytać (inne hasło szyfrowania albo uszkodzony wpis) — dane lokalne bez zmian.`;
  return text;
}
