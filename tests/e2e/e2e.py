"""Testy E2E (Chromium, Playwright): oba warianty budowy, iPhone 390×844 i komputer 1280×800.
Uruchomienie: python3 tests/e2e/e2e.py  (wymaga dist/ oraz opcjonalnie SOURCES_DIR z kopią ZAPASY)."""
import asyncio, json, os, sys, threading, http.server, functools, tempfile, pathlib
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fixtures

ROOT = pathlib.Path(__file__).resolve().parents[2]
BACKUP = os.environ.get('SOURCES_DIR') and pathlib.Path(os.environ['SOURCES_DIR']) / 'zapasy_kopia_2026-09-22.json'
ROUTES = ['#/bezpieczenstwo?m=poradnik', '#/rekompozycja', '#/rekompozycja?s=s6', '#/bezpieczenstwo', '#/bezpieczenstwo?m=tabela', '#/trening?v=stat', '#/trening?v=historia', '#/cfa', '#/cfa?v=harmonogram', '#/cfa?v=kalendarz', '#/cfa?v=log', '#/cfa?v=plan', '#/dzis?d=2026-10-03', '#/trening', '#/trening?d=2026-09-24', '#/zapasy', '#/mealprep', '#/dieta?f=1&w=NT', '#/suplementy?d=2026-09-24', '#/dzis', '#/dzis?d=2026-10-26', '#/dzis?d=2026-09-24', '#/dane', '#/wiecej', '#/dieta', '#/zapasy', '#/trening', '#/cfa', '#/suplementy', '#/bezpieczenstwo']
results = []
# Kontrast tekstu elementu względem jego własnego (nieprzezroczystego) tła — WCAG; stany, których axe nie widzi.
CONTRAST = '''el => { const px = c => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data]; };
  const L = ([r, g, b]) => [r, g, b].map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const s = getComputedStyle(el), a = L(px(s.color)), b = L(px(s.backgroundColor)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }'''

# Oczekiwany stan liczony niezależnie od kodu aplikacji (D-027: stan na koniec 22.09, odliczanie od 23.09).
import datetime as _dt
def expected_stock(start, per_day, since=_dt.date(2026, 9, 22)):
    d, q, today = since + _dt.timedelta(days=1), start, _dt.date.today()
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
BANAN = lambda: expected_stock(DATA['ban'], lambda d: 0 if d.weekday() == 3 else 120, DATA['since'])   # czwartek (NT) bez banana
GLUKO = lambda: expected_stock(180, lambda d: 1 if d <= _dt.date(2027, 3, 21) else 0)
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
    await pg.goto(url + '#/dzis'); await pg.wait_for_selector('.slot')
    for r in ROUTES:
        await pg.goto(url + r); await pg.wait_for_timeout(250)
        sw = await pg.evaluate('document.documentElement.scrollWidth')
        ok(sw <= vp['width'], f'{tag} {r}: brak przewijania w poziomie ({sw}px)')
        words = (await pg.evaluate("document.querySelector('main').textContent")).split()
        bad = [w for w in words if w in ('null', 'false', 'undefined', 'NaN') or w.startswith('[object')]
        ok(not bad, f'{tag} {r}: brak artefaktów tekstowych ({bad[:3]})')
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
    await pg.goto(url + '#/dzis?d=2026-09-21'); await pg.wait_for_selector('.dz-kpis')
    kp = await pg.inner_text('.dz-kpis')
    ok('2629 kcal' in kp and '/ 10' in kp and '/ 8 bloków' in kp, f'{tag} Dziś: kafle z danych (kcal, serie, bloki CFA)')
    ok(await pg.locator('.dz-aside .dz-card').count() >= 4 and 'Plan dnia' in await pg.inner_text('main'), f'{tag} Dziś: karty podsumowań i plan dnia')
    # --- Faza 5.0: regresje wykryte w audycie (nawigacja w obrębie strony, sygnatury modułów, zmienne CSS)
    await pg.goto(url + '#/mealprep'); await pg.wait_for_selector('.prep-card')
    await pg.locator('.mp-jump a').nth(1).click(); await pg.wait_for_timeout(700)
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
    qy = await pg.locator('.quicklinks').bounding_box(); dy = await pg.locator('.day').bounding_box()
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
    await pg.goto(url + '#/suplementy'); await pg.wait_for_selector('.dose-list')
    txt = await pg.inner_text('main')
    ok('Tauryna' in txt and 'do 2027-03-21' in txt, f'{tag} Suplementacja: tauryna (D-014) i okres preparatów czasowych (D-015)')
    ok('Stan i prognoza pochodz' not in txt and 'Potem nie są kontynuowane' not in txt, f'{tag} Suplementacja: bez usuniętych podpisów')
    # najbliższy wtorek (test niezależny od dnia uruchomienia)
    tue = (_dt.date.today() + _dt.timedelta(days=(1 - _dt.date.today().weekday()) % 7)).isoformat()
    await pg.goto(url + f'#/suplementy?d={tue}'); await pg.wait_for_selector('.dose-list')
    ok('Cynk' not in (await pg.inner_text('main')).split('Preparaty')[0], f'{tag} Suplementacja: we wtorek bez cynku')
    await pg.goto(url + '#/suplementy?d=2026-09-24'); await pg.wait_for_selector('.dose-list')
    ok('Cynk' in (await pg.inner_text('main')).split('Preparaty')[0], f'{tag} Suplementacja: czwartek z cynkiem')
    # --- Etap 5: Trening
    await pg.goto(url + '#/trening?d=2026-09-21'); await pg.wait_for_selector('.ex')
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
    await pg.goto(url + '#/trening?d=2026-09-21'); await pg.wait_for_selector('.ex')
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
    await pg.goto(url + '#/trening?d=2026-09-24'); await pg.wait_for_selector('h1')
    ok('Dzień bez treningu' in await pg.inner_text('main'), f'{tag} Trening: czwartek bez ćwiczeń')
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
    await pg.goto(url + '#/cfa?v=dzien&d=2026-09-21'); await pg.wait_for_selector('.cfa-row')
    ok(await pg.locator('.cfa-row').count() == 8, f'{tag} CFA: 8 bloków dnia')
    ok('Curriculum 2026 Vol 1 (QM), s. 3–13 (11 s.)' in await pg.inner_text('main'), f'{tag} CFA: źródło i strony bloku')
    await pg.locator('.cfa-row .set-toggle').first.click(); await pg.wait_for_timeout(400)
    await pg.reload(); await pg.wait_for_selector('.cfa-row')
    ok(await pg.locator('.cfa-row .set-toggle').first.get_attribute('aria-pressed') == 'true' and '1 / 416' in await pg.inner_text('.hero-cfa'),
       f'{tag} CFA: postęp zapisany trwale')
    c = await pg.locator('.cfa-row .set-toggle').first.evaluate(CONTRAST)
    ok(c >= 4.5, f'{tag} CFA: kontrast odhaczonego bloku ≥ 4,5:1 ({c:.2f})')
    await pg.goto(url + '#/cfa?v=harmonogram&kat=Schweser'); await pg.wait_for_selector('.filters')
    ok('75 bloków' in await pg.inner_text('.filters'), f'{tag} CFA: filtr kategorii (Schweser = 75 bloków)')
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
    ok(by.get('Glukozamina', [None, ''])[1].startswith(f'{GLUKO():g} '), f'{tag} glukozamina {GLUKO():g} kaps. (D-015, odliczanie od 23.09)')
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
    ok(await pg.locator('.counters .counter').count() == 3, f'{tag} Zapasy: liczniki statusów')
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
    await pg.wait_for_function('v => document.querySelector(".inv-item input[type=number]").value !== v', arg=before, timeout=8000)
    after = await pg.locator('.inv-item').first.locator('input[type=number]').input_value()
    ok(float(after) > float(before), f'{tag} Zapasy: zakup opakowania zwiększa stan ({before} → {after})')
    await pg.reload(); await pg.wait_for_selector('.inv-item')
    kept = await pg.locator('.inv-item').first.locator('input[type=number]').input_value()
    ok(kept == after, f'{tag} Zapasy: zmiana stanu zapisana trwale')
    await pg.get_by_role('button', name='Cofnij', exact=True).click()
    await pg.wait_for_function('v => document.querySelector(".inv-item input[type=number]").value === v', arg=before, timeout=8000)
    ok(True, f'{tag} Zapasy: cofnięcie ostatniej zmiany przywraca stan')
    await pg.locator('.daycard > summary').click()   # korekta dnia — sekcja zwinięta (Faza 5)
    await pg.get_by_role('button', name='−1 dzień (odlicz)').click()
    await pg.wait_for_function('v => document.querySelector(".inv-item input[type=number]").value !== v', arg=before, timeout=8000)
    ok(True, f'{tag} Zapasy: korekta dnia zmienia stany')
    ok(await pg.locator('.daycard[open]').count() == 1, f'{tag} Zapasy: sekcja korekty dnia pozostaje rozwinięta po zapisie')
    await pg.get_by_role('button', name='+1 dzień (cofnij zużycie)').click()
    await pg.wait_for_function('v => document.querySelector(".inv-item input[type=number]").value === v', arg=before, timeout=8000)
    ok(True, f'{tag} Zapasy: odwrotna korekta dnia wraca do stanu wyjściowego')
    await pg.get_by_role('button', name='Historia', exact=True).click(); await pg.wait_for_selector('dialog.sheet')
    ok('Historia i cofanie zmian' in await pg.inner_text('dialog') and await pg.locator('dialog .hist li').count() >= 4, f'{tag} Zapasy: historia z wpisami')
    pg.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.locator('dialog .hist li').last.get_by_role('button', name='↩ Przywróć ten stan').click()
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
    # --- Faza 5: Dieta (D-071) — składniki z Zapasów (dane syntetyczne mają pozycje pilne)
    await pg.goto(url + '#/dieta'); await pg.wait_for_selector('.meal')
    ok(await pg.locator('.dt-stock .dt-alerts li').count() >= 1 and await pg.locator('.meal .dt-stock-b').count() >= 1, f'{tag} Dieta: składniki z niskim zapasem oznaczone (z modułu Zapasy)')
    await pg.goto(url + '#/mealprep'); await pg.wait_for_selector('.prep-card')
    mp = await pg.inner_text('main')
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

# --- Faza 5 (Trening, CFA): funkcje zależne od bieżącej godziny — zegar przeglądarki ustawiony na poniedziałek
# 28.09.2026 10:00 (UPPER 1, Faza 0; CFA: 7 dni planu przed „dziś”). Oczekiwania liczone z danych, nie z kodu aplikacji.
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
    if mobile:   # cele dotykowe w rozbudowanych modułach
        for r in ('#/trening', '#/cfa?v=dzien', '#/cfa?v=log', '#/dieta', '#/zapasy'):
            await pg.goto(url + r); await pg.wait_for_timeout(300)
            small = await pg.evaluate('''[...document.querySelectorAll('main button, main a.btn, main a.chip, main summary, .dt-nav-a, .tabs a')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(r => r.height < 44 || r.width < 44).length''')
            ok(small == 0, f'{tag} {r}: elementy dotykowe ≥ 44 px (za małych: {small})')
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
    srv.shutdown()
    bad = [m for c, m in results if not c]
    print(f'\nE2E: {len(results)} kontroli, zaliczonych: {len(results) - len(bad)}, błędów: {len(bad)}, pominiętych bloków: {len(skipped)}')
    sys.exit(1 if bad else 0)

asyncio.run(main())
