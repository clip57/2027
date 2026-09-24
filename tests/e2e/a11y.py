"""Audyt dostępności (axe-core, WCAG 2.1 A/AA) i responsywności: wszystkie widoki i stany interakcji × 390/1280 px × motyw jasny/ciemny."""
import asyncio, json, pathlib, sys, collections, datetime as dt
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
AXE = (ROOT / 'node_modules/axe-core/axe.min.js').read_text()
ROUTES = ['#/dzis', '#/dzis?d=2026-10-26', '#/dieta', '#/suplementy', '#/zapasy', '#/mealprep', '#/trening?d=2026-09-21', '#/trening?v=stat',
  '#/trening?v=historia', '#/cfa', '#/cfa?v=harmonogram', '#/cfa?v=kalendarz', '#/cfa?v=log', '#/cfa?v=plan', '#/bezpieczenstwo',
  '#/bezpieczenstwo?m=tabela', '#/bezpieczenstwo?m=poradnik', '#/rekompozycja?s=s6', '#/dane', '#/wiecej']
# Stany niewidoczne po samym wejściu na trasę (odhaczone elementy, rozwinięte sekcje, otwarte okno) — wcześniej poza audytem.
OPEN_ALL = "document.querySelectorAll('details').forEach(d => d.open = true)"
STATES = [('#/trening?d=2026-09-21', "document.querySelector('.set:not(.set-h) .set-toggle').click()", 'odhaczona seria'),
  ('#/cfa?v=dzien&d=2026-09-21', "document.querySelector('.cfa-row .set-toggle').click()", 'odhaczony blok'),
  ('#/mealprep', "document.querySelector('.prep-list input[type=checkbox]').click()", 'odhaczony krok'),
  ('#/bezpieczenstwo?m=poradnik', OPEN_ALL, 'rozwinięte sekcje'), ('#/rekompozycja', OPEN_ALL, 'rozwinięte sekcje'),
  ('#/dieta', OPEN_ALL, 'rozwinięte posiłki'), ('#/trening?d=2026-09-21', "document.querySelector('.ex-tech').click()", 'okno techniki'),
  ('#/trening', "document.querySelector('.set:not(.set-h) .set-toggle').click()", 'licznik przerwy'),
  ('#/cfa?v=log', "document.querySelector('.cf-kinds .chip-b')?.click()", 'filtr error logu')]
# Stały zegar (poniedziałek 28.09.2026 10:00): „dziś” ma trening (licznik przerwy) i zaległe bloki CFA — widoki zależne od daty są audytowane zawsze
CLOCK = dt.datetime(2026, 9, 28, 10, 0, tzinfo=dt.timezone(dt.timedelta(hours=2)))
async def main():
  found = collections.defaultdict(set); overflow = []
  async with async_playwright() as pw:
    b = await pw.chromium.launch()
    for w in (390, 1280):
      for scheme in ('light', 'dark'):
        ctx = await b.new_context(viewport={'width': w, 'height': 844}, color_scheme=scheme, timezone_id='Europe/Warsaw')
        await ctx.clock.install(time=CLOCK)
        # motyw jawnie: 'dark' | 'light' (domyślny jest ciemny — bez tego oba przebiegi sprawdzałyby ten sam motyw)
        await ctx.add_init_script(f"localStorage.setItem('p2027.theme', '{scheme}')")
        pg = await ctx.new_page()
        for r, action, label in [(r, None, '') for r in ROUTES] + STATES:
          await pg.goto((ROOT / 'dist/single/2027.html').as_uri() + r); await pg.wait_for_timeout(350)
          if action: await pg.evaluate(action); await pg.wait_for_timeout(400); r = f'{r} [{label}]'
          sw = await pg.evaluate('document.documentElement.scrollWidth')
          if sw > w: overflow.append(f'{w}/{scheme} {r}: {sw}px')
          await pg.add_script_tag(content=AXE)
          res = await pg.evaluate("axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa']}, resultTypes: ['violations']})")
          for v in res['violations']:
            for n in v['nodes'][:3]:
              found[(v['id'], v['impact'])].add(f"{w}/{scheme} {r} :: {n['target'][0][:60]}")
        await ctx.close()
    await b.close()
  print('PRZELEWANIE:', overflow or 'brak')
  for (vid, imp), where in sorted(found.items(), key=lambda x: x[0][0]):
    print(f'\n[{imp}] {vid} — {len(where)} miejsc'); [print('   ', x) for x in sorted(where)[:6]]
  print('\nNARUSZEŃ (typów):', len(found))
  sys.exit(1 if found or overflow else 0)
asyncio.run(main())
