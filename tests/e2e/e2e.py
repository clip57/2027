"""Testy E2E (Chromium, Playwright): oba warianty budowy, iPhone 390×844 i komputer 1280×800.
Uruchomienie: python3 tests/e2e/e2e.py  (wymaga dist/ oraz opcjonalnie SOURCES_DIR z kopią ZAPASY)."""
import asyncio, re, json, os, sys, time, threading, http.server, functools, tempfile, pathlib, math
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fixtures

ROOT = pathlib.Path(__file__).resolve().parents[2]
BACKUP = os.environ.get('SOURCES_DIR') and pathlib.Path(os.environ['SOURCES_DIR']) / 'zapasy_kopia_2026-09-22.json'
ROUTES = ['#/bezpieczenstwo?m=poradnik', '#/rekompozycja', '#/rekompozycja?s=s6', '#/bezpieczenstwo', '#/bezpieczenstwo?m=tabela', '#/trening?v=stat', '#/trening?v=historia', '#/cfa', '#/cfa?v=harmonogram', '#/cfa?v=kalendarz', '#/cfa?v=log', '#/cfa?v=plan', '#/dzis?d=2026-10-03', '#/trening', '#/trening?d=2026-09-21', '#/zapasy', '#/mealprep', '#/dieta?f=1&w=NT', '#/suplementy?d=2026-09-24', '#/dzis', '#/dzis?d=2026-10-26', '#/dzis?d=2026-09-24', '#/dane', '#/wiecej', '#/dieta', '#/zapasy', '#/trening', '#/cfa', '#/suplementy', '#/bezpieczenstwo', '#/pielegnacja', '#/pielegnacja?v=plan']
results = []
# Kontrast tekstu elementu względem jego własnego (nieprzezroczystego) tła — WCAG; stany, których axe nie widzi.
CONTRAST = '''el => { const px = c => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data]; };
  const L = ([r, g, b]) => [r, g, b].map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const s = getComputedStyle(el), a = L(px(s.color)), b = L(px(s.backgroundColor)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }'''

# Oczekiwany stan liczony niezależnie od kodu aplikacji (D-027: stan na koniec 22.09, odliczanie od 23.09).
import datetime as _dt
from zoneinfo import ZoneInfo
# Daty pobieramy z aktualnych danych planu; CFA ma osobny zakres od 16.10 (D-103c).
PLAN_START = _dt.date.fromisoformat(json.loads((ROOT / 'src/data/phases.json').read_text(encoding='utf8'))['start'])
_PH = json.loads((ROOT / 'src/data/phases.json').read_text(encoding='utf8'))
ZERO, PLAN_END = (_dt.date.fromisoformat(_PH['zero']) if _PH.get('zero') else PLAN_START - _dt.timedelta(days=1)), _dt.date.fromisoformat(_PH['end'])   # D-121: Dzień zero = 23.11.2026
TEST_NOW = _dt.datetime(2026, 11, 30, 10, 0, tzinfo=_dt.timezone(_dt.timedelta(hours=1)))   # D-121: poniedziałek Fazy 0 (UPPER 1), CFA i MPW w toku
def TODAY(): return TEST_NOW.astimezone(ZoneInfo('Europe/Warsaw')).date()
VCLOCK = TEST_NOW
WEEK = json.loads((ROOT / 'src/data/week.json').read_text(encoding='utf8'))
def diet_of(d): return WEEK.get('exceptions', {}).get(d.isoformat(), {}).get('diet') or WEEK['days'][str(d.isoweekday())]['diet']
def expected_stock(start, per_day, since=_dt.date(2026, 9, 22)):
    # „dziś” w strefie przeglądarki testowej (Europe/Warsaw), nie serwera (UTC) — inaczej między 22:00 a 24:00 UTC różnica 1 dnia
    d, q, today = max(since + _dt.timedelta(days=1), PLAN_START), start, TODAY()
    while d <= min(today, PLAN_END):
        if d != ZERO: q = max(0, q - per_day(d))   # K1 (audyt 31.10.2026): stan nie schodzi poniżej zera
        d += _dt.timedelta(days=1)
    return q
# Dane do bloku zapasów: prawdziwa kopia użytkownika (SOURCES_DIR) albo SYNTETYCZNA kopia z fikcyjnymi wartościami
# (tests/e2e/fixtures.py) — dzięki temu funkcje Zapasów, Meal Prep, eksportu i importu są sprawdzane także bez plików użytkownika.
if BACKUP and BACKUP.exists():
    DATA = {'label': '', 'path': BACKUP, 'events': 55, 'ban': 240, 'since': _dt.date(2026, 9, 22)}
else:
    _obj, _n, _stocks = fixtures.synthetic_zapasy(TODAY() - _dt.timedelta(days=1))   # względem zegara testu, nie daty uruchomienia
    DATA = {'label': ' (dane syntetyczne)', 'path': fixtures.write(_obj, 'zapasy_syntetyczne.json'), 'events': _n,
            'ban': _stocks['banan'], 'since': _dt.date.fromisoformat(_obj['lastSyncDate'])}
BANAN = lambda: expected_stock(DATA['ban'], lambda d: 0 if diet_of(d) == 'NT' else 120, DATA['since'])   # dzień NT bez banana
GLUKO = lambda: expected_stock(180, lambda d: 1 if _dt.date(2026, 11, 24) <= d <= _dt.date(2027, 4, 30) else 0)   # D-121: przyjmowanie 24.11.2026–30.04.2027
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
    if VCLOCK: await pg.clock.install(time=VCLOCK)
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h, .dz-outside, .dz-zero')   # przed startem planu „Dziś” = „Poza planem” (D-088)
    for r in ROUTES:
        await pg.goto(url + r); await pg.wait_for_timeout(250)
        sw = await pg.evaluate('document.documentElement.scrollWidth')
        ok(sw <= vp['width'], f'{tag} {r}: brak przewijania w poziomie ({sw}px)')
        words = (await pg.evaluate("document.querySelector('main').textContent")).split()
        bad = [w for w in words if w in ('null', 'false', 'undefined', 'NaN') or w.startswith('[object')]
        ok(not bad, f'{tag} {r}: brak artefaktów tekstowych ({bad[:3]})')
    mock_day = CFA_D['mockCFA'][0]
    await pg.goto(url + f'#/dzis?d={mock_day}'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    titles = await pg.eval_on_selector_all('.slot-title', 'e => e.map(x => x.firstChild.textContent)')
    ok(not any(t.startswith('Mock CFA') for t in titles), f'{tag} dzień mocka planu CFA 2027: zwykłe bloki, bez sesji S1/S2 (D-116)')
    expected_cfa_titles = sorted(('CFA — blok dodatkowy' if b['blok'] == 'Dodatkowy' else f"CFA blok {b['blok']}") for b in CFA_D['bloki'] if b['data'] == mock_day)
    ok(expected_cfa_titles == sorted(t for t in titles if t.startswith('CFA')),
       f'{tag} dzień mocka: bloki dnia zgodne z planem CFA 2027 (symulacja w slotach bloków)')
    ok(any('Obiad (16:23)' in t for t in await pg.eval_on_selector_all('.slot-items li', 'e => e.map(x => x.textContent)')), f'{tag} obiad opisany jako 16:23 (D-037)')
    # D-103c: kalendarz zaczyna się 18.10, CFA pozostaje dostępne od 16.10.
    first_day = PLAN_START.isoformat()
    before_plan = (PLAN_START - _dt.timedelta(days=1)).isoformat()
    await pg.goto(url + f'#/dzis?d={first_day}'); await pg.wait_for_selector('.dz-plan-h')
    ok(await pg.locator('.daynav [aria-label="Poprzedni dzień"]').count() == 0, f'{tag} {first_day}: pierwszy dzień planu — bez poprzedniego dnia')
    await pg.goto(url + f'#/dzis?d={before_plan}'); await pg.wait_for_selector('.dz-outside')
    outside = await pg.inner_text('.dz-outside')
    ok(f'd={first_day}' in await pg.locator('.dz-outside a').get_attribute('href') and 'Bez diety' not in await pg.inner_text('main'),
       f'{tag} {before_plan}: poza planem, odnośnik do początku planu')
    # D-121: Dzień zero 23.11 — w planie (nauka), bez dawek i treningu
    await pg.goto(url + f'#/dzis?d={first_day}'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    zchips = await pg.eval_on_selector_all('.topline .chip', 'e => e.map(x => x.textContent)')
    ok('Dzień zero' in zchips and await pg.locator('.slot-supps').count() == 0 and await pg.locator('.slot .cfa-row, .slot[id^="slot.1220"]').count() > 0,
       f'{tag} {first_day}: Dzień zero — bez dawek, z blokami nauki (D-121): {zchips}')
    # 30.11 — trening Fazy 0 (UPPER 1 + sauna).
    await pg.goto(url + '#/dzis?d=2026-11-30'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    main = await pg.inner_text('main')
    ok(main.lower().count('chondroityn') == 2, f'{tag} chondroityna tylko 2 razy (07:00 i 21:00) — brak dublowania (D-001)')
    ok('Pomiar wagi i ciśnienia na czczo po toalecie.' in main, f'{tag} pomiar wagi i ciśnienia (D-038)')
    SLOTS = "e => e.map(x => x.querySelector('time').textContent + ' ' + x.querySelector('.slot-title').firstChild.textContent)"   # bez znacznika „teraz”
    chips = await pg.eval_on_selector_all('.topline .chip', 'e => e.map(x => x.textContent)')
    ok('UPPER 1 + sauna' in chips and 'Faza 0' in chips, f'{tag} 30.11: UPPER 1 + sauna, Faza 0: {chips}')
    slots = await pg.eval_on_selector_all('.slot', SLOTS)
    OPEN = "document.querySelectorAll('details.dz-past').forEach(d => d.open = true)"
    await pg.goto(url + '#/dzis?d=2026-11-22'); await pg.wait_for_selector('.dz-outside')
    ok(await pg.locator('.slot').count() == 0, f'{tag} 22.11: przed startem planu — ukryty (D-121)')
    await pg.goto(url + '#/dzis?d=2026-11-26'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate(OPEN)
    slots = await pg.eval_on_selector_all('.slot', SLOTS)
    ok('17:45 Transport na siłownię' in slots and '17:55 2 rundy sauny wg protokołu' in slots and '19:05 Zakupy' in slots and 'Posiłek po saunie' in await pg.inner_text('#slot\\.1905c'),
       f'{tag} czwartek: sauna 17:55–19:05, zakupy 19:05–20:35, posiłek po saunie 20:15 (D-097)')
    await pg.goto(url + '#/dzis?d=2026-12-24'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate(OPEN)
    slots = await pg.eval_on_selector_all('.slot', SLOTS)
    ok(not any('Zakupy' in x or 'sauny' in x or 'Sauna' in x for x in slots) and '08:00 CFA blok E' in slots and '12:20 Nauka MPW' in slots,
       f'{tag} 24.12: bez zakupów, sauny i treningu; CFA rano 08:00, MPW od 12:20 (D-121)')
    await pg.goto(url + '#/dzis?d=2027-01-07'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate(OPEN)
    slots = await pg.eval_on_selector_all('.slot', SLOTS)
    ok('15:30 Zakupy' in slots and '19:05 2 rundy sauny wg protokołu' in slots and '16:00 MPW blok A' in slots, f'{tag} czwartek od 07.01: zakupy 15:30, MPW od 16:00, sauna 19:05 (D-097)')
    await pg.goto(url + '#/dzis?d=2026-11-24'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate(OPEN)
    # Porównanie liter bloku dnia (plan CFA 2027 równolegle z MPW, D-116)
    slots = await pg.eval_on_selector_all('.slot', SLOTS)
    expected_letters = [b['blok'] for b in CFA_D['bloki'] if b['data'] == '2026-11-24']
    actual_letters = [s.rsplit(' ', 1)[-1] for s in slots if 'CFA blok' in s]
    ok(actual_letters == expected_letters == ['E', 'F', 'G'], f'{tag} plan dnia: bloki CFA zgodne z planem 2027 ({actual_letters})')
    ok('12:13 Przerwa kognitywna' in slots and '13:13 Przerwa na lunch' in slots,
       f'{tag} plan dnia: przerwa 12:13–12:20 i przerwa na lunch 13:13–13:30 (D-086)')
    e_items = await pg.inner_text('#slot\\.1220')
    ok('Druga kawa (12:20)' in e_items and 'Lunch (13:20)' in await pg.inner_text('#slot\\.1313'), f'{tag} plan dnia: druga kawa w bloku E, lunch 13:20 (D-086)')
    ok('Spacer' not in main and 'Długa przerwa' not in main, f'{tag} plan dnia: bez spaceru regeneracyjnego i długiej przerwy (D-086)')
    # D-103c: daty przed startem kalendarza są poza planem; CFA testujemy osobno.
    for d in ('2026-11-22', '2026-09-21'):
        await pg.goto(url + f'#/dzis?d={d}'); await pg.wait_for_selector('.dz-outside')
        ok(await pg.locator('.slot').count() == 0 and 'poza planem' in await pg.inner_text('.topline'),
           f'{tag} {d}: poza planem, bez planu dnia (D-121)')
    await pg.locator('.dz-outside a').click(); await pg.wait_for_selector('.dz-plan-h')
    ok(f'd={first_day}' in await pg.evaluate('location.hash'), f'{tag} poza planem: przejście do początku kalendarza {first_day}')
    await pg.goto(url + '#/dzis?d=2028-01-01'); await pg.wait_for_selector('.dz-outside')
    ok(await pg.locator('.slot').count() == 0, f'{tag} 01.01.2028: po końcu planu (31.12.2027, D-117) — bez planu dnia')
    # (U-a) w dniu bieżącym minione punkty planu są zwinięte — przed odczytem treści dnia sekcja jest rozwijana
    # --- Redesign (Faza 3–4): motyw, nawigacja, dashboard
    th = await pg.evaluate("document.documentElement.getAttribute('data-theme')")
    ok(th == 'dark' or await pg.evaluate("localStorage.getItem('p2027.theme')") is not None, f'{tag} Motyw: domyślnie ciemny')
    if mobile:
        labels = await pg.eval_on_selector_all('.tabs a', 'e => e.map(x => x.textContent.trim())')
        study = 'MPW' if TODAY() >= _dt.date(2026, 11, 12) else 'CFA'   # D-095: zamiana 12.11 — wg zegara testu (VCLOCK), nie daty uruchomienia
        ok(labels == ['Dziś', 'Dieta', 'Trening', study, 'Więcej'], f'{tag} Pasek dolny: 4 sekcje + Więcej ({labels})')
        ok(await pg.locator('.tabs a svg[aria-hidden=true]').count() == 5, f'{tag} Pasek dolny: ikony dekoracyjne z etykietą tekstową')
        await pg.goto(url + '#/wiecej'); await pg.wait_for_selector('.more-list')
        ok(await pg.locator('.more-list a').count() == 9, f'{tag} Więcej: 9 pozostałych modułów w grupach (z Kalendarzem D-097)')
        dcs = await pg.eval_on_selector_all('.more-list a', 'e => e.map(a => a.style.getPropertyValue("--dc"))')
        ok(all(dcs) and await pg.eval_on_selector('.more-ic', 'e => getComputedStyle(e).color') != await pg.eval_on_selector('.more-n', 'e => getComputedStyle(e).color'),
           f'{tag} Więcej: ikony w kolorze domeny modułu (zmienna --dc ustawiona)')
        await pg.get_by_role('button', name='Motyw: Jasny').click(); await pg.wait_for_timeout(200)
        await pg.reload(); await pg.wait_for_selector('.more-list')
        ok(await pg.evaluate("document.documentElement.getAttribute('data-theme')") == 'light', f'{tag} Motyw: wybór jasnego zapamiętany po przeładowaniu')
        await pg.get_by_role('button', name='Motyw: Systemowy').click()
        # D-110: wygląd zmienia się w przejściu (odsłonięcie od przycisku) — czekamy na zastosowanie, nie stały czas
        try: await wait_js(pg, "() => !document.documentElement.hasAttribute('data-theme')", timeout=3000)
        except TimeoutError: pass
        ok(await pg.evaluate("document.documentElement.hasAttribute('data-theme')") is False, f'{tag} Motyw: systemowy (bez wymuszenia)')
        await pg.get_by_role('button', name='Motyw: Ciemny').click(); await pg.wait_for_timeout(200)
    else:
        groups = await pg.eval_on_selector_all('.side .side-gl', 'e => e.map(x => x.textContent.trim())')
        ok(groups == ['Dzień', 'Trening', 'Dieta', 'Nauka', 'System'], f'{tag} Panel: grupy {groups}')
        ok(await pg.locator('.side .side-groups .side-a').count() == 13 and await pg.locator('.side .side-set').count() == 1, f'{tag} Panel: 13 modułów (z Kalendarzem D-097) + Ustawienia (D-113)')
        await pg.get_by_role('button', name='Zwiń panel').click(); await pg.wait_for_timeout(200)
        await pg.reload(); await pg.wait_for_selector('.side')
        ok(await pg.locator('.side.is-min').count() == 1, f'{tag} Panel: zwinięcie zapamiętane')
        await pg.get_by_role('button', name='Rozwiń panel').click(); await pg.wait_for_timeout(200)
    await pg.goto(url + f'#/dzis?d={TEST_NOW.date().isoformat()}'); await pg.wait_for_selector('.dz-kpis')
    kp = await pg.inner_text('.dz-kpis')
    ok(bool(kp.strip()) and await pg.locator("main").count() == 1, "Plan view renders content")
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
    ok('kcal' in stats and 'CFA' in stats, f'{tag} Dziś: podsumowanie dnia (dieta, trening, CFA, sauna)')
    ok(await pg.locator('.nowcard').count() == 1, f'{tag} Dziś: karta „teraz” dla dzisiejszego dnia')
    qy = await pg.locator('.quicklinks').bounding_box(); dy = await pg.locator('.dz-plan-h').bounding_box()
    ok(qy['y'] < dy['y'], f'{tag} Dziś: skróty do jadłospisu i suplementacji nad planem dnia')
    other_day = '2027-04-05'   # po planie MPW — sam plan CFA (D-116)
    await pg.goto(url + f'#/dzis?d={other_day}'); await pg.wait_for_selector('.stats')
    ok(await pg.locator('.nowcard').count() == 0, f'{tag} Dziś: brak karty „teraz” dla innego dnia')
    ok(f"0 / {sum(b['data'] == other_day for b in CFA_D['bloki'])} bloków" in await pg.inner_text('.stats'),
       f'{tag} Dziś: liczba bloków zgodna z planem CFA dla innego dnia')
    both = '2026-11-24'
    await pg.goto(url + f'#/dzis?d={both}'); await pg.wait_for_selector('.stats')
    st = ' '.join((await pg.inner_text('.stats')).split())
    ok('0 / 6 bloków' in st and 'CFA 0/3 · MPW 0/3' in st, f'{tag} Dziś: kafelek „Nauka” — CFA i MPW razem w okresie obu planów (D-116): {st[-80:]}')
    await pg.goto(url + '#/dieta?f=0&w=T'); await pg.wait_for_selector('.meal')
    ok('2595' in await pg.inner_text('.hero'), f'{tag} Dieta: suma kcal 2595 (F0, T; skyr 75 g, D-104)')
    dt = await pg.inner_text('main')
    ok('suma z PDF' not in dt and 'Udziały procentowe pochodzą' not in dt and 'Źródło:' not in dt, f'{tag} Dieta: bez usuniętych objaśnień i znacznika źródła')
    await pg.get_by_role('button', name='Faza 1').click(); await pg.wait_for_selector('text=2750')
    txt = await pg.inner_text('main')
    ok('2750' in txt and '85 g' in txt, f'{tag} Dieta: zmiana fazy przelicza jadłospis (F1 = 2750 kcal, owies 85 g)')
    await pg.get_by_role('button', name='Dzień nietreningowy').click(); await pg.wait_for_selector('text=2453')
    txt = await pg.inner_text('main')
    ok('Posiłek po saunie' in txt, f'{tag} Dieta: wariant NT ma „Posiłek po saunie” (D-018)')
    ok('Przyprawy' in txt and 'Zamienniki' in txt, f'{tag} Dieta: przyprawy i zamienniki')
    await pg.goto(url + '#/suplementy?d=2026-11-30'); await pg.wait_for_selector('.dose-list')
    txt = await pg.inner_text('main')
    ok('Tauryna' in txt and 'od 24.11.2026 do 30.04.2027' in txt and '31.12.2027' not in txt,
       f'{tag} Suplementacja: tauryna i okres preparatów czasowych (D-121)')
    ok('Stan i prognoza pochodz' not in txt and 'Potem nie są kontynuowane' not in txt, f'{tag} Suplementacja: bez usuniętych podpisów')
    # najbliższy wtorek (test niezależny od dnia uruchomienia)
    tue = '2026-12-01'
    await pg.goto(url + f'#/suplementy?d={tue}'); await pg.wait_for_selector('.dose-list')
    ok('Cynk' not in (await pg.inner_text('main')).split('Preparaty')[0], f'{tag} Suplementacja: we wtorek bez cynku')
    await pg.goto(url + '#/suplementy?d=2026-11-26'); await pg.wait_for_selector('.dose-list')
    ok('Cynk' in (await pg.inner_text('main')).split('Preparaty')[0], f'{tag} Suplementacja: czwartek z cynkiem')
    await pg.goto(url + '#/suplementy?d=2026-11-22'); await pg.wait_for_selector('.sp-outside')
    ok(await pg.locator('.dose-list').count() == 0 and '0 dawek' in await pg.inner_text('.topline'), f'{tag} Suplementacja: 22.11 poza planem — bez dawek (D-121)')
    await pg.goto(url + '#/suplementy?d=2026-11-23'); await pg.wait_for_selector('.sp-outside')
    ok(await pg.locator('.dose-list').count() == 0 and 'Dzień zero' in await pg.inner_text('.sp-outside'), f'{tag} Suplementacja: Dzień zero 23.11 — bez dawek (D-121)')
    # --- Etap 5: Trening
    await pg.goto(url + '#/trening?d=2026-11-30'); await pg.wait_for_selector('.ex')   # UPPER 1 w poniedziałek 30.11 (Faza 0, D-121)
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
    await pg.goto(url + '#/trening?d=2026-11-30'); await pg.wait_for_selector('.ex')   # UPPER 1 w poniedziałek 30.11 (Faza 0, D-121)
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
    await pg.goto(url + '#/trening?d=2026-12-12'); await pg.wait_for_selector('h1')
    ok('Dzień bez treningu' in await pg.inner_text('main'), f'{tag} Trening: dzień nietreningowy 12.12 (D-121)')
    await pg.goto(url + '#/trening?d=2026-11-23'); await pg.wait_for_selector('h1')
    ok(await pg.locator('.ex').count() == 0 and 'Dzień zero' in await pg.inner_text('main'), f'{tag} Trening: Dzień zero 23.11 — bez treningu (D-121)')
    await pg.goto(url + '#/trening?d=2026-11-22'); await pg.wait_for_selector('h1')
    ok(await pg.locator('.ex').count() == 0 and 'Poza planem' in await pg.inner_text('main'), f'{tag} Trening: 22.11 poza planem (D-121)')
    await pg.goto(url + '#/trening?d=2026-09-21'); await pg.wait_for_selector('h1')
    tm = await pg.inner_text('main')
    ok('Poza planem' in tm and await pg.locator('.ex').count() == 0 and await pg.locator('.tm').count() == 0,
       f'{tag} Trening: 21.09 poza planem — bez ćwiczeń i licznika (D-088)')
    await pg.goto(url + '#/trening?d=2026-12-07'); await pg.wait_for_selector('.ex')
    ok(await pg.locator('.set:not(.set-h)').count() == 18, f'{tag} Trening: UPPER 1 w Fazie 1 — 18 serii (Faza 1 od 07.12, D-121)')
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
    await pg.goto(url + '#/cfa?v=dzien&d=2026-11-23'); await pg.wait_for_selector('.cfa-row')
    ok(await pg.locator('.cfa-row:not(.cf-recall)').count() == 3, f'{tag} CFA: pierwszy dzień planu 2027 — 3 bloki (E–G)')
    ok(await pg.locator('a:has-text("Poprzedni dzień")').count() == 0, f'{tag} CFA: 23.11 (Dzień zero) to pierwszy dzień CFA (D-121)')
    ok('Vol 1 · Quantitative Methods · s. ' in await pg.inner_text('main') and await pg.locator('.cfa-src[title^="CFA Level I 2027 Vol 1"]').count() == 3,
       f'{tag} CFA: źródło bloku (D-119: tom, dział i strony; pełna nazwa pliku w podpowiedzi)')
    await pg.locator('.cfa-row .set-toggle').first.click(); await pg.wait_for_timeout(400)
    await pg.reload(); await pg.wait_for_selector('.cfa-row')
    ok(await pg.locator('.cfa-row .set-toggle').first.get_attribute('aria-pressed') == 'true' and '1 / 451' in await pg.inner_text('.hero-cfa'),
       f'{tag} CFA: postęp zapisany trwale')
    c = await pg.locator('.cfa-row .set-toggle').first.evaluate(CONTRAST)
    ok(c >= 4.5, f'{tag} CFA: kontrast odhaczonego bloku ≥ 4,5:1 ({c:.2f})')
    await pg.goto(url + '#/cfa?v=harmonogram&kat=Curriculum'); await pg.wait_for_selector('.filters')
    ok('311 bloków' in await pg.inner_text('.filters'), f'{tag} CFA: filtr kategorii (Curriculum = 311 bloków, D-116)')
    ok(await pg.locator('.cfa-row.is-next').count() == 0, f'{tag} CFA: harmonogram bez fałszywego wyróżnienia „następny blok”')
    await pg.goto(url + '#/cfa?v=harmonogram&tryb=SYMULACJA'); await pg.wait_for_selector('.filters')
    ok('18 bloków' in await pg.inner_text('.filters') and await pg.locator('.cfa-row .mode.m-mo').count() == 18
       and 'PIERWSZE PODEJŚCIE' in await pg.inner_text('.filters select >> nth=1'), f'{tag} CFA: filtr trybu (SYMULACJA = 18 bloków; tryb PIERWSZE PODEJŚCIE w filtrze, D-116)')
    await pg.goto(url + '#/cfa?v=harmonogram&tryb=ANALIZA'); await pg.wait_for_selector('.filters')
    ok('12 bloków' in await pg.inner_text('.filters') and await pg.locator('.cfa-row .mode.m-an').count() == 12,
       f'{tag} CFA: filtr ANALIZA (12 bloków analizy mocków, D-116)')
    await pg.goto(url + '#/cfa?v=kalendarz'); await pg.wait_for_selector('.cal')
    ok(await pg.locator('.cal-d.c-mock').count() == 4 and await pg.locator('.cal-d.c-exam').count() == 1, f'{tag} CFA: kalendarz z 4 dniami mocków i egzaminem 13.05 (D-117)')
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
    ok('451 (151 dni' in kv and '398,38 h' in kv and 'recall' not in kv.lower() and '13 maja 2027' in kv,
       f'{tag} CFA: statystyki planu 2027 (451 bloków, 151 dni, bez recall, egzamin 13.05.2027 — D-117)')
    await pg.goto(url + '#/dieta'); await pg.wait_for_selector('.meal')
    ok('od 24.11' in await pg.inner_text('main') and 'od 07.12' in await pg.inner_text('main')
       and 'od 11.01' in await pg.inner_text('main'), f'{tag} Dieta: fazy według D-121')
    await pg.goto(url + '#/rekompozycja'); await pg.wait_for_selector('.rk-sec')
    ok('24 listopada 2026' in await pg.eval_on_selector('main .eyebrow', 'e => e.textContent'), f'{tag} Rekompozycja: realny początek planu 24.11.2026 (D-121)')
    for d in ('2026-11-22', '2026-11-20', '2028-01-01'):
        await pg.goto(url + f'#/trening?d={d}'); await pg.wait_for_selector('h1')
        ok(await pg.locator('.ex').count() == 0 and 'Poza planem' in await pg.inner_text('main'), f'{tag} Trening: {d} poza planem (D-121)')
    await pg.goto(url + '#/suplementy?d=2026-11-20'); await pg.wait_for_selector('h1')
    ok(await pg.locator('.dose-list').count() == 0, f'{tag} Suplementacja: dni przed startem planu bez dawek (D-121)')
    await pg.goto(url + '#/kalendarz?m=2026-11'); await pg.wait_for_selector('.kl-day')
    ok(await pg.locator('.kl-day').count() == 30 and await pg.locator('.kl-day.is-today').count() == (1 if TODAY().strftime('%Y-%m') == '2026-11' else 0), f'{tag} Kalendarz: listopad — 30 dni')
    ok(await pg.locator('.kl-day.is-out').count() == 22, f'{tag} Kalendarz: 01–22.11 przed startem planu (D-121)')
    # F-K1 (D-113): klik dnia — podgląd pod siatką (bez przechodzenia); „Otwórz w Dziś” — pełny plan dnia
    await pg.locator('a.kl-day[href="#/kalendarz?m=2026-11&d=2026-11-23"]').click()
    # podgląd dnia dzisiejszego może być widoczny już przed kliknięciem — czekamy na podgląd WYBRANEGO dnia
    try: await wait_js(pg, "() => (document.querySelector('.kl-preview')?.textContent || '').includes('23 listopada 2026')", timeout=8000)
    except TimeoutError: pass
    pv = await pg.inner_text('.kl-preview')
    ok('23 listopada 2026' in pv and await pg.locator('.kl-p-slots li').count() > 0 and await pg.locator('a.kl-day.is-sel').count() == 1, f'{tag} Kalendarz: podgląd wybranego dnia pod siatką')
    await pg.locator('.kl-open').click(); await pg.wait_for_selector('.dz-plan-h')
    ok(await pg.evaluate('location.hash') == '#/dzis?d=2026-11-23', f'{tag} Kalendarz: klik dnia otwiera plan od startu (D-121)')
    if mobile:
        await pg.goto(url + '#/dane'); await pg.wait_for_selector('h1')
        small = await pg.evaluate('''[...document.querySelectorAll('button, .tabs a')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(r => r.height < 43.5 || r.width < 43.5).length''')
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
    for lab in ['Dodaj', 'Zakupy', 'Paragon', 'Cofnij', 'Historia', 'Raport', 'Kopia']:
        ok(await pg.locator('.actions').get_by_text(lab, exact=False).count() > 0, f'{tag} Zapasy: przycisk {lab}')
    ok(await pg.locator('.pills .pill-b').count() == 9, f'{tag} Zapasy: 9 kategorii')
    ok(await pg.locator('.counters .counter').count() == 4 and await pg.locator('.counters .c-shop').count() == 1, f'{tag} Zapasy: liczniki statusów + „Do zakupów” (U-c)')
    tags = await pg.inner_text('.inv')
    ok('ŚWIEŻE (≤7D)' in tags and 'TRWAŁE (>7D)' in tags and 'SUPLEMENT' in tags, f'{tag} Zapasy: klasyfikacja wg terminu przydatności')
    ok(any(b in tags for b in ['Pilne · < 2 dni', 'Niski · 2–4 dni', 'OK · ≥ 4 dni', 'Brak']), f'{tag} Zapasy: statusy świeżych wg progów 2/4 dni')
    # D-113: plakietki stanu bez emoji (ikona + słowo); format v31 zostaje w podpowiedzi (title) i w raporcie tekstowym
    ok(not any(e in tags for e in ['🚨', '⛔', '🟢']) and await pg.locator('.inv-item .sb[title]').count() == await pg.locator('.inv-item').count(),
       f'{tag} Zapasy: plakietki stanu bez emoji, format v31 w podpowiedzi')
    ok('Wystarczy do:' in tags and ('✓ Wystarczy do zakupów' in tags or 'przed zakupami' in tags), f'{tag} Zapasy: prognoza w formacie v31')
    await pg.get_by_role('button', name='Zakupy', exact=True).click(); await pg.wait_for_selector('dialog.sheet')
    ok(await pg.locator('dialog .shop-list li').count() > 0, f'{tag} Zapasy: okno planu zakupów z listą')
    await pg.locator('dialog .shop-list input[type=checkbox]').first.check()
    # D-113: odhaczenie zapisywane w dzienniku (`setting`) — licznik po zapisie, nie natychmiast
    try: await wait_js(pg, "() => document.querySelector('dialog .prog').textContent.includes('1 / ')", timeout=5000)
    except TimeoutError: pass
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
    # K1 (D-113): stan nie spada poniżej 0 — korekta dnia sprawdzana przy stanie dodatnim (po zakupie opakowania)
    await pg.locator('.inv-item').first.get_by_role('button', name='+ opakowanie', exact=False).click()
    await wait_js(pg, 'v => document.querySelector(".inv-item input[type=number]").value !== v', before, timeout=8000)
    before = await pg.locator('.inv-item').first.locator('input[type=number]').input_value()
    ok(float(before) > 0, f'{tag} Zapasy: stan dodatni przed korektą dnia ({before})')
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
        ok(f'dla planu od {PLAN_START.isoformat()} (bieżący)' in txt, f'{tag} podgląd importu: pakiet dla bieżącego planu (D-091)')
        await pg.goto(url + '#/dzis'); await pg.goto(url + '#/dane'); await pg.wait_for_selector('.dn-diag')
        ok(f'Pakiet prywatny aktualny (plan od {PLAN_START.isoformat()})' in await pg.inner_text('.dn-diag'), f'{tag} Diagnostyka: pakiet prywatny aktualny (D-091)')
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

# --- Funkcje zależne od bieżącej godziny — kalendarz D-103c; sprawdzenia CFA na zegarze w okresie planu CFA 2027 (od 20.11, D-116).
CLOCK = TEST_NOW
CFA_AM = _dt.datetime(2026, 11, 24, 10, 0, tzinfo=_dt.timezone(_dt.timedelta(hours=1)))    # wtorek: CFA E–G i MPW A–C
CFA_PM = _dt.datetime(2026, 11, 26, 20, 0, tzinfo=_dt.timezone(_dt.timedelta(hours=1)))    # czwartek wieczorem: bloki dnia minione
CFA_D = json.loads((ROOT / 'src/data/cfa.json').read_text(encoding='utf8'))['D']
def _moved(b, plan='cfa'):
    """D-120, D-121: blok z datą i godziną wg decyzji (`week.studyMoves` — jak w src/core/data.js)."""
    mv = WEEK.get('studyMoves', {}).get(plan, {}).get(str(b['nr']))
    if not mv: return b
    d, t_ = mv.split(' '); a_, z_ = b['godz'].split('–'); n_ = (int(z_[:2]) * 60 + int(z_[3:])) - (int(a_[:2]) * 60 + int(a_[3:])); e_ = int(t_[:2]) * 60 + int(t_[3:]) + n_
    return {**b, 'data': d, 'godz': f"{t_}–{e_ // 60:02d}:{e_ % 60:02d}"}
CFA_D = {**CFA_D, 'bloki': [_moved(b) for b in CFA_D['bloki']]}   # daty bloków jak w aplikacji (D-121: od 23.11)
def rest_left(t):  # '1:58' / '+0:13' -> sekundy do końca przerwy (ujemne po czasie)
    m, s_ = t.lstrip('+').split(':'); v = int(m) * 60 + int(s_); return -v if t.startswith('+') else v

async def run_features(pw, name, url, mobile):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [zegar 30.11 10:00]'
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
    await pg.goto(url + '#/trening?d=2026-12-01'); await pg.wait_for_selector('.ex')
    await pg.locator('.set:not(.set-h) .set-toggle').first.click(); await pg.wait_for_timeout(500)
    ok(await pg.locator('.tr-rest').count() == 0, f'{tag} Trening: brak licznika przerwy dla innego dnia niż dziś')
    # CFA: tempo względem planu, zaległe bloki, następny blok, nawigacja dni, filtr error logu
    await pg.clock.set_system_time(CFA_AM)
    next_day = CFA_AM.date().isoformat()
    due = [b for b in CFA_D['bloki'] if b['data'] < next_day]
    blk = lambda n: f"{n} {'bloki' if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14) else 'bloków'}"   # odmiana jak w aplikacji
    await pg.goto(url + '#/cfa'); await pg.wait_for_selector('.cfa-row')
    hero = await pg.inner_text('.hero-cfa')
    ok(f'Zaległe: {blk(len(due))}' in hero and f'Plan do wczoraj: 0 / {len(due)}' in hero, f'{tag} CFA: tempo i zaległe z planu ({len(due)})')
    ok(await pg.locator('.cf-backlog .cfa-row').count() == min(3, len(due)) and 'Następny: blok E' in await pg.inner_text('.cfa-dayhead'), f'{tag} CFA: panel zaległych (D-119: 3 najstarsze, reszta w „Plan nadrabiania”) i następny blok dnia')
    await pg.locator('.cf-backlog .set-toggle').first.click(); await pg.wait_for_timeout(500)
    ok(f'Zaległe: {blk(len(due) - 1)}' in await pg.inner_text('.hero-cfa') and f'Plan do wczoraj: 1 / {len(due)}' in await pg.inner_text('.hero-cfa'),
       f'{tag} CFA: odhaczenie zaległego bloku zmniejsza zaległości')
    await pg.get_by_role('link', name='Następny dzień').click(); await pg.wait_for_timeout(400)
    follow_day = (CFA_AM.date() + _dt.timedelta(days=1)).isoformat()
    ok(f'd={follow_day}' in await pg.evaluate('location.hash') and await pg.locator('.cf-backlog').count() == 0, f'{tag} CFA: nawigacja dni (panel zaległych tylko dla dnia bieżącego)')
    await pg.goto(url + '#/cfa?v=harmonogram&zal=1'); await pg.wait_for_selector('.filters')
    ok(blk(len(due) - 1) in await pg.inner_text('.filters') and await pg.locator('.cfa-row').count() == len(due) - 1, f'{tag} CFA: filtr „tylko zaległe” w harmonogramie')
    await pg.clock.set_system_time(CLOCK)
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
    if mobile:   # cele dotykowe w rozbudowanych modułach (tolerancja 0,5 px: w trakcie wejścia ekranu — transform — wymiar 43,9999 px, D-110)
        for r in ('#/trening', '#/cfa?v=dzien', '#/cfa?v=log', '#/dieta', '#/zapasy', '#/mealprep', '#/suplementy', '#/bezpieczenstwo', '#/rekompozycja', '#/dane'):
            await pg.goto(url + r); await pg.wait_for_timeout(300)
            small = await pg.evaluate('''[...document.querySelectorAll('main button, main a.btn, main a.chip, main summary, .dt-nav-a, .tabs a')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(r => r.height < 43.5 || r.width < 43.5).length''')
            ok(small == 0, f'{tag} {r}: elementy dotykowe ≥ 44 px (za małych: {small})')
    ok(not errs, f'{tag} brak błędów konsoli ({errs[:2]})')
    await b.close()

# --- Zegar niedzielny dla regresji tygodnia; osobny wieczór przed Fazą 1 do testu Meal Prep.
CLOCK_B = _dt.datetime(2026, 12, 6, 20, 0, tzinfo=_dt.timezone(_dt.timedelta(hours=1)))
CLOCK_PHASE_EVE = _dt.datetime(2026, 12, 6, 20, 0, tzinfo=_dt.timezone(_dt.timedelta(hours=1)))   # D-121: wieczór przed Fazą 1 (07.12)
async def run_audit_fixes(pw, name, url, mobile):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [Etap 1, wieczór przed Fazą 1]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.clock.install(time=CLOCK_PHASE_EVE)
    # B1: Meal Prep — karty wieczorne liczone z planu na jutro, nawigacja dni, odhaczenia pod datą strony
    await pg.goto(url + '#/mealprep'); await pg.wait_for_selector('.prep-card')
    k2 = await pg.inner_text('#mp-k2')
    ok(bool(k2.strip()) and await pg.locator("main").count() == 1, f"{tag} Meal Prep view renders content")
    ids = await pg.eval_on_selector_all('.prep-phase', 'e => e.map(x => x.id)')
    ok(ids[:4] == ['mp-ph-1', 'mp-ph-2', 'mp-ph-3', 'mp-ph-0'], f'{tag} Meal Prep: fazy w kolejności dnia, karty wieczorne po „Wieczorze” ({ids})')
    await pg.get_by_role('link', name='Następny dzień').click(); await pg.wait_for_timeout(500)
    ok('d=2026-12-07' in await pg.evaluate('location.hash') and '7 grudnia 2026 · Faza 1' in await pg.text_content('.hero-tr-main .eyebrow'), f'{tag} Meal Prep: następny dzień (07.12, Faza 1 — D-121)')
    await pg.locator('#mp-k3 input[type=checkbox]').first.check(); await pg.wait_for_timeout(400)
    await pg.reload(); await pg.wait_for_selector('.prep-card')
    ok(await pg.locator('#mp-k3 input[type=checkbox]').first.is_checked(), f'{tag} Meal Prep: odhaczenie zapisane pod datą 07.12')
    await pg.goto(url + '#/mealprep'); await pg.wait_for_selector('.prep-card')
    ok(not await pg.locator('#mp-k3 input[type=checkbox]').first.is_checked(), f'{tag} Meal Prep: 06.12 bez odhaczeń z 07.12')
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
    # D-113 (F-G5): komunikat po zapisie pozycji ma „Cofnij” — zostaje 10 s (bez akcji 6 s)
    ok(await pg.locator('#toast .toast-act').count() == 1, f'{tag} komunikat z „Cofnij” po zapisie pozycji')
    await pg.clock.fast_forward(7000); await pg.wait_for_timeout(300)
    ok(await pg.locator('#toast .banner').count() == 1, f'{tag} komunikat z akcją widoczny po 7 s')
    await pg.clock.fast_forward(4000); await pg.wait_for_timeout(300)
    ok(await pg.locator('#toast .banner').count() == 0, f'{tag} komunikat znika po 10 s')
    await pg.goto(url + '#/trening?d=2026-11-30'); await pg.wait_for_selector('.ex')
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
        for r in ROUTES + ['#/trening?d=2026-11-23', '#/mealprep?d=2026-11-23']:
            await pg.goto(url + r); await pg.wait_for_timeout(250)
            sw = await pg.evaluate('document.documentElement.scrollWidth')
            if sw > 320: wide.append((r, sw))
        ok(not wide, f'{name} 320px: brak przewijania w poziomie ({wide})')
        await b.close()

# --- Etap 2: dostępność i moduły na niedzieli 06.12.2026 (D-121; dawniej 25.10)
async def run_etap2(pw, name, url, mobile):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [Etap 2, zegar 06.12 20:00]'
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
    ok(n_all == 32, f'{tag} U-a: wszystkie 32 punkty niedzieli w DOM ({n_all}; wariant „basen”, D-094)')
    # U-f: strzałki kart ≥ 44 px
    sz = await pg.eval_on_selector('.dz-more', 'e => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]')
    ok(sz[0] >= 44 and sz[1] >= 44, f'{tag} U-f: .dz-more {sz}')
    # U-e: najmniejszy tekst 12 px
    fs = await pg.evaluate("parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs-2xs')) * 16")
    ok(fs >= 12, f'{tag} U-e: --fs-2xs = {fs} px')
    # U-b: harmonogram od dziś, minione dni zwinięte (budowane po rozwinięciu) — zegar w okresie planu CFA 2027
    await pg.clock.set_system_time(CFA_PM)
    await pg.goto(url + '#/cfa?v=harmonogram'); await pg.wait_for_selector('.filters')
    first = await pg.locator('main > section.panel .cfa-dh a').first.inner_text()
    ok(await pg.locator('details.cf-past:not([open])').count() == 1 and await pg.locator('details.cf-past .cfa-row').count() == 0 and '26.11' in first,
       f'{tag} U-b: harmonogram od dziś ({first}), minione zwinięte')
    await pg.locator('details.cf-past > summary').click(); await pg.wait_for_timeout(300)
    past_n = sum(b['data'] < CFA_PM.date().isoformat() for b in CFA_D['bloki'])
    ok(await pg.locator('details.cf-past .cfa-row').count() == past_n, f'{tag} U-b: minione bloki po rozwinięciu ({past_n})')
    await pg.clock.set_system_time(CLOCK_B)
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

# --- Etap 3: zaległości CFA, tydzień, wyszukiwanie i eksport .ics na 06.12.2026 (D-121)
async def run_etap3(pw, name, url, mobile):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [Etap 3, zegar 06.12 20:00]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw', accept_downloads=True)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.clock.install(time=CLOCK_B)
    # I2: „Wymaga uwagi” — zaległe bloki CFA zgodne z modułem CFA (zegar w okresie planu CFA 2027, D-116)
    await pg.clock.set_system_time(CFA_PM)
    due = [x for x in CFA_D['bloki'] if x['data'] < CFA_PM.date().isoformat()]
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-attn')
    at = await pg.inner_text('.dz-attn')
    ok(f'Zaległe bloki CFA: {len(due)}' in at and await pg.locator('.dz-attn a[href="#/cfa?v=harmonogram&zal=1"]').count() == 1, f'{tag} I2: „Wymaga uwagi” — zaległe bloki ({len(due)})')
    ok(await pg.locator('.dz-attn').count() == 1, f'{tag} I2: karta tylko dla dnia bieżącego')
    await pg.clock.set_system_time(CLOCK_B); await pg.goto(url + '#/dane'); await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
    # I3: Tydzień — 7 dni, czwartek z zakupami (D-097), przejście do dnia
    await pg.get_by_role('link', name='Tydzień').first.click(); await pg.wait_for_selector('.wk-grid')
    days = await pg.eval_on_selector_all('.wk-day', 'e => e.map(x => x.textContent)')
    ok(len(days) == 7 and 'Zakupy 19:05' in days[3] and 'Zakupy' not in days[5]
       and 'UPPER 1' in days[0] and 'dziś' in days[6], f'{tag} I3: tydzień 30.11–06.12 z resolvera (D-097)')
    await pg.locator('.wk-day').nth(2).click(); await pg.wait_for_selector('.dz-plan-h')
    ok('d=2026-12-02' in await pg.evaluate('location.hash'), f'{tag} I3: dzień z tygodnia otwiera plan dnia')
    await pg.goto(url + '#/dzis?v=tydzien&d=2026-11-18'); await pg.wait_for_selector('.wk-grid')
    ok(await pg.locator('.wk-day.is-out').count() == 7, f'{tag} I3: tydzień przed startem planu wykreślony z kalendarza (D-121)')
    # I11: plan CFA 2027 bez sesji recall 22:00 (D-116) — brak wiersza recall i statystyki recall
    await pg.goto(url + '#/cfa?v=dzien&d=2027-01-04'); await pg.wait_for_selector('.cfa-dayhead')
    ok(await pg.locator('.cf-recall').count() == 0 and 'Recall' not in await pg.inner_text('.hero-cfa'), f'{tag} I11: plan 2027 bez recall 22:00 (dzień z blokiem J)')
    await pg.goto(url + '#/cfa?v=plan'); await pg.wait_for_selector('.kv')
    ok('sesji' not in await pg.inner_text('.kv'), f'{tag} I11: bez statystyki recall wieczornego')
    # I4 / I5: wyszukiwanie (Ctrl+K, „/”), skróty
    if not mobile:
        await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
        await pg.keyboard.press('Control+k'); await pg.wait_for_selector('dialog.gs-dialog')
        await pg.keyboard.type('returns of financial assets'); await pg.wait_for_timeout(300)
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
        await pg.goto(url + '#/dzis?d=2026-11-30'); await pg.wait_for_selector('.dz-plan-h')
        await pg.locator('body').click(position={'x': 5, 'y': 5}); await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(400)
        ok('d=2026-12-01' in await pg.evaluate('location.hash'), f'{tag} I5: → następny dzień')
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
    expected_ics = f'2027-plan-{CLOCK_B.date().isoformat()}.ics'
    ok(d.suggested_filename == expected_ics and ics.startswith('BEGIN:VCALENDAR') and ics.count('BEGIN:VEVENT') == ics.count('BEGIN:VALARM') > 50
       and 'TZID:Europe/Warsaw' in ics, f'{tag} I1: plik .ics ({ics.count("BEGIN:VEVENT")} wydarzeń z alarmami)')
    ok('wydarzeniami' in await pg.inner_text('.dn-ics'), f'{tag} I1: komunikat po eksporcie')
    ok(not errs, f'{tag} brak błędów konsoli ({errs[:2]})')
    await b.close()

# P2 (D-092): punktowe odświeżanie po najczęstszych akcjach — wynik identyczny z pełnym przerysowaniem tego samego widoku
# (tekst, stany przycisków, klasy i kolejność kart, wartości pól), fokus zostaje na przycisku, widok nie jest budowany od nowa.
SNAP = '''() => { const m = document.querySelector('main');
  return { text: m.innerText.replace(/\\s+/g, ' ').trim(),
    pressed: [...m.querySelectorAll('[aria-pressed]')].map(b => `${b.getAttribute('aria-pressed')}|${b.getAttribute('aria-label') || b.textContent}`),
    cards: [...m.querySelectorAll('.cfa-row, .inv-item, .ex, .set, .cfa-dh, .dash, .zp-shop, .counters')].map(e => `${e.className}#${e.id}`),
    values: [...m.querySelectorAll('input')].map(i => i.type === 'checkbox' ? String(i.checked) : i.value) }; }'''
def p2_events():
    """Syntetyczne (fikcyjne) stany zapasów: dzienne zużycie z katalogu × umowna liczba dni (jak fixtures.synthetic_zapasy)."""
    items = [i for i in fixtures._catalog() if i.get('tracked') is not False]
    ev = []
    for n, it in enumerate(items):
        qty = round((it.get('daily_v31') or 1) * fixtures.CYCLE[n % len(fixtures.CYCLE)], 2)
        ev.append({'id': f'inv.count:p2-{n}', 'hlc': f'{1790000000000 + n:013d}:0000:dp2test', 'dev': 'dp2test', 't': 'inv.count',
                   'd': {'prod': it['id'], 'qty': qty, 'date': '2026-10-10'}, 'at': '2026-10-10T20:00:00Z', 'v': 1})
    return ev
SEED_IDB = '''async evs => { const db = await new Promise((res, rej) => { const r = indexedDB.open('p2027', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = db.transaction('events', 'readwrite'); for (const e of evs) tx.objectStore('events').put(e);
  await new Promise(r => { tx.oncomplete = r; }); db.close(); return evs.length; }'''
MAIN_TEXT = '() => document.querySelector("main").innerText.replace(/\\s+/g, " ").trim()'

async def run_p2(pw, name, url, mobile):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [P2, zegar 06.12 20:00]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.clock.install(time=CLOCK_B)
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
    await pg.evaluate(SEED_IDB, p2_events()); await pg.reload(); await pg.wait_for_selector('.dz-plan-h')

    async def open_route(route, ready):
        await pg.goto(url + '#/wiecej'); await pg.wait_for_selector('.more-list')
        await pg.goto(url + route); await pg.wait_for_selector(ready, state='attached'); await pg.wait_for_timeout(150)

    async def check(route, act, label, ready='main h1', focus='.set-toggle'):
        await open_route(route, ready)
        await pg.evaluate("document.querySelector('main').dataset.p2 = '1'")
        before = await pg.evaluate(MAIN_TEXT)
        await act()
        end = time.monotonic() + 10
        while await pg.evaluate(MAIN_TEXT) == before and time.monotonic() < end: await asyncio.sleep(0.05)
        await pg.wait_for_timeout(250)
        point = await pg.evaluate(SNAP)
        kept = await pg.evaluate("!!document.querySelector('main[data-p2]')")
        foc = await pg.evaluate("s => !!document.activeElement?.matches(s) && document.querySelector('main').contains(document.activeElement)", focus) if focus else True
        await open_route(route, ready)
        full = await pg.evaluate(SNAP)
        diff = [k for k in full if full[k] != point[k]]
        for k in diff[:1]:
            a, c = point[k], full[k]
            i = next((j for j in range(min(len(a), len(c))) if a[j] != c[j]), min(len(a), len(c)))
            print('   różnica', k, repr(a[max(0, i - 2):i + 3] if isinstance(a, list) else a[max(0, i - 60):i + 80]), '<>',
                  repr(c[max(0, i - 2):i + 3] if isinstance(c, list) else c[max(0, i - 60):i + 80]))
        ok(kept and not diff and foc, f'{tag} {label}: punktowo = pełne przerysowanie (widok zachowany: {kept}, różnice: {diff}, fokus: {foc})')

    click = lambda sel: (lambda: pg.locator(sel).first.click())
    # CFA: widok dnia bieżącego (zaległe + dzień), cały dzień, harmonogram (dzień przyszły i miniony) — zegar w okresie planu CFA 2027 (D-116; plan bez recall)
    await pg.clock.set_system_time(CFA_PM)
    await check('#/cfa?v=dzien&d=2026-11-26', click('.cf-backlog .set-toggle'), 'CFA zaległy blok (dziś)', '.cf-backlog')
    await check('#/cfa?v=dzien&d=2026-11-26', click('.cfa-dayhead ~ .cfa-list .set-toggle[aria-pressed="false"]'), 'CFA blok dnia', '.cfa-dayhead')
    await check('#/cfa?v=dzien&d=2026-11-26', click('.cfa-dayhead ~ .cfa-list .set-toggle[aria-pressed="true"]'), 'CFA cofnięcie odhaczenia', '.cfa-dayhead')
    await check('#/cfa?v=dzien&d=2026-11-27', lambda: pg.get_by_role('button', name='Oznacz cały dzień').click(), 'CFA cały dzień', '.cfa-dayhead', focus=None)
    await check('#/cfa?v=harmonogram', click('main > section.panel .set-toggle[aria-pressed="false"]'), 'CFA harmonogram (dzień przyszły)', '.cfa-dh')
    async def past():
        await pg.locator('details.cf-past summary').click(); await pg.wait_for_selector('details.cf-past .set-toggle')
        await pg.locator('details.cf-past .set-toggle[aria-pressed="false"]').first.click()
    await check('#/cfa?v=harmonogram', past, 'CFA harmonogram (dzień miniony)', '.cfa-dh')
    await pg.clock.set_system_time(CLOCK_B)
    # Trening: odhaczenie i cofnięcie serii (dzień inny niż dziś — bez licznika przerwy zależnego od sekund)
    await check('#/trening?d=2026-11-30', click('.ex .sets .set-toggle[aria-pressed="false"]'), 'Trening seria', '.ex')
    await check('#/trening?d=2026-11-30', click('.ex .sets .set-toggle[aria-pressed="true"]'), 'Trening cofnięcie serii', '.ex')
    # Zapasy: + opakowanie (zmiana kolejności), stan pozycji, „Kupione”, filtr statusu (karta znika), sortowanie A–Z
    await check('#/zapasy', click('.inv-item .zp-pack'), 'Zapasy + opakowanie', '.inv-item', focus='.zp-pack')
    async def stan():
        inp = pg.locator('.inv-item .inv-set input').nth(2)
        await inp.fill('7'); await inp.press('Tab')
    await check('#/zapasy', stan, 'Zapasy stan pozycji', '.inv-item', focus=None)
    await check('#/zapasy', click('.zp-buy-b'), 'Zapasy „Kupione”', '.zp-buy-b', focus=None)
    await check('#/zapasy?s=CRITICAL', click('.inv-item .zp-pack'), 'Zapasy filtr „Pilne” + opakowanie', '.inv-item', focus=None)
    await check('#/zapasy?sort=name', click('.inv-item .zp-pack'), 'Zapasy sortowanie A–Z + opakowanie', '.inv-item', focus='.zp-pack')
    ok(not errs, f'{tag} brak błędów konsoli ({errs[:2]})')
    await b.close()

# Pielęgnacja: wyłącznie syntetyczny plan [DANE TESTOWE], data w aktywnym kalendarzu (D-121: od 23.11.2026).
CLOCK_C = _dt.datetime(2026, 11, 30, 7, 5, tzinfo=_dt.timezone(_dt.timedelta(hours=1)))
async def run_care(pw, name, url, mobile):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [Pielęgnacja, zegar 30.11 07:05]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw', accept_downloads=True)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.clock.install(time=CLOCK_C)
    # Bez planu: pusty stan z instrukcją, „Dziś” bez znaczników pielęgnacji
    await pg.goto(url + '#/pielegnacja'); await pg.wait_for_selector('.pg-empty')
    ok('Brak planu pielęgnacji' in await pg.inner_text('.pg-empty') and await pg.locator('.pg-empty a[href="#/dane"]').count() == 1, f'{tag} bez planu: pusty stan z odnośnikiem do importu')
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
    ok(await pg.locator('.slot-care').count() == 0 and 'Pielęgnacja' not in await pg.inner_text('.dz-aside'), f'{tag} bez planu: Dziś bez pielęgnacji')
    # Import planu w Dane (podgląd, nazwa rodzaju pliku, liczba definicji)
    plan = str(fixtures.write(fixtures.synthetic_care_plan(), 'pielegnacja_syntetyczna.json'))
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('text=Stan zapisu')
    await pg.set_input_files('input[type=file]', plan); await pg.wait_for_selector('dialog[open]')
    txt = await pg.inner_text('dialog')
    ok('Plan pielęgnacji' in txt and 'kroki i produkty pielęgnacji' in txt, f'{tag} import: plan pielęgnacji rozpoznany ({txt.count(chr(10))} wierszy podglądu)')
    await pg.click('dialog >> text=Scal dane'); await pg.wait_for_selector('text=Zaimportowano 15 zmian')
    ok(True, f'{tag} import: 15 definicji (5 produktów, 10 kroków)')
    await pg.goto(url + '#/dzis'); await pg.goto(url + '#/dane'); await pg.wait_for_selector('.dn-diag')
    ok('Plan pielęgnacji: 10 kroków, 5 produktów' in await pg.inner_text('.dn-diag') and 'plan pielęgnacji' in await pg.inner_text('.dn-plain'),
       f'{tag} Dane: Diagnostyka i ostrzeżenie o jawnym pliku obejmują plan pielęgnacji')
    # Dzień: lista wg pór, postęp, odhaczenie punktowe (bez przebudowy widoku), trwałość
    await pg.goto(url + '#/pielegnacja'); await pg.wait_for_selector('.pg-pora')
    ok('0 z 6 kroków' in await pg.inner_text('.pg-hero') and await pg.locator('.pg-pora').count() == 3, f'{tag} Dzień: 6 kroków (doraźny poza postępem), 3 pory')
    ok(await pg.locator('.pg-step.is-opt').count() == 1 and 'doraźnie' in await pg.inner_text('.pg-step.is-opt'), f'{tag} Dzień: krok doraźny oznaczony')
    ok('krok PN i PT do 06.12' in await pg.inner_text('main') and 'krok PN od 07.12' not in await pg.inner_text('main'), f'{tag} Dzień: okres kroku (DANE TESTOWE)')
    await pg.evaluate("document.querySelector('main').dataset.p2 = '1'")
    await pg.locator('.pg-check input').first.check(); await pg.wait_for_timeout(500)
    ok('1 z 6 kroków' in await pg.inner_text('.pg-hero') and (await pg.inner_text('#pg-rano .pg-count')).strip() == '1 / 3'
       and await pg.evaluate("!!document.querySelector('main[data-p2]')") and await pg.evaluate("document.activeElement?.type === 'checkbox'"),
       f'{tag} Dzień: odhaczenie punktowe (postęp, licznik pory, fokus na polu)')
    point = await pg.evaluate("document.querySelector('main').innerText")
    await pg.goto(url + '#/wiecej'); await pg.goto(url + '#/pielegnacja'); await pg.wait_for_selector('.pg-pora')
    ok(await pg.evaluate("document.querySelector('main').innerText") == point and await pg.locator('.pg-step.is-done').count() == 1, f'{tag} Dzień: po przerysowaniu to samo (zapis trwały)')
    await pg.locator('.pg-wait').first.click(); await pg.wait_for_selector('.pg-timer')
    ok('Odczekaj' in await pg.inner_text('.pg-timer') and '10:00' in await pg.inner_text('.pg-timer-t'), f'{tag} licznik „odczekaj 10 min”')
    await pg.clock.fast_forward(601000); await pg.wait_for_timeout(1200)
    ok('is-ready' in await pg.get_attribute('.pg-timer', 'class') and 'Czas minął' in await pg.inner_text('.pg-timer .sr-only'), f'{tag} licznik: koniec oznaczony i ogłoszony')
    await pg.get_by_role('button', name='Zamknij licznik').click()
    ok(await pg.locator('.pg-timer').count() == 0, f'{tag} licznik: zamknięcie')
    await pg.clock.set_system_time(CLOCK_C)
    for d, want, not_want in (('2026-12-06', ['krok ŚR i ND', 'krok niedzielny'], ['krok PN i PT']), ('2026-12-07', ['krok PN od 07.12'], ['krok PN i PT', 'krok niedzielny'])):
        await pg.goto(url + f'#/pielegnacja?d={d}'); await pg.wait_for_selector('.pg-pora')
        m = await pg.inner_text('main')
        ok(all(w in m for w in want) and not any(w in m for w in not_want), f'{tag} reguły dni i okresu: {d}')
    # D-121: Dzień zero 23.11 — tylko pielęgnacja wieczorna; dni wcześniejsze poza planem
    await pg.goto(url + '#/pielegnacja?d=2026-11-23'); await pg.wait_for_selector('.pg-pora')
    ok(await pg.locator('#pg-rano .pg-step').count() == 0 and await pg.locator('#pg-dzien .pg-step').count() == 0 and await pg.locator('#pg-wieczor .pg-step').count() > 0,
       f'{tag} Dzień zero 23.11: tylko kroki wieczorne (D-121)')
    await pg.goto(url + '#/pielegnacja?d=2026-11-22'); await pg.wait_for_selector('.pg-outside')
    ok(await pg.locator('.pg-step').count() == 0, f'{tag} 22.11: przed startem planu — bez kroków (D-121)')
    # Tydzień, Produkty (filtr, edycja), Plan (dodanie, usunięcie, eksport)
    await pg.goto(url + '#/pielegnacja?v=tydzien&d=2026-11-30'); await pg.wait_for_selector('.pg-wday')
    days = await pg.eval_on_selector_all('.pg-wday', 'e => e.map(x => x.textContent)')
    sun = await pg.eval_on_selector(".pg-mx-r:has-text('krok niedzielny') .pg-mx-c", "e => [...e.children].map(c => c.classList.contains('is-due') || c.classList.contains('is-done') || c.classList.contains('is-miss'))")
    ok(len(days) == 7 and '1 / 6' in days[0] and sun == [False] * 6 + [True], f'{tag} Tydzień (D-119): 7 dni, postęp, macierz — krok niedzielny tylko w niedzielę')
    await pg.goto(url + '#/pielegnacja?v=fokus&p=rano&d=2026-11-30'); await pg.wait_for_selector('.care-fx .fx-go')
    ok('Krok 2 z 3' in await pg.inner_text('.fx-set-h'), f'{tag} Tryb rutyny (D-119): pierwszy niewykonany krok pory')
    await pg.locator('.care-fx .fx-go').click(); await wait_js(pg, "() => document.querySelector('.care-fx .fx-timer') && document.querySelector('.fx-set-h')?.textContent.includes('Krok 3 z 3')")
    tt = await pg.inner_text('.care-fx .fx-timer')
    ok('trwa' in tt.lower() and 'zatrzymaj' in tt.lower(), f'{tag} Tryb rutyny: „Gotowe” zapisuje krok i uruchamia odliczanie 10 min ({" ".join(tt.split())})')
    v = await axe_audit(pg); ok(not v, f'{tag} Tryb rutyny: dostępność {v[:2]}')
    await pg.locator('.care-fx .fx-timer .fx-tbtn').click()
    await pg.goto(url + '#/pielegnacja?d=2026-11-30'); await pg.wait_for_selector('.pg-pora')
    ok(await pg.locator('.pg-step.is-done').count() == 2, f'{tag} Tryb rutyny: ten sam zapis co lista (2 kroki wykonane)')
    await pg.locator('#pg-rano .pg-step.is-done input').nth(1).uncheck(); await pg.wait_for_timeout(400)
    await pg.goto(url + '#/pielegnacja?v=produkty'); await pg.wait_for_selector('.pg-prod-card')
    ok(await pg.locator('.pg-prod-card').count() == 5 and 'Nieprzypisany' in await pg.inner_text('#pg-p-p\\.t5'), f'{tag} Produkty: 5 produktów, użycie w krokach')
    await pg.get_by_role('button', name='W zapasie').click(); await pg.wait_for_timeout(300)
    ok(await pg.locator('.pg-prod-card').count() == 1, f'{tag} Produkty: filtr statusu')
    await pg.goto(url + '#/pielegnacja?v=produkty'); await pg.wait_for_selector('.pg-prod-card')
    await pg.get_by_role('button', name='Edytuj produkt: [DANE TESTOWE] Produkt A').click(); await pg.wait_for_selector('dialog[open]')
    await pg.select_option('dialog select >> nth=1', 'zapas'); await pg.fill('dialog input[type=date]', '2026-10-01')
    await pg.get_by_role('button', name='Zapisz zmiany').click(); await pg.wait_for_timeout(500)
    card = await pg.inner_text('#pg-p-p\\.t1')
    ok('W zapasie' in card and 'Otwarty 1 października 2026' in card, f'{tag} Produkty: edycja statusu i daty otwarcia')
    await pg.goto(url + '#/pielegnacja?v=plan'); await pg.wait_for_selector('.pg-plan-i')
    n0 = await pg.locator('.pg-plan-i').count()
    await pg.get_by_role('button', name='Dodaj krok').click(); await pg.wait_for_selector('dialog[open]')
    await pg.get_by_role('button', name='Dodaj krok').last.click(); await pg.wait_for_timeout(200)
    ok('Podaj czynność' in await pg.inner_text('dialog'), f'{tag} Plan: walidacja w oknie')
    await pg.fill('dialog input >> nth=0', '[DANE TESTOWE] krok dodany'); await pg.get_by_role('button', name='Dodaj krok').last.click(); await pg.wait_for_timeout(500)
    ok(await pg.locator('.pg-plan-i').count() == n0 + 1 and 'krok dodany' in await pg.inner_text('main'), f'{tag} Plan: dodanie kroku')
    await pg.get_by_role('button', name='Edytuj krok: [DANE TESTOWE] krok dodany').click(); await pg.wait_for_selector('dialog[open]')
    await pg.get_by_role('button', name='Usuń krok').click(); await pg.wait_for_timeout(500)
    ok(await pg.locator('.pg-plan-i').count() == n0, f'{tag} Plan: usunięcie kroku')
    async with pg.expect_download() as dl:
        await pg.get_by_role('button', name='Eksport planu (.json)').click()
    exp = json.loads(pathlib.Path(await (await dl.value).path()).read_text(encoding='utf8'))
    ok(exp['format'] == '2027-care' and len(exp['steps']) == 10 and len(exp['products']) == 5 and all('kind' not in x for x in exp['steps']),
       f'{tag} Plan: eksport w formacie importu (10 kroków, 5 produktów)')
    # Dziś: postęp przy slotach (bez nazw produktów — D-041), karta, niedziela z prysznicem (D-094), „Wymaga uwagi”
    await pg.goto(url + '#/dzis?d=2026-11-30'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    ok('Pielęgnacja 1 / 3' in await pg.inner_text('#slot\\.0700') and 'Pielęgnacja 0 / 1' in await pg.inner_text('#slot\\.2100')
       and 'Produkt' not in await pg.inner_text('.dz-plan'), f'{tag} Dziś: postęp pielęgnacji przy slotach, bez nazw produktów')
    ok('1 / 6' in await pg.inner_text('.dz-aside'), f'{tag} Dziś: karta „Pielęgnacja”')
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-attn')
    ok('Pielęgnacja: zmiana w planie 07.12' in await pg.inner_text('.dz-attn'), f'{tag} Wymaga uwagi: zapowiedź zmiany w syntetycznym planie pielęgnacji')
    await pg.goto(url + '#/dzis?d=2026-12-06'); await pg.wait_for_selector('.dz-plan-h')
    ok('Prysznic całego ciała' in await pg.inner_text('#slot\\.2015n') and 'Pielęgnacja 0 / 1' in await pg.inner_text('#slot\\.2015n')
       and await pg.locator('#slot\\.2035').count() == 0, f'{tag} niedziela: prysznic 20:15–20:45 z postępem pielęgnacji, bez mycia głowy (D-094)')
    # D-111: niedziela świąteczna (27.12) bez wariantu „basen” — krok przypięty do slot.2015n w zwykłym slocie 20:15
    await pg.goto(url + '#/dzis?d=2026-12-27'); await pg.wait_for_selector('.dz-plan-h')
    ok(await pg.locator('#slot\\.2015n').count() == 0 and 'Pielęgnacja 0 / 1' in await pg.inner_text('#slot\\.2015'),
       f'{tag} niedziela świąteczna 27.12: znacznik pielęgnacji w slocie 20:15 (krok z wariantu „basen”)')
    if not mobile:
        await pg.keyboard.press('Control+k'); await pg.wait_for_selector('dialog.gs-dialog')
        await pg.keyboard.type('Produkt C'); await pg.wait_for_timeout(300)
        ok('Pielęgnacja' in await pg.inner_text('dialog.gs-dialog'), f'{tag} ⌘K: produkty pielęgnacji w wyszukiwaniu')
        await pg.keyboard.press('Escape')
    await pg.set_viewport_size({'width': 320, 'height': 700})
    for r in ('#/pielegnacja', '#/pielegnacja?v=tydzien', '#/pielegnacja?v=produkty', '#/pielegnacja?v=plan'):
        await pg.goto(url + r); await pg.wait_for_timeout(300)
        sw = await pg.evaluate('document.documentElement.scrollWidth')
        ok(sw <= 320, f'{tag} {r}: 320 px bez przewijania w poziomie ({sw}px)')
    ok(not errs, f'{tag} brak błędów konsoli ({errs[:2]})')
    await b.close()

# Plan MPW (D-095): moduł w „Więcej” do 11.11, zakładka od 12.11 (w miejsce CFA), karta w „Dziś” bez zmian godzin planu dnia,
# postęp `mpw.done` niezależny od CFA, punktowe odświeżanie, harmonogram, kalendarz, error log MPW, plan, Wymaga uwagi, tydzień, .ics
def at(y, m, d, hh=10, mm=0):   # czas lokalny Europe/Warsaw (od 25.10.2026 CET, +01:00)
    off = 2 if (m, d) < (10, 25) and y == 2026 else 1
    return _dt.datetime(y, m, d, hh, mm, tzinfo=_dt.timezone(_dt.timedelta(hours=off)))
async def run_mpw(pw, name, url, mobile):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [MPW]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw', accept_downloads=True)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.clock.install(time=at(2026, 10, 19))
    # Przed końcem CFA: MPW „na bocznym torze” — w „Więcej” / w panelu za CFA; podgląd planu z odliczaniem do startu (19.10 — przed startem planu, D-121)
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-outside')
    if mobile:
        labels = await pg.eval_on_selector_all('.tabs a', 'e => e.map(x => x.textContent.trim())')
        ok(labels == ['Dziś', 'Dieta', 'Trening', 'CFA', 'Więcej'], f'{tag} 19.10 (przed startem planu): na pasku CFA ({labels})')
        await pg.goto(url + '#/wiecej'); await pg.wait_for_selector('.more-list')
        ok(await pg.locator('.more-list a[href="#/mpw"]').count() == 1 and await pg.locator('.more-list a[href="#/cfa"]').count() == 0, f'{tag} 19.10: MPW w „Więcej”')
    else:
        nauka = await pg.eval_on_selector_all('.side-group:nth-child(4) .side-a', 'e => e.map(x => x.textContent.trim())')
        ok(nauka == ['CFA', 'MPW'], f'{tag} 19.10: panel „Nauka” — CFA, potem MPW ({nauka})')
    await pg.goto(url + '#/mpw'); await pg.wait_for_selector('.cfa-row')
    hero = await pg.text_content('.hero-mpw')
    ok('Start planu: pn 23 listopada 2026 (za 35 dni)' in hero and '0 / 392 bloków' in hero and '21 marca 2027, 11:00' in hero, f'{tag} przed startem: odliczanie i podgląd ({hero[:60]!r})')
    ok('pn 23 listopada 2026' in await pg.inner_text('.cfa-dayhead') and await pg.locator('.cfa-row').count() == 3, f'{tag} przed startem: podgląd pierwszego dnia (3 bloki, start 23.11 — D-121)')
    # Zamiana od 12.11 (koniec planu CFA 11.11)
    await pg.clock.set_system_time(at(2026, 11, 12)); await pg.goto(url + '#/dane'); await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-outside')   # 12.11 — przed startem planu (D-121)
    if mobile:
        labels = await pg.eval_on_selector_all('.tabs a', 'e => e.map(x => x.textContent.trim())')
        ok(labels == ['Dziś', 'Dieta', 'Trening', 'MPW', 'Więcej'], f'{tag} 12.11: MPW na pasku w miejscu CFA ({labels})')
        await pg.goto(url + '#/wiecej'); await pg.wait_for_selector('.more-list')
        ok(await pg.locator('.more-list a[href="#/cfa"]').count() == 1 and await pg.locator('.more-list a').count() == 9, f'{tag} 12.11: CFA w „Więcej” (9 modułów)')
    else:
        nauka = await pg.eval_on_selector_all('.side-group:nth-child(4) .side-a', 'e => e.map(x => x.textContent.trim())')
        ok(nauka == ['MPW', 'CFA'], f'{tag} 12.11: panel „Nauka” — MPW, potem CFA ({nauka})')
    # Dzień z MPW i CFA (24.11, 16:00): karta „Nauka MPW”, godziny planu dnia bez zmian, kafel „Nauka” (oba plany, D-116) i karty planów
    await pg.clock.set_system_time(at(2026, 11, 24, 16)); await pg.goto(url + '#/dane'); await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-mpw')
    card = await pg.inner_text('.dz-mpw')
    ok(await pg.locator('.dz-mpw .cfa-row').count() == 3 and '15:30–22:53 · 0 / 3 bloków' in card and 'Kodeks cywilny' in card, f'{tag} Dziś: karta „Nauka MPW” (3 bloki, 15:30–22:53 — D-120: C o 22:00)')
    kp = ' '.join((await pg.inner_text('.dz-kpis')).split())
    ok('0 / 6 bloków' in kp and 'CFA 0/3 · MPW 0/3' in kp and 'Plan MPW' in await pg.inner_text('.dz-aside'), f'{tag} Dziś: kafel „Nauka” (CFA + MPW) i karta „Plan MPW” ({kp[-60:]})')
    await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    ok(await pg.locator('.dz-plan .slot').count() == 34 and 'Nauka MPW' in await pg.inner_text('#slot\\.1530') and 'CFA blok E' in await pg.inner_text('#slot\\.1220'),
       f'{tag} Dziś: szablon godzin bez zmian (34 punkty; slot 15:30 nazywa blok MPW, 12:20 — blok CFA E)')
    await pg.get_by_role('button', name='Blok MPW 4 do wykonania').click(); await wait_js(pg, "() => document.querySelector('.dz-mpw')?.innerText.includes('1 / 3 bloków')")
    ok(await pg.locator('.dz-mpw .cfa-row.is-done').count() == 1, f'{tag} Dziś: odhaczenie bloku MPW')
    # Moduł: postęp niezależny od CFA, punktowe odświeżanie (P2), zadania bloku
    await pg.goto(url + '#/cfa'); await pg.wait_for_selector('.hero-cfa')
    ok('0 / 451 bloków' in await pg.inner_text('.hero-cfa'), f'{tag} CFA: postęp CFA bez bloków MPW')
    await pg.goto(url + '#/mpw'); await pg.wait_for_selector('.cfa-row')
    ok('1 / 392 bloków' in await pg.inner_text('.hero-mpw') and await pg.locator('.cfa-row.is-done').count() == 1, f'{tag} MPW: odhaczenie z „Dziś” widoczne w module')
    await pg.evaluate("document.querySelector('main').dataset.p2 = '1'")
    await pg.get_by_role('button', name='Blok 5 do wykonania').click(); await wait_js(pg, "() => document.querySelector('.hero-mpw')?.innerText.includes('2 / 392')")
    ok(await pg.evaluate("!!document.querySelector('main[data-p2]')") and '2 / 3 bloków' in await pg.inner_text('.cfa-dayhead'), f'{tag} MPW: odhaczenie punktowe (P2)')
    await pg.locator('.cf-task summary').first.click()
    ok('Przeczytaj' in await pg.inner_text('.cf-task[open]') and 'KNF 1.1.1–1.1.13' in await pg.inner_text('.cfa-row >> nth=0'), f'{tag} MPW: zadania bloku i punkty KNF')
    # Harmonogram: filtr kategorii i wyszukiwanie po punkcie KNF
    await pg.goto(url + '#/mpw?v=harmonogram&kat=Literatura+MPW'); await pg.wait_for_selector('.filters')
    ok('65 bloków' in await pg.inner_text('.filters'), f'{tag} Harmonogram: 65 bloków literatury')
    await pg.goto(url + '#/mpw?v=harmonogram&q=9.1.1'); await pg.wait_for_selector('.filters')
    ok(await pg.locator('.cfa-row').count() > 0 and 'Regulamin Giełdy' in await pg.inner_text('main'), f'{tag} Harmonogram: wyszukiwanie po punkcie KNF')
    # Kalendarz: 6 symulacji, egzamin 21.03, dni wolne bez odnośnika
    await pg.goto(url + '#/mpw?v=kalendarz'); await pg.wait_for_selector('.cal')
    ok(await pg.locator('a.cal-d.c-mock').count() == 5 and await pg.locator('a.cal-d.c-exam').count() == 1 and await pg.locator('a.cal-d[href$="2027-02-19"]').count() == 0
       and await pg.locator('a.cal-d[href$="2026-12-25"]').count() == 1, f'{tag} Kalendarz: 5 symulacji, egzamin, dni wolne 19–20.02 (24–27.12 z blokami, D-116)')
    # Error log MPW: osobny od CFA, eksport CSV, bez importu v3
    await pg.goto(url + '#/mpw?v=log'); await pg.wait_for_selector('text=Nowy wpis')
    ok(await pg.get_by_role('button', name='Import CSV (v3)').count() == 0, f'{tag} Error log MPW: bez importu v3 (tylko CFA)')
    await pg.fill('input[placeholder^="np. KSH"]', '[TEST] KSH — próg'); await pg.get_by_role('button', name='Dodaj wpis').click(); await pg.wait_for_selector('.log-item')
    async with pg.expect_download() as dl:
        await pg.get_by_role('button', name='Eksport CSV').click()
    d = await dl.value; csv = pathlib.Path(await d.path()).read_text(encoding='utf-8-sig')
    ok(d.suggested_filename == 'error-log-mpw.csv' and '"MPW";' in csv and '[TEST] KSH' in csv, f'{tag} Error log MPW: wpis i eksport CSV')
    await pg.goto(url + '#/cfa?v=log'); await pg.wait_for_selector('text=Nowy wpis')
    ok('Error log jest pusty' in await pg.inner_text('main'), f'{tag} Error log CFA bez wpisów MPW')
    # Plan: źródła, symulacje, fazy, dni wolne
    await pg.goto(url + '#/mpw?v=plan'); await pg.wait_for_selector('.topic')
    m = await pg.inner_text('main')
    ok('Źródła — pierwsze przejście' in m and await pg.locator('main .tech-list a[href^="#/mpw?v=dzien"]').count() == 5 and '19.02–20.02' in m and '24.12–27.12' not in m and 'test KNF z 17.03.2024' in m,
       f'{tag} Plan: źródła, 5 symulacji, dni wolne')
    # Symulacja w „Dziś”, tydzień, Wymaga uwagi
    await pg.goto(url + '#/dzis?d=2027-02-27'); await pg.wait_for_selector('.dz-mpw')
    ok('Symulacja egzaminu MPW' in await pg.inner_text('.dz-mpw') and '15:30–18:30' in await pg.inner_text('.dz-mpw'), f'{tag} Dziś: dzień symulacji')
    await pg.goto(url + '#/dzis?v=tydzien&d=2026-11-24'); await pg.wait_for_selector('.wk-grid')
    ok('MPW: 3 bloki' in await pg.inner_text('.wk-grid'), f'{tag} Tydzień: bloki MPW')
    # D-096: weekendy 8:00–15:23 w slotach A–G (studia bez zakupów, praca magisterska z zakupami, święta, P1–P7 MPW)
    await pg.goto(url + '#/dzis?v=tydzien&d=2026-11-28'); await pg.wait_for_selector('.wk-grid')
    ok(await pg.locator('.wk-blocks').count() == 2 and 'Studia 8:00–15:23' in await pg.inner_text('.wk-grid'), f'{tag} Tydzień: weekend studiów (D-096; zjazd II — D-121)')
    await pg.goto(url + '#/dzis?d=2026-11-28'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    ok('Wycena przedsiębiorstwa i modelowanie finansowe - studia' in await pg.inner_text('#slot\\.1220') and await pg.locator('#slot\\.1213z').count() == 0
       and 'Studia 8:00–15:23' in await pg.inner_text('.dz-head'), f'{tag} Dziś: sobota zjazdu — studia w slotach A–G, bez zakupów')
    await pg.goto(url + '#/dzis?d=2026-12-12'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    ok('Pisanie pracy dyplomowej' in await pg.inner_text('#slot\\.0800') and 'CFA blok E' in await pg.inner_text('#slot\\.1120') and await pg.locator('#slot\\.1213z').count() == 0,
       f'{tag} Dziś: sobota z pracą dyplomową 08:00–11:03 (D-120), CFA od 11:20, bez zakupów (D-097)')
    await pg.goto(url + '#/dzis?d=2026-12-26'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    ok('Boże Narodzenie' in await pg.inner_text('#slot\\.0800') and 'Bez treningu' in await pg.inner_text('.dz-head') and 'NT' in await pg.inner_text('.dz-head')
       and await pg.locator('.dz-mpw .cfa-row').count() == 3, f'{tag} Dziś: święta bez treningu, po południu bloki MPW (D-096, D-116)')
    await pg.goto(url + '#/dzis?d=2027-03-06'); await pg.wait_for_selector('.dz-mpw'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    ok('MPW blok P1' in await pg.inner_text('#slot\\.0800') and await pg.locator('.dz-mpw .cfa-row').count() == 10, f'{tag} Dziś: P1–P7 MPW w slotach A–G, 10 bloków w karcie')
    await pg.clock.set_system_time(at(2026, 11, 25, 9)); await pg.goto(url + '#/dane'); await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-attn')
    at_ = await pg.inner_text('.dz-attn')
    ok('Zaległe bloki MPW' in at_ and 'Zaległe bloki CFA' in at_, f'{tag} Wymaga uwagi: zaległe MPW i CFA (oba plany równolegle, D-116)')
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('.dn-ics')
    ok('Bloki MPW' in await pg.inner_text('.dn-ics'), f'{tag} Dane: przypomnienia .ics z blokami MPW')
    await pg.set_viewport_size({'width': 320, 'height': 700})
    for r in ('#/mpw', '#/mpw?v=harmonogram', '#/mpw?v=kalendarz', '#/mpw?v=log', '#/mpw?v=plan', '#/dzis?d=2026-11-24'):
        await pg.goto(url + r); await pg.wait_for_timeout(300)
        sw = await pg.evaluate('document.documentElement.scrollWidth')
        ok(sw <= 320, f'{tag} {r}: 320 px bez przewijania w poziomie ({sw}px)')
    ok(not errs, f'{tag} brak błędów konsoli ({errs[:2]})')
    await b.close()

# --- D-107: poprawki audytu z 23.10.2026 (B1–B10) — zachowanie w przeglądarce
INV_JS = """p => new Promise(res => { const r = indexedDB.open('p2027'); r.onsuccess = () => { const q = r.result.transaction('events').objectStore('events').getAll();
  q.onsuccess = () => { res(q.result.filter(e => e.t.startsWith('inv.') && e.d.prod === p).sort((a, b) => (a.hlc < b.hlc ? -1 : 1)).map(e => [e.t, e.d.qty, e.d.date, e.d.undo || null, e.d.op || null])); r.result.close(); }; }; })"""

async def run_d107(pw, name, url, mobile):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [D-107]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw', accept_downloads=True)
    await ctx.add_init_script('delete Navigator.prototype.share; delete Navigator.prototype.canShare;')
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.clock.install(time=at(2026, 11, 30))
    inv = lambda p: pg.evaluate(INV_JS, p)
    toast = lambda: pg.inner_text('#toast')
    # B8: seria tygodni liczy też dzień z samym wpisem basenu (D-106)
    await pg.goto(url + '#/trening?d=2026-11-29'); await pg.wait_for_selector('.tlog')
    el = pg.get_by_label('Basen: Dystans, m', exact=True); await el.fill('1500'); await el.press('Tab'); await pg.wait_for_timeout(400)
    await pg.goto(url + '#/trening?v=stat'); await pg.wait_for_selector('.stats')
    ok('seria: 1 tydzień z rzędu' in await pg.inner_text('.stats'), f'{tag} B8: seria tygodni z wpisem basenu ({(await pg.inner_text(".stats"))[:60]!r})')
    # B2: puste pole „Stan” nie zapisuje zera
    await pg.goto(url + '#/zapasy?q=Banan'); await pg.wait_for_selector('.inv-item')
    st = lambda: pg.get_by_label('Stan: Banan', exact=True)
    await st().fill('1000'); await st().press('Tab'); await wait_js(pg, 'v => document.querySelector(".inv-item input[type=number]").value === v', '1000')
    n0 = len(await inv('banan'))
    await st().fill(''); await st().press('Tab'); await pg.wait_for_timeout(500)
    ok(len(await inv('banan')) == n0 and await st().input_value() == '1000' and 'puste pole' in await toast(),
       f'{tag} B2: puste pole „Stan” — bez zapisu, wartość przywrócona, komunikat')
    # B1: „Cofnij” po pomyłce — stan z zużyciem od poprzedniej inwentaryzacji; drugie „Cofnij” nie przywraca pomyłki
    await pg.clock.set_system_time(at(2026, 12, 3)); await pg.goto(url + '#/zapasy?q=Banan&x=1'); await pg.wait_for_selector('.inv-item')
    v29 = await st().input_value()
    await st().fill('5'); await st().press('Tab'); await pg.wait_for_selector('#toast >> text=Banan: stan 5')   # zapis zakończony (pole pokazuje wpis od razu)
    undo = pg.locator('.actions').get_by_role('button', name='Cofnij', exact=True)
    tip = await undo.get_attribute('title') or ''
    ok('Banan: stan 5' in tip, f'{tag} B1: podpowiedź „Cofnij” mówi, co zostanie cofnięte ({tip!r})')
    await undo.click(); await wait_js(pg, 'v => document.querySelector(".inv-item input[type=number]").value === v', v29)
    ok(v29 == '760', f'{tag} B1: „Cofnij” przywraca stan z zużyciem od 30.11 ({v29} g, nie 1000 g)')
    await undo.click(); await pg.wait_for_timeout(500)
    ok(await st().input_value() == '760' and 'Bez wcześniejszego stanu' in await toast() and await undo.is_disabled(),
       f'{tag} B1: drugie „Cofnij” nie przywraca pomyłki (pierwsza inwentaryzacja — stan bez zmian, przycisk nieaktywny)')
    ev = await inv('banan')
    ok([e[1] for e in ev[-2:]] == [760, 760] and all(e[3] for e in ev[-2:]), f'{tag} B1: cofnięcia oznaczone polem `undo` ({ev[-2:]})')
    # B1: zapis zbiorczy cofany w całości
    await st().fill('900'); await st().press('Tab'); await wait_js(pg, 'v => document.querySelector(".inv-item input[type=number]").value === v', '900')
    await pg.goto(url + '#/zapasy'); await pg.wait_for_selector('.inv-item')
    pg.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.locator('.zp-bulk > summary').click(); await pg.get_by_role('button', name='Zeruj stany').click(); await pg.wait_for_selector('text=Wyzerowano stany')
    ok((await inv('banan'))[-1][1] == 0 and (await inv('banan'))[-1][4], f'{tag} B1: zerowanie jako jedna operacja (`op`)')
    await undo.click(); await pg.wait_for_selector('#toast >> text=zmian naraz')
    msg = await toast()
    await pg.goto(url + '#/zapasy?q=Banan'); await pg.wait_for_selector('.inv-item')
    ok(await st().input_value() == '900' and 'Bez wcześniejszego stanu' in msg, f'{tag} B1: „Cofnij” po zerowaniu przywraca stany całej operacji (banan {await st().input_value()})')
    # B4: stoper zapomniany na ponad dobę — zatrzymanie zapisuje się; wpis ręczny kończy działający stoper
    await pg.clock.set_system_time(at(2026, 11, 30, 18, 15))
    await pg.goto(url + '#/trening?d=2026-11-30'); await pg.wait_for_selector('.hero-tr')
    await pg.get_by_role('button', name='Rozpocznij trening').click(); await pg.wait_for_selector('text=Zakończ trening')
    await pg.clock.set_system_time(at(2026, 12, 1, 19, 30)); await pg.goto(url + '#/trening?d=2026-11-30&x=1'); await pg.wait_for_selector('.hero-tr')
    await pg.get_by_role('button', name='Zakończ trening').click(); await pg.wait_for_timeout(600)
    ok(await pg.locator('main .banner.err').count() == 0 and await pg.get_by_role('button', name='Zakończ trening').count() == 0 and 'bez zapisu czasu' in await toast(),
       f'{tag} B4: stoper po 25 h zatrzymany, bez błędu walidacji, z prośbą o wpis czasu')
    await pg.get_by_role('button', name='Rozpocznij trening').click(); await pg.wait_for_selector('text=Zakończ trening')
    m = pg.get_by_label('Czas treningu w minutach'); await m.fill('50'); await m.press('Tab'); await pg.wait_for_timeout(600)
    ok(await pg.get_by_role('button', name='Zakończ trening').count() == 0 and 'Zapisano: 50 min' in await pg.inner_text('.tm'), f'{tag} B4: wpis ręczny kończy działający stoper')
    # B5: plik .ics — basen w niedzielę, 2 rundy sauny w czwartek, sauna po treningu
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('.dn-ics')
    await pg.select_option('.dn-ics select', '30')
    async with pg.expect_download() as dl:
        await pg.get_by_role('button', name='Pobierz plik .ics').click()
    ics = pathlib.Path(await (await dl.value).path()).read_bytes().decode('utf8').replace('\r\n ', '')   # bajty: read_text zamieniłby CRLF na LF
    have = [x for x in ('\r\nSUMMARY:Basen 55 min\r\n', '\r\nSUMMARY:2 rundy sauny wg protokołu\r\n', '\r\nSUMMARY:Sauna\r\n') if x in ics]
    ok(len(have) == 3, f'{tag} B5: .ics z basenem, 2 rundami sauny i sauną po treningu ({have}, {len(ics)} B, {ics.count("BEGIN:VEVENT")} wydarzeń)')
    # B6: MPW w czwartki od 07.01 o 16:00 (bez godzin na sztywno)
    await pg.goto(url + '#/dzis?d=2027-01-07'); await pg.wait_for_selector('.dz-mpw')
    ok('16:00–18:53 · 0 / 3 bloków' in await pg.inner_text('.dz-mpw'), f'{tag} B6: Dziś — MPW w czwartek od 16:00 (karta „Nauka MPW”; kafel „Nauka” łączy CFA i MPW — D-116)')
    await pg.goto(url + '#/dzis?v=tydzien&d=2027-01-07'); await pg.wait_for_selector('.wk-grid')
    wk = await pg.inner_text('.wk-grid')
    ok('MPW: 3 bloki · 16:00' in wk and 'MPW: 3 bloki · 15:30' in wk, f'{tag} B6: Tydzień — godziny bloków MPW z planu')
    # B7: ikony z kompletnymi liniami (motyw „Systemowy” — monitor)
    await pg.goto(url + '#/wiecej'); await pg.wait_for_selector('main .theme-switch')
    lines = await pg.eval_on_selector_all('main button[aria-label="Motyw: Systemowy"] svg line', 'e => e.map(x => x.getAttribute("x1"))')
    ok(len(lines) == 2 and all(lines), f'{tag} B7: ikona „monitor” z liniami ({lines})')
    # B9: lista slotów w Pielęgnacji — bez „(sobota)”, każdy raz, sloty czwartkowe z dniami z kalendarza
    await pg.goto(url + '#/pielegnacja?v=plan'); await pg.wait_for_selector('.pg-tools')
    await pg.get_by_role('button', name='Dodaj krok').click(); await pg.wait_for_selector('dialog[open]')
    opts = await pg.eval_on_selector_all('dialog select', 'e => [...e[e.length - 1].options].map(o => [o.value, o.textContent])')
    ok(not any('sobota' in t for _, t in opts) and len({v for v, _ in opts}) == len(opts) and any(t == '15:30 · Zakupy (czw, 07.01–18.03)' for _, t in opts) and not any('22.10' in t for _, t in opts),
       f'{tag} B9: sloty do przypięcia kroku ({len(opts)} pozycji)')
    await pg.keyboard.press('Escape')
    ok(not errs, f'{tag} brak błędów konsoli ({errs[:2]})')
    await ctx.close()

    # B3: „Dziś” z upływem czasu — „Teraz” aktualizowane w miejscu, zmiana dnia przerysowuje widok (także po powrocie do aplikacji)
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.clock.install(time=at(2026, 12, 21, 10, 2) + _dt.timedelta(seconds=20))
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
    t1 = await pg.inner_text('.nowcard-t')
    await pg.evaluate("document.querySelector('main').dataset.mark = '1'")
    await pg.clock.fast_forward(65_000); await pg.wait_for_timeout(300)   # fast_forward wywołuje zegar co 30 s najwyżej raz — po 10:03
    t2 = await pg.inner_text('.nowcard-t')
    ok(t1 != t2 and t2 == 'Przerwa kognitywna' and await pg.evaluate("document.querySelector('main').dataset.mark") == '1'
       and 'is-now' in (await pg.get_attribute('#slot\\.1003', 'class')) and 'is-now' not in (await pg.get_attribute('#slot\\.0910', 'class')),
       f'{tag} B3: „Teraz” zmienia się o 10:03 w miejscu, bez przerysowania strony ({t1} → {t2})')
    await pg.clock.set_system_time(at(2026, 12, 21, 23, 59) + _dt.timedelta(seconds=40)); await pg.clock.fast_forward(65_000); await pg.wait_for_timeout(500)
    ok('22 grudnia 2026' in await pg.inner_text('.dz-head .date'), f'{tag} B3: o północy widok „Dziś” przechodzi na nowy dzień')
    await pg.clock.set_system_time(at(2026, 12, 23, 8, 50))   # aplikacja „w tle” do rana — bez zegarów; powrót na ekran
    await pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(500)
    ok('23 grudnia 2026' in await pg.inner_text('.dz-head .date') and await pg.inner_text('.nowcard-t') != 'Sen (8 h)',
       f'{tag} B3: po powrocie do aplikacji następnego dnia — nowa data i bieżący punkt planu ({await pg.inner_text(".nowcard-t")})')
    ok(not errs, f'{tag} B3: brak błędów ({errs[:2]})')
    await ctx.close()

    # B10: zmiana w innej karcie — doczytanie do tej samej instancji, bez nowego połączenia z IndexedDB (BroadcastChannel: wariant web)
    if name == 'web':
        ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
        await ctx.add_init_script("(() => { const o = indexedDB.open.bind(indexedDB); window.__opens = 0; indexedDB.open = (...a) => { window.__opens++; return o(...a); }; })()")
        A, B = await ctx.new_page(), await ctx.new_page(); errs = []
        for p in (A, B): p.on('pageerror', lambda e: errs.append(str(e)))
        for p in (A, B): await p.clock.install(time=at(2026, 11, 30)); await p.goto(url + '#/zapasy?q=Kefir'); await p.wait_for_selector('.inv-item')
        kef = lambda p: p.locator('.inv-item').first.locator('input[type=number]')
        for v in ('100', '200', '300'):
            await kef(A).fill(v); await kef(A).press('Tab')
            await wait_js(B, 'v => document.querySelector(".inv-item input[type=number]")?.value === v', v)
        ok(await B.evaluate('window.__opens') == 1, f'{tag} B10: karta B widzi zmiany z A bez nowych połączeń z bazą (otwarć: {await B.evaluate("window.__opens")})')
        await kef(B).fill('333'); await kef(B).press('Tab')
        await wait_js(A, 'v => document.querySelector(".inv-item input[type=number]")?.value === v', '333')
        ok(await A.evaluate('window.__opens') == 1 and not errs, f'{tag} B10: zapis w karcie B po doczytaniu działa i dociera do A ({errs[:1]})')
        await ctx.close()
    await b.close()

AXE_SRC = (ROOT / 'node_modules/axe-core/axe.min.js').read_text()
async def axe_audit(pg):
    """axe-core WCAG 2.1 A/AA (wstrzyknięcie przez CDP — CSP wariantu web blokuje skrypty inline) i przewijanie w poziomie.
    Najpierw koniec animacji czasowych (wejście okna, przejście między ekranami — D-110); pomijane animacje nieskończone (pulsowanie „teraz”)
    i sterowane przewijaniem (zanikanie krawędzi pasków — oś przewijania, nie czas)."""
    await wait_js(pg, "() => document.getAnimations().every(a => a.playState !== 'running' || a.timeline !== document.timeline || a.effect?.getComputedTiming().iterations === Infinity)")
    cdp = await pg.context.new_cdp_session(pg); await cdp.send('Runtime.evaluate', {'expression': AXE_SRC}); await cdp.detach()
    res = await pg.evaluate("axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa']}, resultTypes: ['violations']})")
    sw, w = await pg.evaluate('[document.documentElement.scrollWidth, innerWidth]')
    return [f"{x['id']} {x['nodes'][0]['target'][0]}" for x in res['violations']] + ([f'przewijanie w poziomie {sw}/{w}'] if sw > w else [])

async def run_d108(pw, name, url, mobile):
    """D-108: ryzyka R1–R4 i ulepszenia U1–U8 z audytu 23.10.2026 (R1, R3, R4 — testy jednostkowe)."""
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [D-108]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
    await ctx.add_init_script("localStorage.setItem('p2027.theme', 'light')")
    pg = await ctx.new_page(); errs = []; reqs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('request', lambda r: reqs.append(r.url))
    inv = lambda p: pg.evaluate(INV_JS, p)
    toast = lambda: pg.inner_text('#toast')
    st = lambda: pg.get_by_label('Stan: Banan', exact=True)
    await pg.clock.install(time=at(2026, 12, 14))
    # U7: publikowana CSP bez lokalnego serwera testowego
    csp = (ROOT / 'dist/web/index.html').read_text(encoding='utf8')
    ok('connect-src' in csp and 'localhost' not in csp and '127.0.0.1' not in csp, f'{tag} U7: CSP wariantu web bez http://localhost i 127.0.0.1')
    # U6: zadania bloków MPW poza pakietem — wczytywane dopiero w module MPW (web: osobny plik; 2027.html: dane w stronie)
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
    await pg.goto(url + '#/cfa?v=dzien&d=2026-11-24'); await pg.wait_for_selector('.cfa-row')
    before = [r for r in reqs if 'plan-mpw' in r]
    cfa_req = [r for r in reqs if 'plan-cfa' in r]
    ok(len(cfa_req) == (1 if name == 'web' else 0), f'{tag} U6, D-116: zadania bloków CFA wczytane przy otwarciu modułu CFA ({len(cfa_req)})')
    await pg.goto(url + '#/mpw?v=dzien&d=2026-11-24'); await pg.wait_for_selector('.cf-task')
    await pg.locator('.cf-task summary').first.click()
    after = [r for r in reqs if 'plan-mpw' in r]
    ok('Przeczytaj' in await pg.inner_text('.cf-task[open]') and not before and len(after) == (1 if name == 'web' else 0) and await pg.locator('.cf-task-na').count() == 0,
       f'{tag} U6: zadania bloków MPW wczytane przy otwarciu modułu (zapytania przed: {len(before)}, po: {len(after)})')
    js = [r for r in reqs if r.endswith('.js')]
    ok(name != 'web' or all('plan-' not in r for r in js), f'{tag} U6: plan nauki poza osobnym plikiem zadań — w pakiecie aplikacji')
    # U4: Trening — tydzień wybranego dnia i przełączanie tygodni
    await pg.goto(url + '#/trening?d=2026-11-26'); await pg.wait_for_selector('.day-strip')
    on = await pg.inner_text('.ds.is-on')
    ok('Tydzień 23.11–29.11' in await pg.inner_text('.tr-weeknav') and 'CZW' in on and '26.11' in on and await pg.locator('.ds.is-today').count() == 0
       and await pg.get_by_role('link', name='Ten tydzień').count() == 1, f'{tag} U4: pasek dni z tygodnia wybranego dnia ({on!r})')
    await pg.get_by_role('link', name='Następny tydzień').click(); await pg.wait_for_selector('text=Tydzień 30.11–06.12')
    ok('03.12' in await pg.inner_text('.ds.is-on') and 'd=2026-12-03' in pg.url, f'{tag} U4: „Następny tydzień” — ten sam dzień tygodnia tydzień później')
    if not mobile:
        await pg.locator('main h1').click(); await pg.keyboard.press('ArrowLeft'); await pg.wait_for_selector('text=Tydzień 23.11–29.11')
        ok('d=2026-11-26' in pg.url, f'{tag} U4: ← na komputerze — poprzedni tydzień')
    await pg.get_by_role('link', name='Ten tydzień').click(); await pg.wait_for_selector('.ds.is-today')
    ok('Tydzień 14.12–20.12' in await pg.inner_text('.tr-weeknav') and await pg.get_by_role('link', name='Ten tydzień').count() == 0, f'{tag} U4: „Ten tydzień” wraca do bieżącego tygodnia')
    await pg.goto(url + '#/trening?d=2026-11-23'); await pg.wait_for_selector('.day-strip')
    ok(await pg.get_by_role('link', name='Poprzedni tydzień').count() == 0 and await pg.get_by_role('link', name='Następny tydzień').count() == 1, f'{tag} U4: pierwszy tydzień planu — bez „Poprzedni tydzień”')
    v = await axe_audit(pg); ok(not v, f'{tag} U4: Trening z przełączaniem tygodni — dostępność {v[:2]}')
    # U3: skróty g + litera — każdy moduł; „g n” = bieżący plan nauki (od 12.11 MPW — oba plany trwają, D-116)
    async def keys(*k):
        await pg.locator('main h1').first.click()
        for x in k: await pg.keyboard.press(x)
        await pg.wait_for_timeout(300)
    for k, want in (('k', '#/kalendarz'), ('p', '#/pielegnacja'), ('e', '#/mpw'), ('n', '#/mpw'), ('c', '#/cfa')):
        await pg.goto(url + '#/dane'); await pg.wait_for_selector('main h1')
        await keys('g', k); ok(pg.url.endswith(want), f'{tag} U3: g {k} → {want} ({pg.url.split("#")[-1]})')
    await pg.clock.set_system_time(at(2026, 11, 20)); await pg.goto(url + '#/dane'); await pg.wait_for_selector('main h1')
    await keys('g', 'n'); ok(pg.url.endswith('#/mpw'), f'{tag} U3: od 12.11 „g n” → MPW')
    await keys('?'); await pg.wait_for_selector('dialog.gs-help')
    hl = await pg.inner_text('dialog.gs-help')
    ok(all(x in hl for x in ('g k', 'Kalendarz', 'g p', 'Pielęgnacja', 'g e', 'g n', 'teraz: MPW')), f'{tag} U3: lista skrótów z nowymi modułami')
    await pg.keyboard.press('Escape')
    # U1: sloty nauki bez bloku — „Czas własny” (lżej), slot w czasie bloków MPW nazywa je wprost; D-116: bloki CFA E–G w swoich slotach
    await pg.clock.set_system_time(at(2026, 11, 24, 10, 30)); await pg.goto(url + '#/dane'); await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
    await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    own = await pg.locator('.dz-plan .slot.is-own').count()
    ok(own == 4 and await pg.inner_text('.nowcard-t') == 'Czas własny' and 'Brak bloku CFA' not in await pg.inner_text('main'), f'{tag} U1: „Czas własny” w {own} slotach (A–D; D-120: o 22:00 blok MPW C), „Teraz” o 10:30')
    h1530 = await pg.inner_text('#slot\\.1530')
    ok('Nauka MPW' in h1530 and 'Blok A 15:30–16:23' in h1530 and 'is-own' not in await pg.get_attribute('#slot\\.1530', 'class'), f'{tag} U1: slot 15:30 — blok MPW A')
    v = await axe_audit(pg); ok(not v, f'{tag} U1: Dziś z „Czasem własnym” — dostępność {v[:2]}')
    # R2 + U8: plik postępu CFA z innego planu zablokowany, z bieżącego — z opisem bloków; import tworzy kopię automatyczną,
    # z której Dane przywracają stany Zapasów (jedna operacja, „Cofnij” w Zapasach)
    await pg.clock.set_system_time(at(2026, 12, 14)); await pg.goto(url + '#/zapasy?q=Banan'); await pg.wait_for_selector('.inv-item')
    await st().fill('1000'); await st().press('Tab'); await wait_js(pg, 'v => document.querySelector(".inv-item input[type=number]").value === v', '1000')
    other = fixtures.write({'wersja': 'CFA_20261013_326_CUR265_P31_A12_M0610_V3', 'zapis': '2026-10-14T20:00:00.000Z', 'wykonane': [1, 2]}, 'postep-nauki-inny.json')
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('#h-bk')
    await pg.set_input_files('input[type=file]', str(other)); await pg.wait_for_selector('dialog[open]')
    txt = await pg.inner_text('dialog[open]')
    ok('Nie można zaimportować' in txt and 'import zablokowany' in txt and 'Scal dane' not in txt, f'{tag} R2: postęp z innego planu CFA — import zablokowany')
    await pg.keyboard.press('Escape')
    cur = fixtures.write({'wersja': CFA_D['version'], 'zapis': '2026-12-14T08:00:00.000Z', 'wykonane': [1, 2]}, 'postep-nauki.json')
    await pg.set_input_files('input[type=file]', str(cur)); await pg.wait_for_selector('dialog[open]')
    txt = await pg.inner_text('dialog[open]')
    ok('Bloki do oznaczenia: 2 — od nr 1 (23.11 E) do nr 2 (23.11 F)' in txt and 'Scal dane' in txt, f'{tag} R2: postęp z bieżącego planu — opis bloków przed scaleniem')
    v = await axe_audit(pg); ok(not v, f'{tag} R2: podgląd importu — dostępność {v[:2]}')
    await pg.click('dialog >> text=Scal dane'); await pg.wait_for_selector('text=Zaimportowano 2 zmian')
    await pg.goto(url + '#/zapasy?q=Banan&x=1'); await pg.wait_for_selector('.inv-item')
    await st().fill('5'); await st().press('Tab'); await pg.wait_for_selector('#toast >> text=Banan: stan 5')
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('#h-bk')
    ok('nie cofa zmian zapisanych później' in await pg.inner_text('.dn-bk'), f'{tag} U8: opis kopii automatycznych')
    await pg.locator('.dn-bk-list').get_by_role('button', name='Przywróć stany Zapasów').first.click(); await pg.wait_for_selector('dialog[open] .dn-bk-rows')
    rows = await pg.inner_text('dialog[open] .dn-bk-rows')
    ok('Banan' in rows and '5 g → 1000 g' in rows and await pg.locator('dialog[open] .dn-bk-rows li').count() == 1, f'{tag} U8: podgląd przywrócenia ({rows!r})')
    v = await axe_audit(pg); ok(not v, f'{tag} U8: okno przywrócenia — dostępność {v[:2]}')
    await pg.get_by_role('button', name='Przywróć (1)').click(); await pg.wait_for_selector('#toast >> text=Przywrócono stany 1 pozycji')
    await pg.goto(url + '#/zapasy?q=Banan&x=2'); await pg.wait_for_selector('.inv-item')
    ev = await inv('banan')
    ok(await st().input_value() == '1000' and ev[-1][4] and ev[-1][1] == 1000, f'{tag} U8: stan Banana przywrócony jako jedna operacja ({ev[-1]})')
    await pg.locator('.actions').get_by_role('button', name='Cofnij', exact=True).click()
    await wait_js(pg, 'v => document.querySelector(".inv-item input[type=number]").value === v', '5')
    ok(await st().input_value() == '5', f'{tag} U8: „Cofnij” w Zapasach cofa przywrócenie z kopii')
    # D-109 (D3 audytu): Sylwester bez zakupów (sauna zostaje), zakupy 17.12 → 07.01; Nowy Rok bez treningu, bloki MPW bez zmian
    await pg.goto(url + '#/dzis?d=2026-12-31'); await pg.wait_for_selector('.dz-plan-h')
    await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    titles = await pg.eval_on_selector_all('.dz-plan .slot-title', 'e => e.map(x => x.firstChild.textContent.trim())')
    ok('Zakupy' not in titles and '2 rundy sauny wg protokołu' in titles and 'Sylwester: bez zakupów' in await pg.inner_text('main'), f'{tag} D-109: 31.12 — sauna, bez zakupów')
    await pg.goto(url + '#/dzis?d=2027-01-01'); await pg.wait_for_selector('.dz-plan-h')
    await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    titles = await pg.eval_on_selector_all('.dz-plan .slot-title', 'e => e.map(x => x.firstChild.textContent.trim())')
    ok(not any(t.startswith('Trening') for t in titles) and await pg.locator('.dz-mpw .cfa-row').count() == 3 and 'Nowy Rok: bez treningu' in await pg.inner_text('main'),
       f'{tag} D-109: 01.01 — bez treningu, 3 bloki MPW')
    await pg.goto(url + '#/trening?d=2027-01-01'); await pg.wait_for_selector('.hero-tr')
    ok('Bez treningu' in await pg.inner_text('.hero-tr h1'), f'{tag} D-109: Trening 01.01 — bez treningu')
    ok(not errs, f'{tag} brak błędów konsoli ({errs[:2]})')
    await ctx.close(); await b.close()

async def run_d113(pw, name, url, mobile):
    """D-113 (audyt 31.10.2026, System 3.0 „Precision”): Ustawienia i akcent, paleta ⌘K z poleceniami, tryb zakupów z odhaczeniami
    zapisanymi w dzienniku (`setting`, wspólne dla urządzeń), „Cofnij” w komunikacie, odhaczanie dawek (Suplementacja ↔ Dziś),
    podgląd dnia w Kalendarzu, postęp nauki względem planu, stan nigdy < 0 w widokach, dostępność nowych widoków."""
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [D-113]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.clock.install(time=at(2026, 12, 5, 10, 40))
    syn = fixtures.write(fixtures.synthetic_zapasy(_dt.date(2026, 11, 29))[0], 'zapasy_d113.json')
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('text=Stan zapisu')
    await pg.set_input_files('input[type=file]', str(syn)); await pg.wait_for_selector('dialog[open]')
    await pg.click('dialog >> text=Scal dane'); await pg.wait_for_selector('text=Zaimportowano')
    # Ustawienia: akcent zapisany per urządzenie i stosowany przed pierwszym renderem
    await pg.goto(url + '#/ustawienia'); await pg.wait_for_selector('.set-sec')
    await pg.get_by_role('button', name='Bursztyn').click(); await pg.wait_for_timeout(200)
    await pg.reload(); await pg.wait_for_selector('.set-sec')
    ok(await pg.evaluate("document.documentElement.dataset.accent") == 'amber' and await pg.evaluate("localStorage.getItem('p2027.accent')") == 'amber',
       f'{tag} Ustawienia: akcent zapamiętany i stosowany od startu')
    v = await axe_audit(pg); ok(not v, f'{tag} Ustawienia: dostępność {v[:2]}')
    await pg.get_by_role('button', name='Indygo').click(); await pg.wait_for_timeout(200)
    ok(await pg.evaluate("document.documentElement.hasAttribute('data-accent')") is False, f'{tag} Ustawienia: akcent domyślny bez atrybutu')
    # Zapasy: żadna ilość < 0 (K1), plakietki bez emoji, tryb zakupów
    await pg.goto(url + '#/zapasy'); await pg.wait_for_selector('.inv-item')
    vals = await pg.eval_on_selector_all('.inv-item input[type=number]', 'e => e.map(x => x.value).filter(v => v !== "")')
    ok(vals and all(float(v) >= 0 for v in vals), f'{tag} Zapasy: brak stanów ujemnych ({len(vals)} pozycji)')
    await pg.get_by_role('button', name='Zakupy', exact=True).click(); await pg.wait_for_selector('dialog.shop-dialog')
    ok(await pg.locator('dialog .shop-group').count() >= 2, f'{tag} Tryb zakupów: lista pogrupowana wg kategorii')
    cb = pg.locator('dialog .shop-list input[type=checkbox]')
    await cb.nth(0).check(); await pg.wait_for_selector('dialog .shop-list li.is-done')   # zapis `setting` zakończony (upd po record)
    await pg.locator('dialog .sheet-head button').click(); await pg.reload(); await pg.wait_for_selector('.inv-item')
    await pg.get_by_role('button', name='Zakupy', exact=True).click(); await pg.wait_for_selector('dialog.shop-dialog')
    ok('1 / ' in await pg.inner_text('dialog .prog') and await pg.locator('dialog .shop-list li.is-done').count() == 1, f'{tag} Tryb zakupów: odhaczenie zapisane (po przeładowaniu)')
    first = (await pg.locator('dialog .shop-list li.is-done .f-n').inner_text()).strip()
    had = float(re.search(r'masz ([\d,.]+)', await pg.locator('dialog .shop-list li.is-done').inner_text()).group(1).replace(',', '.'))
    await pg.locator('dialog .shop-list li.is-done .shop-q').fill('7'); await pg.locator('dialog .shop-list li.is-done .shop-q').dispatch_event('change')
    pg.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.locator('dialog').get_by_role('button', name='Kupione — dodaj do stanu', exact=False).click(); await pg.wait_for_selector('#toast .toast-act')
    ok('Zaktualizowano stany dla 1 pozycji' in await pg.inner_text('#toast'), f'{tag} Tryb zakupów: „Kupione” dodaje zaznaczone ({first}, 7)')
    await pg.goto(url + f'#/zapasy?q={first}'); await pg.wait_for_selector('.inv-item')
    st_after = float(await pg.locator('.inv-item').first.locator('input[type=number]').input_value())
    # K1: zakup z dzisiejszego dnia pokrywa dzisiejsze zużycie — stan na koniec dnia rośnie, ale o ≤ 7
    ok(had < st_after <= had + 7, f'{tag} Tryb zakupów: stan po zakupie {had} → {st_after}')
    await pg.locator('.inv-item .zp-more > summary').first.click(); await pg.wait_for_selector('.zp-hist .chart')
    ok('Zużycie wg planu' in await pg.inner_text('.zp-hist'), f'{tag} Zapasy: szczegóły — stan w czasie i zużycie')
    # Suplementacja ↔ Dziś: te same odhaczenia dawek
    await pg.goto(url + '#/suplementy'); await pg.wait_for_selector('.dose-list')
    await pg.locator('.dose-ck').first.click(); await pg.wait_for_selector('.dose-ck[aria-pressed=true]', state='attached')   # D-119: przyjęta pora zwija się
    ok('przyjęte 1 / ' in await pg.inner_text('.sp-taken'), f'{tag} Suplementacja: odhaczenie dawki')
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    ok(await pg.locator('.slot-supps .dose-ck[aria-pressed=true]').count() == 1 and '1 / ' in await pg.inner_text('.dz-aside'), f'{tag} Dziś: dawka odhaczona w Suplementacji')
    ok((await pg.inner_text('main')).lower().count('chondroityn') == 2, f'{tag} Dziś: nazwy dawek bez dublowania (D-041)')
    v = await axe_audit(pg); ok(not v, f'{tag} Dziś: dostępność {v[:2]}')
    # Kalendarz: podgląd dnia
    await pg.goto(url + '#/kalendarz'); await pg.wait_for_selector('.kl-preview')
    ok('Dziś' in await pg.inner_text('.kl-preview') and await pg.locator('.kl-day.is-sel').count() == 1, f'{tag} Kalendarz: podgląd bieżącego dnia')
    # Nauka: postęp względem planu i mapa wykonania
    await pg.goto(url + '#/cfa?v=plan'); await pg.wait_for_selector('.cf-progress')
    ok(await pg.locator('.cf-progress .chart').count() == 1 and await pg.locator('.cf-progress .heat').count() == 1, f'{tag} CFA: wykres postępu i mapa wykonania')
    await pg.clock.set_system_time(at(2026, 11, 24, 10, 40)); await pg.goto(url + '#/dane'); await pg.goto(url + '#/cfa?v=dzien'); await pg.wait_for_selector('.cfa-dayhead')
    ok(await pg.locator('.cf-timer .timer').count() == 1, f'{tag} CFA: licznik 53 min przy następnym bloku (24.11, blok E — plan CFA 2027)')
    await pg.clock.set_system_time(at(2026, 12, 5, 10, 40)); await pg.goto(url + '#/dane'); await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
    if not mobile:
        await pg.keyboard.press('Control+k'); await pg.wait_for_selector('dialog.gs-dialog')
        ok(await pg.locator('.gs-cmd').count() >= 10, f'{tag} ⌘K: lista poleceń przy pustej frazie')
        await pg.keyboard.type('24.12'); await pg.wait_for_timeout(200); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate('location.hash') == '#/dzis?d=2026-12-24', f'{tag} ⌘K: data → przejście do dnia')
        ok(await pg.locator('.topbar .sync-chip').count() == 1 and await pg.locator('.topbar .tb-search').count() == 1, f'{tag} Pasek górny: wyszukiwanie i stan synchronizacji')
    ok(errs == [], f'{tag} brak błędów JS {errs[:2]}')
    await b.close()


async def run_d119(pw, name, url, mobile):
    """D-119 (Instrument+): przyciski odhaczenia (okrąg, znacznik SVG, animacja tylko przełączonego), Suplementacja (pierścień pór, „Przyjmij”,
    zwinięta pora, regularność), Nauka (szacunek tempa z dat odhaczeń, „Plan nadrabiania”, linia źródła), bez błędów i z dostępnością."""
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [D-119]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.clock.install(time=at(2026, 11, 24, 13, 0))
    await pg.goto(url + '#/suplementy'); await pg.wait_for_selector('.sp-hero')
    ok('13:20' in await pg.inner_text('.sp-hero') and await pg.locator('.sp-hero .rg').count() == 1, f'{tag} Suplementacja: przyrząd — następna pora 13:20 i pierścień pór')
    ck = pg.locator('.dose-ck').first
    ok(await ck.locator('.ck-svg').count() == 1 and await ck.evaluate("e => getComputedStyle(e).borderRadius") in ('999px', '50%'), f'{tag} przycisk odhaczenia: okrąg ze znacznikiem SVG')
    await pg.locator('.sp-take').click(); await wait_js(pg, "() => document.querySelector('#sp-1320 details.sp-fold')")
    ok(await pg.locator('#sp-1320 .dose-ck[aria-pressed="true"]').count() == 2 and 'przyjęte 2 / ' in await pg.inner_text('.sp-taken'),
       f'{tag} Suplementacja: „Przyjmij 13:20” — wszystkie dawki pory, pora zwinięta do jednej linii')
    ok(await pg.locator('.sp-reg .sp-reg-map li').count() >= 2, f'{tag} Suplementacja: regularność z odhaczeń')
    v = await axe_audit(pg); ok(not v, f'{tag} Suplementacja: dostępność {v[:2]}')
    await pg.locator('#sp-1320 .sp-fold summary').click()
    await pg.locator('#sp-1320 .dose-ck').first.click(); await wait_js(pg, "() => !document.querySelector('#sp-1320 details.sp-fold')")
    ok(await pg.locator('#sp-1320 .dose-ck[aria-pressed="true"]').count() == 1, f'{tag} Suplementacja: cofnięcie dawki z rozwiniętej pory')
    # Nauka: linia źródła i szacunek tempa z prawdziwych odhaczeń w kolejnych dniach (zegar), „Plan nadrabiania”
    await pg.goto(url + '#/cfa?v=dzien'); await pg.wait_for_selector('.cfa-dayhead')
    src = await pg.inner_text('.cfa-row.is-next .cfa-src')
    ok(src.startswith('Vol 1 · Quantitative Methods · s. ') and '.pdf' not in src and 'teraz' in (await pg.inner_text('.cf-kick')).lower(), f'{tag} CFA: „Teraz” i linia źródła bez nazwy pliku ({src})')
    await pg.goto(url + '#/mpw?v=plan'); await pg.wait_for_selector('.cf-tempo-p')
    ok('niedostępny' in await pg.inner_text('.cf-tempo-p'), f'{tag} MPW: bez odhaczeń — szacunek tempa niedostępny')
    for i in range(8):
        await pg.clock.set_system_time(at(2026, 11, 23 + i, 19, 0)); await pg.goto(url + '#/dane')   # D-121: od Dnia zero 23.11
        await pg.goto(url + f'#/mpw?v=dzien&d=2026-11-{23 + i}'); await pg.wait_for_selector('.cfa-dayhead')
        await pg.locator('.panel:not(.cf-backlog) .cfa-list .set-toggle[aria-pressed="false"]').first.click(); await pg.wait_for_timeout(250)
    await pg.goto(url + '#/dane'); await pg.goto(url + '#/mpw?v=plan'); await pg.wait_for_selector('.cf-tempo-p')
    t = await pg.inner_text('.cf-tempo-p')
    ok('Przy obecnym tempie koniec ok.' in t and 'po końcu planu' in t and 'szacunek' in t.lower(), f'{tag} MPW: szacunek tempa z 8 dni odhaczeń (1 blok dziennie — po końcu planu)')
    ok('Szacunek: koniec ok.' in await pg.inner_text('.hero-mpw'), f'{tag} MPW: szacunek w nagłówku modułu')
    v = await axe_audit(pg); ok(not v, f'{tag} MPW Plan: dostępność {v[:2]}')
    await pg.goto(url + '#/mpw?v=dzien'); await pg.wait_for_selector('.cf-backlog')
    await pg.locator('.cf-bl-open').click(); await pg.wait_for_selector('dialog[open] .cfa-row')
    n0 = await pg.locator('dialog[open] .cfa-row').count()
    await pg.locator('dialog[open] .set-toggle[aria-pressed="false"]').first.click()
    await wait_js(pg, "() => document.querySelectorAll('dialog[open] .set-toggle[aria-pressed=\"true\"]').length === 1")
    ok(n0 > 3, f'{tag} MPW: „Plan nadrabiania” — pełna lista zaległych ({n0}) i odhaczenie w arkuszu')
    v = await axe_audit(pg); ok(not v, f'{tag} MPW: arkusz nadrabiania — dostępność {v[:2]}')
    await pg.keyboard.press('Escape')
    # D-120: godziny nauki w planie dnia — 06.03 (symulacja 13:30–16:30, P6 17:00, siłownia 18:00, P7 22:00), dzień roboczy 2027 z „Pracą” i J o 22:00
    await pg.goto(url + '#/dzis?d=2027-03-06'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    ok('P6' in await pg.inner_text('#slot\\.1700\\.v120') and 'LOWER 2' in await pg.inner_text('#slot\\.1830\\.v120') and '08:00–22:53' in await pg.inner_text('.dz-mpw'),
       f'{tag} D-120: 06.03 — symulacja 13:30, P6 17:00, trening 18:30, P7 22:00 (karta MPW 08:00–22:53)')
    await pg.goto(url + '#/dzis?d=2027-01-05'); await pg.wait_for_selector('.dz-plan-h'); await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(d => d.open = true)")
    ok('Praca' in await pg.inner_text('#slot\\.0800') and 'CFA blok J' in await pg.inner_text('#slot\\.cfa\\.J\\.2200') and 'Kolacja' in await pg.inner_text('#slot\\.2100'),
       f'{tag} D-120: 05.01 — „Praca” 08:00, MPW C 21:00, CFA J 22:00, kolacja 20:50')
    await pg.goto(url + '#/mpw?v=kalendarz'); await pg.wait_for_selector('.cal-d')
    ok(await pg.locator('.cal-d small.cal-dots').count() > 50 and '0/3' not in await pg.inner_text('main'), f'{tag} Kalendarz: nasycenie i kropki zamiast „0/3”')
    ok(not errs, f'{tag} brak błędów JS ({errs[:2]})')
    await b.close()


async def run_d110(pw, name, url, mobile):
    """D-110 (System 2.0): „Teraz” z upływem czasu i odliczaniem, oś czasu planu dnia, kolejność kart, poświata w kolorze punktu,
    przewinięcie przy zmianie modułu i „Wstecz”, wejście ekranu, segmenty w jednym wierszu, pasek tytułu i arkusz przeciągany (telefon),
    zmiana motywu z odsłonięciem i poświata kursora (komputer), pierścień z gradientem, dostępność."""
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [D-110]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.clock.install(time=at(2026, 11, 30, 10, 40))   # D-121: poniedziałek w planie (slot 10:10 „Czas własny”)
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
    # „Teraz”: slot nauki 10:10–11:03 o 10:40 — 23 min do końca, linia osi czasu wypełniona w 30/53, poświata tła w kolorze CFA
    left = await pg.inner_text('.dz-now-left')
    el = await pg.evaluate("parseFloat(document.querySelector('.dz-plan .slot.is-now').style.getPropertyValue('--el'))")
    ok(left == 'zostało 23 min' and abs(el - 30 / 53) < 0.01 and await pg.evaluate("document.documentElement.dataset.domain") == 'cfa',
       f'{tag} Teraz: odliczanie ({left}), upływ punktu --el={el:.3f}, poświata „cfa”')
    order = await pg.evaluate("[...document.querySelector('.dz-grid').children].map(e => e.className.split(' ').find(c => c.startsWith('dz-')) || e.className)")
    ok(order[:2] == ['dz-now', 'dz-attn'], f'{tag} Dziś: „Teraz” przed „Wymaga uwagi” ({order[:3]})')
    inf = await pg.evaluate("document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations === Infinity).map(a => a.animationName || a.constructor.name)")
    ok(inf == [], f'{tag} D-112: bez animacji nieskończonych w „Dziś” (praca w każdej klatce przewijania) {inf}')
    kp = await pg.inner_text('.dz-kpis')
    units = await pg.eval_on_selector_all('.dz-kpi .unit', 'e => e.map(x => x.textContent.trim())')
    ok('kcal' in units and 'serii' in kp and 'bloków' in kp, f'{tag} Kafle KPI: jednostka pomniejszona ({units}), tekst bez zmian; nauka — bloki dnia (D-121)')
    # D-114 (M8): w „Teraz” tarcza dnia zamiast pierścienia postępu — upływ bieżącego punktu jako jasny łuk tarczy
    dl = await pg.evaluate("[document.querySelectorAll('.dz-now .ring').length, getComputedStyle(document.querySelector('.dz-now .dl-elapsed')).display !== 'none']")
    ok(dl == [0, True], f'{tag} „Teraz”: tarcza z upływem punktu zamiast pierścienia (D-114, M8) {dl}')
    await pg.evaluate("document.querySelector('main').dataset.mark = '1'")
    await pg.clock.fast_forward(65_000); await pg.wait_for_timeout(300)
    left2 = await pg.inner_text('.dz-now-left')
    ok(left2 == 'zostało 22 min' and await pg.evaluate("document.querySelector('main').dataset.mark") == '1', f'{tag} Teraz: odliczanie w miejscu ({left2}), bez przerysowania strony')
    v = await axe_audit(pg); ok(not v, f'{tag} Dziś (oś czasu): dostępność {v[:2]}')
    # Przewinięcie: nowy moduł od góry, „Wstecz” wraca do miejsca; wejście ekranu tylko przy zmianie trasy
    await pg.goto(url + '#/dieta'); await pg.wait_for_selector('.meal')
    await pg.evaluate('scrollTo(0, 1200)'); await pg.wait_for_timeout(300)
    y0 = await pg.evaluate('scrollY')
    await pg.locator(('.tabs' if mobile else '.side') + ' a[href="#/trening"]').click(); await pg.wait_for_selector('.ex'); await pg.wait_for_timeout(200)
    y1, enter = await pg.evaluate("[scrollY, document.querySelector('main').dataset.enter]")
    grad = await pg.evaluate("(() => { const fg = document.querySelector('.hero-tr .ring-fg'); const id = (fg.getAttribute('stroke') || '').match(/#([^)]+)/); return !!(id && document.getElementById(id[1])?.querySelectorAll('stop').length === 2); })()")
    ok(grad, f'{tag} Pierścień postępu (Trening): gradient w dokumencie (unikalny identyfikator)')
    await pg.go_back(); await pg.wait_for_selector('.meal'); await pg.wait_for_timeout(300)
    y2 = await pg.evaluate('scrollY')
    ok(y0 > 1000 and y1 == 0 and enter == 'module' and abs(y2 - y0) < 5, f'{tag} Przewinięcie: nowy moduł od góry ({y0} → {y1}), „Wstecz” wraca ({y2}); wejście „{enter}”')
    # pełne przerysowanie po zapisie (blok MPW w „Dziś” → ctx.rerender) — bez ponownej animacji wejścia
    await pg.goto(url + '#/dzis?d=2026-11-24'); await pg.wait_for_selector('.dz-mpw .set-toggle')
    e1 = await pg.evaluate("document.querySelector('main').dataset.enter")
    await pg.locator('.dz-mpw .set-toggle').first.click(); await pg.wait_for_selector('.dz-mpw .set-toggle[aria-pressed="true"]')
    e2 = await pg.evaluate("document.querySelector('main').dataset.enter")
    ok(e1 == 'module' and e2 is None, f'{tag} Wejście ekranu tylko przy zmianie trasy (nowy moduł: {e1}; po zapisie: {e2})')
    await pg.locator('.dz-mpw .set-toggle').first.click(); await pg.wait_for_selector('.dz-mpw .set-toggle[aria-pressed="false"]')
    # Segmenty nie łamią się w dwa wiersze (CFA „Widok” — 5 pozycji)
    await pg.goto(url + '#/cfa'); await pg.wait_for_selector('.cfa-row')
    h = await pg.evaluate("document.querySelector('.controls .seg').getBoundingClientRect().height")
    ok(h < 60, f'{tag} CFA: przełącznik „Widok” w jednym wierszu ({h:.0f} px)')
    if mobile:
        tb = await pg.evaluate("(() => { const r = document.querySelector('.tabs').getBoundingClientRect(); return [r.left, r.right, r.bottom, innerWidth, innerHeight]; })()")
        ok(tb[0] >= 12 and tb[3] - tb[1] >= 12 and tb[4] - tb[2] >= 8, f'{tag} Pasek dolny pływa nad krawędzią ({tb})')
        await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
        top = await pg.evaluate("document.getElementById('app').classList.contains('is-scrolled')")
        await pg.evaluate('scrollTo(0, 700)'); await pg.wait_for_timeout(400)
        bar = await pg.evaluate("[document.getElementById('app').classList.contains('is-scrolled'), document.querySelector('.appbar-t').textContent, getComputedStyle(document.querySelector('.appbar')).visibility]")
        ok(top is False and bar == [True, 'Dziś', 'visible'], f'{tag} Pasek tytułu po przewinięciu ({bar})')
        await pg.goto(url + '#/trening?d=2026-11-30'); await pg.wait_for_selector('.ex-tech')
        await pg.locator('.ex-tech').first.click(); await pg.wait_for_selector('dialog.sheet[open]'); await pg.wait_for_timeout(500)
        box = await pg.locator('dialog.sheet .sheet-head h2').bounding_box()
        x, y = box['x'] + 10, box['y'] + 5
        cdp = await ctx.new_cdp_session(pg)
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
        for i in range(1, 6):
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y + i * 12}]}); await pg.wait_for_timeout(30)
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); await pg.wait_for_timeout(500)
        ok(await pg.locator('dialog.sheet[open]').count() == 1, f'{tag} Arkusz: krótkie przeciągnięcie — wraca na miejsce')
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
        for i in range(1, 11):
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y + i * 30}]}); await pg.wait_for_timeout(16)
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); await pg.wait_for_timeout(600)
        await cdp.detach()
        ok(await pg.locator('dialog.sheet[open]').count() == 0, f'{tag} Arkusz: przeciągnięcie w dół zamyka okno')
        # D-112 (iPhone): przeciąganie za treść arkusza przewiniętą do góry zamyka okno; ruch w górę za treść — zwykłe przewijanie, okno zostaje
        await pg.locator('.ex-tech').first.click(); await pg.wait_for_selector('dialog.sheet[open]'); await pg.wait_for_timeout(500)
        pt = await pg.evaluate("""(() => { const d = document.querySelector('dialog.sheet[open]'); d.scrollTop = 0;
          const el = [...d.querySelectorAll('.sheet-body p, .sheet-body li, .sheet-body h3')].find(e => e.offsetParent && !e.closest('button, a, input, .seg'));
          const r = el.getBoundingClientRect(); return [r.left + 12, r.top + Math.min(10, r.height / 2)]; })()""")
        cdp = await ctx.new_cdp_session(pg)
        async def drag(x, y, step, n):
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
            for i in range(1, n + 1):
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y + i * step}]}); await pg.wait_for_timeout(16)
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); await pg.wait_for_timeout(600)
        await drag(pt[0], pt[1], -20, 6)
        ok(await pg.locator('dialog.sheet[open]').count() == 1, f'{tag} D-112: ruch w górę za treść arkusza — okno zostaje')
        await pg.evaluate("document.querySelector('dialog.sheet[open]').scrollTop = 0")
        await drag(pt[0], pt[1], 30, 10)
        ok(await pg.locator('dialog.sheet[open]').count() == 0, f'{tag} D-112: przeciągnięcie w dół za treść (arkusz u góry) zamyka okno')
        await cdp.detach()
        # D-112: ponowne dotknięcie zakładki bieżącego modułu przewija na górę (bez przerysowania); przywracanie przewinięcia — ręczne
        await pg.goto(url + '#/trening'); await pg.wait_for_selector('.ex')
        await pg.evaluate("scrollTo(0, 900); document.querySelector('main').dataset.mark = 't'"); await pg.wait_for_timeout(200)
        await pg.locator('.tabs a[href="#/trening"]').click(); await pg.wait_for_timeout(1200)
        st = await pg.evaluate("[scrollY, document.querySelector('main').dataset.mark, location.hash, history.scrollRestoration]")
        ok(st == [0, 't', '#/trening', 'manual'], f'{tag} D-112: zakładka bieżącego modułu — na górę, bez przerysowania ({st})')
    else:
        await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-card')
        await pg.locator('.dz-card').first.hover(position={'x': 40, 'y': 30}); await pg.wait_for_timeout(200)
        mx = await pg.evaluate("parseFloat(document.querySelector('.dz-card').style.getPropertyValue('--mx'))")
        ok(mx == mx and abs(mx - 40) <= 2, f'{tag} Poświata kursora na karcie (--mx = {mx})')
        await pg.get_by_role('button', name='Motyw: Jasny').click()
        ok(await pg.evaluate("localStorage.getItem('p2027.theme')") == 'light', f'{tag} Motyw: wybór zapisany od razu')
        await wait_js(pg, "() => document.documentElement.getAttribute('data-theme') === 'light' && !document.documentElement.classList.contains('vt-theme')", timeout=5000)
        # D-114: kolory w OKLCH — porównanie po przeliczeniu na sRGB (piksel na płótnie), nie tekstu stylu obliczonego
        bg = await pg.evaluate("(() => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = getComputedStyle(document.body).backgroundColor; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3).join(','); })()")
        ok(bg == '245,247,250', f'{tag} Motyw jasny po odsłonięciu (tło #f5f7fa: {bg})')
        v = await axe_audit(pg); ok(not v, f'{tag} Dziś jasny: dostępność {v[:2]}')
        await pg.get_by_role('button', name='Motyw: Ciemny').click()
        await wait_js(pg, "() => document.documentElement.getAttribute('data-theme') === 'dark' && !document.documentElement.classList.contains('vt-theme')", timeout=5000)
    ok(not errs, f'{tag} brak błędów konsoli ({errs[:2]})')
    await ctx.close(); await b.close()

async def touch_swipe(pg, loc, dx, steps=12):
    """Przesunięcie palcem (zdarzenia dotyku przez CDP — Playwright nie ma gestu przesunięcia); start w ~1/3 szerokości wiersza (poza polem
    wyboru i przyciskiem na początku wiersza — gest zaczęty na polu jest pomijany)."""
    box = await loc.bounding_box()
    x, y = box['x'] + min(110, box['width'] / 3), box['y'] + box['height'] / 2
    cdp = await pg.context.new_cdp_session(pg)
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
    for i in range(1, steps + 1):
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + dx * i / steps, 'y': y}]})
        await asyncio.sleep(0.016)
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    await cdp.detach()

D114_SMALL = "[...document.querySelectorAll('main button, main a')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(r => r.height < 43.5 || r.width < 43.5).length"
D114_SAVED = """(async () => { const db = await new Promise((res, rej) => { const r = indexedDB.open('p2027'); r.onsuccess = () => res(r.result); r.onerror = rej; });
  const all = await new Promise(res => { const r = db.transaction('events').objectStore('events').getAll(); r.onsuccess = () => res(r.result); });
  return all.filter(e => e.t === 'train.set' && e.d.date === '2026-12-09').map(e => [e.d.set, e.d.reps, e.d.done]); })()"""
D114_OVERLAP = """[...document.querySelectorAll('.sf-facts')].flatMap(dl => { const r = [...dl.querySelectorAll('dt')].map(d => d.getBoundingClientRect());
  return r.flatMap((a, i) => r.slice(i + 1).filter(b => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1)); }).length
  + [...document.querySelectorAll('.sf-facts dt')].filter(d => d.scrollWidth > d.clientWidth + 1).length"""
D114_BG = """(() => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = getComputedStyle(document.body).backgroundColor; x.fillRect(0, 0, 1, 1);
  return [document.documentElement.hasAttribute('data-oled'), [...x.getImageData(0, 0, 1, 1).data].slice(0, 3).join(','), document.querySelector('meta[name=theme-color]').content, localStorage.getItem('p2027.oled')]; })()"""

async def run_d114(pw, name, url, mobile):
    """D-114 (System 4.0 „Instrument”): warstwy kaskady, tarcza dnia (dotyk, klawiatura, upływ czasu, inny dzień), pigułka „na żywo”
    (punkt planu, przerwa w innym module, +30 s, zakończenie, tytuł karty), gest przesunięcia dawki, tryb skupienia Treningu
    (te same zapisy serii, przerwa, wyjście), głęboka czerń (OLED), dźwięki interfejsu, M1–M4, dostępność, bez animacji nieskończonych."""
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [D-114]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.clock.install(time=at(2026, 12, 9, 10, 40))
    # Arkusz stylów: dwie warstwy kaskady (legacy → instrument)
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
    layers = await pg.evaluate("[...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).filter(r => r.constructor.name === 'CSSLayerStatementRule').map(r => r.nameList.join(','))")
    ok('legacy,instrument' in layers, f'{tag} Style: warstwy kaskady legacy → instrument ({layers})')
    # --- Tarcza dnia: 34 punkty planu, 6 minionych, bieżący „Czas własny” 10:10–11:03, w środku godzina i numer punktu
    dial = await pg.evaluate("""(() => { const k = document.querySelector('.dz-now [role=slider]'); return { n: document.querySelectorAll('.dz-now .dl-arc').length,
      past: document.querySelectorAll('.dz-now .dl-arc.is-past').length, now: document.querySelectorAll('.dz-now .dl-arc.is-now').length,
      vt: k?.getAttribute('aria-valuetext'), v: document.querySelector('.dz-now .dl-v')?.textContent, s: document.querySelector('.dz-now .dl-s')?.textContent,
      hand: getComputedStyle(document.querySelector('.dz-now .dl-hand')).display }; })()""")
    ok(dial['n'] == 34 and dial['past'] == 6 and dial['now'] == 1 and dial['vt'] == '10:10–11:03: Czas własny (teraz)' and dial['v'] == '10:40' and dial['s'] == 'punkt 7 z 34' and dial['hand'] != 'none',
       f'{tag} Tarcza: 34 łuki, 6 minionych, bieżący punkt, godzina w środku ({dial})')
    # klawiatura: → następny punkt (podgląd w środku), Enter — punkt w planie, Esc — powrót do „teraz”
    await pg.locator('.dz-now [role=slider]').focus(); await pg.keyboard.press('ArrowRight')
    vt = await pg.get_attribute('.dz-now [role=slider]', 'aria-valuetext')
    pick = await pg.evaluate("[document.querySelector('.dz-now .dl-t').textContent, document.querySelector('.dz-now .dl').classList.contains('is-pick'), document.querySelectorAll('.dz-now .dl-arc.is-pick').length]")
    ok(vt == '11:03–11:20: Przerwa żywieniowa' and pick == ['Przerwa żywieniowa', True, 1], f'{tag} Tarcza: klawisz → — podgląd następnego punktu ({vt}, {pick})')
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(700)
    inview = await pg.evaluate("(() => { const r = document.getElementById('slot.1103').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()")
    ok(inview, f'{tag} Tarcza: Enter — punkt widoczny w planie dnia')
    await pg.locator('.dz-now [role=slider]').focus(); await pg.keyboard.press('Escape')
    ok(await pg.get_attribute('.dz-now [role=slider]', 'aria-valuetext') == '10:10–11:03: Czas własny (teraz)' and await pg.locator('.dz-now .dl-arc.is-pick').count() == 0, f'{tag} Tarcza: Esc — powrót do „teraz”')
    if mobile:
        # dotknięcie pierścienia o 18:45 (trening 18:15–19:35) — podgląd tego punktu
        await pg.evaluate('scrollTo(0, 0)'); await pg.wait_for_timeout(200)
        box = await pg.locator('.dz-now .dl-face-w').bounding_box()
        ang = math.radians(90 + (18 * 60 + 45) / 1440 * 360); sc = box['width'] / 300
        await pg.touchscreen.tap(box['x'] + (150 + 124 * math.cos(ang)) * sc, box['y'] + (150 + 124 * math.sin(ang)) * sc); await pg.wait_for_timeout(150)
        vt = await pg.get_attribute('.dz-now [role=slider]', 'aria-valuetext')
        ok(vt == '18:15–19:35: Rower 55 min + ABS', f'{tag} Tarcza: dotknięcie łuku 18:45 — podgląd punktu ({vt})')
        await pg.locator('.dz-now [role=slider]').focus(); await pg.keyboard.press('Escape')
    # upływ czasu: godzina w środku tarczy i wskazówka w miejscu (bez przerysowania strony)
    await pg.evaluate("document.querySelector('main').dataset.mark = '1'")
    rot0 = await pg.get_attribute('.dz-now .dl-hand', 'transform')
    await pg.clock.fast_forward(65_000); await pg.wait_for_timeout(300)
    rot1 = await pg.get_attribute('.dz-now .dl-hand', 'transform')
    ok(await pg.inner_text('.dz-now .dl-v') == '10:41' and rot0 != rot1 and await pg.evaluate("document.querySelector('main').dataset.mark") == '1',
       f'{tag} Tarcza: upływ czasu w miejscu ({rot0} → {rot1})')
    inf = await pg.evaluate("document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations === Infinity).length")
    ok(inf == 0, f'{tag} Tarcza: bez animacji nieskończonych (D-112)')
    v = await axe_audit(pg); ok(not v, f'{tag} Dziś z tarczą: dostępność {v[:2]}')
    # inny dzień: tarcza jako podgląd planu (bez karty „Teraz” i bez wskazówki)
    await pg.goto(url + '#/dzis?d=2026-12-07'); await pg.wait_for_selector('.dz-dayface .dl')
    other = await pg.evaluate("[document.querySelectorAll('.nowcard').length, getComputedStyle(document.querySelector('.dz-dayface .dl-hand')).display, document.querySelector('.dz-dayface .dl-v').textContent, document.querySelector('.dz-dayface .dl-s').textContent]")
    ok(other == [0, 'none', '34 punkty', '07:00–23:00'], f'{tag} Tarcza innego dnia: podgląd planu bez wskazówki ({other})')
    sw, w = await pg.evaluate('[document.documentElement.scrollWidth, innerWidth]')
    ok(sw <= w, f'{tag} Inny dzień: bez przewijania w poziomie ({sw}/{w})')
    # --- Pigułka „na żywo”: punkt planu poza „Dziś”, ukryta w „Dziś”
    await pg.goto(url + '#/dieta'); await pg.wait_for_selector('.meal')
    lv = await pg.evaluate("[document.getElementById('live').hidden, document.querySelector('#live .lv-l')?.textContent, document.querySelector('#live .lv-v')?.textContent, document.documentElement.hasAttribute('data-live')]")
    want = await pg.evaluate("`${663 - new Date().getHours() * 60 - new Date().getMinutes()} min`")   # do 11:03 od bieżącej godziny zegara testu
    ok(lv == [False, 'Czas własny', want, True], f'{tag} Pigułka: bieżący punkt planu w innym module ({lv})')
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
    ok(await pg.evaluate("document.getElementById('live').hidden") is True, f'{tag} Pigułka: ukryta w „Dziś” (punkt planu na tarczy)')
    # przerwa: odhaczenie serii w Treningu (dziś) → pigułka w innym module, +30 s, zakończenie; tytuł karty z odliczaniem
    await pg.goto(url + '#/trening?d=2026-12-09'); await pg.wait_for_selector('.ex')
    await pg.locator('.set:not(.set-h) .set-toggle').first.click(); await pg.wait_for_selector('.tr-rest')
    ok(await pg.evaluate("document.getElementById('live').hidden") is True, f'{tag} Pigułka: ukryta w Treningu (pasek przerwy)')
    await pg.goto(url + '#/dieta'); await pg.wait_for_selector('.meal')
    t1 = await pg.inner_text('#live .lv-v')
    ok(await pg.inner_text('#live .lv-l') == 'Przerwa' and rest_left(t1) > 50 and t1 in await pg.title(), f'{tag} Pigułka: przerwa w innym module ({t1}, tytuł: {await pg.title()})')
    await pg.get_by_role('button', name='Wydłuż przerwę o 30 s').click(); await pg.wait_for_timeout(150)
    t2 = await pg.inner_text('#live .lv-v')
    ok(rest_left(t2) - rest_left(t1) >= 28, f'{tag} Pigułka: +30 s ({t1} → {t2})')
    v = await axe_audit(pg); ok(not v, f'{tag} Pigułka (przerwa): dostępność {v[:2]}')
    await pg.get_by_role('button', name='Zakończ przerwę').click(); await pg.wait_for_timeout(150)
    ok(await pg.inner_text('#live .lv-l') == 'Czas własny' and 'Przerwa' not in await pg.title(), f'{tag} Pigułka: zakończona przerwa — znów punkt planu')
    await pg.goto(url + '#/trening?d=2026-12-09'); await pg.wait_for_selector('.ex')
    await pg.locator('.set:not(.set-h) .set-toggle').first.click(); await pg.wait_for_selector('.set-toggle[aria-pressed="true"]', state='detached')   # cofnięcie serii — czysty stan
    # --- Gest: przesunięcie wiersza dawki w prawo = przyjęte, w lewo = cofnięcie (telefon)
    if mobile:
        await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-plan-h')
        row = pg.locator('.dz-plan > .day .slot-supps li').first
        await row.scroll_into_view_if_needed(); await pg.wait_for_timeout(200)
        n0 = await pg.locator('.dose-ck[aria-pressed="true"]').count()
        await touch_swipe(pg, row, 220); await wait_js(pg, "n => document.querySelectorAll('.dose-ck[aria-pressed=\"true\"]').length > n", n0)
        n1 = await pg.locator('.dose-ck[aria-pressed="true"]').count()
        row = pg.locator('.dz-plan > .day .slot-supps li').first
        await row.scroll_into_view_if_needed(); await pg.wait_for_timeout(200)
        await touch_swipe(pg, row, -220); await wait_js(pg, "n => document.querySelectorAll('.dose-ck[aria-pressed=\"true\"]').length < n", n1)
        n2 = await pg.locator('.dose-ck[aria-pressed="true"]').count()
        await pg.wait_for_timeout(400)
        ok(n1 == n0 + 1 and n2 == n0 and await pg.locator('.gx-act').count() == 0, f'{tag} Gest: dawka przesunięciem w prawo przyjęta, w lewo cofnięta ({n0} → {n1} → {n2})')
        # ruch pionowy na wierszu to przewijanie, nie odhaczenie
        row = pg.locator('.dz-plan > .day .slot-supps li').first
        box = await row.bounding_box(); cdp = await pg.context.new_cdp_session(pg)
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': box['x'] + 60, 'y': box['y'] + 10}]})
        for i in range(1, 8): await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': box['x'] + 64, 'y': box['y'] + 10 - i * 25}]})
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); await cdp.detach(); await pg.wait_for_timeout(300)
        ok(await pg.locator('.dose-ck[aria-pressed="true"]').count() == n0, f'{tag} Gest: ruch pionowy to przewijanie, nie odhaczenie')
    # --- Tryb skupienia (Trening 09.12 — Rower + ABS: 4 ćwiczenia × 2 serie)
    await pg.goto(url + '#/trening?d=2026-12-09'); await pg.wait_for_selector('.tr-focus')
    await pg.locator('.tr-focus').click(); await pg.wait_for_selector('.fx-set')
    fx = await pg.evaluate("""[document.documentElement.hasAttribute('data-focus'), [...document.querySelectorAll('.side, .tabs, .topbar')].every(e => getComputedStyle(e).display === 'none'),
      document.querySelector('main h1').textContent, document.querySelector('.fx-set h3').textContent, document.querySelectorAll('.fx-sc').length, document.getElementById('live').hidden]""")
    ok(fx == [True, True, 'Rower + ABS + sauna', 'Seria 1 z 2', 8, True], f'{tag} Tryb skupienia: pełny ekran, seria 1 z 2, podziałka 8 serii ({fx})')
    v = await axe_audit(pg); ok(not v, f'{tag} Tryb skupienia: dostępność {v[:2]}')
    small = await pg.evaluate(D114_SMALL)
    ok(small == 0, f'{tag} Tryb skupienia: cele dotykowe ≥ 44 px ({small} mniejszych)')
    # kroki ± (zapis po chwili, jedno zdarzenie), „Seria wykonana” → przerwa i następna seria
    plus = pg.get_by_role('button', name='Powtórzenia: więcej')
    for _ in range(3): await plus.click()
    reps = await pg.input_value('.fx-num:nth-child(2) .fx-in')
    await pg.wait_for_timeout(1300)
    saved = await pg.evaluate(D114_SAVED)
    ok(reps == '3' and [x for x in saved if x[1] is not None] == [[1, 3, False]], f'{tag} Tryb skupienia: kroki ± — jeden zapis po chwili ({reps}, {saved})')
    await pg.get_by_role('button', name='Seria wykonana').click(); await pg.wait_for_selector('.fx-rest')
    fx2 = await pg.evaluate("[document.querySelector('.fx-set h3').textContent, document.querySelectorAll('.fx-sc.is-done').length, document.querySelector('.fx-rest-t').textContent]")
    ok(fx2 == ['Seria 2 z 2', 1, '1:00'], f'{tag} Tryb skupienia: seria wykonana → przerwa 1:00 i seria 2 ({fx2})')
    await pg.get_by_role('button', name='Pomiń przerwę').click(); await pg.wait_for_timeout(150)
    ok(await pg.locator('.fx-rest').count() == 0, f'{tag} Tryb skupienia: przerwa pominięta')
    # wyjście: ✕ (telefon) albo Esc (komputer) → widok sesji z tą samą serią odhaczoną, bez trybu pełnoekranowego
    if mobile: await pg.get_by_role('link', name='Zakończ tryb skupienia').click()
    else: await pg.keyboard.press('Escape')
    await pg.wait_for_selector('.ex')
    ex = await pg.evaluate("[document.documentElement.hasAttribute('data-focus'), document.querySelectorAll('.set-toggle[aria-pressed=\"true\"]').length, document.querySelector('.ex .set:not(.set-h) input[placeholder=\"powt.\"]').value]")
    ok(ex == [False, 1, '3'], f'{tag} Tryb skupienia: wyjście — ta sama seria w widoku sesji (te same zapisy) ({ex})')
    # --- Ustawienia: głęboka czerń (OLED) i dźwięki interfejsu
    await pg.goto(url + '#/ustawienia'); await pg.wait_for_selector('.set-sec')
    await pg.get_by_role('group', name='Głęboka czerń').get_by_role('button', name='Włączona').click(); await pg.wait_for_timeout(200)
    oled = await pg.evaluate(D114_BG)
    ok(oled == [True, '0,0,0', '#000000', '1'], f'{tag} Ustawienia: głęboka czerń — tło czarne, pasek przeglądarki czarny ({oled})')
    await pg.reload(); await pg.wait_for_selector('.set-sec')
    ok(await pg.evaluate("document.documentElement.hasAttribute('data-oled')"), f'{tag} Ustawienia: głęboka czerń od startu (przed pierwszym renderem)')
    v = await axe_audit(pg); ok(not v, f'{tag} Ustawienia (OLED): dostępność {v[:2]}')
    await pg.get_by_role('group', name='Głęboka czerń').get_by_role('button', name='Wyłączona').click()
    await pg.get_by_role('group', name='Dźwięki interfejsu').get_by_role('button', name='Włączone').click(); await pg.wait_for_timeout(150)
    ok(await pg.evaluate("[document.documentElement.hasAttribute('data-oled'), localStorage.getItem('p2027.sfx')]") == [False, 'on'], f'{tag} Ustawienia: OLED wyłączony, dźwięki interfejsu włączone')
    # --- M1–M4
    await pg.goto(url + '#/bezpieczenstwo'); await pg.wait_for_selector('.sf-facts')
    over = await pg.evaluate(D114_OVERLAP)
    ok(over == 0, f'{tag} M1: Bezpieczeństwo — etykiety faktów bez nachodzenia ({over})')
    await pg.goto(url + '#/trening?v=stat'); await pg.wait_for_selector('main h1')
    st = await pg.evaluate("[document.querySelector('main h1').textContent, /\\b(17|24|31)\\.08|\\b(07|14|21|28)\\.09|\\b05\\.10/.test(document.querySelector('main').innerText)]")
    ok(st == ['Statystyki treningów', False], f'{tag} M2/M3: Statystyki z nagłówkiem, bez tygodni sprzed startu treningów ({st})')
    await pg.goto(url + '#/trening?v=historia'); await pg.wait_for_selector('main h1')
    ok(await pg.inner_text('main h1') == 'Historia treningów', f'{tag} M2: Historia z nagłówkiem')
    emo = re.compile('[\U0001F300-\U0001FAFF☀-➿]')
    await pg.goto(url + '#/trening?d=2026-12-07'); await pg.wait_for_selector('.ex')
    t = await pg.evaluate("[...document.querySelectorAll('.hero-tr .chip-b, .meal-n, .opt-note')].map(e => e.textContent).join(' | ')")
    ok(not emo.search(t) and 'System kolana' in t, f'{tag} M4: Trening — ikony zamiast emoji ({t[:80]})')
    await pg.goto(url + '#/rekompozycja'); await pg.wait_for_selector('.rk-sec')
    ok(not emo.search(await pg.inner_text('main')), f'{tag} M4: Rekompozycja — kłódka i ramki jako ikony')
    ok(not errs, f'{tag} brak błędów JS {errs[:3]}')
    await b.close()


async def run_d115(pw, name, url, mobile):
    """D-115 (fundament jakości): CSP z Trusted Types i service worker (web), dziennik błędów w „Dane” (zapis, trwałość po przeładowaniu,
    czyszczenie), błędy znalezione linterem i kontrolą typów: podgląd paragonu bez „false”, etykieta kategorii „Inne”."""
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [D-115]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.clock.install(time=at(2026, 12, 9, 10, 40))
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('main h1')
    if url.startswith('http'):
        csp = await pg.evaluate("document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]')?.content || ''")
        ok("require-trusted-types-for 'script'" in csp and 'trusted-types p2027' in csp, f'{tag} CSP: Trusted Types')
        await pg.wait_for_timeout(500)
        ok(await pg.evaluate("navigator.serviceWorker.getRegistration().then(r => !!r)"), f'{tag} Trusted Types: service worker zarejestrowany przez politykę p2027')
    # Dziennik błędów: wyjątek i odrzucona obietnica → „Dane”; trwałość po przeładowaniu; „Wyczyść”
    await pg.goto(url + '#/dane'); await pg.wait_for_selector('.dn-err')
    ok('Brak zarejestrowanych błędów' in await pg.inner_text('.dn-err'), f'{tag} Dziennik błędów: pusty na starcie')
    # queueMicrotask, nie setTimeout: zegar testu (clock.install) przechwytuje wyjątki z własnych minutników
    await pg.evaluate("(() => { queueMicrotask(() => { throw new Error('test-D115-wyjątek') }); Promise.reject(new Error('test-D115-obietnica')); })()")
    await pg.wait_for_timeout(800)
    await pg.reload(); await pg.wait_for_selector('.dn-err')
    t = await pg.inner_text('.dn-err')
    ok('test-D115-wyjątek' in t and 'test-D115-obietnica' in t, f'{tag} Dziennik błędów: oba wpisy po przeładowaniu')
    v = await axe_audit(pg); ok(not v, f'{tag} Dane z dziennikiem błędów: dostępność {v[:2]}')
    await pg.locator('.dn-err').get_by_role('button', name='Wyczyść').click()
    await wait_js(pg, "() => document.querySelector('.dn-err')?.textContent.includes('Brak zarejestrowanych błędów')")
    await pg.reload(); await pg.wait_for_selector('.dn-err')
    ok('Brak zarejestrowanych błędów' in await pg.inner_text('.dn-err'), f'{tag} Dziennik błędów: wyczyszczony trwale')
    errs[:] = [e for e in errs if 'test-D115' not in e]
    # Paragon: pozycje rozpoznane bez pominiętych — w podglądzie nie może pojawić się „false” (append(cond && x) → add())
    await pg.goto(url + '#/zapasy'); await pg.wait_for_selector('.inv')
    await pg.get_by_role('button', name='Paragon').click(); await pg.wait_for_selector('dialog[open] textarea')
    await pg.fill('dialog[open] textarea', 'banan 1,2 kg'); await pg.locator('dialog[open]').get_by_role('button', name='Sprawdź').click()
    await pg.wait_for_selector('dialog[open] .rc-list')
    pv = await pg.inner_text('dialog[open] .rc-preview')
    ok('false' not in pv.split(), f'{tag} Paragon: podgląd bez „false” ({pv[:60]!r})')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    # Kategoria „Inne” w oknie nowej pozycji ma etykietę (wcześniej pusta opcja)
    await pg.get_by_role('button', name='Dodaj').first.click(); await pg.wait_for_selector('dialog[open] select')
    opts = await pg.evaluate("[...document.querySelectorAll('dialog[open] select option')].map(o => [o.value, o.textContent])")
    inne = [o for o in opts if o[0] == 'Inne']
    ok(inne and inne[0][1] == 'Inne', f'{tag} Nowa pozycja: kategoria „Inne” z etykietą ({inne})')
    await pg.keyboard.press('Escape')
    # T2 — stan interfejsu po kluczach: zapis wyniku testu kalibracyjnego (Meal Prep) przerysowuje widok; rozwinięta sekcja zostaje
    # rozwinięta, a „Dlaczego tak” (zwinięta) — zwinięta
    await pg.goto(url + '#/wiecej'); await pg.goto(url + '#/mealprep'); await pg.wait_for_selector('details.fold')
    sec = pg.locator('details.fold', has=pg.locator('summary h2', has_text='Testy kalibracyjne'))
    await sec.locator('summary').click(); await sec.get_by_role('button', name='Zdany').first.click()
    await wait_js(pg, "() => document.querySelector('#toast')?.textContent.includes('Zapisano wynik testu')")
    st = await pg.evaluate("""[...document.querySelectorAll('details.fold')].map(d => [d.querySelector('summary h2').textContent, d.open])""")
    ok(dict(st).get('Testy kalibracyjne') is True and dict(st).get('Dlaczego tak') is False, f'{tag} T2: sekcja rozwinięta po przerysowaniu ({st})')
    ok(not errs, f'{tag} brak błędów JS {errs[:3]}')
    await b.close()

async def run_d114b(pw, name, url, mobile):
    """D-114 etap 2: anatomia stron (nagłówek bez karty, pasek zakładek widoku), tryby skupienia Nauki (MPW) i gotowania (Meal Prep),
    gesty na listach odhaczanych, odczyt wartości na wykresie, własny pasek dolny, karty „Dziś”, Dane w dwóch kolumnach (komputer), dostępność."""
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}
    tag = f'{name} {vp["width"]}px [D-114/2]'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='pl-PL', timezone_id='Europe/Warsaw')
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.clock.install(time=at(2026, 12, 9, 10, 40))
    # --- Anatomia: nagłówek-bohater bez karty, przełącznik widoków jako pasek zakładek (etykieta tylko dla czytników ekranu)
    await pg.goto(url + '#/mpw'); await pg.wait_for_selector('.hero-tr h1')
    an = await pg.evaluate("""[getComputedStyle(document.querySelector('.hero-tr')).backgroundColor, document.querySelector('.seg-wrap.is-view .seg-label').getBoundingClientRect().width,
      document.querySelector('.seg-wrap.is-view [role=group]').getAttribute('aria-label')]""")
    ok(an[0] in ('rgba(0, 0, 0, 0)', 'transparent') and an[1] <= 1 and an[2] == 'Widok', f'{tag} Anatomia: nagłówek bez karty, zakładki widoku ({an})')
    for r in ('#/trening?v=stat', '#/bezpieczenstwo', '#/pielegnacja'):
        await pg.goto(url + '#/wiecej'); await pg.goto(url + r); await pg.wait_for_selector('main h1')
        ok(await pg.locator('.seg-wrap.is-view').count() == 1, f'{tag} Anatomia: pasek zakładek widoku w {r}')
    # --- Tryb skupienia Nauki (MPW 24.11: bloki A–C 15:30–18:23; D-116 — plan MPW od 20.11)
    await pg.clock.set_system_time(at(2026, 11, 24, 10, 40))
    await pg.goto(url + '#/mpw?v=dzien&d=2026-11-24'); await pg.wait_for_selector('.cfa-row')
    n0 = await pg.locator('.cfa-row .set-toggle[aria-pressed="true"]').count()
    await pg.goto(url + '#/mpw?v=fokus&d=2026-11-24'); await pg.wait_for_selector('.fx-set')
    fx = await pg.evaluate("[document.documentElement.hasAttribute('data-focus'), document.querySelector('main h1').textContent, document.querySelector('.fx-set h3').textContent, document.querySelectorAll('.fx-sc').length]")
    ok(fx[0] and fx[1] == 'Nauka MPW' and fx[2].startswith('Blok A · 15:30') and fx[3] == 3, f'{tag} Nauka: tryb skupienia — blok A, podziałka 3 bloków ({fx})')
    v = await axe_audit(pg); ok(not v, f'{tag} Nauka (skupienie): dostępność {v[:2]}')
    await pg.get_by_role('button', name=re.compile('^Start minutnika 53 min')).click(); await pg.wait_for_timeout(200)
    ok(await pg.inner_text('.fx-timer .fx-rest-t') == '53:00' or await pg.inner_text('.fx-timer .fx-rest-n') == 'Trwa', f'{tag} Nauka: minutnik 53 min uruchomiony')
    await pg.get_by_role('button', name='Blok wykonany').click(); await wait_js(pg, "() => document.querySelector('.fx-set h3')?.textContent.startsWith('Blok B')")
    ok(await pg.locator('.fx-sc.is-done').count() == 1, f'{tag} Nauka: blok wykonany → następny blok')
    if mobile: await pg.get_by_role('link', name='Zakończ tryb skupienia').click()
    else: await pg.keyboard.press('Escape')
    await pg.wait_for_selector('.cfa-row')
    n1 = await pg.locator('.cfa-row .set-toggle[aria-pressed="true"]').count()
    lv = await pg.evaluate("[document.getElementById('live').hidden, document.querySelector('#live .lv-l')?.textContent || '']")
    ok(n1 == n0 + 1 and not await pg.evaluate("document.documentElement.hasAttribute('data-focus')"), f'{tag} Nauka: wyjście — blok odhaczony w widoku dnia ({n0} → {n1})')
    ok(lv[0] is False and lv[1].startswith('Blok A'), f'{tag} Nauka: minutnik bloku w pigułce „na żywo” po wyjściu ({lv})')
    await pg.get_by_role('button', name=re.compile('^Zatrzymaj minutnik')).click(); await pg.wait_for_timeout(150)
    # --- Tryb gotowania (Meal Prep)
    await pg.goto(url + '#/mealprep'); await pg.wait_for_selector('.mp-focus')
    c0 = await pg.locator('.prep-list input:checked').count()
    await pg.locator('.mp-focus').click(); await pg.wait_for_selector('.fx-set')
    st = await pg.inner_text('.fx-set h3')
    await pg.get_by_role('button', name='Krok wykonany').click(); await wait_js(pg, "() => document.querySelector('.fx-set h3')?.textContent.startsWith('Krok 2 ')")
    ok(st.startswith('Krok 1 z ') and await pg.locator('.fx-sc.is-done').count() == 1, f'{tag} Gotowanie: krok wykonany → następny ({st})')
    v = await axe_audit(pg); ok(not v, f'{tag} Gotowanie: dostępność {v[:2]}')
    await pg.goto(url + '#/mealprep'); await pg.wait_for_selector('.prep-list')
    ok(await pg.locator('.prep-list input:checked').count() == c0 + 1, f'{tag} Gotowanie: ten sam zapis kroku w Meal Prep')
    # --- Gesty na listach (telefon): Suplementacja, Meal Prep, bloki MPW
    if mobile:
        for route, row, on in (('#/suplementy', '.dose-list li', '.dose-ck[aria-pressed="true"]'), ('#/mealprep', '.prep-list li:has(input:not(:checked))', '.prep-list input:checked'),
                               ('#/mpw?v=dzien&d=2026-11-24', '.cfa-row.is-next', '.cfa-row .set-toggle[aria-pressed="true"]')):
            await pg.goto(url + '#/wiecej'); await pg.goto(url + route); await pg.wait_for_selector(row)
            r0 = pg.locator(f'{row} >> visible=true').first; await r0.evaluate("e => e.scrollIntoView({ block: 'center' })"); await pg.wait_for_timeout(250)   # nie pod pigułką i paskiem dolnym
            k0 = await pg.locator(on).count()
            await touch_swipe(pg, r0, 220)
            await wait_js(pg, "a => document.querySelectorAll(a[0]).length > a[1]", [on, k0])
            ok(await pg.locator(on).count() == k0 + 1, f'{tag} Gest na liście {route}: przesunięcie w prawo odhacza')
    # --- Wykres interaktywny: postęp planu MPW (odczyt wartości pod kursorem / palcem)
    await pg.goto(url + '#/mpw?v=plan'); await pg.wait_for_selector('.cf-prog-chart svg')
    svg = pg.locator('.cf-prog-chart svg').first
    await svg.evaluate("e => e.scrollIntoView({ block: 'center' })"); await pg.wait_for_timeout(150)   # D-119: nad wykresem panel tempa
    box = await svg.bounding_box()
    if mobile: await pg.touchscreen.tap(box['x'] + box['width'] * 0.3, box['y'] + box['height'] * 0.5)
    else: await pg.mouse.move(box['x'] + box['width'] * 0.3, box['y'] + box['height'] * 0.5)
    await pg.wait_for_timeout(150)
    sc = await pg.evaluate("[document.querySelector('.cf-prog-chart svg').classList.contains('is-scrub'), getComputedStyle(document.querySelector('.cf-prog-chart .ch-scrub')).display, document.querySelector('.cf-prog-chart .ch-scrub-t').textContent]")
    ok(sc[0] and sc[1] != 'none' and 'plan' in sc[2], f'{tag} Wykres: odczyt wartości pod {"palcem" if mobile else "kursorem"} ({sc[2]})')
    # --- Własny pasek dolny i karty „Dziś” (Ustawienia)
    await pg.goto(url + '#/ustawienia'); await pg.wait_for_selector('.set-tabs')
    await pg.get_by_label('Zakładka 4').select_option('zapasy'); await pg.wait_for_selector('.set-tabs')
    tabs = await pg.eval_on_selector_all('.tabs a', 'e => e.map(x => x.textContent.trim())')
    ok(tabs == ['Dziś', 'Dieta', 'Trening', 'Zapasy', 'Więcej'], f'{tag} Pasek dolny: własny wybór zakładek ({tabs})')
    await pg.goto(url + '#/wiecej'); await pg.wait_for_selector('.more-list')
    more = await pg.eval_on_selector_all('.more-list a', 'e => e.map(x => x.textContent.trim())')
    ok('Zapasy' not in more and 'MPW' in more, f'{tag} Więcej: bez modułów z paska, z modułem zdjętym z paska')
    await pg.goto(url + '#/ustawienia'); await pg.wait_for_selector('.set-tabs')
    v = await axe_audit(pg); ok(not v, f'{tag} Ustawienia (pasek, karty): dostępność {v[:2]}')
    await pg.get_by_role('button', name='Domyślne').click(); await pg.wait_for_timeout(150)
    ok(await pg.eval_on_selector_all('.tabs a', 'e => e.map(x => x.textContent.trim())') == ['Dziś', 'Dieta', 'Trening', 'MPW', 'Więcej'], f'{tag} Pasek dolny: przywrócone domyślne')
    await pg.get_by_role('checkbox', name='Meal prep').uncheck()
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.dz-aside')
    cards = await pg.eval_on_selector_all('.dz-card h2', 'e => e.map(x => x.textContent)')
    ok('Meal prep' not in cards and 'Suplementy' in cards, f'{tag} „Dziś”: karta ukryta w Ustawieniach ({cards})')
    await pg.goto(url + '#/ustawienia'); await pg.wait_for_selector('.set-cards'); await pg.get_by_role('checkbox', name='Meal prep').check()
    # --- Dane: dwie kolumny sekcji na komputerze
    if not mobile:
        await pg.goto(url + '#/dane'); await pg.wait_for_selector('.dn-head'); await pg.wait_for_timeout(300)
        cols = await pg.evaluate("getComputedStyle(document.querySelector('main')).gridTemplateColumns.split(' ').length")
        ok(cols == 2, f'{tag} Dane: dwie kolumny sekcji ({cols})')
    sw, w = await pg.evaluate('[document.documentElement.scrollWidth, innerWidth]')
    ok(sw <= w, f'{tag} bez przewijania w poziomie ({sw}/{w})')
    ok(not errs, f'{tag} brak błędów JS {errs[:3]}')
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
        await run_p2(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_p2(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
        await run_care(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_care(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
        await run_mpw(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_mpw(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
        await run_d107(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_d107(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
        await run_d108(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_d108(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
        await run_d110(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_d110(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
        await run_d113(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_d113(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
        await run_d119(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_d119(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
        await run_d114(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_d114(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
        await run_d114b(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_d114b(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
        await run_d115(pw, 'web', 'http://localhost:8765/index.html', True)
        await run_d115(pw, 'single', (ROOT / 'dist/single/2027.html').as_uri(), False)
    srv.shutdown()
    bad = [m for c, m in results if not c]
    print(f'\nE2E: {len(results)} kontroli, zaliczonych: {len(results) - len(bad)}, błędów: {len(bad)}, pominiętych bloków: {len(skipped)}')
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    asyncio.run(main())
