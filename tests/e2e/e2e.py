"""Testy E2E (Chromium, Playwright): oba warianty budowy, iPhone 390×844 i komputer 1280×800.
Uruchomienie: python3 tests/e2e/e2e.py  (wymaga dist/ oraz opcjonalnie SOURCES_DIR z kopią ZAPASY)."""
import asyncio, json, os, sys, threading, http.server, functools, tempfile, pathlib
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
BACKUP = os.environ.get('SOURCES_DIR') and pathlib.Path(os.environ['SOURCES_DIR']) / 'zapasy_kopia_2026-09-22.json'
ROUTES = ['#/dzis', '#/dzis?d=2026-10-26', '#/dzis?d=2026-09-24', '#/dane', '#/wiecej', '#/dieta', '#/zapasy', '#/trening', '#/cfa', '#/suplementy', '#/bezpieczenstwo']
results = []
def ok(cond, msg): results.append((bool(cond), msg)); print(('OK  ' if cond else 'BŁĄD'), msg)

def serve(port):
    class Q(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT / 'dist/web'), **k)
        def log_message(self, *a): pass
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), Q)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

async def run_variant(pw, name, url, mobile):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, accept_downloads=True, locale='pl-PL', timezone_id='Europe/Warsaw')
    # Okno udostępniania (navigator.share) nie istnieje w przeglądarce testowej — sprawdzana jest ścieżka „pobierz plik”.
    # Ścieżka share wymaga testu akceptacyjnego na iPhonie/Macu.
    await ctx.add_init_script('delete Navigator.prototype.share; delete Navigator.prototype.canShare;')
    pg = await ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    tag = f'{name} {vp["width"]}px'
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.slot')
    for r in ROUTES:
        await pg.goto(url + r); await pg.wait_for_timeout(250)
        sw = await pg.evaluate('document.documentElement.scrollWidth')
        ok(sw <= vp['width'], f'{tag} {r}: brak przewijania w poziomie ({sw}px)')
    await pg.goto(url + '#/dzis?d=2026-10-26'); await pg.wait_for_selector('.slot')
    titles = await pg.eval_on_selector_all('.slot-title', 'e => e.map(x => x.textContent)')
    ok(titles.count('Mock CFA — sesja 1') == 2 and titles.count('Wolne') >= 2, f'{tag} dzień mocka: sesje w A–D, E/F „Wolne” (D-036)')
    ok(any('Obiad (16:23)' in t for t in await pg.eval_on_selector_all('.slot-items li', 'e => e.map(x => x.textContent)')), f'{tag} obiad opisany jako 16:23 (D-037)')
    await pg.goto(url + '#/dzis?d=2026-09-21'); await pg.wait_for_selector('.slot')
    main = await pg.inner_text('main')
    ok(main.lower().count('chondroityn') == 2, f'{tag} chondroityna tylko 2 razy (07:00 i 21:00) — brak dublowania (D-001)')
    ok('Pomiar wagi i ciśnienia na czczo po toalecie.' in main, f'{tag} pomiar wagi i ciśnienia (D-038)')
    ok('Curriculum 2026 Vol 1 (QM), s. 3–13 (11 s.)' in main, f'{tag} źródło i strony w bloku CFA (D-039)')
    chips = await pg.eval_on_selector_all('.topline .chip', 'e => e.map(x => x.textContent)')
    ok('UPPER 1 + sauna' in chips, f'{tag} nazwa treningu w nagłówku (D-040): {chips}')
    if mobile:
        await pg.goto(url + '#/dane'); await pg.wait_for_selector('h1')
        small = await pg.evaluate('''[...document.querySelectorAll('button, .tabs a')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(r => r.height < 44 || r.width < 44).length''')
        ok(small == 0, f'{tag} elementy dotykowe ≥ 44 px (za małych: {small})')
    # --- import kopii ZAPASY przez interfejs
    if BACKUP and BACKUP.exists():
        await pg.goto(url + '#/dane'); await pg.wait_for_selector('text=Stan zapisu')
        await pg.set_input_files('input[type=file]', str(BACKUP))
        await pg.wait_for_selector('dialog[open]')
        txt = await pg.inner_text('dialog')
        ok('Nowe zmiany' in txt and '55' in txt, f'{tag} podgląd importu kopii ZAPASY: 55 zmian (51 stanów + 3 suplementy D-015 + archiwum)')
        await pg.click('dialog >> text=Scal dane'); await pg.wait_for_selector('text=Zaimportowano 55 zmian')
        backup = json.loads(BACKUP.read_text(encoding='utf8'))
        await pg.reload(); await pg.wait_for_selector('table.data')
        rows = await pg.eval_on_selector_all('table.data tbody tr', 'e => e.map(r => [...r.children].map(c => c.textContent))')
        by = {r[0]: r for r in rows}
        ok(by.get('Banan', [None, ''])[1].startswith('240'), f'{tag} po przeładowaniu stan zachowany: Banan {by.get("Banan", ["", "?"])[1]} (kopia: {backup["stocks"]["banan"]} g na 22.09)')
        ok(by.get('Glukozamina', [None, ''])[1].startswith('180'), f'{tag} glukozamina 180 kaps. (D-015)')
        ok(by.get('Cynk', ['', '', '', ''])[3] == 'Nieśledzony', f'{tag} cynk nieśledzony (D-016)')
        ok(len(rows) == 55, f'{tag} tabela kontroli: {len(rows)} pozycji')
        # --- eksport i ponowny import (idempotencja)
        async with pg.expect_download() as dl:
            await pg.get_by_role('button', name='Wyślij do iCloud').click()
        d = await dl.value
        path = await d.path()
        bundle = json.loads(pathlib.Path(path).read_text(encoding='utf8'))
        ok(bundle['format'] == '2027-sync' and bundle['count'] == 55 and len(bundle['sha256']) == 64, f'{tag} eksport 2027-sync.json: {bundle["count"]} zmian, suma kontrolna')
        await pg.wait_for_selector('text=Wszystkie zmiany z tego urządzenia zostały wysłane')
        ok(True, f'{tag} po eksporcie brak niewysłanych zmian')
        tmp = pathlib.Path(tempfile.mkdtemp()) / '2027-sync.json'; tmp.write_text(json.dumps(bundle), encoding='utf8')
        await pg.set_input_files('input[type=file]', str(tmp)); await pg.wait_for_selector('dialog[open]')
        txt = await pg.inner_text('dialog')
        ok('Scal dane' not in txt and 'Już znane' in txt, f'{tag} ponowny import tego samego pliku: 0 nowych zmian')
        await pg.click('dialog >> text=Zamknij')
        for r in ROUTES:  # szerokość ponownie — z danymi (tabela stanów) — wcześniej przeoczone
            await pg.goto(url + r); await pg.wait_for_timeout(250)
            sw = await pg.evaluate('Math.max(...[...document.querySelectorAll(".panel, main")].map(e => Math.ceil(e.getBoundingClientRect().right)), document.documentElement.scrollWidth)')
            ok(sw <= vp['width'], f'{tag} {r} z danymi: nic nie wychodzi poza ekran ({sw}px)')
        pack = os.environ.get('PRIVATE_PACK')
        if pack and pathlib.Path(pack).exists():
            await pg.goto(url + '#/dane'); await pg.wait_for_selector('text=Stan zapisu')
            await pg.set_input_files('input[type=file]', pack); await pg.wait_for_selector('dialog[open]')
            txt = await pg.inner_text('dialog')
            ok('Pakiet prywatny' in txt and 'Scal dane' in txt, f'{tag} pakiet prywatny rozpoznany')
            await pg.click('dialog >> text=Scal dane'); await pg.wait_for_selector('text=Zaimportowano 1 zmian')
            has = await pg.evaluate('''new Promise(r => { const q = indexedDB.open('p2027'); q.onsuccess = () => { const g = q.result.transaction('events').objectStore('events').getAll(); g.onsuccess = () => r(g.result.some(e => e.t === 'private.pack' && e.d.pack.sections.length === 2)); }; })''')
            ok(has, f'{tag} pakiet prywatny zapisany w bazie (2 sekcje)')
    else:
        ok(True, f'{tag} (pominięto import — brak pliku kopii w SOURCES_DIR)')
    # --- offline (tylko wariant web z service workerem)
    if name == 'web':
        await pg.goto(url + '#/dzis')
        await pg.evaluate('navigator.serviceWorker.ready')
        await pg.reload(); await pg.wait_for_function('navigator.serviceWorker.controller !== null')
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_selector('.slot', timeout=8000)
        ok(True, f'{tag} działa offline po przeładowaniu (service worker)')
        await ctx.set_offline(False)
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.slot')
    await pg.screenshot(path=str(ROOT / f'tests/e2e/shot-{name}-{vp["width"]}-dzis.png'))
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('h1')
    await pg.screenshot(path=str(ROOT / f'tests/e2e/shot-{name}-{vp["width"]}-dane.png'), full_page=False)
    ok(not errs, f'{tag} brak błędów konsoli ({errs[:2]})')
    await b.close()

async def main():
    srv = serve(8765)
    async with async_playwright() as pw:
        for mobile in (True, False):
            await run_variant(pw, 'web', 'http://localhost:8765/index.html', mobile)
            await run_variant(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), mobile)
    srv.shutdown()
    bad = [m for c, m in results if not c]
    print(f'\nE2E: {len(results)} kontroli, błędów: {len(bad)}')
    sys.exit(1 if bad else 0)

asyncio.run(main())
