"""Budżety wydajności (D-115, T6 audytu 10.11): rozmiar pakietu, czas startu przy dużym dzienniku zdarzeń, liczba węzłów DOM,
czas reakcji na dotknięcie. Uruchamiane w workflow „Testy 2027” (`npm run budget`) — przekroczenie limitu = błąd.

Limity ustawione z zapasem względem pomiarów z 18.11.2026 (tabela w docs/RAPORT_D115.md): mają łapać wyraźne pogorszenie
(np. podwojenie pakietu, start dłuższy o sekundy), a nie szum maszyny CI. Zmiana limitu = świadoma decyzja z opisem w raporcie.
Dziennik syntetyczny (bez danych użytkownika, D-065): zdarzenia `setting` (odhaczone dawki) i `train.set` w jawnych datach.
Pomiary w wariancie web (Chromium, 390 px, dotyk); start = od nawigacji do widocznego nagłówka „Dziś” (mediana z 3 prób)."""
import asyncio, gzip, json, pathlib, statistics, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from e2e import serve, at, ROOT                       # noqa: E402  (serwer i zegar testów E2E)
from playwright.async_api import async_playwright      # noqa: E402

DIST = ROOT / 'dist'
LIMITS = {
    'js_kb': 1400, 'js_gzip_kb': 340, 'css_kb': 230, 'single_kb': 1900,          # pakiet (KB = 1000 B)
    'start_empty_ms': 1500, 'start_50k_ms': 4000,                                 # start: pusty dziennik / 50 tys. zdarzeń (≈ rok)
    'dom_nodes': 3500, 'dom_nodes_list': 8500,                                    # widok zwykły / pełna lista (harmonogram MPW: 392 bloki)
    'tap_ms': 250,                                                                # dotknięcie → zmiana na ekranie (mediana)
}
ROUTES = ['#/dzis', '#/zapasy', '#/trening', '#/suplementy', '#/dieta', '#/kalendarz', '#/dane', '#/mpw']
LIST_ROUTES = ['#/mpw?v=harmonogram']   # pełna lista bloków planu — osobny, wyższy limit
N_EVENTS = 50_000
results, fails = [], []


def check(name, value, limit, unit):
    ok = value <= limit
    results.append((name, value, limit, unit, ok))
    print(f"{'OK  ' if ok else 'BŁĄD'} {name}: {value} {unit} (limit {limit} {unit})")
    if not ok: fails.append(name)


def sizes():
    js = next((DIST / 'web').glob('app.*.js')); css = next((DIST / 'web').glob('app.*.css'))
    check('pakiet JS', round(js.stat().st_size / 1000), LIMITS['js_kb'], 'KB')
    check('pakiet JS (gzip)', round(len(gzip.compress(js.read_bytes(), 9)) / 1000), LIMITS['js_gzip_kb'], 'KB')
    check('style CSS', round(css.stat().st_size / 1000), LIMITS['css_kb'], 'KB')
    check('2027.html (jeden plik)', round((DIST / 'single/2027.html').stat().st_size / 1000), LIMITS['single_kb'], 'KB')


# Wypełnienie IndexedDB syntetycznym dziennikiem — na stronie tego samego źródła, zanim aplikacja otworzy bazę (manifest = brak skryptów)
FILL = """async n => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('p2027', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('events', { keyPath: 'id' }); d.createObjectStore('meta', { keyPath: 'k' });
      d.createObjectStore('quarantine', { autoIncrement: true }); d.createObjectStore('backups', { keyPath: 'at' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const day = i => new Date(Date.UTC(2026, 9, 18) + Math.floor(i / 140) * 86400000).toISOString().slice(0, 10);
  const t0 = Date.UTC(2026, 9, 18, 8);
  for (let b = 0; b < n; b += 5000) {
    await new Promise((res, rej) => { const tx = db.transaction(['events', 'meta'], 'readwrite'), s = tx.objectStore('events');
      if (b === 0) tx.objectStore('meta').put({ k: 'device', v: 'dbench0001' });
      for (let i = b; i < Math.min(n, b + 5000); i++) {
        const hlc = `${String(t0 + i * 600).padStart(13, '0')}:${String(i % 10000).padStart(4, '0')}:dbench0001`;
        const d = i % 3 ? { key: `supp.dose:${day(i)}|${String(6 + (i % 14)).padStart(2, '0')}:00|bench${i % 9}`, value: i % 7 !== 0 }
                        : { date: day(i), ex: `bench_ex${i % 12}`, set: 1 + (i % 5), done: true, kg: 40 + (i % 20), reps: 8 };
        s.put({ id: `bench:${i}`, hlc, dev: 'dbench0001', t: i % 3 ? 'setting' : 'train.set', d, at: new Date(t0 + i * 600).toISOString(), v: 1 });
      }
      tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }
  db.close(); return n;
}"""


async def start_ms(pw, url, events):
    """Mediana z 3 prób: nowa karta (dziennik już w bazie), od nawigacji do widocznego nagłówka „Dziś” i gotowego planu dnia."""
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, locale='pl-PL', timezone_id='Europe/Warsaw')
    pg = await ctx.new_page()
    await pg.clock.install(time=at(2026, 11, 18, 10, 40))
    if events:
        await pg.goto(url.replace('index.html', 'manifest.webmanifest'))
        await pg.evaluate(FILL, events)
    times = []
    for _ in range(3):
        p2 = await ctx.new_page()
        t = time.perf_counter()
        await p2.goto(url + '#/dzis'); await p2.wait_for_selector('.dz-plan-h', timeout=60000)
        times.append(round((time.perf_counter() - t) * 1000))
        await p2.close()
    await b.close()
    return statistics.median(times), times


async def dom_and_tap(pw, url):
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, locale='pl-PL', timezone_id='Europe/Warsaw')
    pg = await ctx.new_page()
    await pg.clock.install(time=at(2026, 11, 18, 10, 40))
    for routes, limit, label in ((ROUTES, LIMITS['dom_nodes'], 'węzły DOM'), (LIST_ROUTES, LIMITS['dom_nodes_list'], 'węzły DOM, pełna lista')):
        worst = (0, '')
        for r in routes:
            await pg.goto(url + '#/wiecej'); await pg.goto(url + r); await pg.wait_for_selector('main h1')
            n, prev = -1, -2
            while n != prev:   # moduły asynchroniczne (MPW, Dane) dokładają treść po wczytaniu — liczymy po ustaleniu się drzewa
                prev = n; await pg.wait_for_timeout(300); n = await pg.evaluate("document.getElementsByTagName('*').length")
            print(f'     {label} {r}: {n}')
            worst = max(worst, (n, r))
        check(f'{label} (najwięcej: {worst[1]})', worst[0], limit, 'węzłów')
    # Czas reakcji: dotknięcie dawki w Suplementacji → zmiana aria-pressed widoczna w następnej klatce (mediana z 5)
    await pg.goto(url + '#/wiecej'); await pg.goto(url + '#/suplementy'); await pg.wait_for_selector('.dose-ck', state='attached')
    taps = []
    for i in range(5):
        ms = await pg.evaluate("""async i => {
          const b = document.querySelectorAll('.dose-ck')[i]; const before = b.getAttribute('aria-pressed'); const t0 = performance.now();
          b.click();
          while (performance.now() - t0 < 3000) { await new Promise(r => requestAnimationFrame(r));
            const now = document.querySelectorAll('.dose-ck')[i]; if (now && now.getAttribute('aria-pressed') !== before) return performance.now() - t0; }
          return 99999; }""", i)
        taps.append(round(ms))
    print(f'     dotknięcia (ms): {taps}')
    check('dotknięcie → zmiana na ekranie (mediana)', statistics.median(taps), LIMITS['tap_ms'], 'ms')
    await b.close()


async def main():
    sizes()
    srv = serve(8766)
    url = 'http://localhost:8766/index.html'
    async with async_playwright() as pw:
        m, ts = await start_ms(pw, url, 0)
        print(f'     start, pusty dziennik (ms): {ts}')
        check('start — pusty dziennik (mediana)', m, LIMITS['start_empty_ms'], 'ms')
        m, ts = await start_ms(pw, url, N_EVENTS)
        print(f'     start, {N_EVENTS} zdarzeń (ms): {ts}')
        check(f'start — {N_EVENTS // 1000} tys. zdarzeń (mediana)', m, LIMITS['start_50k_ms'], 'ms')
        await dom_and_tap(pw, url)
    srv.shutdown()
    out = ROOT / 'dist' / 'budget.json'
    out.write_text(json.dumps([{'name': n, 'value': v, 'limit': l, 'unit': u, 'ok': ok} for n, v, l, u, ok in results], ensure_ascii=False, indent=1))
    print(f'\nBUDŻETY: {len(results)} pomiarów, przekroczonych: {len(fails)}' + (f' — {", ".join(fails)}' if fails else ''))
    sys.exit(1 if fails else 0)


asyncio.run(main())
