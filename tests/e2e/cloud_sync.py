"""Synchronizacja przez chmurę (D-078, Etap 2; automatyczna — D-084) — testy w przeglądarce (Chromium) na ODDZIELNYCH
profilach (osobne bazy, jak iPhone i komputer) z lokalnym FAŁSZYWYM serwerem Supabase (tests/e2e/fake_supabase.py).
Adres, klucz, konto i hasła fikcyjne; dane zapasów syntetyczne (D-065). Zakres: konfiguracja (odrzucenie klucza
sekretnego), logowanie, hasło szyfrowania (pierwsze urządzenie z powtórzeniem, błędne na drugim), przełącznik automatu
(wyłączony: nic bez kliknięcia), automatyczna wysyłka po zmianie i grupowanie serii zmian, pierwsza synchronizacja po
haśle, ponowne otwarcie i powrót do aplikacji, powrót sieci, konflikt, dwie karty (poprawka A4), brak przerysowania w trakcie
wpisywania, lekkie pobieranie (transfer), baner wstrzymanej synchronizacji, brak treści jawnej na serwerze, wygasły token,
pamięć kluczy, wylogowanie, odłączenie, wariant jednoplikowy (file://), axe-core i cele dotykowe w każdym kroku.
Uruchomienie: npm run build && python3 tests/e2e/cloud_sync.py"""
import asyncio, os, pathlib, sys, threading, http.server
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fixtures
from fake_supabase import FakeSupabase

ROOT = pathlib.Path(__file__).resolve().parents[2]
AXE = (ROOT / 'node_modules/axe-core/axe.min.js').read_text()
KEY = 'sb_publishable_TESTOWYklucz0000'          # fikcyjny
EMAIL, PWD = 'test@example.invalid', 'fikcyjne-haslo-konta'
PASS = 'fikcyjne hasło szyfrowania e2e'
results, axe_found = [], []
def ok(c, m): results.append((bool(c), m)); print(('OK  ' if c else 'BŁĄD'), m)

def serve(port):
    class Q(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT / 'dist/web'), **k)
        def log_message(self, *a): pass
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), Q)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

async def page(b, mobile, errs, theme='dark', clock=False, ua=None):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 900}
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw',
                              **({'user_agent': f'Mozilla/5.0 (p2027-test-{ua})'} if ua else {}))
    if clock: await ctx.clock.install()     # zegar płynie naturalnie; fast_forward = „aplikacja w tle przez minutę”
    await ctx.add_init_script(f"localStorage.setItem('p2027.theme', '{theme}')")
    pg = await ctx.new_page()
    # Odpowiedzi 4xx i brak sieci są tu oczekiwane (Chromium zapisuje je w konsoli jako „Failed to load resource”)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    return pg

async def dane(pg, url):
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('.dn-cloud')

async def msg(pg, text, timeout=20000):
    await pg.wait_for_function("s => (document.querySelector('.dn-cloud-msg')?.textContent || '').includes(s)", arg=text, timeout=timeout)
    return await pg.inner_text('.dn-cloud-msg')

async def status(pg): return await pg.inner_text('.dn-cloud .dn-sync-s')

async def audit(pg, label):
    """axe-core (WCAG 2.1 A/AA), przewijanie w poziomie i cele dotykowe ≥ 44 px w sekcji chmury."""
    await pg.add_script_tag(content=AXE)
    res = await pg.evaluate("axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa']}, resultTypes: ['violations']})")
    v = [f"{x['id']} {x['nodes'][0]['target'][0]}" for x in res['violations']]
    axe_found.extend(f'{label}: {x}' for x in v)
    ok(not v, f'{label}: axe bez naruszeń {v[:2]}')
    sw, w = await pg.evaluate('[document.documentElement.scrollWidth, innerWidth]')
    ok(sw <= w, f'{label}: bez przewijania w poziomie ({sw}/{w})')
    small = await pg.evaluate("[...document.querySelectorAll('.dn-cloud button, .dn-cloud summary, .dn-cloud input')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(r => r.height < 44).length")
    ok(small == 0, f'{label}: elementy dotykowe ≥ 44 px (za małych: {small})')

async def configure(pg, url, srv):
    await dane(pg, url)
    await pg.get_by_label('Project URL').fill(srv.url)
    await pg.get_by_label('Publishable Key').fill(KEY)
    await pg.get_by_role('button', name='Zapisz konfigurację').click(); await msg(pg, 'Konfiguracja zapisana')

async def login(pg, password=PWD):
    await pg.get_by_label('E-mail konta').fill(EMAIL); await pg.get_by_label('Hasło konta').fill(password)
    await pg.get_by_role('button', name='Zaloguj').click()

async def sync(pg, expect='Synchronizacja zakończona'):
    await pg.get_by_role('button', name='Synchronizuj teraz').click()
    return await msg(pg, expect)

async def stock(pg, url, name):
    await pg.goto(url + '#/zapasy?q=' + name); await pg.wait_for_selector('.inv-item')
    v = await pg.locator('.inv-item').first.locator('input[type=number]').input_value()
    return float(v) if v else None      # brak stanu (dane jeszcze niepobrane)

async def until(cond, timeout=12.0, step=0.2):
    """Czeka na warunek (funkcja zwykła lub async) — bez klikania; zwraca True/False."""
    t = 0.0
    while t < timeout:
        v = cond()
        if asyncio.iscoroutine(v): v = await v
        if v: return True
        await asyncio.sleep(step); t += step
    return False

def checks_of(srv, ua):   # lekkie sprawdzenia (D-085) wykonane przez dany profil
    return sum(1 for a, m, p, q, _ in srv.calls if f'p2027-test-{ua}' in a and m == 'GET' and p == '/rest/v1/events' and 'limit=100' in q and 'select=seq' in q)
def calls_of(srv, ua): return sum(1 for a, m, p, q, _ in srv.calls if f'p2027-test-{ua}' in a and p.startswith('/rest/v1/events'))

def event_posts(srv): return sum(1 for m, p in srv.log if m == 'POST' and p == '/rest/v1/events')
def event_calls(srv): return sum(1 for _, p in srv.log if p.startswith('/rest/v1/events'))

async def plus_pack(pg, url, name, n):
    await pg.goto(url + '#/zapasy?q=' + name); await pg.wait_for_selector('.inv-item')
    for _ in range(n): await pg.locator('.inv-item').first.get_by_role('button', name='+ opakowanie', exact=False).click()

async def set_stock(pg, url, name, value):
    await pg.goto(url + '#/zapasy?q=' + name); await pg.wait_for_selector('.inv-item')
    f = pg.locator('.inv-item').first.locator('input[type=number]')
    await f.fill(str(value)); await f.press('Tab'); await pg.wait_for_timeout(400)

async def main():
    web = serve(8793); URL = 'http://localhost:8793/index.html'
    SINGLE = (ROOT / 'dist/single/2027.html').as_uri()
    srv = FakeSupabase(KEY, 54329).start(); srv.add_user(EMAIL, PWD)
    syn = fixtures.write(fixtures.synthetic_zapasy()[0], 'zapasy_syntetyczne.json')
    errs = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        A = await page(b, True, errs, clock=True, ua='A')   # „iPhone” 390 px, ciemny

        # ---------- konfiguracja (A)
        await dane(A, URL)
        ok('Nieskonfigurowana' in await status(A), 'A: sekcja chmury widoczna, stan „nieskonfigurowana”')
        ok(await A.locator('.dn-sync').count() == 1 and await A.get_by_role('button', name='Wyślij do iCloud').count() == 1, 'A: ręczna synchronizacja plikiem bez zmian')
        await audit(A, 'A 390 ciemny: konfiguracja')
        await A.get_by_label('Project URL').fill(srv.url)
        await A.get_by_label('Publishable Key').fill('sb_secret_TESTOWYklucz0000')
        await A.get_by_role('button', name='Zapisz konfigurację').click()
        ok('SEKRETNY' in await msg(A, 'nie wolno'), 'A: klucz sekretny (sb_secret_…) odrzucony')
        await A.get_by_label('Publishable Key').fill(KEY)
        await A.get_by_role('button', name='Zapisz konfigurację').click(); await msg(A, 'Konfiguracja zapisana')
        ok(await A.evaluate("document.activeElement?.name") == 'email', 'A: po zapisie fokus na polu e-mail')

        # ---------- logowanie
        await audit(A, 'A 390 ciemny: logowanie')
        await login(A, 'złe hasło'); t = await msg(A, 'Nieprawidłowy')
        ok('e-mail lub hasło konta' in t, 'A: błędne hasło konta — czytelny komunikat')
        await login(A); await msg(A, 'Zalogowano')

        # ---------- hasło szyfrowania: pierwsze urządzenie wymaga powtórzenia
        await A.get_by_label('Hasło szyfrowania', exact=True).fill(PASS)
        await A.get_by_role('button', name='Odblokuj').click(); await A.get_by_label('Powtórz hasło szyfrowania').wait_for()
        ok('pierwsze urządzenie' in await A.inner_text('.dn-cloud'), 'A: pierwsze urządzenie — informacja i pole powtórzenia hasła')
        ok(await A.get_by_label('Hasło szyfrowania', exact=True).input_value() == PASS and await A.evaluate("document.activeElement?.name") == 'passphrase-2',
           'A: wpisane hasło zostaje, fokus na polu powtórzenia (bez przerysowania)')
        ok((await A.locator('.dn-cloud').inner_text()).count('to pierwsze urządzenie') == 1, 'A: informacja o pierwszym urządzeniu bez powtórzeń')
        await audit(A, 'A 390 ciemny: hasło szyfrowania (pierwsze urządzenie)')
        await A.get_by_label('Hasło szyfrowania', exact=True).fill(PASS); await A.get_by_label('Powtórz hasło szyfrowania').fill(PASS + 'x')
        await A.get_by_role('button', name='Ustaw hasło szyfrowania').click(); await msg(A, 'nie są identyczne')
        ok(not srv.keys, 'A: różne hasła — nic nie zapisano w chmurze')
        await A.get_by_label('Hasło szyfrowania', exact=True).fill(PASS); await A.get_by_label('Powtórz hasło szyfrowania').fill(PASS)
        await A.get_by_role('button', name='Ustaw hasło szyfrowania').click(); await msg(A, 'Hasło szyfrowania ustawione')
        ok(len(srv.keys) == 1, 'A: parametry szyfrowania (sól, iteracje, weryfikator) zapisane w chmurze')

        # ---------- przełącznik wyłączony: bez kliknięcia nic nie jest wysyłane (dotychczasowe zachowanie ręczne)
        await A.get_by_role('button', name='Synchronizuj automatycznie').wait_for()
        ok(await A.get_by_role('button', name='Synchronizuj automatycznie').get_attribute('aria-pressed') == 'true', 'A: synchronizacja automatyczna domyślnie włączona')
        await A.get_by_role('button', name='Synchronizuj automatycznie').click(); await msg(A, 'wyłączona na tym urządzeniu')
        await A.set_input_files('input[type=file]', str(syn)); await A.wait_for_selector('dialog[open]')
        await A.click('dialog >> text=Scal dane'); await A.wait_for_selector('text=Zaimportowano')
        before = event_calls(srv)
        await set_stock(A, URL, 'Banan', 300); await A.reload(); await dane(A, URL); await A.wait_for_timeout(4000)
        ok(event_calls(srv) == before, 'A (automat wyłączony): bez kliknięcia nic nie jest wysyłane ani pobierane')
        ok('Do wysłania do chmury' in await status(A), 'A: licznik zmian czekających na wysłanie')
        ok('wyłączona na tym urządzeniu' in await A.inner_text('.dn-cloud-auto'), 'A: stan „automatyczna wyłączona” w sekcji')
        ok('Wszystkie zmiany' not in await status(A) and await A.locator('.dn-cloud.has-unsent').count() == 1, 'A: sekcja oznaczona jako niewysłana')
        await audit(A, 'A 390 ciemny: gotowe do synchronizacji (automat wyłączony)')
        t = await sync(A)
        n_a = len(srv.events)
        ok('wysłane:' in t and n_a > 10, f'A: „Synchronizuj teraz” wysłało {n_a} zmian ({t.strip()[:80]})')
        blob = ' '.join(e['sid'] + e['blob'] for e in srv.events) + str(srv.keys)
        ok(not any(s in blob for s in ('banan', 'Banan', 'inv.count', 'inv.move', '"prod"', '"hlc"')) and all(':' not in e['sid'] for e in srv.events),
           'A: serwer przechowuje tylko szyfrogramy (bez nazw produktów, typów i identyfikatorów zdarzeń)')
        ok('Wszystkie zmiany z tego urządzenia są w chmurze' in await status(A), 'A: po synchronizacji — wszystko wysłane')
        await A.get_by_role('button', name='Synchronizuj automatycznie').click(); await msg(A, 'włączona na tym urządzeniu')
        await A.reload(); await A.wait_for_selector('.dn-cloud')
        ok(await A.get_by_role('button', name='Synchronizuj teraz').count() == 1, 'A: po przeładowaniu sesja i klucze zachowane (bez ponownego hasła)')
        stored = await A.evaluate("""() => new Promise(r => { const q = indexedDB.open('p2027'); q.onsuccess = () => { const g = q.result.transaction('meta').objectStore('meta').get('cloud.keys'); g.onsuccess = () => r(g.result && g.result.v && [g.result.v.enc.extractable, g.result.v.enc.type, JSON.stringify(g.result.v)]); }; })""")
        ok(stored and stored[0] is False and stored[1] == 'secret' and PASS not in stored[2], 'A: klucze w IndexedDB jako nieeksportowalne CryptoKey, bez hasła')
        await audit(A, 'A 390 ciemny: automat włączony')

        # ---------- automatyczna wysyłka po zmianie; seria szybkich zmian = jedno zapytanie
        await A.wait_for_timeout(3000)                              # pełna runda po otwarciu (bootDelay) już za nami
        p0, n0 = event_posts(srv), len(srv.events)
        await plus_pack(A, URL, 'Banan', 5)
        ok(await until(lambda: len(srv.events) == n0 + 5), f'A: 5 szybkich zmian wysłanych automatycznie, bez kliknięcia ({len(srv.events) - n0})')
        await A.wait_for_timeout(2500)
        ok(event_posts(srv) - p0 == 1, f'A: seria zmian zgrupowana w jedno wysłanie (wysłań: {event_posts(srv) - p0})')
        a_ban = await stock(A, URL, 'Banan')

        # ---------- drugie urządzenie (B, zegar Playwright): błędne hasło szyfrowania, pierwsza synchronizacja automatycznie
        B = await page(b, False, errs, 'light', clock=True, ua='B')   # „komputer” (MacBook) 1280 px, jasny
        await configure(B, URL, srv); await login(B); await msg(B, 'Zalogowano')
        await B.get_by_label('Hasło szyfrowania', exact=True).fill('zupełnie inne hasło')
        await B.get_by_role('button', name='Odblokuj').click(); await msg(B, 'Nieprawidłowe hasło szyfrowania')
        ok(not await B.get_by_label('Powtórz hasło szyfrowania').is_visible(), 'B: drugie urządzenie — bez powtórzenia hasła')
        await audit(B, 'B 1280 jasny: błędne hasło szyfrowania')
        await B.get_by_label('Hasło szyfrowania', exact=True).fill(PASS)
        await B.get_by_role('button', name='Odblokuj').click(); await msg(B, 'Hasło szyfrowania poprawne')
        async def b_has(v): return (await stock(B, URL, 'Banan')) == v
        ok(await until(lambda: b_has(a_ban), timeout=15), f'B: pierwsza synchronizacja automatycznie po haśle — banan {a_ban} jak na A')
        await dane(B, URL); await audit(B, 'B 1280 jasny: po automatycznej synchronizacji')

        # ---------- lekkie pobieranie: runda bez zmian = sam indeks (bez treści wierszy)
        srv.stats['bytes_out'] = 0
        await dane(B, URL); t = await sync(B)
        ok('wszystko aktualne' in t and srv.stats['bytes_out'] < 20 * n_a, f'B: pełna runda bez zmian pobiera tylko indeks ({srv.stats["bytes_out"]} B dla {len(srv.events)} wierszy)')

        # ---------- powrót do aplikacji: zmiana z A pobierana na B; wpisywanie na B nie jest przerywane przerysowaniem
        await set_stock(A, URL, 'Banan', 250)
        ok(await until(lambda: len(srv.events) > n0 + 5), 'A: zmiana stanu wysłana automatycznie')
        await B.goto(URL + '#/rekompozycja'); await B.wait_for_selector('.rk-search input')
        await B.locator('.rk-search input').click(); await B.keyboard.type('sen')
        await B.evaluate("document.querySelector('main').dataset.probe = '1'")
        g0 = srv.stats['gets']
        await B.clock.fast_forward(65000)                           # minuta w tle
        await B.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
        ok(await until(lambda: srv.stats['gets'] > g0), 'B: powrót do aplikacji (po > 60 s) — pełna runda automatycznie')
        await B.wait_for_timeout(2500)
        ok(await B.evaluate("document.querySelector('main').dataset.probe") == '1' and await B.locator('.rk-search input').input_value() == 'sen'
           and await B.evaluate("document.activeElement?.type") == 'search', 'B: pobranie w trakcie wpisywania — bez przerysowania, wpis i fokus zostają')
        await B.evaluate("document.activeElement.blur()")
        ok(await until(lambda: b_has(250)), 'B: po zakończeniu wpisywania widok pokazuje zmianę z A (250)')

        # ---------- D-085: automatyczne pobieranie zmian na otwartym, widocznym „MacBooku” (B) — bez żadnej akcji
        async def b_input(v):
            x = await B.locator('.inv-item').first.locator('input[type=number]').input_value()
            return x != '' and float(x) == v
        async def pushed_after(n): return await until(lambda: len(srv.events) > n)
        await B.goto(URL + '#/zapasy?q=Banan'); await B.wait_for_selector('.inv-item'); await B.keyboard.press('Shift')   # interakcja
        await B.wait_for_timeout(1500)
        n = len(srv.events); await set_stock(A, URL, 'Banan', 260); ok(await pushed_after(n), 'A: zmiana 260 wysłana')
        k0 = checks_of(srv, 'B')
        await B.clock.fast_forward(31000)
        ok(await until(lambda: checks_of(srv, 'B') > k0), 'B (komputer): lekkie sprawdzenie zmian po 30 s, bez żadnej akcji')
        ok(await until(lambda: b_input(260)), 'B: zmiana z A widoczna sama — bez klikania i przeładowania (sprawdzenie → pełna runda)')
        # sprawdzenie bez zmian: jedno małe zapytanie, bez pełnej rundy
        i0 = len(srv.calls); await B.clock.fast_forward(31000)
        ok(await until(lambda: checks_of(srv, 'B') > k0 + 1), 'B: kolejne sprawdzenie po 30 s')
        await B.wait_for_timeout(800)
        mine = [c for c in srv.calls[i0:] if 'p2027-test-B' in c[0]]
        ok(len(mine) == 1 and mine[0][4] <= 4, f'B: sprawdzenie bez zmian = jedno zapytanie, {mine[0][4] if mine else "?"} B treści, bez pełnej rundy ({len(mine)} zapytań)')
        # powrót do okna (focus): od razu, najwyżej raz na 10 s
        n = len(srv.events); await set_stock(A, URL, 'Banan', 270); ok(await pushed_after(n), 'A: zmiana 270 wysłana')
        await B.clock.fast_forward(11000)
        k1 = checks_of(srv, 'B')
        await B.evaluate("window.dispatchEvent(new Event('focus'))")
        ok(await until(lambda: checks_of(srv, 'B') > k1, timeout=3) and await until(lambda: b_input(270), timeout=5), 'B: powrót do okna — sprawdzenie od razu, zmiana z A pobrana')
        await B.wait_for_timeout(500); k1 = checks_of(srv, 'B')
        await B.evaluate("window.dispatchEvent(new Event('focus'))"); await B.wait_for_timeout(1000)
        ok(checks_of(srv, 'B') == k1, f'B: drugi powrót do okna w ciągu 10 s — bez kolejnego sprawdzenia ({checks_of(srv, "B") - k1})')
        # bezczynność: po 5 min bez interakcji co 5 min; interakcja przywraca 30 s
        await B.clock.fast_forward(301000); await B.wait_for_timeout(800)
        k2 = checks_of(srv, 'B')
        await B.clock.fast_forward(120000); await B.wait_for_timeout(800)
        ok(checks_of(srv, 'B') == k2, 'B: bezczynność > 5 min — w kolejnych 2 min bez sprawdzeń (interwał 5 min)')
        await B.goto(URL + '#/dane'); await B.wait_for_selector('.dn-cloud-auto')
        ok('co 5 min (bezczynność)' in await B.inner_text('.dn-cloud-auto'), 'B: stan „sprawdzanie zmian co 5 min (bezczynność)”')
        await B.keyboard.press('Shift')
        ok(await until(lambda: checks_of(srv, 'B') > k2), 'B: interakcja kończy bezczynność — sprawdzenie od razu')
        ok(await until(lambda: B.evaluate("/co 30 s/.test(document.querySelector('.dn-cloud-auto').textContent)")), 'B: znów „sprawdzanie zmian co 30 s”')
        # przełącznik „Automatyczne pobieranie zmian”: wyłączony = zero sprawdzeń
        pb = B.get_by_role('button', name='Automatyczne pobieranie zmian')
        ok(await pb.get_attribute('aria-pressed') == 'true', 'B: „Automatyczne pobieranie zmian” domyślnie włączone')
        await audit(B, 'B 1280 jasny: przełączniki automatu i pobierania')
        await pb.click(); await msg(B, 'pobieranie zmian wyłączone'); await B.wait_for_timeout(1000)
        k3 = checks_of(srv, 'B'); i3 = len(srv.calls); await B.clock.fast_forward(95000); await B.wait_for_timeout(800)
        await B.evaluate("window.dispatchEvent(new Event('focus'))"); await B.wait_for_timeout(500)
        ok(checks_of(srv, 'B') == k3, f'B: pobieranie wyłączone — zero sprawdzeń (także przy powrocie do okna) {[(c[2], c[3][:50]) for c in srv.calls[i3:] if "test-B" in c[0]]}')
        ok('pobierane przy otwarciu i powrocie' in await B.inner_text('.dn-cloud-auto'), 'B: stan „pobierane przy otwarciu i powrocie do aplikacji”')
        await B.get_by_role('button', name='Automatyczne pobieranie zmian').click(); await msg(B, 'pobieranie zmian włączone')
        # offline: zero sprawdzeń; powrót sieci — pełna runda i znów sprawdzanie
        await B.context.set_offline(True)
        k4 = calls_of(srv, 'B'); await B.clock.fast_forward(95000); await B.wait_for_timeout(800)
        ok(calls_of(srv, 'B') == k4, 'B offline: zero zapytań (sprawdzanie wstrzymane)')
        await B.context.set_offline(False)
        ok(await until(lambda: calls_of(srv, 'B') > k4), 'B: po powrocie sieci — synchronizacja od razu')
        # telefon (A): co 60 s, nie co 30 s
        await A.goto(URL + '#/dzis'); await A.wait_for_selector('main h1'); await A.keyboard.press('Shift')
        await A.clock.fast_forward(11000); await A.evaluate("window.dispatchEvent(new Event('focus'))")
        await until(lambda: checks_of(srv, 'A') > 0, timeout=5); await A.wait_for_timeout(500)
        ka = checks_of(srv, 'A')
        await A.clock.fast_forward(35000); await A.wait_for_timeout(800)
        ok(checks_of(srv, 'A') == ka, 'A (telefon): po 35 s jeszcze bez sprawdzenia')
        await A.clock.fast_forward(30000)
        ok(await until(lambda: checks_of(srv, 'A') > ka), 'A (telefon): sprawdzenie po 60 s')

        # ---------- offline i konflikt: A zmienia offline (bez żadnych zapytań), B później; powrót sieci = wysyłka automatycznie
        await A.context.set_offline(True)
        c0 = event_calls(srv)
        await set_stock(A, URL, 'Banan', 111)
        await dane(A, URL); await A.wait_for_timeout(2500)
        ok('Brak połączenia' in await A.inner_text('.dn-cloud-auto'), 'A offline: stan „brak połączenia — wyślę po powrocie internetu”, bez banerów')
        ok(await A.locator('.banner.err').count() == 0, 'A offline: bez komunikatu błędu przy zmianie')
        await A.goto(URL + '#/dzis'); await A.wait_for_selector('main h1')
        ok(await stock(A, URL, 'Banan') == 111, 'A offline: aplikacja działa, zmiana zapisana lokalnie')
        await dane(A, URL); t = await sync(A, 'Brak połączenia')
        ok('bezpieczne na tym urządzeniu' in t, 'A offline: „Synchronizuj teraz” — czytelny komunikat, bez utraty danych')
        await set_stock(B, URL, 'Banan', 222)                      # późniejsza zmiana (nowszy HLC)
        ok(await until(lambda: event_calls(srv) > c0), 'B: zmiana wysłana automatycznie')
        c1 = len(srv.events)
        await A.context.set_offline(False)
        ok(await until(lambda: len(srv.events) == c1 + 1), 'A: po powrocie sieci zaległa zmiana wysłana automatycznie')
        async def a_has(v): return (await stock(A, URL, 'Banan')) == v
        ok(await until(lambda: a_has(222)), 'A: po powrocie sieci pobrana nowsza zmiana z B (222)')
        await B.clock.fast_forward(65000); await B.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
        await B.wait_for_timeout(2000)
        a_b, b_b = await stock(A, URL, 'Banan'), await stock(B, URL, 'Banan')
        ok(a_b == b_b == 222, f'konflikt: oba urządzenia zbieżne, wygrywa nowsza zmiana (A {a_b}, B {b_b})')

        # ---------- dwie karty tego samego profilu (A i A2): powiadamianie po przeładowaniu (A4), bez błędów równoległości
        A2 = await A.context.new_page()
        A2.on('pageerror', lambda e: errs.append(str(e)))
        A2.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        await A2.goto(URL + '#/zapasy?q=Kefir'); await A2.wait_for_selector('.inv-item')
        n1 = len(srv.events)
        await plus_pack(A, URL, 'Banan', 1)                         # A2 przeładowuje bazę po powiadomieniu z A
        ok(await until(lambda: len(srv.events) == n1 + 1), 'A: zmiana wysłana')
        await A2.wait_for_timeout(500)
        await A2.locator('.inv-item').first.get_by_role('button', name='+ opakowanie', exact=False).click()
        await A.locator('.inv-item').first.get_by_role('button', name='+ opakowanie', exact=False).click()   # obie karty naraz
        ok(await until(lambda: len(srv.events) == n1 + 3), f'dwie karty: zmiany z obu kart wysłane automatycznie, bez błędów równoległości ({len(srv.events) - n1}/3)')
        k_a = await stock(A, URL, 'Kefir'); await A2.reload(); await A2.wait_for_selector('.inv-item')
        k_a2 = float(await A2.locator('.inv-item').first.locator('input[type=number]').input_value())
        ok(k_a == k_a2, f'dwie karty: każda widzi zmiany drugiej po przeładowaniu bazy — powiadamianie A4 (kefir {k_a}/{k_a2})')
        await A2.close()

        # ---------- wygasły token: odświeżenie w tle
        srv.expire_all()
        await dane(A, URL); t = await sync(A)
        ok('Synchronizacja zakończona' in t and any(p == '/auth/v1/token' for _, p in srv.log[-8:]), 'A: wygasły token odświeżony bez ponownego logowania')

        # ---------- wariant jednoplikowy (file://): pierwsza synchronizacja automatycznie
        C = await page(b, False, errs, clock=True, ua='C')
        await configure(C, SINGLE, srv); await login(C); await msg(C, 'Zalogowano')
        await C.get_by_label('Hasło szyfrowania', exact=True).fill(PASS); await C.get_by_role('button', name='Odblokuj').click(); await msg(C, 'Hasło szyfrowania poprawne')
        async def c_has(v): return (await stock(C, SINGLE, 'Banan')) == v
        a_now = await stock(A, URL, 'Banan')
        ok(await until(lambda: c_has(a_now), timeout=15), f'plik lokalny (2027.html): synchronizacja automatyczna działa, stan zbieżny (banan {a_now})')

        # ---------- wygasła sesja przy otwarciu: baner poza Dane (raz, z przejściem do Dane), brak ponowień
        await C.evaluate("""() => new Promise(r => { const q = indexedDB.open('p2027'); q.onsuccess = () => { const s = q.result.transaction('meta', 'readwrite').objectStore('meta');
          const g = s.get('cloud.session'); g.onsuccess = () => { const v = g.result.v; v.refresh_token = 'nieważny'; v.expires_at = 0; s.put({ k: 'cloud.session', v }).onsuccess = () => r(); }; }; })""")
        await C.goto(SINGLE + '#/dzis'); await C.reload(); await C.wait_for_selector('main h1')
        ok(await until(lambda: C.locator('.cloud-banner').count(), timeout=10), 'C: wygasła sesja — baner poza Dane')
        ok('Sesja wygasła' in await C.inner_text('.cloud-banner') and await C.locator('.cloud-banner a[href="#/dane"]').count() == 1, 'C: baner z przyczyną i przejściem do Dane')
        await audit(C, 'C 1280 ciemny: baner synchronizacji')
        await C.get_by_role('button', name='Zamknij komunikat synchronizacji').click()
        ok(await C.locator('.cloud-banner').count() == 0, 'C: baner zamknięty')
        await C.goto(SINGLE + '#/cfa'); await C.wait_for_selector('main h1')
        ok(await C.locator('.cloud-banner').count() == 0, 'C: zamknięty baner nie wraca w tej sesji')
        await C.reload(); await C.wait_for_selector('main h1')
        ok(await until(lambda: C.locator('.cloud-banner').count(), timeout=10), 'C: ponowne uruchomienie — wygasła sesja zgłaszana ponownie (nie „cicho wyłączona”)')
        await dane(C, SINGLE)
        ok(await C.get_by_label('E-mail konta').count() == 1, 'C: Dane — formularz logowania (sesja wygasła)')
        kc = calls_of(srv, 'C'); await C.clock.fast_forward(95000); await C.wait_for_timeout(800)
        await C.evaluate("window.dispatchEvent(new Event('focus'))"); await C.wait_for_timeout(500)
        ok(calls_of(srv, 'C') == kc, 'C: synchronizacja wstrzymana (wygasła sesja) — zero sprawdzeń')

        # ---------- wylogowanie i odłączenie (B)
        await dane(B, URL)
        await B.get_by_role('button', name='Wyloguj').click(); await msg(B, 'Wylogowano')
        ok(await B.get_by_label('E-mail konta').count() == 1 and ('POST', '/auth/v1/logout') in srv.log, 'B: wylogowanie — formularz logowania, sesja unieważniona na serwerze')
        c2 = calls_of(srv, 'B')
        await set_stock(B, URL, 'Banan', 5); await B.wait_for_timeout(3000); await B.clock.fast_forward(95000); await B.wait_for_timeout(800)
        ok(calls_of(srv, 'B') == c2 and await B.locator('.cloud-banner').count() == 0, 'B: po wylogowaniu automat i sprawdzanie cicho wyłączone (bez zapytań i banerów)')
        await dane(B, URL)
        await B.locator('.dn-cloud-cfg > summary').click()
        await B.get_by_role('button', name='Odłącz to urządzenie').click(); await msg(B, 'odłączone')
        ok(await B.get_by_label('Project URL').count() == 1, 'B: odłączenie — powrót do konfiguracji')
        ok(await stock(B, URL, 'Banan') == 5, 'B: dane lokalne po odłączeniu bez zmian')
        ok(not errs, f'brak błędów konsoli ({errs[:2]})')
        await b.close()
    srv.stop(); web.shutdown()
    bad = [m for c, m in results if not c]
    print(f'\nCHMURA E2E: {len(results)} kontroli, zaliczonych: {len(results) - len(bad)}, błędów: {len(bad)}')
    sys.exit(1 if bad else 0)

asyncio.run(main())
