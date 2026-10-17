"""Test dymny CFA i planu dnia — sterowany danymi z src/data/cfa.json (bez zaszytych dat i liczb), więc po wymianie planu CFA
uruchamia się bez zmian. Sprawdza w prawdziwej przeglądarce (dist/single/2027.html, zegar sztuczny):
  • licznik bloków i brak błędów JS na kluczowych widokach,
  • dla reprezentatywnych dni: liczba bloków w widoku CFA = plan, recall tylko w dniach z harmonogramu, sloty w „Dziś” = bloki planu,
  • odhaczanie bloku i recallu (trwałość po przeładowaniu, cofnięcie), „zaległe” liczone z planu,
  • karta „Teraz” w środku każdego bloku wskazuje blok CFA (albo posiłek — zamierzone nakładanie D-101).
Uruchomienie: npm run build && python3 tests/e2e/cfa_smoke.py   (kod wyjścia 1 przy błędach)
"""
import asyncio, datetime as dt, json, pathlib, re, sys
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
CFA = json.loads((ROOT / 'src/data/cfa.json').read_text(encoding='utf8'))['D']
PHASES = json.loads((ROOT / 'src/data/phases.json').read_text(encoding='utf8'))
TZ = ZoneInfo('Europe/Warsaw')
URL = (ROOT / 'dist/single/2027.html').as_uri()
BLOCKS = CFA['bloki']; N = len(BLOCKS)
BY_DAY = {}
for b in BLOCKS: BY_DAY.setdefault(b['data'], []).append(b)
NIGHT = set(CFA['nightDates'])
MOCKS = CFA['mockCFA']
fails = []

def ok(cond, msg):
    print(('OK   ' if cond else 'BŁĄD ') + msg)
    if not cond: fails.append(msg)

def at(date, hm='12:00'):
    y, m, d = map(int, date.split('-')); h, mi = map(int, hm.split(':'))
    return dt.datetime(y, m, d, h, mi, tzinfo=TZ)

def pick_days():
    """Reprezentatywne dni wybrane z danych: pierwszy, ostatni, mock, dzień z najwięcej blokami, dzień z literami K/L/M (jeśli są), czwartek, zwykły."""
    days = sorted(BY_DAY)
    sel = {'pierwszy dzień planu CFA': days[0], 'ostatni dzień planu CFA': days[-1]}
    if MOCKS: sel['dzień mocka'] = MOCKS[0]
    sel['dzień z największą liczbą bloków'] = max(days, key=lambda d: len(BY_DAY[d]))
    late = [d for d in days if any(b['blok'] in 'KLMNOP' and b['blok'] not in ('S1', 'S2') for b in BY_DAY[d])]
    if late: sel['dzień z blokami po południu (K–P)'] = late[0]
    thu = [d for d in days if dt.date.fromisoformat(d).isoweekday() == 4 and d not in MOCKS]
    if thu: sel['czwartek'] = thu[0]
    plain = [d for d in days if d not in MOCKS and d >= PHASES['start'] and dt.date.fromisoformat(d).isoweekday() in (1, 2, 3)]
    if plain: sel['zwykły dzień roboczy'] = plain[0]
    return sel

BROWSER = None
class Ctx:
    """Zamykalny kontekst przeglądarki (jedna przeglądarka na cały test — start przeglądarki na scenariusz jest zbyt wolny)."""
    def __init__(self, ctx): self.ctx = ctx
    async def close(self): await self.ctx.close()

async def new_page(pw, when, errs):
    ctx = await BROWSER.new_context(viewport={'width': 390, 'height': 844}, timezone_id='Europe/Warsaw')
    await ctx.clock.install(time=when)
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    pg.on('console', lambda m: errs.append(f'console: {m.text}') if m.type == 'error' else None)
    return Ctx(ctx), pg

async def main():
    global BROWSER
    sel = pick_days()
    async with async_playwright() as pw:
        BROWSER = await pw.chromium.launch()
        # ---- 1. Widoki dnia: bloki, recall, sloty
        for label, d in sel.items():
            errs = []; b, pg = await new_page(pw, at(d), errs)
            await pg.goto(f'{URL}#/cfa?v=dzien&d={d}'); await pg.wait_for_selector('.cfa-dayhead', timeout=20000)
            rows = await pg.locator('.cfa-row:not(.cf-recall)').count()
            # w widoku „Dzień” lista dnia może zawierać też zaległe z poprzednich dni (panel .cf-backlog) — liczymy tylko listę dnia
            day_rows = await pg.locator('.panel:not(.cf-backlog) .cfa-list .cfa-row:not(.cf-recall)').count()
            ok(day_rows == len(BY_DAY[d]), f'{label} {d}: widok CFA ma {day_rows} bloków (plan: {len(BY_DAY[d])})')
            ok((await pg.locator('.cf-recall').count() == 1) == (d in NIGHT), f'{label} {d}: recall 22:00 {"jest" if d in NIGHT else "nie ma"} zgodnie z harmonogramem')
            hero = ' '.join((await pg.inner_text('.hero-cfa')).split())
            ok(f'0 / {N} bloków' in hero, f'{label} {d}: licznik „0 / {N} bloków”')
            await pg.goto(f'{URL}#/dzis?d={d}'); await pg.wait_for_selector('.dz-plan-h, .dz-outside', timeout=20000)
            await pg.evaluate("document.querySelectorAll('details.dz-past').forEach(x => x.open = true)")
            titles = await pg.eval_on_selector_all('.slot-title', 'e => e.map(x => x.textContent.trim())')
            if d < PHASES['start']:
                ok(await pg.locator('.dz-outside').count() == 1, f'{label} {d}: przed początkiem planu (od {PHASES["start"]}) „Dziś” = „Poza planem” (bloki CFA są w widoku CFA)')
            elif d in MOCKS:
                ok(any(t.startswith('Mock CFA') for t in titles), f'{label} {d}: „Dziś” pokazuje sesje mocka ({[t for t in titles if "Mock" in t]})')
            else:
                want = sorted({b2['blok'] for b2 in BY_DAY[d]}); got = sorted(m.group(1) for t in titles if (m := re.match(r'CFA blok ([A-Z])', t)))   # tytuł bieżącego slotu ma dopisek „teraz”
                ok(want == got, f'{label} {d}: „Dziś” — bloki {got} = plan {want}')
            ok(not errs, f'{label} {d}: brak błędów JS ({errs[:2]})')
            await b.close()

        # ---- 2. Odhaczanie bloku i recallu, trwałość, zaległe
        d = sel.get('zwykły dzień roboczy') or sorted(BY_DAY)[1]
        later = [x for x in sorted(BY_DAY) if x > d]
        today = later[2] if len(later) > 2 else later[0]       # „dziś” jest kilka dni po wybranym dniu → bloki dnia d są zaległe
        errs = []; b, pg = await new_page(pw, at(today), errs)
        await pg.goto(f'{URL}#/cfa?v=dzien&d={d}'); await pg.wait_for_selector('.cfa-dayhead', timeout=20000)
        overdue = sum(len(v) for k, v in BY_DAY.items() if k < today)
        hero = ' '.join((await pg.inner_text('.hero-cfa')).split())
        ok(f'Zaległe: {overdue}' in hero, f'zaległe z planu: „Zaległe: {overdue}” (dziś {today})')
        first = pg.locator('.panel:not(.cf-backlog) .cfa-list .cfa-row .set-toggle').first
        await first.click(); await pg.wait_for_timeout(400)
        hero = ' '.join((await pg.inner_text('.hero-cfa')).split())
        ok(f'1 / {N} bloków' in hero and f'Zaległe: {overdue - 1}' in hero, f'po odhaczeniu bloku: 1 / {N}, zaległe {overdue - 1}')
        await pg.reload(); await pg.wait_for_selector('.cfa-dayhead')
        hero = ' '.join((await pg.inner_text('.hero-cfa')).split())
        ok(f'1 / {N} bloków' in hero, 'odhaczenie bloku przetrwało przeładowanie (IndexedDB)')
        if d in NIGHT:
            rec = pg.locator('.cf-recall .set-toggle'); await rec.click(); await pg.wait_for_timeout(300)
            ok(await rec.get_attribute('aria-pressed') == 'true', 'recall odhaczony')
            await pg.reload(); await pg.wait_for_selector('.cfa-dayhead')
            ok(await pg.locator('.cf-recall .set-toggle').get_attribute('aria-pressed') == 'true', 'recall przetrwał przeładowanie')
        await pg.locator('.panel:not(.cf-backlog) .cfa-list .cfa-row .set-toggle').first.click(); await pg.wait_for_timeout(300)
        hero = ' '.join((await pg.inner_text('.hero-cfa')).split())
        ok(f'0 / {N} bloków' in hero, 'cofnięcie odhaczenia wraca do 0')
        ok(not errs, f'odhaczanie: brak błędów JS ({errs[:2]})')
        await b.close()

        # ---- 3. Pozostałe widoki CFA ładują się bez błędów i bez artefaktów tekstowych
        errs = []; b, pg = await new_page(pw, at(sorted(BY_DAY)[3]), errs)
        for v in ('harmonogram', 'kalendarz', 'log', 'plan'):
            await pg.goto(f'{URL}#/cfa?v={v}'); await pg.wait_for_timeout(500)
            txt = (await pg.inner_text('main')).split()
            bad = [w for w in txt if w in ('null', 'undefined', 'NaN') or w.startswith('[object')]
            ok(not bad and not errs and len(txt) > 20, f'#/cfa?v={v}: renderuje się, brak artefaktów ({bad[:3]}, błędy {errs[:1]})')
        await b.close()

        # ---- 4. „Teraz” w środku każdego bloku (jeden blok na dzień planu) — wskazuje blok CFA albo posiłek (zamierzone nakładanie D-101)
        bad = []; meal_ok = 0; checked = 0
        for d2 in sorted(BY_DAY):
            if d2 in MOCKS or d2 < PHASES['start']: continue   # dni poza planem nie mają karty „Teraz”
            sample = [x for x in BY_DAY[d2] if x['blok'] not in ('S1', 'S2') and (x['blok'] in 'JKLMNOP' or x is BY_DAY[d2][0])]
            for blk in sample:
                f, t = blk['godz'].split('–'); mid = (int(f[:2]) * 60 + int(f[3:]) + int(t[:2]) * 60 + int(t[3:])) // 2
                hm = f'{mid // 60:02d}:{mid % 60:02d}'
                errs = []; b, pg = await new_page(pw, at(d2, hm), errs)
                await pg.goto(f'{URL}#/dzis'); await pg.wait_for_selector('.dz-plan-h, .dz-outside', timeout=20000)
                card = ' '.join((await pg.inner_text('.dz-now')).split()) if await pg.locator('.dz-now').count() else ''
                await b.close(); checked += 1
                if f'CFA blok {blk["blok"]}' in card: continue
                if any(k in card for k in ('Posiłek po saunie', 'Powrót do domu')): meal_ok += 1; continue
                bad.append(f'{d2} {hm} (blok {blk["blok"]}): „{card[:70]}”')
        ok(not bad, f'„Teraz” w środku bloku wskazuje blok ({checked} bloków sprawdzonych, {meal_ok} = posiłek w bloku D-101); rozbieżności: {len(bad)}')
        for x in bad: print('       ', x[:150])
        await BROWSER.close()
    print(f'\nBŁĘDÓW: {len(fails)}')
    sys.exit(1 if fails else 0)
asyncio.run(main())
