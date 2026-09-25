"""Lokalny FAŁSZYWY serwer zgodny z używanym podzbiorem REST Supabase (Auth + PostgREST) — wyłącznie do testów w przeglądarce.
Odpowiednik tests/unit/helpers/fake-supabase.mjs: logowanie hasłem, odświeżanie z rotacją, wygasanie tokenów, RLS (każdy
użytkownik widzi tylko swoje wiersze, bez tokenu brak dostępu), wstawianie z pominięciem duplikatów, numery nadawane przez
serwer, CORS (aplikacja działa pod innym adresem niż serwer, wariant jednoplikowy — z file://). Dane w pamięci; konta fikcyjne."""
import json, threading, time, uuid, http.server
from urllib.parse import urlsplit, parse_qs


class FakeSupabase:
    def __init__(self, anon_key, port, token_ttl=3600):
        self.anon_key, self.port, self.ttl = anon_key, port, token_ttl
        self.users, self.access, self.refresh = {}, {}, {}
        self.events, self.keys, self.log = [], {}, []
        self.seq, self.lock = 0, threading.Lock()
        self.stats = {'bytes_out': 0, 'gets': 0, 'posts': 0}   # transfer z serwera (GET /events) i liczba zapytań
        self.calls = []   # (user-agent, metoda, ścieżka, zapytanie, bajty treści) — rozróżnienie profili testowych
        self.url = f'http://localhost:{port}'

    def add_user(self, email, password):
        self.users[email] = {'id': str(uuid.UUID(int=len(self.users) + 1)), 'email': email, 'password': password}

    def expire_all(self):
        with self.lock:
            for a in self.access.values(): a['exp'] = 0

    def _session(self, u):
        a, r = 'at-' + uuid.uuid4().hex, 'rt-' + uuid.uuid4().hex
        self.access[a] = {'uid': u['id'], 'exp': time.time() + self.ttl}; self.refresh[r] = u['id']
        return {'access_token': a, 'refresh_token': r, 'expires_in': self.ttl, 'expires_at': int(time.time() + self.ttl),
                'user': {'id': u['id'], 'email': u['email']}}

    def handle(self, method, path, query, headers, body):
        """Zwraca (status, obiekt JSON albo None)."""
        self.log.append((method, path))
        if headers.get('apikey') != self.anon_key: return 401, {'message': 'Invalid API key'}
        if path == '/auth/v1/token':
            grant = query.get('grant_type', [''])[0]
            if grant == 'password':
                u = self.users.get((body or {}).get('email'))
                if u and u['password'] == body.get('password'): return 200, self._session(u)
                return 400, {'code': 400, 'error_code': 'invalid_credentials', 'msg': 'Invalid login credentials'}
            if grant == 'refresh_token':
                uid = self.refresh.pop((body or {}).get('refresh_token'), None)   # rotacja: token jednorazowy
                if not uid: return 400, {'code': 400, 'error_code': 'refresh_token_not_found', 'msg': 'Invalid Refresh Token: Refresh Token Not Found'}
                return 200, self._session(next(u for u in self.users.values() if u['id'] == uid))
            return 400, {'msg': 'unsupported_grant_type'}
        token = (headers.get('authorization') or '').removeprefix('Bearer ')
        if path == '/auth/v1/logout': self.access.pop(token, None); return 204, None
        a = self.access.get(token)
        uid = a['uid'] if a and a['exp'] > time.time() else None
        if not uid: return 401, {'code': 'PGRST301', 'message': 'JWT expired'}
        if path == '/rest/v1/sync_keys':
            if method == 'GET': return 200, [self.keys[uid]] if uid in self.keys else []
            if method == 'POST':
                if body.get('user_id') != uid: return 403, {'message': 'new row violates row-level security policy'}
                if uid in self.keys: return 409, {'message': 'duplicate key value violates unique constraint'}
                self.keys[uid] = {k: body[k] for k in ('salt', 'iterations', 'verifier')}; return 201, None
            if method == 'DELETE': self.keys.pop(uid, None); return 204, None
        if path == '/rest/v1/events':
            if method == 'GET':
                f = query.get('seq', ['gt.0'])[0]; limit = int(query.get('limit', ['1000'])[0])
                cols = query.get('select', ['sid,seq,blob'])[0].split(',')
                if f.startswith('in.('): want = {int(x) for x in f[4:-1].split(',') if x}; match = lambda e: e['seq'] in want
                else: gt = int(f.removeprefix('gt.')); match = lambda e: e['seq'] > gt
                rows = sorted((e for e in self.events if e['user_id'] == uid and match(e)), key=lambda e: e['seq'])[:limit]
                out = [{c: e[c] for c in cols} for e in rows]
                self.stats['bytes_out'] += len(json.dumps(out)); self.stats['gets'] += 1
                return 200, out
            if method == 'POST':
                if any(r.get('user_id') != uid for r in body): return 403, {'message': 'new row violates row-level security policy'}
                have = {e['sid'] for e in self.events if e['user_id'] == uid}
                if any(r['sid'] in have for r in body) and 'ignore-duplicates' not in (headers.get('prefer') or ''): return 409, {'message': 'duplicate key'}
                inserted = []
                for r in body:
                    if r['sid'] not in have:
                        self.seq += 1; have.add(r['sid']); inserted.append({'seq': self.seq})
                        self.events.append({'user_id': uid, 'sid': r['sid'], 'blob': r['blob'], 'seq': self.seq})
                self.stats['posts'] += 1
                return 201, (inserted if 'return=representation' in (headers.get('prefer') or '') else None)
            if method == 'DELETE': self.events = [e for e in self.events if e['user_id'] != uid]; return 204, None
        return 404, {'message': 'not found'}

    def start(self):
        fake = self

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a): pass
            def cors(self):
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Headers', 'apikey, authorization, content-type, prefer')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
            def do_OPTIONS(self):
                self.send_response(204); self.cors(); self.send_header('Content-Length', '0'); self.end_headers()
            def any(self):
                u = urlsplit(self.path); n = int(self.headers.get('Content-Length') or 0)
                raw = self.rfile.read(n) if n else b''
                hdrs = {k.lower(): v for k, v in self.headers.items()}
                with fake.lock:
                    status, obj = fake.handle(self.command, u.path, parse_qs(u.query), hdrs, json.loads(raw) if raw else None)
                data = b'' if obj is None else json.dumps(obj).encode()
                with fake.lock: fake.calls.append((hdrs.get('user-agent', ''), self.command, u.path, u.query, len(data)))
                self.send_response(status); self.cors()
                self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(data))); self.end_headers()
                self.wfile.write(data)
            do_GET = do_POST = do_DELETE = any

        self.srv = http.server.ThreadingHTTPServer(('127.0.0.1', self.port), H)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        return self

    def stop(self): self.srv.shutdown()
