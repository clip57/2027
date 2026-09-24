"""Synchronizacja przez chmurę (D-078, Etap 2) — testy w przeglądarce (Chromium) na ODDZIELNYCH profilach (osobne bazy,
jak iPhone i komputer) z lokalnym FAŁSZYWYM serwerem Supabase (tests/e2e/fake_supabase.py). Adres, klucz, konto i hasła
fikcyjne; dane zapasów syntetyczne (D-065). Zakres: konfiguracja (odrzucenie klucza sekretnego), logowanie, hasło
szyfrowania (pierwsze urządzenie z powtórzeniem, błędne hasło na drugim), „Synchronizuj teraz” w obu kierunkach, brak
synchronizacji bez kliknięcia, brak treści jawnej na serwerze, tryb offline, konflikt, wygasła sesja, pamięć kluczy po
przeładowaniu, wylogowanie, odłączenie, wariant jednoplikowy (file://), axe-core i cele dotykowe w każdym kroku.
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

async def page(b, mobile, errs, theme='dark'):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 900}
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
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
    return float(await pg.locator('.inv-item').first.locator('input[type=number]').input_value())

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
        A = await page(b, True, errs)                 # „iPhone” 390 px, ciemny
        B = await page(b, False, errs, 'light')       # „komputer” 1280 px, jasny

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

        # ---------- dane + brak synchronizacji bez kliknięcia
        await A.set_input_files('input[type=file]', str(syn)); await A.wait_for_selector('dialog[open]')
        await A.click('dialog >> text=Scal dane'); await A.wait_for_selector('text=Zaimportowano')
        before = len(srv.log)
        await set_stock(A, URL, 'Banan', 300); await A.reload(); await dane(A, URL); await A.wait_for_timeout(500)
        ok(not any(p.startswith('/rest/v1/events') for _, p in srv.log[before:]), 'A: bez kliknięcia nic nie jest wysyłane (brak synchronizacji automatycznej)')
        ok('Do wysłania do chmury' in await status(A), 'A: licznik zmian czekających na wysłanie')
        ok('Wszystkie zmiany' not in await status(A) and await A.locator('.dn-cloud.has-unsent').count() == 1, 'A: sekcja oznaczona jako niewysłana')
        await audit(A, 'A 390 ciemny: gotowe do synchronizacji')
        t = await sync(A)
        n_a = len(srv.events)
        ok('wysłane:' in t and n_a > 10, f'A: „Synchronizuj teraz” wysłało {n_a} zmian ({t.strip()[:80]})')
        blob = ' '.join(e['sid'] + e['blob'] for e in srv.events) + str(srv.keys)
        ok(not any(s in blob for s in ('banan', 'Banan', 'inv.count', 'inv.move', '"prod"', '"hlc"')) and all(':' not in e['sid'] for e in srv.events),
           'A: serwer przechowuje tylko szyfrogramy (bez nazw produktów, typów i identyfikatorów zdarzeń)')
        ok('Wszystkie zmiany z tego urządzenia są w chmurze' in await status(A), 'A: po synchronizacji — wszystko wysłane')
        await A.reload(); await A.wait_for_selector('.dn-cloud')
        ok(await A.get_by_role('button', name='Synchronizuj teraz').count() == 1, 'A: po przeładowaniu sesja i klucze zachowane (bez ponownego hasła)')
        stored = await A.evaluate("""() => new Promise(r => { const q = indexedDB.open('p2027'); q.onsuccess = () => { const g = q.result.transaction('meta').objectStore('meta').get('cloud.keys'); g.onsuccess = () => r(g.result && g.result.v && [g.result.v.enc.extractable, g.result.v.enc.type, JSON.stringify(g.result.v)]); }; })""")
        ok(stored and stored[0] is False and stored[1] == 'secret' and PASS not in stored[2], 'A: klucze w IndexedDB jako nieeksportowalne CryptoKey, bez hasła')

        # ---------- drugie urządzenie (B): błędne hasło szyfrowania, pobranie
        await configure(B, URL, srv); await login(B); await msg(B, 'Zalogowano')
        await B.get_by_label('Hasło szyfrowania', exact=True).fill('zupełnie inne hasło')
        await B.get_by_role('button', name='Odblokuj').click(); await msg(B, 'Nieprawidłowe hasło szyfrowania')
        ok(not await B.get_by_label('Powtórz hasło szyfrowania').is_visible(), 'B: drugie urządzenie — bez powtórzenia hasła')
        await audit(B, 'B 1280 jasny: błędne hasło szyfrowania')
        await B.get_by_label('Hasło szyfrowania', exact=True).fill(PASS)
        await B.get_by_role('button', name='Odblokuj').click(); await msg(B, 'Hasło szyfrowania poprawne')
        t = await sync(B)
        ok(f'Pobrane z chmury: {n_a}' in t, f'B: pobrano {n_a} zmian ({t.strip()[:80]})')
        await audit(B, 'B 1280 jasny: po synchronizacji')
        ok(await stock(B, URL, 'Banan') == 300, 'B: stan banana jak na A (300)')

        # ---------- offline i konflikt: A zmienia offline, B później online; zbieżność do nowszej zmiany
        await A.context.set_offline(True)
        await set_stock(A, URL, 'Banan', 111)
        await dane(A, URL); t = await sync(A, 'Brak połączenia')
        ok('bezpieczne na tym urządzeniu' in t, 'A offline: „Synchronizuj teraz” — czytelny komunikat, bez utraty danych')
        await A.goto(URL + '#/dzis'); await A.wait_for_selector('main h1')
        ok(await stock(A, URL, 'Banan') == 111, 'A offline: aplikacja działa, zmiana zapisana lokalnie')
        await set_stock(B, URL, 'Banan', 222)                      # późniejsza zmiana (nowszy HLC)
        await A.context.set_offline(False)
        await dane(A, URL); t = await sync(A); ok('wysłane: 1' in t, f'A online: wysłano zaległą zmianę ({t.strip()[:60]})')
        await dane(B, URL); await sync(B); await dane(A, URL); await sync(A)
        a_ban, b_ban = await stock(A, URL, 'Banan'), await stock(B, URL, 'Banan')
        ok(a_ban == b_ban == 222, f'konflikt: oba urządzenia zbieżne, wygrywa nowsza zmiana (A {a_ban}, B {b_ban})')

        # ---------- wygasły token: odświeżenie w tle
        srv.expire_all()
        await dane(A, URL); t = await sync(A)
        ok('wszystko aktualne' in t and any(p == '/auth/v1/token' for _, p in srv.log[-6:]), 'A: wygasły token odświeżony bez ponownego logowania')

        # ---------- wariant jednoplikowy (file://): pobranie wszystkiego
        C = await page(b, False, errs)
        await configure(C, SINGLE, srv); await login(C); await msg(C, 'Zalogowano')
        await C.get_by_label('Hasło szyfrowania', exact=True).fill(PASS); await C.get_by_role('button', name='Odblokuj').click(); await msg(C, 'Hasło szyfrowania poprawne')
        await sync(C)
        ok(await stock(C, SINGLE, 'Banan') == 222, 'plik lokalny (2027.html): synchronizacja z chmurą działa, stan zbieżny')

        # ---------- wylogowanie i odłączenie (B)
        await dane(B, URL)
        await B.get_by_role('button', name='Wyloguj').click(); await msg(B, 'Wylogowano')
        ok(await B.get_by_label('E-mail konta').count() == 1 and ('POST', '/auth/v1/logout') in srv.log, 'B: wylogowanie — formularz logowania, sesja unieważniona na serwerze')
        await B.locator('.dn-cloud-cfg > summary').click()
        await B.get_by_role('button', name='Odłącz to urządzenie').click(); await msg(B, 'odłączone')
        ok(await B.get_by_label('Project URL').count() == 1, 'B: odłączenie — powrót do konfiguracji')
        ok(await stock(B, URL, 'Banan') == 222, 'B: dane lokalne po odłączeniu bez zmian')
        ok(not errs, f'brak błędów konsoli ({errs[:2]})')
        await b.close()
    srv.stop(); web.shutdown()
    bad = [m for c, m in results if not c]
    print(f'\nCHMURA E2E: {len(results)} kontroli, zaliczonych: {len(results) - len(bad)}, błędów: {len(bad)}')
    sys.exit(1 if bad else 0)

asyncio.run(main())
