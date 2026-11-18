"""Strażnik wizualny (D-114): zrzuty wszystkich widoków — wariant jednoplikowy (npm run build), dane syntetyczne (fixtures.py), stały zegar 18.11.2026 10:40.
Użycie: python3 tools/visual/snap.py <katalog> [szerokości=390,1280] [motywy=dark,light,oled] [filtry po przecinku]; FULL=0 — tylko pierwszy ekran.
Porównanie: python3 tools/visual/compare.py <przed> <po> [katalog różnic] — liczba różnych pikseli (zmiana stylów bez zmiany wyglądu = 0 różnic;
numer wersji maskowany — D-115). W CI: zadanie „Strażnik wizualny” w testy.yml (gałąź bazowa ↔ bieżący commit). Katalogi zrzutów poza repozytorium (np. w katalogu tymczasowym)."""
import asyncio, os, pathlib, sys, datetime as dt
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'tests/e2e'))
import fixtures
from playwright.async_api import async_playwright
ROOT = pathlib.Path(os.environ.get('APP_ROOT', pathlib.Path(__file__).resolve().parents[2]))
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
WIDTHS = [int(x) for x in (sys.argv[2] if len(sys.argv) > 2 else '390,1280').split(',')]
THEMES = (sys.argv[3] if len(sys.argv) > 3 else 'dark,light').split(',')
FILTER = sys.argv[4] if len(sys.argv) > 4 else ''
FULL = os.environ.get('FULL', '1') == '1'
H, M = (int(x) for x in os.environ.get('HM', '10:40').split(':'))
DAY = os.environ.get('DAY', '2026-11-18')
ROUTES = [('dzis', '#/dzis'), ('tydzien', '#/dzis?v=tydzien'), ('kalendarz', '#/kalendarz'), ('pielegnacja', '#/pielegnacja'),
  ('dieta', '#/dieta'), ('suplementy', '#/suplementy'), ('zapasy', '#/zapasy'), ('mealprep', '#/mealprep'),
  ('trening', '#/trening?d=2026-11-16'), ('trening-stat', '#/trening?v=stat'), ('trening-hist', '#/trening?v=historia'), ('rekompozycja', '#/rekompozycja'),
  ('cfa', '#/cfa'), ('cfa-dzien', '#/cfa?v=dzien&d=2026-10-19'), ('mpw', '#/mpw'), ('mpw-dzien', '#/mpw?v=dzien&d=2026-11-17'),
  ('bezp', '#/bezpieczenstwo'), ('bezp-por', '#/bezpieczenstwo?m=poradnik'), ('dane', '#/dane'), ('wiecej', '#/wiecej'), ('ustawienia', '#/ustawienia'),
  ('dzis-past', '#/dzis?d=2026-11-16'), ('fokus', '#/trening?v=fokus&d=2026-11-18'), ('fokus-past', '#/trening?v=fokus&d=2026-11-16'), ('fx-mpw', '#/mpw?v=fokus&d=2026-11-18'), ('fx-prep', '#/mealprep?v=fokus')]
STATES = [('sheet', '#/trening?d=2026-11-16', "document.querySelector('.ex-tech').click()"),
  ('fokus-rest', '#/trening?v=fokus&d=2026-11-18', "document.querySelector('.fx-go').click()"),
  ('live', '#/zapasy', "location.hash = '#/trening?d=2026-11-18'; setTimeout(() => { document.querySelector('.set:not(.set-h) .set-toggle').click(); setTimeout(() => { location.hash = '#/zapasy'; }, 300); }, 300)"),
  ('search', '#/dzis', "document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' })); setTimeout(() => { const i = document.querySelector('.gs-input'); i.value = 'kefir'; i.dispatchEvent(new Event('input')); }, 50)")]
MASK_VERSION = """(() => { const v = document.querySelector('meta[name="app-version"]')?.getAttribute('content') || ''; const h = (v.split('+')[1] || '').slice(0, 6);
  const b = document.querySelector('meta[name="app-built"]')?.getAttribute('content') || ''; const d = b ? `${b.slice(8, 10)}.${b.slice(5, 7)}.${b.slice(0, 4)}` : '';
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const subs = [v, h, d].filter(Boolean);
  for (let n = w.nextNode(); n; n = w.nextNode()) { let t = n.nodeValue; for (const x of subs) t = t.split(x).join('▒'.repeat(Math.min(x.length, 6))); if (t !== n.nodeValue) n.nodeValue = t; } })()"""
async def main():
  syn = fixtures.write(fixtures.synthetic_zapasy(dt.date(2026, 11, 14))[0], 'zapasy_syntetyczne.json')
  care = fixtures.write(fixtures.synthetic_care_plan(), 'pielegnacja_syntetyczna.json')
  url = (ROOT / 'dist/single/2027.html').as_uri()
  y, mo, d = (int(x) for x in DAY.split('-'))
  clock = dt.datetime(y, mo, d, H, M, tzinfo=dt.timezone(dt.timedelta(hours=1)))
  async with async_playwright() as pw:
    b = await pw.chromium.launch()
    for w in WIDTHS:
      for theme in THEMES:
        mob = w < 600
        ctx = await b.new_context(viewport={'width': w, 'height': 844 if mob else 900}, device_scale_factor=1, is_mobile=mob, has_touch=mob,
                                  color_scheme=theme if theme in ('dark', 'light') else 'dark', timezone_id='Europe/Warsaw', locale='pl-PL', reduced_motion='reduce')
        await ctx.clock.install(time=clock)
        th = theme if theme in ('dark', 'light') else 'dark'
        await ctx.add_init_script(f"localStorage.setItem('p2027.theme', '{th}');" + ("localStorage.setItem('p2027.oled', '1');" if theme == 'oled' else ''))
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(url + '#/dane'); await pg.wait_for_selector('text=Stan zapisu')
        await pg.set_input_files('input[type=file]', str(syn)); await pg.wait_for_selector('dialog[open]')
        await pg.click('dialog >> text=Scal dane'); await pg.wait_for_selector('text=Zaimportowano')
        await pg.set_input_files('input[type=file]', str(care)); await pg.wait_for_selector('dialog[open]')
        await pg.click('dialog >> text=Scal dane'); await pg.wait_for_timeout(400)
        await pg.goto(url + '#/trening?d=2026-11-16'); await pg.wait_for_timeout(300)
        for i in range(3):
          await pg.evaluate(f"document.querySelectorAll('.set:not(.set-h) .set-toggle')[{i}]?.click()"); await pg.wait_for_timeout(120)
        for name, r, action in [(n, r, None) for n, r in ROUTES] + STATES:
          if FILTER and not any(f in name for f in FILTER.split(',')): continue
          await pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")
          await pg.goto(url + '#/wiecej'); await pg.wait_for_timeout(40)
          await pg.goto(url + r); await pg.wait_for_timeout(350)
          await pg.evaluate("document.getElementById('toast')?.replaceChildren()")
          # D-115 (T5): numer wersji (inny w każdym buildzie) zamaskowany — porównanie dwóch buildów pokazuje tylko zmiany wyglądu
          await pg.evaluate(MASK_VERSION)
          if action: await pg.evaluate(action); await pg.wait_for_timeout(1400 if name == 'live' else 400)
          await pg.screenshot(path=str(OUT / f'{name}-{w}-{theme}.png'), full_page=FULL and not action, animations='disabled')
        if errs: print('BŁĘDY JS', w, theme, errs[:3])
        await ctx.close()
    await b.close()
asyncio.run(main())
