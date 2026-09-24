"""NAPRAWA synchronizacji — testy w przeglądarce (Chromium) na dwóch ODDZIELNYCH profilach (osobne bazy danych,
jak komputer i iPhone albo Safari i aplikacja z ekranu początkowego).
Zakres: A) ręczna synchronizacja danych 2027-sync.json w obu kierunkach + niezależne zmiany + ostrzeżenie o starszym pliku;
B) zdarzenia z nowszej wersji (baner, brak utraty); C) aktualizacja KODU tylko za zgodą użytkownika;
D) przejście ze starego service workera (wersja obecnie zainstalowana na urządzeniach).
Uruchomienie: SOURCES_DIR=… python3 tests/e2e/sync_update.py   (wymaga Playwright + Chromium; buduje dist/ kilka razy)."""
import asyncio, json, os, pathlib, shutil, subprocess, sys, tempfile, threading, http.server, datetime as dt
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
BACKUP = pathlib.Path(os.environ.get('SOURCES_DIR', '/nonexistent')) / 'zapasy_kopia_2026-09-22.json'
results = []
def ok(c, m): results.append((bool(c), m)); print(('OK  ' if c else 'BŁĄD'), m)
skipped = []
def skip(m): skipped.append(m); print('POMINIĘTO', m)

SERVE = {'dir': None}
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=SERVE['dir'], **k)
    def log_message(s, *a): pass
    def end_headers(s): s.send_header('Cache-Control', 'no-cache'); super().end_headers()

def build(tag):
    subprocess.run(['node', 'tools/build.mjs'], cwd=ROOT, check=True, capture_output=True, env={**os.environ, 'BUILD_TAG': tag})
    d = pathlib.Path(tempfile.mkdtemp()) / tag
    shutil.copytree(ROOT / 'dist/web', d)
    return d

def deploy(src):
    # Uwaga środowiska testowego: serwer odpowiada 304 wg daty modyfikacji (dokładność 1 s). Kopie dostają BIEŻĄCĄ
    # datę (shutil.copy, nie copy2) i odczekujemy >1 s — inaczej dwie wersje z tej samej sekundy wyglądałyby identycznie.
    import time; time.sleep(1.1)
    for f in pathlib.Path(SERVE['dir']).iterdir():
        (shutil.rmtree if f.is_dir() else os.remove)(f)
    shutil.copytree(src, SERVE['dir'], dirs_exist_ok=True, copy_function=shutil.copy)

LEGACY_SW = """const CACHE = 'p2027-legacy';
const SHELL = SHELL_LIST;
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('p2027-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).catch(() => caches.match('index.html'))));
});"""

async def stock(pg, name):
    await pg.goto(URL + '#/zapasy?q=' + name); await pg.wait_for_selector('.inv-item')
    return float(await pg.locator('.inv-item').first.locator('input[type=number]').input_value())

async def export(pg):
    await pg.goto(URL + '#/dane'); await pg.wait_for_selector('text=Stan zapisu')
    async with pg.expect_download() as d:
        await pg.get_by_role('button', name='Wyślij do iCloud').click()
    p = pathlib.Path(tempfile.mkdtemp()) / '2027-sync.json'
    shutil.copy(await (await d.value).path(), p)
    return p

async def import_file(pg, path, expect_new=True):
    await pg.goto(URL + '#/dane'); await pg.wait_for_selector('text=Stan zapisu')
    await pg.set_input_files('input[type=file]', str(path)); await pg.wait_for_selector('dialog[open]')
    txt = await pg.inner_text('dialog')
    if expect_new and 'Scal dane' in txt:
        await pg.click('dialog >> text=Scal dane'); await pg.wait_for_selector('text=Zaimportowano')
    else:
        await pg.click('dialog >> text=Zamknij') if 'Zamknij' in txt else await pg.click('dialog >> text=Anuluj')
    return txt

async def main():
    global URL
    v1, v2 = build('v1'), build('v2')
    legacy = pathlib.Path(tempfile.mkdtemp()) / 'legacy'; shutil.copytree(v1, legacy)
    shell = json.loads((v1 / 'sw.js').read_text().split('const SHELL = ')[1].split(';')[0])
    (legacy / 'sw.js').write_text(LEGACY_SW.replace('SHELL_LIST', json.dumps(shell)))
    idx = (legacy / 'index.html').read_text()
    (legacy / 'index.html').write_text(idx.replace('-v1"', '-legacy"'))
    SERVE['dir'] = tempfile.mkdtemp(); deploy(v1)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8791), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
    URL = 'http://localhost:8791/index.html'
    today = dt.date.today()
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        desk = await (await b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)).new_page()
        phone = await (await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, accept_downloads=True)).new_page()
        for p in (desk, phone): await p.add_init_script('delete Navigator.prototype.share; delete Navigator.prototype.canShare;')

        # ---------- A) ręczna synchronizacja danych ----------
        if BACKUP.exists():
            await desk.goto(URL); await import_file(desk, BACKUP)
        else:
            skip('import kopii ZAPASY — brak SOURCES_DIR (stan startowy ustawiany ręcznie, reszta scenariusza działa)')
            await desk.goto(URL + '#/zapasy?q=Banan'); await desk.wait_for_selector('.inv-item')
            await desk.locator('.inv-item').first.locator('input[type=number]').fill('240'); await desk.locator('.inv-item').first.locator('input[type=number]').press('Tab')
            await desk.wait_for_selector('text=Banan: stan 240 g')   # potwierdzenie zapisu przed dalszymi krokami (bez wyścigu)
            # wartości TESTOWE (nie dane użytkownika): scenariusz niezależnych zmian używa też kefiru
            await desk.goto(URL + '#/zapasy?q=Kefir'); await desk.wait_for_selector('.inv-item')
            await desk.locator('.inv-item').first.locator('input[type=number]').fill('800'); await desk.locator('.inv-item').first.locator('input[type=number]').press('Tab')
            await desk.wait_for_selector('text=Kefir 1,5%: stan 800 ml/g')
        await desk.goto(URL + '#/zapasy?q=Banan'); await desk.wait_for_selector('.inv-item')
        await desk.locator('.inv-item').first.get_by_role('button', name='+ opakowanie', exact=False).click(); await desk.wait_for_timeout(400)
        d_ban = await stock(desk, 'Banan')
        f1 = await export(desk)
        txt = await import_file(phone, f1)
        ok('Plik wyeksportowany' in txt, 'A: podgląd importu pokazuje datę eksportu i urządzenie źródłowe')
        ok(await stock(phone, 'Banan') == d_ban, f'A: komputer → telefon: banan {d_ban} na obu')
        dane = await phone.evaluate("(async()=>{location.hash='#/dane'; await new Promise(r=>setTimeout(r,400)); return document.querySelector('main').textContent})()")
        ok('Wczytany plik' in dane and 'karta przeglądarki' in dane, 'A: moduł Dane pokazuje wczytany plik i tryb uruchomienia (osobna baza)')

        # niezależne zmiany: telefon kupuje kefir, komputer kupuje banana
        await phone.goto(URL + '#/zapasy?q=Kefir'); await phone.wait_for_selector('.inv-item')
        await phone.locator('.inv-item').first.get_by_role('button', name='+ opakowanie', exact=False).click(); await phone.wait_for_timeout(400)
        await desk.goto(URL + '#/zapasy?q=Banan'); await desk.wait_for_selector('.inv-item')
        await desk.locator('.inv-item').first.get_by_role('button', name='+ opakowanie', exact=False).click(); await desk.wait_for_timeout(400)
        fp = await export(phone); fd = await export(desk)
        await import_file(desk, fp); await import_file(phone, fd)
        kd, kp, bd, bp = await stock(desk, 'Kefir'), await stock(phone, 'Kefir'), await stock(desk, 'Banan'), await stock(phone, 'Banan')
        ok(kd == kp and bd == bp, f'A: niezależne zmiany w obu kierunkach zbieżne (kefir {kd}/{kp}, banan {bd}/{bp})')
        ok(bd == d_ban + 120, f'A: oba zakupy banana zachowane ({bd} = {d_ban} + 120)')
        txt = await import_file(phone, f1, expect_new=False)
        ok('STARSZY' in txt, 'A: import starszego pliku — wyraźne ostrzeżenie')
        txt = await import_file(phone, fd, expect_new=False)
        ok('Scal dane' not in txt, 'A: ponowny import tego samego pliku — brak nowych zmian (bez duplikatów)')

        # ---------- B) zdarzenie z nowszej wersji ----------
        await phone.evaluate("""() => new Promise(r => { const q = indexedDB.open('p2027'); q.onsuccess = () => { const tx = q.result.transaction('events', 'readwrite');
          tx.objectStore('events').put({ id: 'x.future:e2e', hlc: '1790000000000:0000:dfut', dev: 'dfut', t: 'x.future', d: { a: 1 }, at: '2026-09-23T10:00:00Z', v: 1 });
          tx.oncomplete = () => r(); }; })""")
        await phone.reload(); await phone.wait_for_selector('main h1')
        ok('Niepełne przetwarzanie' in await phone.inner_text('main'), 'B: zdarzenie z nowszej wersji — widoczny baner o niepełnym przetwarzaniu')
        await phone.reload(); await phone.wait_for_selector('main h1')
        kept = await phone.evaluate("""() => new Promise(r => { const q = indexedDB.open('p2027'); q.onsuccess = () => { const g = q.result.transaction('events').objectStore('events').get('x.future:e2e'); g.onsuccess = () => r(!!g.result); }; })""")
        ok(kept, 'B: zdarzenie z nowszej wersji nie zostało usunięte z bazy po ponownym otwarciu')
        ok(await stock(phone, 'Banan') == bp, 'B: zapasy przeliczane poprawnie mimo nieznanego zdarzenia')

        # ---------- C) aktualizacja kodu tylko za zgodą ----------
        upd = await (await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True)).new_page()
        await upd.goto(URL); await upd.wait_for_function('navigator.serviceWorker && navigator.serviceWorker.controller')
        await upd.goto(URL + '#/zapasy?q=Banan'); await upd.wait_for_selector('.inv-item')
        await upd.locator('.inv-item').first.locator('input[type=number]').fill('777'); await upd.locator('.inv-item').first.locator('input[type=number]').press('Tab'); await upd.wait_for_timeout(300)
        ver = lambda: upd.evaluate("document.querySelector('meta[name=app-version]').content")
        ok((await ver()).endswith('-v1'), 'C: działa wersja v1')
        deploy(v2)
        await upd.evaluate("document.dispatchEvent(new Event('visibilitychange'))")   # powrót aplikacji na ekran
        try:
            await upd.wait_for_selector('text=Nowa wersja — odśwież', timeout=15000)
        except Exception:
            print('DIAG C:', await upd.evaluate("navigator.serviceWorker.getRegistration().then(r => ({active: r.active && r.active.state, waiting: !!r.waiting, installing: !!r.installing}))"),
                  await upd.evaluate("caches.keys()"), await ver())
            raise
        await upd.wait_for_timeout(2500)
        ok((await ver()).endswith('-v1'), 'C: nowa wersja pobrana, ale BEZ automatycznego przeładowania')
        async with upd.expect_navigation():
            await upd.get_by_role('button', name='Nowa wersja — odśwież').first.click()
        ok((await ver()).endswith('-v2'), 'C: po kliknięciu użytkownika działa v2')
        ok(await stock(upd, 'Banan') == 777, 'C: dane nienaruszone przez aktualizację kodu')
        await upd.context.set_offline(True); await upd.reload(); await upd.wait_for_selector('main h1')
        ok((await ver()).endswith('-v2'), 'C: offline po aktualizacji działa nowa wersja z pamięci podręcznej')
        await upd.context.set_offline(False)

        # ---------- D) przejście ze starego service workera (obecny stan urządzeń) ----------
        deploy(legacy)
        old = await (await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True)).new_page()
        await old.goto(URL); await old.wait_for_function('navigator.serviceWorker && navigator.serviceWorker.controller')
        await old.goto(URL + '#/zapasy?q=Banan'); await old.wait_for_selector('.inv-item')
        await old.locator('.inv-item').first.locator('input[type=number]').fill('555'); await old.locator('.inv-item').first.locator('input[type=number]').press('Tab'); await old.wait_for_timeout(300)
        vold = lambda: old.evaluate("document.querySelector('meta[name=app-version]').content")
        ok((await vold()).endswith('-legacy'), 'D: działa stara wersja (stary service worker)')
        deploy(v2)
        await old.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
        # czekamy na AKTYWACJĘ nowego SW (usuwa starą pamięć podręczną), a nie tylko na instalację
        await old.wait_for_function("caches.keys().then(k => k.some(x => x.startsWith('p2027-v2-')) && !k.includes('p2027-legacy'))", timeout=15000)
        await old.wait_for_timeout(1500)
        ok((await vold()).endswith('-legacy'), 'D: przejście ze starego SW bez przeładowania otwartej strony')
        await old.reload(); await old.wait_for_selector('main h1')
        ok((await vold()).endswith('-v2'), 'D: przy następnym starcie działa nowa wersja')
        ok(await stock(old, 'Banan') == 555, 'D: dane zachowane przy przejściu ze starej wersji')
        await b.close()
    srv.shutdown()
    subprocess.run(['node', 'tools/build.mjs'], cwd=ROOT, check=True, capture_output=True)   # przywrócenie zwykłego buildu
    bad = [m for c, m in results if not c]
    print(f'\nSYNC/UPDATE: {len(results)} kontroli, zaliczonych: {len(results) - len(bad)}, błędów: {len(bad)}, pominiętych bloków: {len(skipped)}')
    sys.exit(1 if bad else 0)

asyncio.run(main())
