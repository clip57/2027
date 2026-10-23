"""Test w przeglądarce: dziennik szczegółów sesji (D-106) — pola basenu, roweru, kolana i sauny zapisują się od razu (zdarzenie train.detail), wracają po przeładowaniu,
walidują zakres, są widoczne zależnie od dnia, trafiają do Historii i są dostępne (axe WCAG 2.1 A/AA). Uruchomienie: npm run build && python3 tests/e2e/trening_log.py"""
import asyncio, datetime as dt, pathlib, sys
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = (ROOT / 'dist/single/2027.html').as_uri()
AXE = (ROOT / 'node_modules/axe-core/axe.min.js').read_text()
fails = []

def ok(cond, msg):
    print(('OK   ' if cond else 'BŁĄD ') + msg)
    if not cond: fails.append(msg)

async def axe(pg):
    await pg.add_script_tag(content=AXE)
    r = await pg.evaluate("axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},resultTypes:['violations']})")
    return [f"[{v['impact']}] {v['id']} ({len(v['nodes'])}) {v['nodes'][0]['target'][0][:50]}" for v in r['violations']]

async def fill(pg, label, value):
    el = pg.get_by_label(label, exact=True); await el.fill(str(value)); await el.dispatch_event('change'); await pg.wait_for_timeout(150)

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        for w, hgt, scheme in ((390, 900, 'dark'), (1100, 900, 'light')):
            tag = f'{w}px {scheme}'
            ctx = await b.new_context(viewport={'width': w, 'height': hgt}, color_scheme=scheme, timezone_id='Europe/Warsaw')
            await ctx.clock.install(time=dt.datetime(2026, 10, 25, 10, 0, tzinfo=ZoneInfo('Europe/Warsaw')))
            await ctx.add_init_script(f"localStorage.setItem('p2027.theme','{scheme}')")
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(URL + '#/trening?d=2026-10-25'); await pg.wait_for_selector('.tlog', timeout=15000)       # niedziela: basen
            ok(await pg.locator('.tl-st', has_text='Basen').count() == 1 and await pg.locator('.tl-st', has_text='Rower').count() == 0, f'{tag} niedziela: sekcja Basen, bez sekcji Rower')
            ok(await pg.locator('details.tl-sec[open]').count() == 1, f'{tag} niedziela: otwarta tylko sekcja Basen (kolano i sauna zwinięte)')
            # --- wypełnienie basenu
            await fill(pg, 'Basen: Część właściwa, min', 45); await fill(pg, 'Basen: Dystans, m', 1500); await fill(pg, 'Basen: RPE części właściwej', 3.5)
            await fill(pg, 'Basen: Tętno średnie, bpm', 118)
            await pg.get_by_role('radio', name='25 m').click()
            for name in ('Kraul', 'Grzbiet', 'Oddech co 3. ruch ramion, bez głodu powietrza', 'Pieczenie w barkach lub przedramionach', 'Rozciąganie barków 2×20 s na stronę'):
                await pg.get_by_role('button', name=name).click()
            await pg.wait_for_timeout(200)
            ok('Tempo (część właściwa): 3:00 /100 m' in await pg.inner_text('.tl-derived'), f'{tag} basen: tempo liczone z czasu i dystansu (3:00 /100 m)')
            ok(await pg.get_by_role('radio', name='25 m').get_attribute('aria-checked') == 'true', f'{tag} basen: wybór długości basenu zaznaczony')
            ok(await pg.get_by_role('button', name='Kraul').get_attribute('aria-pressed') == 'true', f'{tag} basen: styl wielokrotnego wyboru zaznaczony')
            # --- walidacja zakresu: wartość spoza zakresu nie jest zapisywana
            await fill(pg, 'Basen: Dystans, m', 99999)
            ok(await pg.get_by_label('Basen: Dystans, m', exact=True).get_attribute('aria-invalid') == 'true' and await pg.locator('.banner.err').count() >= 1, f'{tag} basen: dystans spoza zakresu — komunikat i oznaczenie błędu')
            await fill(pg, 'Basen: Dystans, m', 1500)
            # --- kolano i sauna (rozwinięcie), notatka
            await pg.locator('.tl-sec > summary', has_text='Kolano').click()
            await fill(pg, 'Kolano: Ból wyjściowy przed 1. serią, /10', 1); await fill(pg, 'Kolano: Ból w trakcie (najwyższy), /10', 2.5)
            await pg.get_by_role('radio', name='minimalny').click()
            await pg.locator('.tl-sec > summary', has_text='Sauna').click()
            await fill(pg, 'Sauna: Liczba rund', 1); await fill(pg, 'Sauna: Temperatura, °C', 90); await fill(pg, 'Sauna: Woda po prysznicu, ml', 600)
            await pg.get_by_label('Sauna: Koniec sauny (godzina)').fill('20:35'); await pg.get_by_label('Sauna: Koniec sauny (godzina)').dispatch_event('change')
            note = pg.get_by_label('Notatka do sesji'); await note.fill('Lekko, bez problemów.'); await note.dispatch_event('change'); await pg.wait_for_timeout(300)
            badge = ' '.join((await pg.inner_text('.tlog')).split())
            ok('9 wpisów' in badge or '9 wpisów' in badge.replace('\xa0', ' '), f'{tag} znaczniki sekcji pokazują liczbę wpisów (basen: 9)')
            # --- po przeładowaniu wartości wracają (IndexedDB)
            await pg.reload(); await pg.wait_for_selector('.tlog')
            ok(await pg.get_by_label('Basen: Dystans, m', exact=True).input_value() == '1500' and await pg.get_by_label('Basen: RPE części właściwej', exact=True).input_value() == '3.5', f'{tag} po przeładowaniu: dystans i RPE zapisane')
            ok(await pg.get_by_role('button', name='Grzbiet').get_attribute('aria-pressed') == 'true' and await pg.get_by_role('radio', name='minimalny').get_attribute('aria-checked') == 'true', f'{tag} po przeładowaniu: styl i obrzęk zapisane')
            ok(await pg.get_by_label('Sauna: Koniec sauny (godzina)').input_value() == '20:35' and await pg.get_by_label('Notatka do sesji').input_value() == 'Lekko, bez problemów.', f'{tag} po przeładowaniu: godzina sauny i notatka zapisane')
            ok(await pg.locator('details.tl-sec[open]').count() == 3, f'{tag} po przeładowaniu: sekcje z wpisami otwarte')
            # --- cofnięcie: odznaczenie chipu usuwa wpis; wyczyszczenie pola usuwa wartość
            await pg.get_by_role('button', name='Grzbiet').click(); await fill(pg, 'Basen: Tętno średnie, bpm', ''); await pg.wait_for_timeout(150)
            ok(await pg.get_by_role('button', name='Grzbiet').get_attribute('aria-pressed') == 'false' and await pg.get_by_label('Basen: Tętno średnie, bpm', exact=True).input_value() == '', f'{tag} cofnięcie wpisów działa')
            # --- Historia pokazuje podsumowanie wpisów
            await pg.goto(URL + '#/trening?v=historia'); await pg.wait_for_selector('.hist-item', timeout=10000)
            hist = ' '.join((await pg.inner_text('main')).split())
            ok('Basen 1500 m · 45 min · RPE 3,5 · 3:00 /100 m' in hist and 'kolano 1 / 2,5 / –' in hist, f'{tag} Historia: podsumowanie wpisów dnia')
            # --- dostępność z otwartymi sekcjami
            await pg.goto(URL + '#/trening?d=2026-10-25'); await pg.wait_for_selector('.tlog')
            v = await axe(pg); ok(not v, f'{tag} niedziela (dziennik): dostępność {v[:2]}')
            # --- widoczność zależnie od dnia: wtorek (LOWER — kolano otwarte), środa (rower), czwartek (sauna otwarta)
            await pg.goto(URL + '#/trening?d=2026-10-20'); await pg.wait_for_selector('.tlog')
            ok(await pg.locator('details.tl-sec[open] .tl-st', has_text='Kolano').count() == 1 and await pg.locator('.tl-st', has_text='Basen').count() == 0 and await pg.locator('.tl-st', has_text='Rower').count() == 0, f'{tag} wtorek (LOWER 1): kolano rozwinięte, bez basenu i roweru')
            await pg.goto(URL + '#/trening?d=2026-10-21'); await pg.wait_for_selector('.tlog')
            ok(await pg.locator('details.tl-sec[open] .tl-st', has_text='Rower').count() == 1 and await pg.locator('.tl-st', has_text='Basen').count() == 0, f'{tag} środa (rower + ABS): sekcja Rower')
            await fill(pg, 'Rower: Tętno średnie, bpm', 128); await pg.get_by_role('radio', name='Niski').click()
            v = await axe(pg); ok(not v, f'{tag} środa (dziennik): dostępność {v[:2]}')
            await pg.goto(URL + '#/trening?d=2026-11-12'); await pg.wait_for_selector('.tlog')
            ok(await pg.locator('details.tl-sec[open] .tl-st', has_text='Sauna').count() == 1, f'{tag} czwartek 12.11 (2 × sauna): sauna rozwinięta')
            await pg.goto(URL + '#/trening?d=2026-10-22'); await pg.wait_for_selector('.tlog')
            ok(await pg.locator('details.tl-sec[open]').count() == 0 and await pg.locator('.tl-st', has_text='Sauna').count() == 1, f'{tag} czwartek 22.10 (bez sauny, D-103): sekcja Sauna dostępna, ale zwinięta')
            ok(not errs, f'{tag}: brak błędów JS {errs[:1]}')
            await ctx.close()
        await b.close()
    print(f'\nBŁĘDÓW: {len(fails)}'); sys.exit(1 if fails else 0)
asyncio.run(main())
