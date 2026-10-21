"""Test w przeglądarce: czytelność ostrzeżeń „System kolana” i „Sauna” oraz list rozgrzewki i schłodzenia w widoku Trening (D-105).
Sprawdza strukturę (karty, listy, alarm, numeracja), brak spłaszczonego akapitu i encji HTML, brak przewijania poziomego w oknie oraz dostępność (axe WCAG 2.1 A/AA) przy otwartym oknie.
Uruchomienie: npm run build && python3 tests/e2e/trening_sheets.py   (kod wyjścia 1 przy błędach)"""
import asyncio, datetime as dt, json, pathlib, sys
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = (ROOT / 'dist/single/2027.html').as_uri()
AXE = (ROOT / 'node_modules/axe-core/axe.min.js').read_text()
T = json.loads((ROOT / 'src/data/training.json').read_text(encoding='utf8'))
KNEE, SAUNA = T['sheetsData']
fails = []

def ok(cond, msg):
    print(('OK   ' if cond else 'BŁĄD ') + msg)
    if not cond: fails.append(msg)

async def axe(pg):
    await pg.add_script_tag(content=AXE)
    r = await pg.evaluate("axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},resultTypes:['violations']})")
    return [v["id"] for v in r["violations"]]

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        for w, h, scheme in ((390, 844, 'dark'), (390, 844, 'light'), (1100, 900, 'dark'), (1100, 900, 'light')):
            tag = f'{w}px {scheme}'
            ctx = await b.new_context(viewport={'width': w, 'height': h}, color_scheme=scheme, timezone_id='Europe/Warsaw')
            await ctx.clock.install(time=dt.datetime(2026, 10, 20, 10, 0, tzinfo=ZoneInfo('Europe/Warsaw')))
            await ctx.add_init_script(f"localStorage.setItem('p2027.theme','{scheme}')")
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(URL + '#/trening?d=2026-10-20'); await pg.wait_for_selector('.hero-tr', timeout=15000)   # wtorek: LOWER 1
            # --- System kolana
            await pg.get_by_role('button', name='System kolana').click(); await pg.wait_for_selector('dialog.sheet[open]')
            await pg.locator("dialog.sheet[open]").evaluate("el => Promise.all(el.getAnimations().map(a => a.finished))")
            d = pg.locator('dialog.sheet')
            ok(await d.locator('.ks-crit').count() == len(KNEE['criteria']), f'{tag} kolano: {len(KNEE["criteria"])} kart kryteriów')
            ok(await d.locator('.ks-crit .ks-row').count() == 3 * len(KNEE['criteria']), f'{tag} kolano: po 3 poziomy (zielone, żółte, czerwone) w każdym kryterium')
            ok(await d.locator('.ks-actions li').count() == 3 and await d.locator('.ks-alert li').count() == len(KNEE['alert']['items']), f'{tag} kolano: 3 działania i alarm z {len(KNEE["alert"]["items"])} pozycjami')
            ok(await d.locator('.sheet-text').count() == 0, f'{tag} kolano: brak spłaszczonego akapitu')
            txt = await d.inner_text()
            ok('&gt;' not in txt and '&lt;' not in txt and '>5/10 lub rośnie' in txt, f'{tag} kolano: bez encji HTML („>5/10” poprawnie)')
            ok(await d.evaluate('e => e.scrollWidth <= e.clientWidth + 1'), f'{tag} kolano: bez przewijania poziomego')
            v = await axe(pg); ok(not v, f'{tag} kolano: dostępność {v[:2]}')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
            # --- Sauna
            await pg.get_by_role('button', name='Sauna').click(); await pg.wait_for_selector('dialog.sheet[open]')
            await pg.locator("dialog.sheet[open]").evaluate("el => Promise.all(el.getAnimations().map(a => a.finished))")
            d = pg.locator('dialog.sheet')
            steps = sum(len(p['steps']) for p in SAUNA['phases'])
            ok(await d.locator('.sa-card').count() == len(SAUNA['summary']), f'{tag} sauna: {len(SAUNA["summary"])} karty zasad')
            ok(await d.locator('.sa-steps li').count() == steps and await d.locator('.sa-steps li.is-alert').count() == 1, f'{tag} sauna: {steps} kroków, wyjście awaryjne jako alarm')
            ok(await d.locator('.sa-timeline li').count() == len(SAUNA['thursday']['steps']), f'{tag} sauna: czwartek — {len(SAUNA["thursday"]["steps"])} numerowanych kroków')
            ok(await d.locator('.sheet-text').count() == 0, f'{tag} sauna: brak spłaszczonego akapitu')
            ok(await d.evaluate('e => e.scrollWidth <= e.clientWidth + 1'), f'{tag} sauna: bez przewijania poziomego')
            v = await axe(pg); ok(not v, f'{tag} sauna: dostępność {v[:2]}')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
            # --- lista rozgrzewki i schłodzenia, notatka dnia (wtorek), struktura roweru (środa), brak tekstu następnego dnia w schłodzeniu
            await pg.evaluate("document.querySelectorAll('details.meal').forEach(x => x.open = true)")
            ok(await pg.locator('.ph-list').count() == 2 and await pg.locator('.ph-list li').count() == len(T['warmupData']['wt']['items']) + len(T['cooldownData']['wt']['items']), f'{tag} wtorek: rozgrzewka i schłodzenie jako numerowane listy')
            ok(await pg.locator('.dn h3').inner_text() == 'Akcent kolanowy', f'{tag} wtorek: notatka „Akcent kolanowy” przy właściwym dniu')
            body = ' '.join((await pg.inner_text('main')).split())
            ok('Rower + ABS 55 min' not in body and 'Dzień wolny od treningu 2 sesje' not in body, f'{tag} wtorek: w schłodzeniu nie ma już tekstu środy')
            await pg.goto(URL + '#/trening?d=2026-10-21'); await pg.wait_for_selector('.hero-tr', timeout=15000)
            await pg.evaluate("document.querySelectorAll('details.meal').forEach(x => x.open = true)")
            ok(await pg.locator('.dn-phases li').count() == 3 and 'Rozciąganie · 5 min' in ' '.join((await pg.inner_text('main')).split()), f'{tag} środa: struktura roweru (3 części) i rozciąganie 5 min')
            v = await axe(pg); ok(not v, f'{tag} środa (widok sesji): dostępność {v[:2]}')
            ok(not errs, f'{tag}: brak błędów JS {errs[:1]}')
            await ctx.close()
        await b.close()
    print(f'\nBŁĘDÓW: {len(fails)}'); sys.exit(1 if fails else 0)
asyncio.run(main())
