"""Audyt dostępności (axe-core, WCAG 2.1 A/AA) i responsywności: wszystkie widoki i stany interakcji × 390/1280 px × motyw jasny/ciemny."""
import asyncio, json, os, pathlib, sys, collections, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fixtures
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
AXE = (ROOT / 'node_modules/axe-core/axe.min.js').read_text()
ROUTES = ['#/dzis', '#/dzis?d=2026-10-26', '#/dzis?d=2026-09-26', '#/dzis?d=2026-09-24', '#/dieta', '#/suplementy', '#/zapasy', '#/mealprep', '#/trening?d=2026-09-28', '#/trening?v=stat',
  '#/trening?v=historia', '#/cfa', '#/cfa?v=harmonogram', '#/cfa?v=kalendarz', '#/cfa?v=log', '#/cfa?v=plan', '#/bezpieczenstwo',
  '#/bezpieczenstwo?m=tabela', '#/bezpieczenstwo?m=poradnik', '#/rekompozycja?s=s6', '#/dane', '#/wiecej',
  '#/dzis?v=tydzien', '#/dzis?v=tydzien&d=2026-09-25', '#/mealprep?d=2026-10-11', '#/cfa?v=dzien&d=2026-09-28']   # Etapy 1–3 audytu
# Stany niewidoczne po samym wejściu na trasę (odhaczone elementy, rozwinięte sekcje, otwarte okno) — wcześniej poza audytem.
OPEN_ALL = "document.querySelectorAll('details').forEach(d => d.open = true)"
STATES = [('#/trening?d=2026-09-28', "document.querySelector('.set:not(.set-h) .set-toggle').click()", 'odhaczona seria'),
  ('#/cfa?v=dzien&d=2026-09-25', "document.querySelector('.cfa-row .set-toggle').click()", 'odhaczony blok'),
  ('#/mealprep', "document.querySelector('.prep-list input[type=checkbox]').click()", 'odhaczony krok'),
  ('#/bezpieczenstwo?m=poradnik', OPEN_ALL, 'rozwinięte sekcje'), ('#/rekompozycja', OPEN_ALL, 'rozwinięte sekcje'),
  ('#/dieta', OPEN_ALL, 'rozwinięte posiłki'), ('#/trening?d=2026-09-28', "document.querySelector('.ex-tech').click()", 'okno techniki'),
  ('#/trening', "document.querySelector('.set:not(.set-h) .set-toggle').click()", 'licznik przerwy'),
  ('#/cfa?v=log', "document.querySelector('.cf-kinds .chip-b')?.click()", 'filtr error logu'),
  ('#/zapasy', "document.querySelectorAll('.daycard, .zp-more, .zp-bulk').forEach(d => d.open = true)", 'rozwinięte korekty i szczegóły'),
  ('#/zapasy?s=CRITICAL', None, 'filtr pilnych'), ('#/rekompozycja?q=kreatyna', None, 'wyszukiwanie w planie'),
  ('#/bezpieczenstwo?q=termos', None, 'filtr produktów'), ('#/mealprep', "document.querySelectorAll('details.fold').forEach(d => d.open = true)", 'rozwinięte tabele'),
  # Etapy 1–2 audytu (25.09.2026): minione punkty dnia, minione dni harmonogramu, komunikat po akcji, filtr zakupów, błąd w oknie (na końcu — okno zostaje otwarte)
  ('#/dzis', "document.querySelector('.dz-past > summary')?.click()", 'minione punkty'),
  ('#/cfa?v=harmonogram', "document.querySelector('.cf-past > summary')?.click()", 'minione dni'),
  ('#/zapasy', "document.querySelector('.zp-pack').click()", 'komunikat po akcji'), ('#/zapasy?s=shop', None, 'filtr „Do zakupów”'),
  ('#/cfa?v=dzien&d=2026-09-28', "document.querySelector('.cf-recall .set-toggle').click()", 'odhaczony recall'),
  ('#/dzis', "document.querySelector('.side-search, .gs-open')?.click() || document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' })); setTimeout(() => { const i = document.querySelector('.gs-input'); i.value = 'kefir'; i.dispatchEvent(new Event('input')); }, 50)", 'wyszukiwanie'),
  ('#/zapasy', "document.querySelector('dialog')?.remove(); document.querySelectorAll('.zp-act')[2].click(); const t = document.querySelector('dialog textarea'); t.value = 'banan 1,2 kg\\nczekolada 1'; [...document.querySelectorAll('dialog button')].find(b => b.textContent.includes('Sprawdź')).click()", 'podgląd paragonu'),
  ('#/zapasy', "document.querySelector('dialog')?.remove(); document.querySelectorAll('.zp-act')[1].click(); document.querySelector('dialog .sheet-body > button.primary').click()", 'błąd w oknie „Dodaj”')]
# Stany zapasów: SYNTETYCZNA kopia (D-065) importowana przed audytem — statusy, paski zapasu, „Do kupienia”, ostrzeżenia w Diecie
SYN = fixtures.write(fixtures.synthetic_zapasy(dt.date(2026, 9, 27))[0], 'zapasy_syntetyczne.json')
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
        await pg.goto((ROOT / 'dist/single/2027.html').as_uri() + '#/dane'); await pg.wait_for_selector('text=Stan zapisu')
        await pg.set_input_files('input[type=file]', str(SYN)); await pg.wait_for_selector('dialog[open]')
        await pg.click('dialog >> text=Scal dane'); await pg.wait_for_selector('text=Zaimportowano')
        for r, action, label in [(r, None, '') for r in ROUTES] + STATES:
          await pg.goto((ROOT / 'dist/single/2027.html').as_uri() + r); await pg.wait_for_timeout(350)
          if action: await pg.evaluate(action); await pg.wait_for_timeout(400)
          if label: r = f'{r} [{label}]'
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
