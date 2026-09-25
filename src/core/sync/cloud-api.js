// Klient REST Supabase (Auth + PostgREST) bez SDK — sam `fetch` (D-078, Etap 1). Nie przechowuje niczego sam:
// sesję zapisuje przekazany `storage` ({ get(k), set(k, v), remove(k) }, np. magazyn `meta` w IndexedDB).
// Adres projektu i Publishable Key podaje użytkownik na urządzeniu (cloud-local.js) — nie ma ich w repozytorium.
export class CloudError extends Error {
  constructor(msg, code, status = null) { super(msg); this.name = 'CloudError'; this.code = code; this.status = status; }
}

const SESSION_KEY = 'cloud.session';
const MARGIN_S = 60;                               // odśwież token minutę przed wygaśnięciem
export const TIMEOUT_MS = 30000;                   // zawieszone połączenie nie może blokować synchronizacji (i blokady kart)

export function createCloudClient({ url, anonKey, fetch = globalThis.fetch?.bind(globalThis), storage, now = () => Date.now(), timeout = TIMEOUT_MS }) {
  if (!/^https:\/\/[^/]+$/.test(url || '') && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url || ''))
    throw new CloudError('Adres projektu musi mieć postać https://<projekt>.supabase.co', 'bad-config');
  if (!anonKey) throw new CloudError('Brak klucza projektu (Publishable Key).', 'bad-config');
  const base = url.replace(/\/$/, '');

  async function call(path, { method = 'GET', body, token, prefer, auth = true } = {}) {
    const headers = { apikey: anonKey, 'Content-Type': 'application/json' };
    if (auth) headers.Authorization = `Bearer ${token}`;
    if (prefer) headers.Prefer = prefer;
    let res, text;
    // Limit czasu przez AbortController + setTimeout (AbortSignal.timeout dopiero od Safari 16)
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl && setTimeout(() => ctl.abort(), timeout);
    try {
      res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), ...(ctl && { signal: ctl.signal }) });
      text = await res.text();
    } catch (e) {
      throw new CloudError(ctl?.signal.aborted ? 'Serwer chmury nie odpowiedział w wyznaczonym czasie.' : `Brak połączenia z chmurą: ${e.message}`, 'network');
    } finally { if (timer) clearTimeout(timer); }
    const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
    if (!res.ok) {
      const msg = (data && (data.message || data.msg || data.error_description || data.error)) || `HTTP ${res.status}`;
      const code = res.status === 401 ? 'unauthorized' : res.status === 403 ? 'forbidden' : res.status === 409 ? 'conflict'
        : res.status === 400 && /invalid.*(credential|grant)/i.test(msg) ? 'bad-credentials' : 'http';
      throw new CloudError(String(msg), code, res.status);
    }
    return data;
  }

  // ---------- sesja
  const keep = async s => {
    const session = { access_token: s.access_token, refresh_token: s.refresh_token,
      expires_at: s.expires_at ?? Math.floor(now() / 1000) + (s.expires_in || 3600), user: { id: s.user?.id, email: s.user?.email } };
    await storage.set(SESSION_KEY, session);
    return session;
  };
  async function signIn(email, password) {
    return keep(await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false }));
  }
  async function refresh(session) {
    try { return await keep(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, auth: false })); }
    catch (e) { if (e.code === 'bad-credentials' || e.status === 400 || e.status === 401) { await storage.remove(SESSION_KEY); throw new CloudError('Sesja wygasła — zaloguj się ponownie.', 'signed-out'); } throw e; }
  }
  async function session() {
    const s = await storage.get(SESSION_KEY);
    if (!s) throw new CloudError('Nie zalogowano do chmury.', 'signed-out');
    return s.expires_at - MARGIN_S <= now() / 1000 ? refresh(s) : s;
  }
  async function signOut() {
    const s = await storage.get(SESSION_KEY);
    await storage.remove(SESSION_KEY);
    if (s) { try { await call('/auth/v1/logout', { method: 'POST', token: s.access_token }); } catch { /* sesja lokalna i tak usunięta */ } }
  }
  const user = async () => (await storage.get(SESSION_KEY))?.user || null;

  // Zapytanie z tokenem; przy 401 jedno odświeżenie i ponowienie
  async function authed(path, opts = {}) {
    let s = await session();
    try { return await call(path, { ...opts, token: s.access_token }); }
    catch (e) { if (e.code !== 'unauthorized') throw e; s = await refresh(s); return call(path, { ...opts, token: s.access_token }); }
  }

  // ---------- tabele (RLS: każdy widzi wyłącznie własne wiersze — tools/supabase/schema.sql)
  return {
    signIn, signOut, session, user,
    async getKeyInfo() {
      const rows = await authed('/rest/v1/sync_keys?select=salt,iterations,verifier');
      return Array.isArray(rows) && rows.length ? rows[0] : null;
    },
    putKeyInfo: (userId, info) => authed('/rest/v1/sync_keys', { method: 'POST', body: { user_id: userId, ...info }, prefer: 'return=minimal' }),
    // Strona zdarzeń o numerze kolejnym większym niż `after` (rosnąco)
    pullEvents: (after, limit) => authed(`/rest/v1/events?select=sid,seq,blob&seq=gt.${Number(after) || 0}&order=seq.asc&limit=${limit}`),
    // Lekki indeks: same numery kolejne (ok. 12 B na wiersz) — treść pobierana tylko dla wierszy nieznanych lokalnie
    pullIndex: (after, limit) => authed(`/rest/v1/events?select=seq&seq=gt.${Number(after) || 0}&order=seq.asc&limit=${limit}`),
    // Lekkie sprawdzenie (D-085): numery wierszy nowszych niż kursor — bez nowych wierszy odpowiedź to „[]”
    peekEvents: (after, limit = 100) => authed(`/rest/v1/events?select=seq&seq=gt.${Number(after) || 0}&order=seq.asc&limit=${limit}`),
    pullBySeq: seqs => authed(`/rest/v1/events?select=sid,seq,blob&seq=in.(${seqs.map(Number).join(',')})&order=seq.asc`),
    // Wstawienie z pominięciem duplikatów (idempotentne) — ten sam `sid` wysłany drugi raz niczego nie zmienia.
    // Zwraca numery kolejne WSTAWIONYCH wierszy (duplikaty pominięte) — urządzenie nie pobiera potem własnych wierszy.
    pushEvents: (userId, rows) => rows.length ? authed('/rest/v1/events?on_conflict=user_id,sid&select=seq', { method: 'POST',
      body: rows.map(r => ({ user_id: userId, sid: r.sid, blob: r.blob })), prefer: 'resolution=ignore-duplicates,return=representation' }) : null,
    // „Usuń moje dane z chmury” (Etap 4) — jedyne kasowanie; dane lokalne bez zmian
    deleteAll: userId => authed(`/rest/v1/events?user_id=eq.${userId}`, { method: 'DELETE', prefer: 'return=minimal' })
      .then(() => authed(`/rest/v1/sync_keys?user_id=eq.${userId}`, { method: 'DELETE', prefer: 'return=minimal' })),
  };
}
