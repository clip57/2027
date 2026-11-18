"""Testy w silniku WebKit (D-115, T4 audytu 10.11) — ten sam silnik co Safari na iPhonie i Macu. Uruchamiane w workflow „Testy 2027”
(`npm run e2e:webkit`) obok testów w Chromium. Wymaga `python3 -m playwright install --with-deps webkit`.

Zakres (to, co w tym projekcie psuło się tylko w Safari albo zależy od silnika): wszystkie widoki obu wariantów buildu na iPhonie (WebKit
z emulacją dotyku, 390 px) i w Safari na komputerze (1280 px) — bez błędów JS, bez przewijania w poziomie, bez artefaktów tekstowych;
zapis w IndexedDB i odczyt po przeładowaniu; okna (otwarcie, Esc); tryb skupienia; gest przesunięcia na zdarzeniach dotyku (D-112);
CSP z Trusted Types i service worker (wariant web); paleta ⌘K; dostępność axe-core (wariant jednoplikowy — bez CSP) w obu motywach.
Dane syntetyczne (D-065), zegar testu 18.11.2026 10:40 (Europe/Warsaw)."""
import asyncio, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from e2e import serve, at, ROOT, wait_js                 # noqa: E402
from a11y import ROUTES as A11Y_ROUTES                   # noqa: E402
from playwright.async_api import async_playwright        # noqa: E402

AXE_SRC = (ROOT / 'node_modules/axe-core/axe.min.js').read_text()
CLOCK = at(2026, 11, 18, 10, 40)
ROUTES = list(dict.fromkeys(A11Y_ROUTES + ['#/ustawienia', '#/trening?v=fokus&d=2026-11-18', '#/mpw?v=fokus&d=2026-11-18', '#/mealprep?v=fokus']))
AXE_ROUTES = ['#/dzis', '#/zapasy', '#/trening?d=2026-10-19', '#/suplementy', '#/mpw', '#/mpw?v=plan', '#/kalendarz', '#/dane', '#/ustawienia', '#/mpw?v=fokus&d=2026-11-18']
results = []


def ok(cond, msg):
    results.append((bool(cond), msg)); print(('OK  ' if cond else 'BŁĄD'), msg)


async def new_page(b, mobile, theme='dark'):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
    await ctx.add_init_script(f"localStorage.setItem('p2027.theme', '{theme}')")
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.clock.install(time=CLOCK)
    return ctx, pg, errs


# Gest przesunięcia palcem zdarzeniami dotyku (WebKit nie ma CDP; Touch/TouchEvent są dostępne przy emulacji dotyku)
SWIPE = """async ([sel, dx]) => {
  const row = document.querySelector(sel); row.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 100));
  const r = row.getBoundingClientRect(), x = r.left + Math.min(110, r.width / 3), y = r.top + r.height / 2;
  // WebKit nie pozwala tworzyć Touch ze skryptu („Illegal constructor”) — zdarzenie typu touch* z polami dotyku jak w Safari
  const t = cx => ({ identifier: 1, target: row, clientX: cx, clientY: y, pageX: cx, pageY: y + scrollY });
  const fire = (type, cx, end) => { const e = new Event(type, { bubbles: true, cancelable: true });
    for (const [k, v] of [['touches', end ? [] : [t(cx)]], ['targetTouches', end ? [] : [t(cx)]], ['changedTouches', [t(cx)]]]) Object.defineProperty(e, k, { value: v });
    row.dispatchEvent(e); };
  fire('touchstart', x);
  for (let i = 1; i <= 12; i++) { fire('touchmove', x + dx * i / 12); await new Promise(r => setTimeout(r, 16)); }
  fire('touchend', x + dx, true); return true; }"""


async def run_routes(pw, name, url, mobile):
    tag = f'WebKit {name} {390 if mobile else 1280}px'
    b = await pw.webkit.launch()
    ctx, pg, errs = await new_page(b, mobile)
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('main h1')
    for r in ROUTES:
        await pg.goto(url + '#/wiecej'); await pg.goto(url + r)
        try: await pg.wait_for_selector('main h1', timeout=10000)
        except Exception: pass
        await pg.wait_for_timeout(150)
        st = await pg.evaluate("""[!!document.querySelector('main h1'), document.documentElement.scrollWidth, innerWidth,
          (document.querySelector('main')?.textContent || '').split(/\\s+/).filter(w => ['null', 'false', 'undefined', 'NaN'].includes(w) || w.startsWith('[object'))]""")
        ok(st[0] and st[1] <= st[2] and not st[3], f'{tag} {r}: nagłówek, bez przewijania w poziomie ({st[1]}/{st[2]}), bez artefaktów {st[3][:3]}')
    ok(not errs, f'{tag}: brak błędów JS na {len(ROUTES)} trasach {errs[:3]}')
    await b.close()


async def run_interactions(pw, name, url, mobile):
    tag = f'WebKit {name} {390 if mobile else 1280}px'
    b = await pw.webkit.launch()
    ctx, pg, errs = await new_page(b, mobile, 'light')
    # Zapis w IndexedDB i odczyt po przeładowaniu (dawka w Suplementacji)
    await pg.goto(url + '#/suplementy'); await pg.wait_for_selector('.dose-ck')
    k0 = await pg.locator('.dose-ck[aria-pressed="true"]').count()
    await pg.locator('.dose-ck[aria-pressed="false"]').first.click()
    await wait_js(pg, "k => document.querySelectorAll('.dose-ck[aria-pressed=\"true\"]').length > k", k0)
    await pg.reload(); await pg.wait_for_selector('.dose-ck')
    ok(await pg.locator('.dose-ck[aria-pressed="true"]').count() == k0 + 1, f'{tag} IndexedDB: odhaczenie dawki po przeładowaniu')
    # Okno (arkusz): otwarcie i zamknięcie klawiszem Esc — po zamknięciu usunięte z DOM
    await pg.goto(url + '#/zapasy'); await pg.wait_for_selector('.inv')
    add_btn = pg.locator('main button', has_text='Dodaj').first
    opened = await add_btn.count() > 0
    if opened: await add_btn.click()
    if opened:
        await pg.wait_for_selector('dialog[open]'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        ok(await pg.locator('dialog').count() == 0, f'{tag} okno: Esc zamyka i usuwa z DOM')
    else:
        ok(False, f'{tag} okno: nie znaleziono przycisku dodania pozycji')
    # Tryb skupienia Treningu: nawigacja schowana, wyjście przywraca
    await pg.goto(url + '#/trening?v=fokus&d=2026-11-18'); await pg.wait_for_selector('.fx')
    ok(await pg.evaluate("document.documentElement.hasAttribute('data-focus')"), f'{tag} tryb skupienia: html[data-focus]')
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('main h1')
    ok(not await pg.evaluate("document.documentElement.hasAttribute('data-focus')"), f'{tag} tryb skupienia: wyjście')
    if mobile:
        # Gest na liście (zdarzenia dotyku, D-112 / D-114): dawka w Suplementacji
        await pg.goto(url + '#/wiecej'); await pg.goto(url + '#/suplementy'); await pg.wait_for_selector('.dose-list li')
        has = await pg.evaluate("'ontouchstart' in window || navigator.maxTouchPoints > 0")
        if has:
            k1 = await pg.locator('.dose-ck[aria-pressed="true"]').count()
            await pg.evaluate(SWIPE, ['.dose-list li:has(.dose-ck[aria-pressed="false"])', 220])
            await wait_js(pg, "k => document.querySelectorAll('.dose-ck[aria-pressed=\"true\"]').length > k", k1)
            ok(await pg.locator('.dose-ck[aria-pressed="true"]').count() == k1 + 1, f'{tag} gest: przesunięcie w prawo odhacza dawkę')
        else:
            ok(False, f'{tag} gest: WebKit z emulacją dotyku nie zgłasza obsługi dotyku')
    else:
        # Paleta ⌘K (Safari na Macu)
        await pg.goto(url + '#/dzis'); await pg.wait_for_selector('main h1')
        await pg.keyboard.press('Meta+k'); await pg.wait_for_selector('dialog[open] input[type=search]', timeout=5000)
        await pg.keyboard.type('zapasy'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        ok('#/zapasy' in pg.url, f'{tag} ⌘K: przejście do Zapasów ({pg.url.split("#")[-1]})')
    if url.startswith('http'):
        csp = await pg.evaluate("document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]')?.content || ''")
        sw = await pg.evaluate("navigator.serviceWorker ? navigator.serviceWorker.getRegistration().then(r => !!r) : 'brak'")
        ok("require-trusted-types-for 'script'" in csp and sw is True, f'{tag} CSP z Trusted Types, service worker zarejestrowany ({sw})')
    ok(not errs, f'{tag}: brak błędów JS {errs[:3]}')
    await b.close()


async def run_axe(pw, url, mobile):
    tag = f'WebKit single {390 if mobile else 1280}px'
    b = await pw.webkit.launch()
    for theme in ('dark', 'light'):
        ctx, pg, errs = await new_page(b, mobile, theme)
        await pg.goto(url + '#/dzis'); await pg.wait_for_selector('main h1')
        await pg.evaluate(AXE_SRC)
        for r in AXE_ROUTES:
            await pg.goto(url + '#/wiecej'); await pg.goto(url + r); await pg.wait_for_selector('main h1'); await pg.wait_for_timeout(400)
            if not await pg.evaluate("typeof axe === 'object'"): await pg.evaluate(AXE_SRC)
            res = await pg.evaluate("axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa']}, resultTypes: ['violations']})")
            v = [f"{x['id']} {x['nodes'][0]['target'][0]}" for x in res['violations']]
            ok(not v, f'{tag} {theme} {r}: dostępność {v[:2]}')
        await ctx.close()
    await b.close()


async def main():
    srv = serve(8767)
    web, single = 'http://localhost:8767/index.html', (ROOT / 'dist/single/2027.html').as_uri()
    async with async_playwright() as pw:
        for name, url in (('web', web), ('single', single)):
            await run_routes(pw, name, url, True)
            await run_interactions(pw, name, url, True)
        await run_routes(pw, 'web', web, False)
        await run_interactions(pw, 'web', web, False)
        await run_axe(pw, single, True)
        await run_axe(pw, single, False)
    srv.shutdown()
    bad = [m for c, m in results if not c]
    print(f'\nWEBKIT: {len(results)} kontroli, zaliczonych: {len(results) - len(bad)}, błędów: {len(bad)}')
    sys.exit(1 if bad else 0)


asyncio.run(main())
