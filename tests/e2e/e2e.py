"""Testy E2E (Chromium, Playwright): oba warianty budowy, iPhone 390×844 i komputer 1280×800.
Uruchomienie: python3 tests/e2e/e2e.py  (wymaga dist/ oraz opcjonalnie SOURCES_DIR z kopią ZAPASY)."""
import asyncio, json, os, sys, time, threading, http.server, functools, tempfile, pathlib
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fixtures

ROOT = pathlib.Path(__file__).resolve().parents[2]
BACKUP = os.environ.get('SOURCES_DIR') and pathlib.Path(os.environ['SOURCES_DIR']) / 'zapasy_kopia_2026-09-22.json'
ROUTES = ['#/bezpieczenstwo?m=poradnik', '#/rekompozycja', '#/rekompozycja?s=s6', '#/bezpieczenstwo', '#/bezpieczenstwo?m=tabela', '#/trening?v=stat', '#/trening?v=historia', '#/cfa', '#/cfa?v=harmonogram', '#/cfa?v=kalendarz', '#/cfa?v=log', '#/cfa?v=plan', '#/dzis?d=2026-10-03', '#/trening', '#/trening?d=2026-09-21', '#/zapasy', '#/mealprep', '#/dieta?f=1&w=NT', '#/suplementy?d=2026-09-24', '#/dzis', '#/dzis?d=2026-10-26', '#/dzis?d=2026-09-24', '#/dane', '#/wiecej', '#/dieta', '#/zapasy', '#/trening', '#/cfa', '#/suplementy', '#/bezpieczenstwo']
results = []
# Kontrast tekstu elementu względem jego własnego (nieprzezroczystego) tła — WCAG; stany, których axe nie widzi.
CONTRAST = '''el => { const px = c => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data]; };
  const L = ([r, g, b]) => [r, g, b].map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const s = getComputedStyle(el), a = L(px(s.color)), b = L(px(s.backgroundColor)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }'''

# Oczekiwany stan liczony niezależnie od kodu aplikacji (D-027: stan na koniec 22.09, odliczanie od 23.09).
import datetime as _dt
from zoneinfo import ZoneInfo
# Start planu (D-088, D-090): zużycie wg planu dopiero od 27.09.2026; dieta dnia z wyjątkami dat (D-087: 27.09 — NT)
PLAN_START = _dt.date.fromisoformat(json.loads((ROOT / 'src/data/phases.json').read_text(encoding='utf8'))['start'])
WEEK = json.loads((ROOT / 'src/data/week.json').read_text(encoding='utf8'))
def diet_of(d): return WEEK.get('exceptions', {}).get(d.isoformat(), {}).get('diet') or WEEK['days'][str(d.isoweekday())]['diet']
def expected_stock(start, per_day, since=_dt.date(2026, 9, 22)):
    # „dziś” w strefie przeglądarki testowej (Europe/Warsaw), nie serwera (UTC) — inaczej między 22:00 a 24:00 UTC różnica 1 dnia
    d, q, today = max(since + _dt.timedelta(days=1), PLAN_START), start, _dt.datetime.now(ZoneInfo('Europe/Warsaw')).date()
    while d <= today:
        q -= per_day(d); d += _dt.timedelta(days=1)
    return q
# Dane do bloku zapasów: prawdziwa kopia użytkownika (SOURCES_DIR) albo SYNTETYCZNA kopia z fikcyjnymi wartościami
# (tests/e2e/fixtures.py) — dzięki temu funkcje Zapasów, Meal Prep, eksportu i importu są sprawdzane także bez plików użytkownika.
if BACKUP and BACKUP.exists():
    DATA = {'label': '', 'path': BACKUP, 'events': 55, 'ban': 240, 'since': _dt.date(2026, 9, 22)}
else:
    _obj, _n, _stocks = fixtures.synthetic_zapasy()
    DATA = {'label': ' (dane syntetyczne)', 'path': fixtures.write(_obj, 'zapasy_syntetyczne.json'), 'events': _n,
            'ban': _stocks['banan'], 'since': _dt.date.fromisoformat(_obj['lastSyncDate'])}
BANAN = lambda: expected_stock(DATA['ban'], lambda d: 0 if diet_of(d) == 'NT' else 120, DATA['since'])   # dzień NT bez banana
GLUKO = lambda: expected_stock(180, lambda d: 1 if PLAN_START <= d <= _dt.date(2027, 3, 21) else 0)   # D-090: przyjmowanie 27.09–21.03
async def wait_js(pg, fn, arg=None, timeout=15000):
    # Zamiast wait_for_function (tekst predykatu wymaga 'unsafe-eval', blokowane przez CSP wariantu web — S1): odpytywanie przez evaluate
    end = time.monotonic() + timeout / 1000
    while not await pg.evaluate(fn, arg):
        if time.monotonic() > end: raise TimeoutError(f'warunek niespełniony: {fn}')
        await asyncio.sleep(0.1)

def ok(cond, msg): results.append((bool(cond), msg)); print(('OK  ' if cond else 'BŁĄD'), msg)
skipped = []
def skip(msg): skipped.append(msg); print('POMINIĘTO', msg)

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
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h, .dz-outside')   # przed startem planu „Dziś” = „Poza planem” (D-088)
    for r in ROUTES:
        await pg.goto(url + r); await pg.wait_for_timeout(250)
        sw = await pg.evaluate('document.documentElement.scrollWidth')
        ok(sw <= vp['width'], f'{tag} {r}: brak przewijania w poziomie ({sw}px)')
        words = (await pg.evaluate("document.querySelector('main').textContent")).split()
        bad = [w for w in words if w in ('null', 'false', 'undefined', 'NaN') or w.startswith('[object')]
        ok(not bad, f'{tag} {r}: brak artefaktów tekstowych ({bad[:3]})')
    await pg.goto(url + '#/dzis?d=2026-10-26'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    titles = await pg.eval_on_selector_all('.slot-title', 'e => e.map(x => x.textContent)')
    ok(titles.count('Mock CFA — sesja 1') == 2 and titles.count('Mock CFA — sesja 2') == 3 and 'Wolne' in titles,
       f'{tag} dzień mocka: sesje w A–E (E = kontynuacja sesji 2 do 13:00, D-086), F „Wolne” (D-036)')
    ok(['CFA blok G', 'CFA blok H', 'CFA blok I'] == [t for t in titles if t.startswith('CFA blok')], f'{tag} dzień mocka: analiza w blokach G–I (D-086)')
    ok(any('Obiad (16:23)' in t for t in await pg.eval_on_selector_all('.slot-items li', 'e => e.map(x => x.textContent)')), f'{tag} obiad opisany jako 16:23 (D-037)')
    # D-090: pierwszy dzień planu 27.09.2026 — dzień sauny (D-087), dieta NT, Faza 0, 9 bloków CFA od 08:00
    await pg.goto(url + '#/dzis?d=2026-09-27'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    main = await pg.inner_text('main')
    ok(main.lower().count('chondroityn') == 2, f'{tag} chondroityna tylko 2 razy (07:00 i 21:00) — brak dublowania (D-001)')
    ok('Pomiar wagi i ciśnienia na czczo po toalecie.' in main, f'{tag} pomiar wagi i ciśnienia (D-038)')
    ok('Curriculum 2026 Vol 1 (QM), s. 3–13 (11 s.)' in main, f'{tag} źródło i strony w bloku CFA (D-039) — pierwszy blok planu 27.09, 08:00')
    SLOTS = "e => e.map(x => x.querySelector('time').textContent + ' ' + x.querySelector('.slot-title').firstChild.textContent)"   # bez znacznika „teraz”
    slots = await pg.eval_on_selector_all('.slot', SLOTS)
    chips = await pg.eval_on_selector_all('.topline .chip', 'e => e.map(x => x.textContent)')
    ok('Bez treningu, 2 × sauna' in chips and 'Faza 0' in chips and '2332 kcal (NT)' in chips, f'{tag} 27.09: start planu, dzień sauny, dieta NT, Faza 0 (D-087, D-090): {chips}')
    ok(await pg.locator('.daynav [aria-label="Poprzedni dzień"]').count() == 0, f'{tag} 27.09: pierwszy dzień planu — bez przejścia do dnia poprzedniego (D-088, D-090)')
    ok([s for s in slots if 'CFA blok' in s] == [f'{t} CFA blok {l}' for t, l in zip(('08:00', '09:10', '10:10', '11:20', '12:20', '13:30', '14:30', '15:30', '16:40'), 'ABCDEFGHI')],
       f'{tag} 27.09: 9 bloków CFA od 08:00 (D-090)')
    ok('Posiłek po saunie' in await pg.inner_text('#slot\\.2015'), f'{tag} 27.09: posiłek po saunie (D-087)')
    await pg.goto(url + '#/dzis?d=2026-10-03'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    slots = await pg.eval_on_selector_all('.slot', SLOTS)
    ok(len(slots) == 33 and '12:13 Zakupy' in slots and '13:13 Przerwa na lunch' in slots and not any(s.startswith('12:20') for s in slots)
       and 'Druga kawa (12:20)' in await pg.inner_text('#slot\\.1213z'), f'{tag} sobota: zakupy 12:13–13:13 z drugą kawą, bez bloku E, lunch bez zmian (D-087)')
    await pg.goto(url + '#/dzis?d=2026-09-28'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    main = await pg.inner_text('main')
    chips = await pg.eval_on_selector_all('.topline .chip', 'e => e.map(x => x.textContent)')
    ok('UPPER 1 + sauna' in chips and 'Faza 0' in chips, f'{tag} nazwa treningu w nagłówku (D-040), Faza 0: {chips}')
    # D-086: 9 bloków CFA, 12:13–12:20 przerwa kognitywna, 12:20 blok E z drugą kawą, 13:13–13:30 lunch; bez spaceru
    slots = await pg.eval_on_selector_all('.slot', SLOTS)
    ok(len(slots) == 34 and [s for s in slots if 'CFA blok' in s] == [f'{t} CFA blok {l}' for t, l in zip(
        ('08:00', '09:10', '10:10', '11:20', '12:20', '13:30', '14:30', '15:30', '16:40'), 'ABCDEFGHI')], f'{tag} plan dnia: 9 bloków CFA A–I (D-086)')
    ok('12:13 Przerwa kognitywna' in slots and '13:13 Przerwa na lunch' in slots,
       f'{tag} plan dnia: przerwa 12:13–12:20 i przerwa na lunch 13:13–13:30 (D-086)')
    e_items = await pg.inner_text('#slot\\.1220')
    ok('Druga kawa (12:20)' in e_items and 'Lunch (13:20)' in await pg.inner_text('#slot\\.1313'), f'{tag} plan dnia: druga kawa w bloku E, lunch 13:20 (D-086)')
    ok('Spacer' not in main and 'Długa przerwa' not in main, f'{tag} plan dnia: bez spaceru regeneracyjnego i długiej przerwy (D-086)')
    # D-088, D-090: dni przed 27.09.2026 poza planem — bez planu dnia, z przejściem do pierwszego dnia planu
    for d in ('2026-09-26', '2026-09-25', '2026-09-21'):
        await pg.goto(url + f'#/dzis?d={d}'); await pg.wait_for_selector('.dz-outside')
        ok(await pg.locator('.slot').count() == 0 and 'Plan zaczyna się 27 września 2026' in await pg.inner_text('.dz-outside')
           and 'poza planem' in await pg.inner_text('.topline'), f'{tag} {d}: poza planem, bez planu dnia (D-088, D-090)')
    await pg.locator('.dz-outside a').click(); await pg.wait_for_selector('.dz-plan-h')
    ok('d=2026-09-27' in await pg.evaluate('location.hash'), f'{tag} poza planem: przejście do 27.09 (D-090)')
    # (U-a) w dniu bieżącym minione punkty planu są zwinięte — przed odczytem treści dnia sekcja jest rozwijana
    # --- Redesign (Faza 3–4): motyw, nawigacja, dashboard
    th = await pg.evaluate("document.documentElement.getAttribute('data-theme')")
    ok(th == 'dark' or await pg.evaluate("localStorage.getItem('p2027.theme')") is not None, f'{tag} Motyw: domyślnie ciemny')
    if mobile:
        labels = await pg.eval_on_selector_all('.tabs a', 'e => e.map(x => x.textContent.trim())')
        ok(labels == ['Dziś', 'Dieta', 'Trening', 'CFA', 'Więcej'], f'{tag} Pasek dolny: 4 sekcje + Więcej ({labels})')
        ok(await pg.locator('.tabs a svg[aria-hidden=true]').count() == 5, f'{tag} Pasek dolny: ikony dekoracyjne z etykietą tekstową')
        await pg.goto(url + '#/wiecej'); await pg.wait_for_selector('.more-list')
        ok(await pg.locator('.more-list a').count() == 6, f'{tag} Więcej: 6 pozostałych modułów w grupach')
        dcs = await pg.eval_on_selector_all('.more-list a', 'e => e.map(a => a.style.getPropertyValue("--dc"))')
        ok(all(dcs) and await pg.eval_on_selector('.more-ic', 'e => getComputedStyle(e).color') != await pg.eval_on_selector('.more-n', 'e => getComputedStyle(e).color'),
           f'{tag} Więcej: ikony w kolorze domeny modułu (zmienna --dc ustawiona)')
        await pg.get_by_role('button', name='Motyw: Jasny').click(); await pg.wait_for_timeout(200)
        await pg.reload(); await pg.wait_for_selector('.more-list')
        ok(await pg.evaluate("document.documentElement.getAttribute('data-theme')") == 'light', f'{tag} Motyw: wybór jasnego zapamiętany po przeładowaniu')
        await pg.get_by_role('button', name='Motyw: Systemowy').click(); await pg.wait_for_timeout(200)
        ok(await pg.evaluate("document.documentElement.hasAttribute('data-theme')") is False, f'{tag} Motyw: systemowy (bez wymuszenia)')
        await pg.get_by_role('button', name='Motyw: Ciemny').click(); await pg.wait_for_timeout(200)
    else:
        groups = await pg.eval_on_selector_all('.side .side-gl', 'e => e.map(x => x.textContent.trim())')
        ok(groups == ['Dzień', 'Trening', 'Dieta', 'Nauka', 'System'], f'{tag} Panel: grupy {groups}')
        ok(await pg.locator('.side .side-a').count() == 10, f'{tag} Panel: 10 modułów')
        await pg.get_by_role('button', name='Zwiń panel').click(); await pg.wait_for_timeout(200)
        await pg.reload(); await pg.wait_for_selector('.side')
        ok(await pg.locator('.side.is-min').count() == 1, f'{tag} Panel: zwinięcie zapamiętane')
        await pg.get_by_role('button', name='Rozwiń panel').click(); await pg.wait_for_timeout(200)
    await pg.goto(url + '#/dzis?d=2026-09-28'); await pg.wait_for_selector('.dz-kpis')
    kp = await pg.inner_text('.dz-kpis')
    ok('2629 kcal' in kp and '/ 10' in kp and '/ 9 bloków' in kp and '477 min + 53 min recall' in kp, f'{tag} Dziś: kafle z danych (kcal, serie, bloki CFA)')
    ok(await pg.locator('.dz-aside .dz-card').count() >= 4 and 'Plan dnia' in await pg.inner_text('main'), f'{tag} Dziś: karty podsumowań i plan dnia')
    # --- Faza 5.0: regresje wykryte w audycie (nawigacja w obrębie strony, sygnatury modułów, zmienne CSS)
    await pg.goto(url + '#/mealprep'); await pg.wait_for_selector('.prep-card')
    await pg.locator('.mp-jump a[href="#mp-ph-1"]').click(); await pg.wait_for_timeout(700)
    top = await pg.evaluate("document.getElementById('mp-ph-1').getBoundingClientRect().top")
    ok(await pg.evaluate('location.hash') == '#/mealprep' and await pg.locator('.prep-card').count() > 0 and -5 <= top < 200,
       f'{tag} Meal Prep: skrót fazy przewija do sekcji i zostaje w module (top {top:.0f}px)')
    ok(await pg.evaluate("document.activeElement.id") == 'mp-ph-1', f'{tag} Meal Prep: fokus na sekcji docelowej skrótu')
    await pg.get_by_text('Przejdź do karty').click(); await pg.wait_for_timeout(700)
    ok(await pg.evaluate('location.hash') == '#/mealprep' and 'Meal Prep' in await pg.inner_text('main h1'), f'{tag} Meal Prep: „Przejdź do karty” zostaje w module')
    await pg.goto(url + '#/dieta?f=0&w=T'); await pg.wait_for_selector('.meal')
    stripe = await pg.eval_on_selector('.meal[data-meal="dinner"]', 'e => [getComputedStyle(e).borderLeftColor, getComputedStyle(e).borderTopColor]')
    ok(stripe[0] != stripe[1], f'{tag} Dieta: kolorowa krawędź posiłku zachowana ({stripe[0]})')
    await pg.goto(url + '#/bezpieczenstwo?m=poradnik'); await pg.wait_for_selector('.gd-rt', state='attached')   # w zwiniętej sekcji
    stripe = await pg.eval_on_selector('.gd-rt', 'e => [getComputedStyle(e).borderLeftColor, getComputedStyle(e).borderTopColor]')
    ok(stripe[0] != stripe[1], f'{tag} Poradnik: kolorowa krawędź karty zachowana')

    # --- Etap 3: Dziś, Dieta, Suplementacja
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.stats')
    stats = await pg.inner_text('.stats')
    ok('kcal' in stats and 'bloków' in stats, f'{tag} Dziś: podsumowanie dnia (dieta, trening, CFA, sauna)')
    ok(await pg.locator('.nowcard').count() == 1, f'{tag} Dziś: karta „teraz” dla dzisiejszego dnia')
    qy = await pg.locator('.quicklinks').bounding_box(); dy = await pg.locator('.dz-plan-h').bounding_box()
    ok(qy['y'] < dy['y'], f'{tag} Dziś: skróty do jadłospisu i suplementacji nad planem dnia')
    await pg.goto(url + '#/dzis?d=2026-10-03'); await pg.wait_for_selector('.stats')
    ok(await pg.locator('.nowcard').count() == 0, f'{tag} Dziś: brak karty „teraz” dla innego dnia')
    await pg.goto(url + '#/dieta?f=0&w=T'); await pg.wait_for_selector('.meal')
    ok('2629' in await pg.inner_text('.hero'), f'{tag} Dieta: suma kcal 2629 (F0, T)')
    dt = await pg.inner_text('main')
    ok('suma z PDF' not in dt and 'Udziały procentowe pochodzą' not in dt and 'Źródło:' not in dt, f'{tag} Dieta: bez usuniętych objaśnień i znacznika źródła')
    await pg.get_by_role('button', name='Faza 1').click(); await pg.wait_for_selector('text=2784')
    txt = await pg.inner_text('main')
    ok('2784' in txt and '85 g' in txt, f'{tag} Dieta: zmiana fazy przelicza jadłospis (F1 = 2784 kcal, owies 85 g)')
    await pg.get_by_role('button', name='Dzień nietreningowy').click(); await pg.wait_for_selector('text=2487')
    txt = await pg.inner_text('main')
    ok('Posiłek po saunie' in txt, f'{tag} Dieta: wariant NT ma „Posiłek po saunie” (D-018)')
    ok('Przyprawy' in txt and 'Zamienniki' in txt, f'{tag} Dieta: przyprawy i zamienniki')
    await pg.goto(url + '#/suplementy?d=2026-09-28'); await pg.wait_for_selector('.dose-list')
    txt = await pg.inner_text('main')
    ok('Tauryna' in txt and 'od 2026-09-27 do 2027-03-21' in txt and '2027-03-25' not in txt, f'{tag} Suplementacja: tauryna (D-014) i okres preparatów czasowych (D-015, D-090)')
    ok('Stan i prognoza pochodz' not in txt and 'Potem nie są kontynuowane' not in txt, f'{tag} Suplementacja: bez usuniętych podpisów')
    # najbliższy wtorek (test niezależny od dnia uruchomienia)
    tue = (_dt.date.today() + _dt.timedelta(days=(1 - _dt.date.today().weekday()) % 7)).isoformat()
    await pg.goto(url + f'#/suplementy?d={tue}'); await pg.wait_for_selector('.dose-list')
    ok('Cynk' not in (await pg.inner_text('main')).split('Preparaty')[0], f'{tag} Suplementacja: we wtorek bez cynku')
    await pg.goto(url + '#/suplementy?d=2026-10-01'); await pg.wait_for_selector('.dose-list')
    ok('Cynk' in (await pg.inner_text('main')).split('Preparaty')[0], f'{tag} Suplementacja: czwartek z cynkiem')
    await pg.goto(url + '#/suplementy?d=2026-09-24'); await pg.wait_for_selector('.sp-outside')
    ok(await pg.locator('.dose-list').count() == 0 and '0 dawek' in await pg.inner_text('.topline'), f'{tag} Suplementacja: 24.09 poza planem — bez dawek (D-088)')
    # --- Etap 5: Trening
    await pg.goto(url + '#/trening?d=2026-09-28'); await pg.wait_for_selector('.ex')
    SETS = '.set:not(.set-h)'
    ok(await pg.locator('.ex').count() == 9 and await pg.locator(SETS).count() == 10, f'{tag} Trening: UPPER 1 w Fazie 0 — 9 ćwiczeń, 10 serii')
    ok(await pg.locator('.hero-tr .bodymap').count() == 1 and await pg.locator('.ex-map .bodymap').count() == 9, f'{tag} Trening: mapa mięśni sesji i każdego ćwiczenia')
    await pg.locator(SETS).first.locator('input[placeholder=kg]').fill('45')
    await pg.locator(SETS).first.locator('input[placeholder=kg]').press('Tab'); await pg.wait_for_timeout(300)
    await pg.locator(SETS).first.locator('.set-toggle').click(); await pg.wait_for_timeout(500)
    await pg.reload(); await pg.wait_for_selector('.ex')
    ok(await pg.locator(SETS).first.locator('.set-toggle').get_attribute('aria-pressed') == 'true' and await pg.locator(SETS).first.locator('input[placeholder=kg]').input_value() == '45',
       f'{tag} Trening: seria i ciężar zapisane trwale')
    c = await pg.locator(SETS).first.locator('.set-toggle').evaluate(CONTRAST)
    ok(c >= 4.5, f'{tag} Trening: kontrast odhaczonej serii ≥ 4,5:1 ({c:.2f})')
    ok('1 / 10 serii' in await pg.inner_text('.hero-tr'), f'{tag} Trening: pierścień postępu sesji')
    await pg.locator(SETS).nth(1).locator('.set-copy').click(); await pg.wait_for_timeout(500)
    ok(await pg.locator(SETS).nth(1).locator('input[placeholder=kg]').input_value() == '45', f'{tag} Trening: kopiowanie wartości z poprzedniej serii')
    await pg.locator('.ex-tech').first.click(); await pg.wait_for_selector('dialog.sheet')
    dtxt = await pg.inner_text('dialog')
    ok('Kluczowe punkty' in dtxt and await pg.locator('dialog a[href*="youtube"]').count() > 0, f'{tag} Trening: technika z filmem')
    ok('Główne: Klatka piersiowa' in dtxt and 'free-exercise-db' in dtxt and await pg.locator('dialog .bm-p').count() > 0, f'{tag} Trening: mapa mięśni z podanym źródłem')
    await pg.locator('dialog .sheet-head button').click()
    # schemat ruchu (interaktywny)
    await pg.goto(url + '#/trening?d=2026-09-28'); await pg.wait_for_selector('.ex')
    await pg.locator('.ex-tech').first.click(); await pg.wait_for_selector('dialog .fig-svg')
    ok(await pg.locator('dialog .fig-svg .fg-head').count() == 1, f'{tag} Trening: animowana postać w oknie techniki')
    arm0 = await pg.locator('dialog .fig-svg polyline').last.get_attribute('points')
    await pg.locator('dialog').get_by_role('button', name='▶ Odtwórz').click(); await pg.wait_for_timeout(900)
    ok(await pg.locator('dialog .fig-svg polyline').last.get_attribute('points') != arm0, f'{tag} Trening: postać wykonuje ruch')
    await pg.locator('dialog input[type=range]').fill('100')
    ok('pozycja startowa' in await pg.inner_text('dialog .mv-phase'), f'{tag} Trening: suwak — pełny cykl wraca do pozycji startowej')
    await pg.locator('dialog').get_by_role('button', name='Następna ›').click()
    ok('Wskazówka 2 /' in await pg.inner_text('dialog .mv-cues'), f'{tag} Trening: wskazówki krok po kroku')
    await pg.locator('dialog .sheet-head button').click()
    # czas treningu
    await pg.get_by_role('button', name='Rozpocznij trening').click(); await pg.wait_for_selector('.tm-clock')
    await pg.get_by_role('button', name='Zakończ trening').click(); await pg.wait_for_timeout(500)
    await pg.locator('.tm-man input').fill('72'); await pg.locator('.tm-man input').press('Tab'); await pg.wait_for_timeout(500)
    await pg.reload(); await pg.wait_for_selector('.ex')
    ok('Zapisano: 72 min' in await pg.evaluate("document.querySelector('.tm').textContent"), f'{tag} Trening: czas treningu zapisany trwale')
    # serie opcjonalne spoza fazy
    opt = pg.locator('.ex').filter(has=pg.locator('.opt-note')).first
    ok('nie jest elementem Fazy 0' in await opt.locator('.opt-note').inner_text(), f'{tag} Trening: uwaga przy ćwiczeniu spoza fazy')
    await opt.get_by_role('button', name='+ Dodaj serię (opcjonalnie)').click(); await pg.wait_for_timeout(400)
    opt = pg.locator('.ex').filter(has=pg.locator('.opt-note')).first
    await opt.locator('input[placeholder=kg]').first.fill('20'); await opt.locator('input[placeholder="powt."]').first.fill('12')
    await opt.locator('input[placeholder="powt."]').first.press('Tab'); await pg.wait_for_timeout(400)
    # statystyki i historia
    await pg.goto(url + '#/trening?v=stat'); await pg.wait_for_selector('.stats')
    st = await pg.inner_text('main')
    ok('72 min' in st and 'Objętość' in st and await pg.locator('svg.chart').count() >= 2, f'{tag} Statystyki: czas, objętość, wykresy tygodniowe')
    ok('Rekordy osobiste' in st and 'Serie na grupę mięśni' in st, f'{tag} Statystyki: rekordy i serie na grupę mięśni')
    await pg.goto(url + '#/trening?v=historia'); await pg.wait_for_selector('.hist-item')
    hs = await pg.inner_text('.hist-list')
    ok('72 min' in hs and '1 opcjonalna' in hs, f'{tag} Historia: sesja z czasem i oznaczeniem serii opcjonalnej')
    await pg.goto(url + '#/trening?d=2026-10-01'); await pg.wait_for_selector('h1')
    ok('Dzień bez treningu' in await pg.inner_text('main'), f'{tag} Trening: czwartek bez ćwiczeń')
    await pg.goto(url + '#/trening?d=2026-09-21'); await pg.wait_for_selector('h1')
    tm = await pg.inner_text('main')
    ok('Poza planem — plan i treningi zaczynają się 27 września 2026' in tm and await pg.locator('.ex').count() == 0 and await pg.locator('.tm').count() == 0,
       f'{tag} Trening: 21.09 poza planem — bez ćwiczeń i licznika (D-088)')
    await pg.goto(url + '#/trening?d=2026-10-12'); await pg.wait_for_selector('.ex')
    ok(await pg.locator('.set:not(.set-h)').count() == 18, f'{tag} Trening: UPPER 1 w Fazie 1 — 18 serii')
    # --- Etap 6: Rekompozycja (bez pakietu prywatnego)
    await pg.goto(url + '#/rekompozycja'); await pg.wait_for_selector('.rk-sec')
    rk = await pg.evaluate("document.querySelector('main').textContent")
    ok(await pg.locator('.rk-sec').count() == 24, f'{tag} Rekompozycja: 24 sekcje')
    ok(not any(w in rk for w in ['ng/ml', 'ferrytyn', 'chondropat', 'Wiberg']), f'{tag} Rekompozycja: bez danych medycznych przed importem pakietu (D-035)')
    ok('prosto z patelni' in rk and '≥75 °C' not in rk and 'Białko WPC' in rk and 'Obiad gotowany codziennie' in rk, f'{tag} Rekompozycja: zaakceptowane zmiany treści')
    ok('Pierwotne uzasadnienie' in rk and 'Decyzja użytkownika' in rk, f'{tag} Rekompozycja: decyzje i pierwotne uzasadnienie (D-050)')
    ok('20:15, z posiłkiem potreningowym' in rk and 'dowolnie start' not in rk and '0,5–1 mg' not in rk, f'{tag} Rekompozycja: tabele suplementów zgodne z SUPLEMENTACJĄ (A2.9)')
    # --- Etap 6: poradnik bezpieczeństwa
    await pg.goto(url + '#/bezpieczenstwo?m=poradnik'); await pg.wait_for_selector('.rk-sec')
    gd = await pg.evaluate("document.querySelector('main').textContent")
    ok(await pg.locator('.rk-sec').count() == 11 and 'Dziesięć twierdzeń' in gd, f'{tag} Poradnik: 11 sekcji, 10 korekt (B1.1–B1.2)')
    ok('85 °C' not in gd.replace('185 °C', '') and 'Powtórz go' not in gd and 'jogurt' not in gd.lower() and 'KFD' not in gd, f'{tag} Poradnik: bez progu 85 °C, bez powtarzania testu (D-049), nazwy kanoniczne')
    ok('powyżej 63 °C podczas jedzenia' in gd, f'{tag} Poradnik: próg > 63 °C (B1.4)')
    # --- Etap 6: Bezpieczeństwo żywności
    await pg.goto(url + '#/bezpieczenstwo'); await pg.wait_for_selector('.sf-card')
    ok(await pg.locator('.sf-card').count() == 71, f'{tag} Bezpieczeństwo: 71 pozycji (70 + termos D-013)')
    bt = await pg.inner_text('main')
    ok('Skyr' in bt and 'Jogurt 0%' not in bt and 'KFD' not in bt, f'{tag} Bezpieczeństwo: nazwy kanoniczne (D-020)')
    await pg.goto(url + '#/bezpieczenstwo?p=brokuly'); await pg.wait_for_selector('.sf-card')
    ok(await pg.locator('.sf-card').count() == 1 and 'świeże' in await pg.inner_text('.sf-card'), f'{tag} Bezpieczeństwo: brokuły mrożone odsyłają do brokułów świeżych (D-028)')
    await pg.goto(url + '#/bezpieczenstwo?q=termos'); await pg.wait_for_selector('.sf-card')
    ok('> 63 °C' in await pg.inner_text('.sf-card'), f'{tag} Bezpieczeństwo: termos > 63 °C (D-013)')
    await pg.goto(url + '#/bezpieczenstwo?m=tabela'); await pg.wait_for_selector('.safety-table')
    ok(await pg.locator('.safety-table tbody tr').count() == 71 and await pg.locator('.safety-table th').count() == 12, f'{tag} Bezpieczeństwo: pełna tabela 12 kolumn')
    # --- Etap 5: CFA
    await pg.goto(url + '#/cfa?v=dzien&d=2026-09-27'); await pg.wait_for_selector('.cfa-row')
    ok(await pg.locator('.cfa-row:not(.cf-recall)').count() == 9, f'{tag} CFA: 27.09 — 9 bloków (D-090)')
    ok(await pg.locator('a:has-text("Poprzedni dzień")').count() == 0, f'{tag} CFA: 27.09 to pierwszy dzień planu')
    ok('Curriculum 2026 Vol 1 (QM), s. 3–13 (11 s.)' in await pg.inner_text('main'), f'{tag} CFA: źródło i strony bloku')
    await pg.locator('.cfa-row .set-toggle').first.click(); await pg.wait_for_timeout(400)
    await pg.reload(); await pg.wait_for_selector('.cfa-row')
    ok(await pg.locator('.cfa-row .set-toggle').first.get_attribute('aria-pressed') == 'true' and '1 / 409' in await pg.inner_text('.hero-cfa'),
       f'{tag} CFA: postęp zapisany trwale')
    c = await pg.locator('.cfa-row .set-toggle').first.evaluate(CONTRAST)
    ok(c >= 4.5, f'{tag} CFA: kontrast odhaczonego bloku ≥ 4,5:1 ({c:.2f})')
    await pg.goto(url + '#/cfa?v=harmonogram&kat=Schweser'); await pg.wait_for_selector('.filters')
    ok('71 bloków' in await pg.inner_text('.filters'), f'{tag} CFA: filtr kategorii (Schweser = 71 bloków, D-090)')
    ok(await pg.locator('.cfa-row.is-next').count() == 0, f'{tag} CFA: harmonogram bez fałszywego wyróżnienia „następny blok”')
    await pg.goto(url + '#/cfa?v=harmonogram&tryb=MOCK'); await pg.wait_for_selector('.filters')
    ok('24 bloki' in await pg.inner_text('.filters') and await pg.locator('.cfa-row .mode.m-mo').count() == 24
       and 'PRACTICE' not in await pg.inner_text('.filters select >> nth=1'), f'{tag} CFA: filtr trybu (MOCK = 24 bloki; v7 bez PRACTICE, D-090)')
    await pg.goto(url + '#/cfa?v=kalendarz'); await pg.wait_for_selector('.cal')
    ok(await pg.locator('.cal-d.c-mock').count() == 4 and await pg.locator('.cal-d.c-exam').count() == 1, f'{tag} CFA: kalendarz z 4 mockami i egzaminem')
    await pg.goto(url + '#/cfa?v=log'); await pg.wait_for_selector('.form-grid')
    await pg.fill('.form-grid input:not([type=date])', 'FI — duration')
    await pg.select_option('.form-grid select', 'pośpiech')
    await pg.fill('.form-grid textarea', 'Mod. duration = Mac. duration / (1 + y)')
    await pg.get_by_role('button', name='Dodaj wpis').click(); await pg.wait_for_selector('.log-item')
    await pg.reload(); await pg.wait_for_selector('.log-item')
    ok('FI — duration' in await pg.inner_text('.log-list') and 'pośpiech' in await pg.inner_text('.log-list'), f'{tag} CFA: wpis error logu zapisany trwale')
    async with pg.expect_download() as dl:
        await pg.get_by_role('button', name='Eksport CSV').click()
    csv = pathlib.Path(await (await dl.value).path()).read_text(encoding='utf-8-sig')
    ok(csv.startswith('egzamin;data;temat_zrodlo;rodzaj_bledu;prawidlowa_regula') and 'FI — duration' in csv, f'{tag} CFA: eksport CSV w formacie v3')
    await pg.get_by_role('button', name='Edytuj').click(); await pg.wait_for_selector('text=Edytuj wpis')
    await pg.fill('.form-grid input:not([type=date])', 'FI — convexity'); await pg.get_by_role('button', name='Zapisz zmiany').click()
    await pg.wait_for_selector('text=FI — convexity')
    ok(await pg.locator('.log-item').count() == 1, f'{tag} CFA: edycja wpisu bez duplikatu')
    pg.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.get_by_role('button', name='Usuń').click(); await pg.wait_for_selector('text=Error log jest pusty')
    ok(True, f'{tag} CFA: usunięcie wpisu')
    await pg.goto(url + '#/cfa?v=plan'); await pg.wait_for_selector('.topic')
    ok(await pg.locator('.topic').count() == 10, f'{tag} CFA: 10 działów w planie')
    kv = await pg.inner_text('.kv')
    ok('409 (46 dni: 41×9 + 5×8)' in kv and '361,28 h' in kv and '(34 sesji)' in kv, f'{tag} CFA: statystyki planu D-090 (409 bloków, recall 34)')
    await pg.goto(url + '#/dieta'); await pg.wait_for_selector('.meal')
    ok('od 27.09' in await pg.inner_text('main') and 'od 26.09' not in await pg.inner_text('main'), f'{tag} Dieta: Faza 0 od 27.09 (D-090)')
    await pg.goto(url + '#/rekompozycja'); await pg.wait_for_selector('.rk-sec')
    ok('punkt startowy 27.09.2026' in await pg.eval_on_selector('main .eyebrow', 'e => e.textContent'), f'{tag} Rekompozycja: punkt startowy 27.09.2026 (D-090)')
    for d in ('2026-09-25', '2026-09-26'):
        await pg.goto(url + f'#/trening?d={d}'); await pg.wait_for_selector('h1')
        ok(await pg.locator('.ex').count() == 0 and 'Poza planem' in await pg.inner_text('main'), f'{tag} Trening: {d} poza planem (D-090)')
    await pg.goto(url + '#/trening?d=2026-09-27'); await pg.wait_for_selector('h1')
    ok(await pg.locator('.ex').count() == 0 and 'Dwie rundy sauny' in await pg.inner_text('main'), f'{tag} Trening: 27.09 dzień sauny zamiast basenu (D-087)')
    await pg.goto(url + '#/suplementy?d=2026-09-27'); await pg.wait_for_selector('.dose-list')
    ok('dziś bez banana (dieta NT)' in await pg.inner_text('main'), f'{tag} Suplementacja: 27.09 kreatyna bez banana (dieta NT, D-087)')
    if mobile:
        await pg.goto(url + '#/dane'); await pg.wait_for_selector('h1')
        small = await pg.evaluate('''[...document.querySelectorAll('button, .tabs a')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(r => r.height < 44 || r.width < 44).length''')
        ok(small == 0, f'{tag} elementy dotykowe ≥ 44 px (za małych: {small})')
    # --- import kopii ZAPASY przez interfejs
    tag0, tag = tag, tag + DATA['label']
    N = DATA['events']
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('text=Stan zapisu')
    await pg.set_input_files('input[type=file]', str(DATA['path']))
    await pg.wait_for_selector('dialog[open]')
    txt = await pg.inner_text('dialog')
    ok('Nowe zmiany' in txt and str(N) in txt, f'{tag} podgląd importu kopii ZAPASY: {N} zmian (stany + 3 suplementy D-015 + archiwum)')
    await pg.click('dialog >> text=Scal dane'); await pg.wait_for_selector(f'text=Zaimportowano {N} zmian')
    await pg.reload(); await pg.wait_for_selector('table.data')
    rows = await pg.eval_on_selector_all('table.data tbody tr', 'e => e.map(r => [...r.children].map(c => c.textContent))')
    by = {r[0]: r for r in rows}
    ok(by.get('Banan', [None, ''])[1].startswith(f'{BANAN():g} '), f'{tag} po przeładowaniu stan zachowany: Banan {by.get("Banan", ["", "?"])[1]} (oczekiwane {BANAN():g} g)')
    ok(by.get('Glukozamina', [None, ''])[1].startswith(f'{GLUKO():g} '), f'{tag} glukozamina {GLUKO():g} kaps. (D-015, przyjmowanie 27.09–21.03 — D-090)')
    ok(by.get('Cynk', ['', '', '', ''])[3] == 'Nieśledzony', f'{tag} cynk nieśledzony (D-016)')
    ok(len(rows) == 55, f'{tag} tabela kontroli: {len(rows)} pozycji')
    # --- eksport i ponowny import (idempotencja)
    async with pg.expect_download() as dl:
        await pg.get_by_role('button', name='Wyślij do iCloud').click()
    d = await dl.value
    path = await d.path()
    bundle = json.loads(pathlib.Path(path).read_text(encoding='utf8'))
    ok(bundle['format'] == '2027-sync' and bundle['count'] >= 55 and bundle['count'] == len(bundle['events']) and len(bundle['sha256']) == 64, f'{tag} eksport 2027-sync.json: {bundle["count"]} zmian, suma kontrolna')
    await pg.wait_for_selector('text=Wszystkie zmiany z tego urządzenia zostały wysłane')
    ok(True, f'{tag} po eksporcie brak niewysłanych zmian')
    tmp = pathlib.Path(tempfile.mkdtemp()) / '2027-sync.json'; tmp.write_text(json.dumps(bundle), encoding='utf8')
    await pg.set_input_files('input[type=file]', str(tmp)); await pg.wait_for_selector('dialog[open]')
    txt = await pg.inner_text('dialog')
    ok('Scal dane' not in txt and 'Już znane' in txt, f'{tag} ponowny import tego samego pliku: 0 nowych zmian')
    await pg.click('dialog >> text=Zamknij')
    # --- Etap 4: Zapasy i Meal Prep na danych z kopii
    await pg.goto(url + '#/zapasy'); await pg.wait_for_selector('.inv-item')
    inv = await pg.inner_text('main')
    ok('55' in await pg.inner_text('.dash'), f'{tag} Zapasy: 55 pozycji')
    for lab in ['Dodaj', 'Zakupy', 'Paragon', 'Cofnij', 'Historia', 'Status AI', 'Kopia']:
        ok(await pg.locator('.actions').get_by_text(lab, exact=False).count() > 0, f'{tag} Zapasy: przycisk {lab}')
    ok(await pg.locator('.pills .pill-b').count() == 9, f'{tag} Zapasy: 9 kategorii')
    ok(await pg.locator('.counters .counter').count() == 4 and await pg.locator('.counters .c-shop').count() == 1, f'{tag} Zapasy: liczniki statusów + „Do zakupów” (U-c)')
    tags = await pg.inner_text('.inv')
    ok('ŚWIEŻE (≤7D)' in tags and 'TRWAŁE (>7D)' in tags and 'SUPLEMENT' in tags, f'{tag} Zapasy: klasyfikacja wg terminu przydatności')
    ok(any(b in tags for b in ['🚨 < 2 dni', '⚠️ Niski (2-3.9d)', '🟢 OK (≥4d)', '⛔ BRAK (0)']), f'{tag} Zapasy: statusy świeżych wg progów 2/4 dni')
    ok('Wystarczy do:' in tags and ('✓ Wystarczy do zakupów' in tags or 'przed zakupami' in tags), f'{tag} Zapasy: prognoza w formacie v31')
    await pg.get_by_role('button', name='Zakupy', exact=True).click(); await pg.wait_for_selector('dialog.sheet')
    ok(await pg.locator('dialog .shop-list li').count() > 0, f'{tag} Zapasy: okno planu zakupów z listą')
    await pg.locator('dialog .shop-list input[type=checkbox]').first.check()
    ok('1 / ' in await pg.inner_text('dialog .prog'), f'{tag} Zapasy: pasek postępu zakupów')
    await pg.locator('dialog .sheet-head button').click()
    await pg.get_by_role('button', name='Kopia', exact=True).click(); await pg.wait_for_selector('dialog.sheet')
    ok('Pobierz kopię' in await pg.inner_text('dialog'), f'{tag} Zapasy: okno kopii zapasowej w module')
    await pg.locator('dialog .sheet-head button').click()
    await pg.get_by_role('button', name='Suplementy', exact=False).first.click(); await pg.wait_for_timeout(300)
    ok(await pg.locator('.inv-item').count() == 14, f'{tag} Zapasy: kategoria Suplementy (14 pozycji)')
    await pg.get_by_role('button', name='Wszystko').click(); await pg.wait_for_timeout(200)
    ok('wystarczy do' in inv.lower(), f'{tag} Zapasy: prognoza wyczerpania')
    # pozycja zużywana KAŻDEGO dnia (także w czwartek) — test korekty dnia niezależny od dnia tygodnia
    await pg.goto(url + '#/zapasy?q=Płatki'); await pg.wait_for_selector('.inv-item')
    before = await pg.locator('.inv-item').first.locator('input[type=number]').input_value()
    await pg.locator('.inv-item').first.get_by_role('button', name='+ opakowanie', exact=False).click()
    await wait_js(pg, 'v => document.querySelector(".inv-item input[type=number]").value !== v', before, timeout=8000)
    after = await pg.locator('.inv-item').first.locator('input[type=number]').input_value()
    ok(float(after) > float(before), f'{tag} Zapasy: zakup opakowania zwiększa stan ({before} → {after})')
    await pg.reload(); await pg.wait_for_selector('.inv-item')
    kept = await pg.locator('.inv-item').first.locator('input[type=number]').input_value()
    ok(kept == after, f'{tag} Zapasy: zmiana stanu zapisana trwale')
    await pg.get_by_role('button', name='Cofnij', exact=True).click()
    await wait_js(pg, 'v => document.querySelector(".inv-item input[type=number]").value === v', before, timeout=8000)
    ok(True, f'{tag} Zapasy: cofnięcie ostatniej zmiany przywraca stan')
    await pg.locator('.daycard > summary').click()   # korekta dnia — sekcja zwinięta (Faza 5)
    await pg.get_by_role('button', name='−1 dzień (odlicz)').click()
    await wait_js(pg, 'v => document.querySelector(".inv-item input[type=number]").value !== v', before, timeout=8000)
    ok(True, f'{tag} Zapasy: korekta dnia zmienia stany')
    ok(await pg.locator('.daycard[open]').count() == 1, f'{tag} Zapasy: sekcja korekty dnia pozostaje rozwinięta po zapisie')
    await pg.get_by_role('button', name='+1 dzień (cofnij zużycie)').click()
    await wait_js(pg, 'v => document.querySelector(".inv-item input[type=number]").value === v', before, timeout=8000)
    ok(True, f'{tag} Zapasy: odwrotna korekta dnia wraca do stanu wyjściowego')
    await pg.get_by_role('button', name='Historia', exact=True).click(); await pg.wait_for_selector('dialog.sheet')
    ok('Historia i cofanie zmian' in await pg.inner_text('dialog') and await pg.locator('dialog .hist li').count() >= 4, f'{tag} Zapasy: historia z wpisami')
    pg.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.locator('dialog .hist li').last.get_by_role('button', name='Przywróć ten stan').click()
    await pg.wait_for_selector('text=Przywrócono stan', timeout=15000)
    ok(True, f'{tag} Zapasy: przywrócenie stanu z historii')
    ok('pozycj' in await pg.inner_text('.dash'), f'{tag} Zapasy: podsumowanie stanu magazynu na pulpicie')
    # --- Faza 5: Zapasy (D-072) — przegląd, „Do kupienia”, pasek zapasu, szczegóły pozycji
    await pg.goto(url + '#/zapasy'); await pg.wait_for_selector('.inv-item')
    ok(await pg.locator('.zp-hbar > span').count() == 4 and 'Następne zakupy' in await pg.inner_text('.zp-shop') and 'pozycj' in await pg.inner_text('.zp-shop'),
       f'{tag} Zapasy: pasek stanu magazynu i karta „Do kupienia” z najbliższymi zakupami')
    ok(await pg.locator('.inv-item .zp-run').count() > 0 and await pg.locator('.zp-run-s').count() == await pg.locator('.zp-run').count(), f'{tag} Zapasy: pasek zapasu z kreską dnia zakupów')
    buy_name = (await pg.locator('.zp-buy-n').first.inner_text()).split('\n')[0]
    await pg.locator('.zp-buy-b').first.click(); await pg.wait_for_selector('text=(kupione)')
    await pg.goto(url + '#/zapasy?q=' + buy_name); await pg.wait_for_selector('.inv-item')
    ok(buy_name not in [x.split('\n')[0] for x in await pg.eval_on_selector_all('.zp-buy-n', 'e => e.map(x => x.innerText)')], f'{tag} Zapasy: „Kupione” dodaje zakup i zdejmuje pozycję z listy ({buy_name})')
    await pg.locator('.inv-item .zp-more > summary').first.click(); await pg.wait_for_timeout(200)
    ok('porcja' in await pg.inner_text('.inv-item .zp-more') and 'Opakowanie' in await pg.inner_text('.inv-item .zp-more'), f'{tag} Zapasy: „Więcej” — szczegóły i korekty porcji')
    await pg.locator('.inv-item .zp-more').get_by_role('button', name='+ porcja').click(); await pg.wait_for_timeout(500)
    ok(await pg.locator('.inv-item .zp-more[open]').count() == 1, f'{tag} Zapasy: szczegóły pozostają rozwinięte po korekcie')
    if not mobile:
        # Układ karty po rozwinięciu „Więcej” na komputerze (błąd: kolumna czynności rozpychała kartę, nazwa łamana po literze)
        await pg.goto(url + '#/zapasy'); await pg.wait_for_selector('.inv-item')
        for w in (1100, 1280, 1440):
            await pg.set_viewport_size({'width': w, 'height': 800}); await pg.wait_for_timeout(150)
            closed = await pg.evaluate("Math.round(document.querySelector('.inv-item .inv-head').getBoundingClientRect().width)")
            await pg.locator('.inv-item').first.locator('.zp-more > summary').click(); await pg.wait_for_timeout(150)
            m = await pg.evaluate('''() => { const it = document.querySelector('.inv-item'), r = s => it.querySelector(s).getBoundingClientRect();
              return { head: Math.round(r('.inv-head').width), item: Math.round(it.getBoundingClientRect().width), more: Math.round(r('.zp-more').width),
                sw: document.documentElement.scrollWidth, h3: Math.round(it.querySelector('.inv-head h3').getBoundingClientRect().height) }; }''')
            ok(closed >= 200 and m['head'] >= 200 and m['more'] >= m['item'] * 0.8 and m['h3'] < 60 and m['sw'] <= w,
               f'{tag} Zapasy {w}px: karta po „Więcej” bez zwężenia (nazwa {closed}→{m["head"]} px, szczegóły {m["more"]}/{m["item"]} px, h3 {m["h3"]} px)')
            await pg.locator('.inv-item').first.locator('.zp-more > summary').click(); await pg.wait_for_timeout(100)
        await pg.set_viewport_size({'width': 1280, 'height': 800})
    # --- Faza 5: Dieta (D-071) — składniki z Zapasów (dane syntetyczne mają pozycje pilne)
    await pg.goto(url + '#/dieta'); await pg.wait_for_selector('.meal')
    ok(await pg.locator('.dt-stock .dt-alerts li').count() >= 1 and await pg.locator('.meal .dt-stock-b').count() >= 1, f'{tag} Dieta: składniki z niskim zapasem oznaczone (z modułu Zapasy)')
    # --- Faza 5: Meal Prep (D-074), Suplementacja (D-075), Zapasy → Bezpieczeństwo (dane syntetyczne)
    await pg.goto(url + '#/mealprep'); await pg.wait_for_selector('.prep-card')
    ok('Składniki na jutro' in await pg.inner_text('.mp-stock') and await pg.locator('.mp-short-list li').count() >= 1 and await pg.locator('.prep-card .mp-short').count() >= 1,
       f'{tag} Meal Prep: braki składników na jutro (karta i oznaczenia kart)')
    await pg.goto(url + '#/suplementy'); await pg.wait_for_selector('.dose-list')
    ok(await pg.locator('.sp-stock .sp-low li').count() >= 1, f'{tag} Suplementacja: zapas suplementów z modułu Zapasy')
    await pg.locator('.sp-low .zp-buy-b').first.click(); await pg.wait_for_selector('text=(kupione)')
    ok(True, f'{tag} Suplementacja: „Kupione” dodaje opakowanie')
    await pg.goto(url + '#/zapasy?q=Banan'); await pg.wait_for_selector('.inv-item')
    await pg.locator('.inv-item .zp-more > summary').first.click(); await pg.wait_for_timeout(200)
    ok('bezpieczenstwo?q=Banan' in (await pg.locator('.zp-safe').first.get_attribute('href') or ''), f'{tag} Zapasy: link do zasad przechowywania (identyczna nazwa w Tabeli bezpieczeństwa)')
    await pg.goto(url + '#/mealprep'); await pg.wait_for_selector('.prep-card')
    mp = await pg.evaluate("document.querySelector('main').textContent")   # tabele progów w zwiniętych panelach (Faza 5)
    ok('płatki owsiane 70 g' in mp, f'{tag} Meal Prep: ilości z Fazy 0')
    ok('prosto z patelni' in mp and '> 63 °C' in mp, f'{tag} Meal Prep: progi wg D-013')
    allmp = await pg.evaluate("document.querySelector('main').textContent")  # także treść zwiniętych sekcji
    ok('ferrytyn' not in allmp and 'pakiecie prywatnym' in allmp, f'{tag} Meal Prep: dane z badań tylko w pakiecie prywatnym (D-035)')
    cb = pg.locator('.prep-list input[type=checkbox]').first
    await cb.check(); await pg.wait_for_timeout(300)
    await pg.reload(); await pg.wait_for_selector('.prep-card')
    ok(await pg.locator('.prep-list input[type=checkbox]').first.is_checked(), f'{tag} Meal Prep: odhaczony krok zapisany trwale')
    ok('1 / ' in await pg.inner_text('.mp-ring'), f'{tag} Meal Prep: pierścień postępu')
    ok('następny krok' in (await pg.inner_text('.mp-next')).lower(), f'{tag} Meal Prep: karta następnego kroku')
    await pg.goto(url + '#/suplementy'); await pg.wait_for_selector('table.data')
    tbl = await pg.inner_text('table.data')
    ok(f'{GLUKO():g} kaps.' in tbl and 'nieśledzony' in tbl, f'{tag} Suplementacja: stan z magazynu (glukozamina {GLUKO():g}) i cynk nieśledzony')
    for r in ROUTES:  # szerokość ponownie — z danymi (tabela stanów) — wcześniej przeoczone
        await pg.goto(url + r); await pg.wait_for_timeout(250)
        sw = await pg.evaluate('Math.max(...[...document.querySelectorAll(".panel, main")].map(e => Math.ceil(e.getBoundingClientRect().right)), document.documentElement.scrollWidth)')
        ok(sw <= vp['width'], f'{tag} {r} z danymi: nic nie wychodzi poza ekran ({sw}px)')
    pack = os.environ.get('PRIVATE_PACK')
    real_pack = bool(pack and pathlib.Path(pack).exists())
    if not real_pack:   # pakiet SYNTETYCZNY: poprawna struktura, wyłącznie teksty zastępcze (bez danych osobowych)
        pack = str(fixtures.write(fixtures.synthetic_private_pack(), 'pakiet_syntetyczny.json'))
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('text=Stan zapisu')
    await pg.set_input_files('input[type=file]', pack); await pg.wait_for_selector('dialog[open]')
    txt = await pg.inner_text('dialog')
    ok('Pakiet prywatny' in txt and 'Scal dane' in txt, f'{tag} pakiet prywatny rozpoznany')
    await pg.click('dialog >> text=Scal dane'); await pg.wait_for_selector('text=Zaimportowano 1 zmian')
    has = await pg.evaluate('''new Promise(r => { const q = indexedDB.open('p2027'); q.onsuccess = () => { const g = q.result.transaction('events').objectStore('events').getAll(); g.onsuccess = () => r(g.result.some(e => e.t === 'private.pack' && e.d.pack.sections.length === 4)); }; })''')
    ok(has, f'{tag} pakiet prywatny zapisany w bazie')
    if not real_pack:   # D-091: pakiet dla bieżącej wersji planu — podgląd importu i Diagnostyka
        ok('dla planu od 2026-09-27 (bieżący)' in txt, f'{tag} podgląd importu: pakiet dla bieżącego planu (D-091)')
        await pg.goto(url + '#/dzis'); await pg.goto(url + '#/dane'); await pg.wait_for_selector('.dn-diag')
        ok('Pakiet prywatny aktualny (plan od 2026-09-27)' in await pg.inner_text('.dn-diag'), f'{tag} Diagnostyka: pakiet prywatny aktualny (D-091)')
    await pg.goto(url + '#/rekompozycja?s=s13'); await pg.wait_for_selector('.rk-sec')
    want = 30 if real_pack else fixtures.rekomp_marker_uses()
    ok(await pg.locator('.priv-in').count() == want and await pg.locator('.priv-miss').count() == 0, f'{tag} Rekompozycja: {want} fragmentów z pakietu prywatnego wstawionych, nic ukrytego')
    await pg.goto(url + '#/mealprep'); await pg.wait_for_selector('.prep-card')
    mpp = await pg.evaluate("document.querySelector('main').textContent")
    ok('fragment w pakiecie prywatnym' not in mpp, f'{tag} Meal Prep: fragmenty z pakietu prywatnego wstawione')
    tag = tag0
    # --- offline (tylko wariant web z service workerem)
    if name == 'web':
        await pg.goto(url + '#/dzis')
        await pg.evaluate('navigator.serviceWorker.ready')
        await pg.reload(); await wait_js(pg, '() => navigator.serviceWorker.controller !== null')
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_selector('.dz-plan-h', timeout=8000)
        ok(True, f'{tag} działa offline po przeładowaniu (service worker)')
        await ctx.set_offline(False)
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h, .dz-outside')   # przed startem planu „Dziś” = „Poza planem” (D-088)
    await pg.screenshot(path=str(ROOT / f'tests/e2e/shot-{name}-{vp["width"]}-dzis.png'))
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('h1')
    await pg.screenshot(path=str(ROOT / f'tests/e2e/shot-{name}-{vp["width"]}-dane.png'), full_page=False)
    ok(not errs, f'{tag} brak błędów konsoli ({errs[:2]})')
    await b.close()

# --- Faza 5 (Trening, CFA): funkcje zależne od bieżącej godziny — zegar przeglądarki ustawiony na poniedziałek
# 28.09.2026 10:00 (UPPER 1, Faza 0; CFA: 1 dzień planu przed „dziś” — start 27.09, D-090). Oczekiwania liczone z danych, nie z kodu aplikacji.
CLOCK = _dt.datetime(2026, 9, 28, 10, 0, tzinfo=_dt.timezone(_dt.timedelta(hours=2)))
CFA_D = json.loads((ROOT / 'src/data/cfa.json').read_text(encoding='utf8'))['D']
def rest_left(t):  # '1:58' / '+0:13' -> sekundy do końca przerwy (ujemne po czasie)
    m, s_ = t.lstrip('+').split(':'); v = int(m) * 60 + int(s_); return -v if t.startswith('+') else v

async def run_features(pw, name, url, mobile):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [zegar 28.09 10:00]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.clock.install(time=CLOCK)
    # Trening: następna seria, licznik przerwy (tylko dla dnia bieżącego), podsumowanie sesji
    await pg.goto(url + '#/trening'); await pg.wait_for_selector('.ex')
    nx = await pg.inner_text('.tr-next')
    ok('Wyciskanie sztangi leżąc · seria 1 z 2' in nx and 'przerwa 2–3 min' in nx, f'{tag} Trening: karta pierwszej serii z planu')
    await pg.locator('.set:not(.set-h) .set-toggle').first.click(); await pg.wait_for_selector('.tr-rest')
    t0 = rest_left(await pg.inner_text('.tr-rest-t'))
    ok(115 <= t0 <= 120 and 'plan 2–3 min' in await pg.inner_text('.tr-rest-n'), f'{tag} Trening: licznik przerwy po odhaczeniu serii ({t0} s z 120)')
    ok('seria 2 z 2' in await pg.inner_text('.tr-next') and 'seria 2 z 2' in await pg.inner_text('.tr-rest-next'), f'{tag} Trening: następna seria po odhaczeniu')
    await pg.clock.fast_forward(60000); await pg.wait_for_timeout(1200)
    t1 = rest_left(await pg.inner_text('.tr-rest-t'))
    ok(52 <= t1 <= 60, f'{tag} Trening: przerwa odlicza czas zegara ({t1} s po 60 s)')
    await pg.locator('.tr-rest').get_by_role('button', name='+30 s').click(); await pg.wait_for_timeout(300)
    t2 = rest_left(await pg.inner_text('.tr-rest-t'))
    ok(t2 - t1 >= 28, f'{tag} Trening: „+30 s” wydłuża przerwę ({t1} → {t2} s)')
    await pg.clock.fast_forward(100000); await pg.wait_for_timeout(1200)
    ok('is-ready' in await pg.get_attribute('.tr-rest', 'class') and 'Przerwa zakończona' in await pg.inner_text('.tr-rest .sr-only'), f'{tag} Trening: koniec przerwy oznaczony i ogłoszony czytnikom ekranu')
    await pg.get_by_role('button', name='Pomiń przerwę').click()
    ok(await pg.locator('.tr-rest').count() == 0, f'{tag} Trening: „Pomiń” zamyka licznik')
    await pg.get_by_role('link', name='Przejdź do ćwiczenia').click(); await pg.wait_for_timeout(600)
    ok(await pg.evaluate('location.hash') == '#/trening' and (await pg.evaluate('document.activeElement.id')).startswith('ex-'), f'{tag} Trening: „Przejdź do ćwiczenia” przewija w module')
    for _ in range(9):   # pozostałe serie sesji
        await pg.locator('.set:not(.set-h) .set-toggle[aria-pressed=false]').first.click(); await pg.wait_for_timeout(350)
    done_txt = await pg.inner_text('.tr-next')
    ok('Sesja ukończona' in done_txt and '10 serii' in done_txt and await pg.locator('.tr-rest').count() == 0, f'{tag} Trening: podsumowanie ukończonej sesji, bez przerwy po ostatniej serii')
    await pg.goto(url + '#/trening?d=2026-09-29'); await pg.wait_for_selector('.ex')
    await pg.locator('.set:not(.set-h) .set-toggle').first.click(); await pg.wait_for_timeout(500)
    ok(await pg.locator('.tr-rest').count() == 0, f'{tag} Trening: brak licznika przerwy dla innego dnia niż dziś')
    # CFA: tempo względem planu, zaległe bloki, następny blok, nawigacja dni, filtr error logu
    due = [b for b in CFA_D['bloki'] if b['data'] < '2026-09-28']
    await pg.goto(url + '#/cfa'); await pg.wait_for_selector('.cfa-row')
    hero = await pg.inner_text('.hero-cfa')
    ok(f'Zaległe: {len(due)} bloków' in hero and f'Plan do wczoraj: 0 / {len(due)}' in hero, f'{tag} CFA: tempo i zaległe z planu ({len(due)})')
    ok(await pg.locator('.cf-backlog .cfa-row').count() == 5 and 'Następny: blok A' in await pg.inner_text('.cfa-dayhead'), f'{tag} CFA: panel zaległych (5 najstarszych) i następny blok dnia')
    await pg.locator('.cf-backlog .set-toggle').first.click(); await pg.wait_for_timeout(500)
    ok(f'Zaległe: {len(due) - 1} bloków' in await pg.inner_text('.hero-cfa') and f'Plan do wczoraj: 1 / {len(due)}' in await pg.inner_text('.hero-cfa'),
       f'{tag} CFA: odhaczenie zaległego bloku zmniejsza zaległości')
    await pg.get_by_role('link', name='Następny dzień').click(); await pg.wait_for_timeout(400)
    ok('d=2026-09-29' in await pg.evaluate('location.hash') and await pg.locator('.cf-backlog').count() == 0, f'{tag} CFA: nawigacja dni (panel zaległych tylko dla dnia bieżącego)')
    await pg.goto(url + '#/cfa?v=harmonogram&zal=1'); await pg.wait_for_selector('.filters')
    ok(f'{len(due) - 1} bloków' in await pg.inner_text('.filters') and await pg.locator('.cfa-row').count() == len(due) - 1, f'{tag} CFA: filtr „tylko zaległe” w harmonogramie')
    await pg.goto(url + '#/cfa?v=log'); await pg.wait_for_selector('.form-grid')
    for temat, kind in (('[TEST] FI — duration', 'pośpiech'), ('[TEST] QM — hipotezy', 'brak wiedzy')):
        await pg.fill('.form-grid input:not([type=date])', temat); await pg.select_option('.form-grid select', kind)
        await pg.get_by_role('button', name='Dodaj wpis').click(); await pg.wait_for_selector(f'text={temat}')
    await pg.get_by_role('button', name='pośpiech: 1').click(); await pg.wait_for_timeout(300)
    ok(await pg.locator('.log-item').count() == 1 and 'duration' in await pg.inner_text('.log-list'), f'{tag} CFA: filtr error logu wg rodzaju błędu')
    await pg.get_by_role('button', name='Wszystkie: 2').click(); await pg.wait_for_timeout(300)
    await pg.fill('.cf-search input', 'hipotezy'); await pg.press('.cf-search input', 'Enter'); await pg.wait_for_timeout(400)
    ok(await pg.locator('.log-item').count() == 1 and 'hipotezy' in await pg.inner_text('.log-list'), f'{tag} CFA: wyszukiwanie w error logu')
    # Dieta (D-071): następny posiłek wg godzin planu dnia, nawigacja po posiłkach w kolejności godzin
    await pg.goto(url + '#/dieta'); await pg.wait_for_selector('.meal')
    ok('11:15' in await pg.inner_text('.dt-next') and 'Przekąska' in await pg.inner_text('.dt-next'), f'{tag} Dieta: następny posiłek o 10:00 — przekąska 11:15')
    navs = await pg.eval_on_selector_all('.dt-nav-n', 'e => e.map(x => x.textContent)')
    ok(navs[:3] == ['Śniadanie', 'Przekąska', 'Lunch'] and navs[-1] == 'Napoje', f'{tag} Dieta: posiłki w kolejności godzin ({navs[:3]}…)')
    await pg.get_by_role('link', name='Pokaż skład').click(); await pg.wait_for_timeout(600)
    ok(await pg.evaluate('location.hash') == '#/dieta' and await pg.evaluate('document.activeElement.id') == 'dt-snack', f'{tag} Dieta: „Pokaż skład” przewija do posiłku')
    await pg.goto(url + '#/dieta?f=0&w=NT'); await pg.wait_for_selector('.meal')
    ok(await pg.locator('.dt-next').count() == 0 and await pg.locator('a.dt-today').count() == 1, f'{tag} Dieta: inny wariant — bez „następnego posiłku”, link do planu na dziś')
    # Suplementacja (D-075): minione i następna pora dnia; Meal Prep: bieżąca karta
    await pg.goto(url + '#/suplementy'); await pg.wait_for_selector('.dose-list')
    ok(await pg.locator('.tl-item.is-next time').inner_text() == '10:30' and await pg.locator('.tl-item.is-past').count() == 2, f'{tag} Suplementacja: 07:00 i 09:00 minione, następna 10:30')
    await pg.goto(url + '#/mealprep'); await pg.wait_for_selector('.prep-card')
    ok(await pg.locator('.prep-card.is-next').count() == 1, f'{tag} Meal Prep: wyróżniona karta z następnym krokiem')
    # Rekompozycja (D-076): wyszukiwanie w planie, rozwiń / zwiń wszystko
    await pg.goto(url + '#/rekompozycja?q=kreatyna'); await pg.wait_for_selector('.rk-sec')
    n = await pg.locator('.rk-sec').count()
    ok(1 <= n < 24 and 'kreatyna' in await pg.inner_text('.rk-hits'), f'{tag} Rekompozycja: wyszukiwanie zawęża sekcje ({n})')
    await pg.get_by_role('button', name='Rozwiń wszystko').click()
    ok(await pg.locator('.rk-sec[open]').count() == n, f'{tag} Rekompozycja: „Rozwiń wszystko”')
    # Bezpieczeństwo: wyczyszczenie filtrów; Dane (D-077): synchronizacja na górze
    await pg.goto(url + '#/bezpieczenstwo?q=termos'); await pg.wait_for_selector('.sf-card')
    await pg.get_by_role('button', name='Wyczyść filtry').click(); await pg.wait_for_timeout(400)
    ok(await pg.locator('.sf-card').count() == 71, f'{tag} Bezpieczeństwo: „Wyczyść filtry” przywraca 71 pozycji')
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('text=Stan zapisu')
    order = await pg.evaluate("[...document.querySelectorAll('main section.panel h2')].map(x => x.textContent)")
    ok(order and 'Synchronizacja' in order[0], f'{tag} Dane: synchronizacja jako pierwsza sekcja ({order[:2]})')
    if mobile:   # cele dotykowe w rozbudowanych modułach
        for r in ('#/trening', '#/cfa?v=dzien', '#/cfa?v=log', '#/dieta', '#/zapasy', '#/mealprep', '#/suplementy', '#/bezpieczenstwo', '#/rekompozycja', '#/dane'):
            await pg.goto(url + r); await pg.wait_for_timeout(300)
            small = await pg.evaluate('''[...document.querySelectorAll('main button, main a.btn, main a.chip, main summary, .dt-nav-a, .tabs a')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(r => r.height < 44 || r.width < 44).length''')
            ok(small == 0, f'{tag} {r}: elementy dotykowe ≥ 44 px (za małych: {small})')
    ok(not errs, f'{tag} brak błędów konsoli ({errs[:2]})')
    await b.close()

# --- Etap 1 (audyt 25.09.2026, B1–B7): zegar 11.10.2026 20:00 — wieczór przed startem Fazy 1 (12.10)
CLOCK_B = _dt.datetime(2026, 10, 11, 20, 0, tzinfo=_dt.timezone(_dt.timedelta(hours=2)))
async def run_audit_fixes(pw, name, url, mobile):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [Etap 1, zegar 11.10 20:00]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.clock.install(time=CLOCK_B)
    # B1: Meal Prep — karty wieczorne liczone z planu na jutro, nawigacja dni, odhaczenia pod datą strony
    await pg.goto(url + '#/mealprep'); await pg.wait_for_selector('.prep-card')
    k2 = await pg.inner_text('#mp-k2')
    ok('płatki owsiane 85 g' in k2 and '12.10' in await pg.inner_text('.mp-eve') and 'Faza 1' in await pg.inner_text('.mp-eve'),
       f'{tag} Meal Prep: wieczorem 11.10 overnight oats na jutro — 85 g (Faza 1)')
    ids = await pg.eval_on_selector_all('.prep-phase', 'e => e.map(x => x.id)')
    ok(ids[:4] == ['mp-ph-1', 'mp-ph-2', 'mp-ph-3', 'mp-ph-0'], f'{tag} Meal Prep: fazy w kolejności dnia, karty wieczorne po „Wieczorze” ({ids})')
    await pg.get_by_role('link', name='Następny dzień').click(); await pg.wait_for_timeout(500)
    ok('d=2026-10-12' in await pg.evaluate('location.hash') and '12 października 2026 · Faza 1' in await pg.text_content('.hero-tr-main .eyebrow'), f'{tag} Meal Prep: następny dzień (12.10, Faza 1)')
    await pg.locator('#mp-k3 input[type=checkbox]').first.check(); await pg.wait_for_timeout(400)
    await pg.reload(); await pg.wait_for_selector('.prep-card')
    ok(await pg.locator('#mp-k3 input[type=checkbox]').first.is_checked(), f'{tag} Meal Prep: odhaczenie zapisane pod datą 12.10')
    await pg.goto(url + '#/mealprep'); await pg.wait_for_selector('.prep-card')
    ok(not await pg.locator('#mp-k3 input[type=checkbox]').first.is_checked(), f'{tag} Meal Prep: 11.10 bez odhaczeń z 12.10')
    # B3: okna — nazwa dostępna, usunięcie po Esc; B2: błąd walidacji widoczny w oknie
    await pg.goto(url + '#/zapasy'); await pg.wait_for_selector('.inv-item')
    for _ in range(2):
        await pg.locator('.zp-act', has_text='Dodaj').click(); await pg.wait_for_selector('dialog[open]')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    ok(await pg.locator('dialog').count() == 0, f'{tag} Zapasy: okno usunięte po Esc (2 × otwarcie)')
    await pg.locator('.zp-act', has_text='Dodaj').click(); await pg.wait_for_selector('dialog[open]')
    ok(await pg.get_by_role('dialog', name='Dodaj nową pozycję').count() == 1, f'{tag} Zapasy: okno z nazwą dostępną')
    await pg.get_by_role('button', name='Zapisz pozycję').click(); await pg.wait_for_timeout(200)
    ok(await pg.locator('dialog .sheet-msg .banner.err').is_visible() and 'Podaj nazwę' in await pg.inner_text('dialog .sheet-msg'),
       f'{tag} Zapasy: błąd „Podaj nazwę pozycji” widoczny w oknie')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    # B5: fokus wraca na przycisk po zapisie; B4: potwierdzenie widoczne w oknie przeglądarki mimo przewinięcia
    btn = pg.locator('.zp-pack').nth(6)
    label = await btn.get_attribute('aria-label')
    await btn.click(); await pg.wait_for_timeout(600)
    ok(await pg.evaluate("document.activeElement.getAttribute('aria-label')") == label, f'{tag} Zapasy: fokus na „+ opakowanie” po zapisie')
    r = await pg.evaluate("(() => { const b = document.querySelector('#toast .banner'); if (!b) return null; const x = b.getBoundingClientRect(); return [x.top, x.bottom, innerHeight, b.textContent]; })()")
    ok(r and r[0] >= 0 and r[1] <= r[2] and ':' in r[3], f'{tag} Zapasy: potwierdzenie w obszarze komunikatów, w widoku ({r})')
    ok(await pg.evaluate("document.querySelector('main').textContent.includes(document.querySelector('#toast').textContent)") is False,
       f'{tag} komunikat poza przerysowywaną treścią')
    await pg.clock.fast_forward(7000); await pg.wait_for_timeout(300)
    ok(await pg.locator('#toast .banner').count() == 0, f'{tag} komunikat znika po 6 s')
    await pg.goto(url + '#/trening?d=2026-10-12'); await pg.wait_for_selector('.ex')
    t = pg.locator('.set:not(.set-h) .set-toggle').nth(2)
    host = await t.evaluate("e => e.closest('.ex').id")
    await t.click(); await pg.wait_for_timeout(600)
    ok(await pg.evaluate("document.activeElement.classList.contains('set-toggle') && document.activeElement.closest('.ex').id") == host
       and await pg.evaluate("document.activeElement.getAttribute('aria-pressed')") == 'true', f'{tag} Trening: fokus na odhaczonej serii po zapisie')
    await pg.locator('.ex-tech').first.click(); await pg.wait_for_selector('dialog[open]')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    ok(await pg.locator('dialog').count() == 0, f'{tag} Trening: okno techniki usunięte po Esc')
    ok(not errs, f'{tag} brak błędów konsoli ({errs[:2]})')
    await b.close()
    # B6: 320 px — brak przewijania w poziomie w żadnym widoku
    if mobile:
        b = await pw.chromium.launch()
        pg = await (await b.new_context(viewport={'width': 320, 'height': 700}, is_mobile=True, has_touch=True, locale='pl-PL', timezone_id='Europe/Warsaw')).new_page()
        await pg.clock.install(time=CLOCK_B)
        wide = []
        for r in ROUTES + ['#/trening?d=2026-10-12', '#/mealprep?d=2026-10-12']:
            await pg.goto(url + r); await pg.wait_for_timeout(250)
            sw = await pg.evaluate('document.documentElement.scrollWidth')
            if sw > 320: wide.append((r, sw))
        ok(not wide, f'{name} 320px: brak przewijania w poziomie ({wide})')
        await b.close()

# --- Etap 2 (audyt 25.09.2026, U-a…U-i, S1, I8): zegar 11.10.2026 20:00
async def run_etap2(pw, name, url, mobile):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [Etap 2, zegar 11.10 20:00]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.clock.install(time=CLOCK_B)
    # U-i: „Przejdź do treści” — pierwszy element w kolejności Tab, przenosi fokus do <main>
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
    await pg.keyboard.press('Tab')
    ok(await pg.evaluate("document.activeElement.className") == 'skip-link', f'{tag} U-i: „Przejdź do treści” pierwszy po Tab')
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
    ok(await pg.evaluate("document.activeElement.id") == 'main', f'{tag} U-i: fokus w treści')
    # U-a: minione punkty dnia zwinięte, bieżący widoczny
    past = pg.locator('details.dz-past')
    ok(await past.count() == 1 and await past.get_attribute('open') is None and 'Minione punkty' in await pg.inner_text('.dz-past > summary')
       and await pg.locator('.dz-plan > .day .slot.is-now').count() == 1, f'{tag} U-a: minione punkty zwinięte, „teraz” w planie')
    n_all = await pg.locator('.slot').count()
    ok(n_all == 34, f'{tag} U-a: wszystkie 34 punkty w DOM ({n_all})')
    # U-f: strzałki kart ≥ 44 px
    sz = await pg.eval_on_selector('.dz-more', 'e => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]')
    ok(sz[0] >= 44 and sz[1] >= 44, f'{tag} U-f: .dz-more {sz}')
    # U-e: najmniejszy tekst 12 px
    fs = await pg.evaluate("parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs-2xs')) * 16")
    ok(fs >= 12, f'{tag} U-e: --fs-2xs = {fs} px')
    # U-b: harmonogram od dziś, minione dni zwinięte (budowane po rozwinięciu)
    await pg.goto(url + '#/cfa?v=harmonogram'); await pg.wait_for_selector('.filters')
    first = await pg.locator('main > section.panel .cfa-dh a').first.inner_text()
    ok(await pg.locator('details.cf-past:not([open])').count() == 1 and await pg.locator('details.cf-past .cfa-row').count() == 0 and '11.10' in first,
       f'{tag} U-b: harmonogram od dziś ({first}), minione zwinięte')
    await pg.locator('details.cf-past > summary').click(); await pg.wait_for_timeout(300)
    ok(await pg.locator('details.cf-past .cfa-row').count() > 100, f'{tag} U-b: minione dni po rozwinięciu')
    # U-c: wyszukiwanie na bieżąco, filtr „Do zakupów”, edycja własnej pozycji, jednostki; U-g: podpowiedź „Stan”
    await pg.goto(url + '#/zapasy'); await pg.wait_for_selector('.inv-item')
    ok(await pg.locator('#zp-stan-hint').count() == 1 and await pg.locator('.inv-item input[aria-describedby="zp-stan-hint"]').count() > 0, f'{tag} U-g: podpowiedź „Stan na koniec dnia”')
    await pg.locator('#zp-q').press_sequentially('płat', delay=30); await pg.wait_for_timeout(300)
    vis = await pg.eval_on_selector_all('.inv-item:not([hidden]) h3', 'e => e.map(x => x.textContent)')
    ok(vis and all('płat' in v.lower() for v in vis) and 'q=' in await pg.evaluate('location.hash') and await pg.evaluate('document.activeElement.id') == 'zp-q',
       f'{tag} U-c: filtrowanie podczas pisania, fokus w polu ({vis})')
    await pg.locator('#zp-q').fill(''); await pg.locator('#zp-q').press_sequentially('x', delay=30); await pg.wait_for_timeout(200)
    await pg.locator('#zp-q').fill(''); await pg.locator('#zp-q').dispatch_event('input'); await pg.wait_for_timeout(300)
    await pg.locator('.counters .c-shop').click(); await pg.wait_for_timeout(400)
    ok('s=shop' in await pg.evaluate('location.hash'), f'{tag} U-c: filtr „Do zakupów”')
    await pg.goto(url + '#/zapasy'); await pg.wait_for_selector('.inv-item')
    await pg.locator('.zp-act', has_text='Dodaj').click(); await pg.wait_for_selector('dialog[open]')
    await pg.locator('dialog input').first.fill('[TEST] Pozycja E2E'); await pg.get_by_role('button', name='Zapisz pozycję').click(); await pg.wait_for_timeout(500)
    await pg.goto(url + '#/zapasy?q=%5BTEST%5D'); await pg.wait_for_selector('.inv-item')
    await pg.locator('.inv-item .zp-more > summary').first.click()
    ok('Opakowanie 1 g' in await pg.inner_text('.inv-item .zp-more'), f'{tag} U-c: jednostka ze spacją („Opakowanie 1 g”)')
    await pg.get_by_role('button', name='Edytuj [TEST] Pozycja E2E').click(); await pg.wait_for_selector('dialog[open]')
    await pg.locator('dialog input').first.fill('[TEST] Pozycja E2E zmieniona'); await pg.get_by_role('button', name='Zapisz zmiany').click(); await pg.wait_for_timeout(500)
    ok('[TEST] Pozycja E2E zmieniona' in await pg.inner_text('.inv'), f'{tag} U-c: edycja własnej pozycji')
    ok(not any(ord(c) > 0x2700 for c in await pg.inner_text('.actions')), f'{tag} U-d: przyciski Zapasów bez emoji')
    # U-h, I8: Dane — ostrzeżenia i diagnostyka
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('.dn-diag')
    ok(await pg.locator('.dn-diag-list li').count() >= 5 and 'Diagnostyka danych' in await pg.inner_text('.dn-diag'), f'{tag} I8: diagnostyka danych')
    ok('nie jest szyfrowany' in await pg.inner_text('.dn-plain'), f'{tag} U-h: ostrzeżenie o jawnym pliku')
    ok((await pg.locator('.dn-evict').count() == 1) == (name == 'web'), f'{tag} U-h: ostrzeżenie o karcie Safari tylko w karcie przeglądarki')
    if name == 'web':
        ok('Content-Security-Policy' in await pg.evaluate("document.querySelector('meta[http-equiv]')?.httpEquiv || ''"), f'{tag} S1: CSP w wariancie web')
    ok(not errs, f'{tag} brak błędów konsoli, także naruszeń CSP ({errs[:2]})')
    await b.close()

# --- Etap 3 (audyt 25.09.2026, I1–I5, I7, I11; bez I6): zegar 11.10.2026 20:00
async def run_etap3(pw, name, url, mobile):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [Etap 3, zegar 11.10 20:00]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw', accept_downloads=True)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.clock.install(time=CLOCK_B)
    due = [x for x in CFA_D['bloki'] if x['data'] < '2026-10-11']
    # I2: „Wymaga uwagi” — zaległe bloki CFA zgodne z modułem CFA
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-attn')
    at = await pg.inner_text('.dz-attn')
    ok(f'Zaległe bloki CFA: {len(due)}' in at and await pg.locator('.dz-attn a[href="#/cfa?v=harmonogram&zal=1"]').count() == 1, f'{tag} I2: „Wymaga uwagi” — zaległe bloki ({len(due)})')
    ok(await pg.locator('.dz-attn').count() == 1, f'{tag} I2: karta tylko dla dnia bieżącego')
    # I3: Tydzień — 7 dni, sobota z zakupami, przejście do dnia
    await pg.get_by_role('link', name='Tydzień').first.click(); await pg.wait_for_selector('.wk-grid')
    days = await pg.eval_on_selector_all('.wk-day', 'e => e.map(x => x.textContent)')
    ok(len(days) == 7 and 'Zakupy 12:13' in days[5] and 'UPPER 1' in days[0] and 'dziś' in days[6], f'{tag} I3: tydzień 05–11.10 z resolvera')
    await pg.locator('.wk-day').nth(2).click(); await pg.wait_for_selector('.dz-plan-h')
    ok('d=2026-10-07' in await pg.evaluate('location.hash'), f'{tag} I3: dzień z tygodnia otwiera plan dnia')
    await pg.goto(url + '#/dzis?v=tydzien&d=2026-09-25'); await pg.wait_for_selector('.wk-grid')
    ok(await pg.locator('.wk-day.is-out').count() == 6, f'{tag} I3: 21–26.09 poza planem (D-088, D-090)')
    # I11: recall 22:00 odhaczany (ustawienie), widoczny w statystykach
    await pg.goto(url + '#/cfa?v=dzien&d=2026-10-05'); await pg.wait_for_selector('.cf-recall')
    await pg.locator('.cf-recall .set-toggle').click(); await pg.wait_for_timeout(500)
    ok(await pg.locator('.cf-recall .set-toggle').get_attribute('aria-pressed') == 'true' and 'Recall: 1 /' in await pg.inner_text('.hero-cfa'), f'{tag} I11: recall odhaczony')
    await pg.goto(url + '#/cfa?v=plan'); await pg.wait_for_selector('.kv')
    ok('wykonane 1 z 34 sesji' in await pg.inner_text('main'), f'{tag} I11: statystyka recall w planie')
    await pg.goto(url + '#/cfa?v=dzien&d=2026-10-09'); await pg.wait_for_selector('.cfa-dayhead')
    ok(await pg.locator('.cf-recall').count() == 0, f'{tag} I11: piątek bez recall')
    # I4 / I5: wyszukiwanie (Ctrl+K, „/”), skróty
    if not mobile:
        await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
        await pg.keyboard.press('Control+k'); await pg.wait_for_selector('dialog.gs-dialog')
        await pg.keyboard.type('hypothesis testing'); await pg.wait_for_timeout(300)
        ok(await pg.locator('.gs-hit').count() >= 1 and 'CFA' in await pg.inner_text('.gs-list'), f'{tag} I4: wyniki wyszukiwania (bloki CFA)')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
        ok('#/cfa?v=dzien&d=' in await pg.evaluate('location.hash') and await pg.locator('dialog').count() == 0, f'{tag} I4: Enter otwiera pierwszy wynik')
        await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
        await pg.keyboard.press('/'); await pg.wait_for_selector('dialog.gs-dialog')
        await pg.keyboard.type('płatki'); await pg.wait_for_timeout(300)
        ok(any('Płatki' in t for t in await pg.eval_on_selector_all('.gs-t', 'e => e.map(x => x.textContent)')), f'{tag} I4: „/” i produkty Zapasów')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        await pg.keyboard.press('g'); await pg.keyboard.press('z'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate('location.hash') == '#/zapasy', f'{tag} I5: g z → Zapasy')
        await pg.goto(url + '#/dzis?d=2026-10-05'); await pg.wait_for_selector('.dz-plan-h')
        await pg.locator('body').click(position={'x': 5, 'y': 5}); await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(400)
        ok('d=2026-10-06' in await pg.evaluate('location.hash'), f'{tag} I5: → następny dzień')
        await pg.keyboard.press('?'); await pg.wait_for_selector('dialog.gs-help')
        ok('g z' in await pg.inner_text('dialog.gs-help'), f'{tag} I5: lista skrótów'); await pg.keyboard.press('Escape')
    else:
        await pg.goto(url + '#/wiecej'); await pg.wait_for_selector('.more-search')
        await pg.locator('.more-search').click(); await pg.wait_for_selector('dialog.gs-dialog')
        await pg.locator('.gs-input').fill('skyr'); await pg.wait_for_timeout(300)
        ok(await pg.locator('.gs-hit').count() >= 2, f'{tag} I4: wyszukiwanie z „Więcej” (telefon)')
        await pg.keyboard.press('Escape')
    # I7: paragon tekstem — podgląd, zapis
    await pg.goto(url + '#/zapasy?q=Banan'); await pg.wait_for_selector('.inv-item')
    await pg.locator('.zp-act', has_text='Paragon').click(); await pg.wait_for_selector('dialog[open]')
    await pg.locator('dialog textarea').fill('banan 1,2 kg\nczekolada gorzka 100 g')
    await pg.get_by_role('button', name='Sprawdź').click(); await pg.wait_for_timeout(300)
    pvt = await pg.inner_text('.rc-preview')
    ok('Banan' in pvt and '1200 g' in pvt.replace('\xa0', ' ') and 'czekolada' in pvt, f'{tag} I7: podgląd paragonu (rozpoznane i pominięte)')
    await pg.get_by_role('button', name='Dodaj do zapasów').click(); await pg.wait_for_timeout(600)
    ok(await pg.locator('dialog').count() == 0 and 'Paragon: 1 pozycji' in await pg.inner_text('#toast'), f'{tag} I7: zapis zakupów z paragonu')
    # I1: plik .ics z alarmami
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('.dn-ics')
    async with pg.expect_download() as dl:
        await pg.get_by_role('button', name='Pobierz plik .ics').click()
    d = await dl.value
    ics = pathlib.Path(await d.path()).read_text(encoding='utf8')
    ok(d.suggested_filename == '2027-plan-2026-10-11.ics' and ics.startswith('BEGIN:VCALENDAR') and ics.count('BEGIN:VEVENT') == ics.count('BEGIN:VALARM') > 50
       and 'TZID:Europe/Warsaw' in ics, f'{tag} I1: plik .ics ({ics.count("BEGIN:VEVENT")} wydarzeń z alarmami)')
    ok('wydarzeniami' in await pg.inner_text('.dn-ics'), f'{tag} I1: komunikat po eksporcie')
    ok(not errs, f'{tag} brak błędów konsoli ({errs[:2]})')
    await b.close()

async def main():
    srv = serve(8765)
    async with async_playwright() as pw:
        for mobile in (True, False):
            await run_variant(pw, 'web', 'http://localhost:8765/index.html', mobile)
            await run_variant(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), mobile)
        await run_features(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_features(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
        await run_audit_fixes(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_audit_fixes(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
        await run_etap2(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_etap2(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
        await run_etap3(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_etap3(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
    srv.shutdown()
    bad = [m for c, m in results if not c]
    print(f'\nE2E: {len(results)} kontroli, zaliczonych: {len(results) - len(bad)}, błędów: {len(bad)}, pominiętych bloków: {len(skipped)}')
    sys.exit(1 if bad else 0)

asyncio.run(main())
