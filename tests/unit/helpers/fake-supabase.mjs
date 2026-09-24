// Lokalny FAŁSZYWY serwer zgodny z używanym podzbiorem REST Supabase (Auth + PostgREST) — wyłącznie do testów.
// Emuluje: logowanie hasłem, odświeżanie z rotacją tokenów, wygasanie tokenów, RLS (każdy użytkownik widzi tylko swoje
// wiersze, anon nie ma dostępu), wstawianie z pominięciem duplikatów, numery kolejne nadawane przez serwer oraz
// opóźnione zatwierdzenie transakcji (wiersz z niższym numerem widoczny później — test zapasu kursora).
// Dane w pamięci; konta i hasła fikcyjne.
export function fakeSupabase({ anonKey = 'anon-test-key', tokenTtl = 3600, clock = () => Date.now() } = {}) {
  const users = new Map();          // email -> { id, email, password }
  const access = new Map();         // token -> { userId, exp }
  const refresh = new Map();        // token -> userId
  const events = [];                // { user_id, sid, seq, blob, visible }
  const keys = new Map();           // user_id -> { salt, iterations, verifier }
  let seq = 0, n = 0, holdNext = 0;
  const log = [];                   // [method, path] — do asercji
  const tok = p => `${p}-${++n}-${Math.random().toString(36).slice(2)}`;
  const json = (status, body) => new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const session = u => {
    const a = tok('at'), r = tok('rt');
    access.set(a, { userId: u.id, exp: clock() / 1000 + tokenTtl }); refresh.set(r, u.id);
    return { access_token: a, refresh_token: r, expires_in: tokenTtl, expires_at: Math.floor(clock() / 1000 + tokenTtl), user: { id: u.id, email: u.email } };
  };
  const who = h => {
    const t = (h.Authorization || '').replace(/^Bearer /, '');
    const a = access.get(t);
    return a && a.exp > clock() / 1000 ? a.userId : null;
  };

  async function fetch(url, init = {}) {
    const u = new URL(url), h = init.headers || {}, method = init.method || 'GET';
    log.push([method, u.pathname]);
    if (h.apikey !== anonKey) return json(401, { message: 'Invalid API key' });
    const body = init.body ? JSON.parse(init.body) : null;
    // ---------- Auth
    if (u.pathname === '/auth/v1/token') {
      const grant = u.searchParams.get('grant_type');
      if (grant === 'password') {
        const usr = users.get(body?.email);
        return usr && usr.password === body.password ? json(200, session(usr)) : json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      }
      if (grant === 'refresh_token') {
        const uid = refresh.get(body?.refresh_token);
        if (!uid) return json(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
        refresh.delete(body.refresh_token);                                        // rotacja: stary token jednorazowy
        return json(200, session([...users.values()].find(x => x.id === uid)));
      }
      return json(400, { error: 'unsupported_grant_type' });
    }
    if (u.pathname === '/auth/v1/logout') { const t = (h.Authorization || '').replace(/^Bearer /, ''); access.delete(t); return json(204); }
    // ---------- PostgREST z RLS
    const uid = who(h);
    if (!uid) return json(401, { message: 'JWT expired or missing', code: 'PGRST301' });
    if (u.pathname === '/rest/v1/sync_keys') {
      if (method === 'GET') return json(200, keys.has(uid) ? [keys.get(uid)] : []);
      if (method === 'POST') {
        if (body.user_id !== uid) return json(403, { message: 'new row violates row-level security policy' });
        if (keys.has(uid)) return json(409, { message: 'duplicate key value violates unique constraint' });
        keys.set(uid, { salt: body.salt, iterations: body.iterations, verifier: body.verifier }); return json(201);
      }
      if (method === 'DELETE') { keys.delete(uid); return json(204); }
    }
    if (u.pathname === '/rest/v1/events') {
      if (method === 'GET') {
        const gt = Number((u.searchParams.get('seq') || 'gt.0').replace('gt.', ''));
        const limit = Number(u.searchParams.get('limit') || 1000);
        const rows = events.filter(e => e.user_id === uid && e.visible && e.seq > gt).sort((a, b) => a.seq - b.seq).slice(0, limit);
        return json(200, rows.map(e => ({ sid: e.sid, seq: e.seq, blob: e.blob })));
      }
      if (method === 'POST') {
        const ignore = /resolution=ignore-duplicates/.test(h.Prefer || '');
        if (body.some(r => r.user_id !== uid)) return json(403, { message: 'new row violates row-level security policy' });
        const dup = body.filter(r => events.some(e => e.user_id === uid && e.sid === r.sid));
        if (dup.length && !ignore) return json(409, { message: 'duplicate key value violates unique constraint' });
        const hold = holdNext > 0;
        for (const r of body) if (!events.some(e => e.user_id === uid && e.sid === r.sid)) events.push({ user_id: uid, sid: r.sid, blob: r.blob, seq: ++seq, visible: !hold });
        if (hold) holdNext--;
        return json(201);
      }
      if (method === 'DELETE') { for (let i = events.length - 1; i >= 0; i--) if (events[i].user_id === uid) events.splice(i, 1); return json(204); }
    }
    return json(404, { message: 'not found' });
  }

  return {
    fetch, anonKey, url: 'http://localhost:54321', log, events, keys, access,
    addUser(email, password) { const usr = { id: `00000000-0000-4000-8000-${String(users.size + 1).padStart(12, '0')}`, email, password }; users.set(email, usr); return usr; },
    // Następne wstawienie dostaje numery kolejne, ale jest niewidoczne do release() — jak transakcja zatwierdzona później
    holdNextInsert() { holdNext++; },
    release() { events.forEach(e => { e.visible = true; }); },
    expireAll() { for (const a of access.values()) a.exp = 0; },
  };
}

// Pamięć sesji zgodna z interfejsem `storage` klienta (w aplikacji: magazyn `meta` IndexedDB)
export const memoryStorage = () => { const m = new Map(); return { get: async k => m.get(k) ?? null, set: async (k, v) => { m.set(k, structuredClone(v)); }, remove: async k => { m.delete(k); } }; };
