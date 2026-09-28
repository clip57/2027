"""SYNTETYCZNE dane testowe (fikcyjne) dla konfiguracji bez plików użytkownika (bez SOURCES_DIR / PRIVATE_PACK).

Nie są to kopie ani rekonstrukcje danych użytkownika: stany zapasów są wyliczane wzorem z katalogu (zużycie dzienne ×
umowna liczba dni), a pakiet prywatny zawiera wyłącznie neutralne teksty zastępcze „[DANE TESTOWE] …” — bez żadnych
danych osobowych ani medycznych. Pliki powstają w katalogu tymczasowym przy każdym uruchomieniu testów i nie trafiają
do repozytorium (D-035). Format plików = istniejące formaty importu (kopia ZAPASY v31, pakiet prywatny 2027-private)."""
import datetime as dt, json, pathlib, re, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
CYCLE = [1.5, 3, 6, 12, 25]          # umowne „dni zapasu” — mieszanka stanów pilnych, niskich i wystarczających


def _catalog():
    return json.loads((ROOT / 'src/data/catalog.json').read_text(encoding='utf8'))['items']


def _seeded():
    return {s['prod'] for s in json.loads((ROOT / 'src/data/seeds.json').read_text(encoding='utf8'))['counts']}


def synthetic_zapasy(last_sync=None):
    """Kopia w formacie ZAPASY v31 z fikcyjnymi stanami. Zwraca (obiekt, liczba_zdarzeń_po_imporcie, stany)."""
    last_sync = last_sync or (dt.date.today() - dt.timedelta(days=1))
    seeded, stocks, products = _seeded(), {}, []
    items = [i for i in _catalog() if i.get('tracked') is not False and i['id'] not in seeded]
    for n, it in enumerate(items):
        daily = it.get('daily_v31') or 1
        stocks[it['id']] = round(daily * CYCLE[n % len(CYCLE)], 2)
        products.append({'id': it['id'], 'name': it['name'], 'unit': it['unit'], 'packSize': it['packSize'], 'daily': daily})
    obj = {'app': 'Spizarnia_Dieta_2027T', 'version': 31, '_note': 'SYNTETYCZNE DANE TESTOWE — wartości fikcyjne',
           'lastSyncDate': last_sync.isoformat(), 'exportDate': f'{last_sync.isoformat()}T21:00:00.000Z',
           'products': products, 'stocks': stocks,
           'logs': [{'id': 'syn-1', 'time': f'{last_sync.isoformat()} 20:00', 'desc': '[DANE TESTOWE] inwentaryzacja'},
                    {'id': 'syn-2', 'time': f'{last_sync.isoformat()} 20:05', 'desc': '[DANE TESTOWE] zakup'}]}
    events = len(stocks) + len(seeded) + 1          # stany + suplementy czasowe D-015 (seeds.json) + archiwum historii
    return obj, events, stocks


def _markers(path):
    return sorted({int(m) for m in re.findall(r'\{private:(\d+)\}', (ROOT / path).read_text(encoding='utf8'))})


def rekomp_marker_uses():
    """Liczba wystąpień znaczników {private:N} w treści Rekompozycji (każde = jeden wstawiony fragment .priv-in)."""
    return len(re.findall(r'\{private:\d+\}', (ROOT / 'src/data/rekomp.json').read_text(encoding='utf8')))


def synthetic_private_pack():
    """Pakiet prywatny o poprawnej strukturze, z neutralnymi tekstami zastępczymi (bez danych osobowych/medycznych)."""
    t = lambda s: f'[DANE TESTOWE] {s}'
    plan = json.loads((ROOT / 'src/data/phases.json').read_text(encoding='utf8'))
    return {'format': '2027-private', 'schema': 1, 'created': '2026-01-01', 'decision': 'D-035', 'source': 'tests/e2e/fixtures.py',
            'plan': {'start': plan['start'], 'decision': 'D-091'},   # metadane wersji planu (jak w generatorze, D-091)
            'sections': [
                {'id': 'rek-s1', 'title': t('sekcja 1'), 'blocks': [{'type': 'h', 'text': t('nagłówek')}, {'type': 'p', 'text': t('akapit')},
                                                                     {'type': 'list', 'items': [t('punkt 1'), t('punkt 2')]},
                                                                     {'type': 'table', 'rows': [['Kolumna A', 'Kolumna B'], ['—', '—']]}]},
                {'id': 'rek-s21', 'title': t('sekcja 21'), 'blocks': [{'type': 'p', 'text': t('akapit')}]},
                {'id': 'mp-why', 'title': t('Meal Prep'), 'blocks': [{'type': 'p', 'text': t(f'fragment MP {n}'), 'marker': n} for n in _markers('src/data/mealprep.json')]},
                {'id': 'rek-priv', 'title': t('Rekompozycja'), 'blocks': [{'type': 'p', 'text': t(f'fragment {n}'), 'marker': n} for n in _markers('src/data/rekomp.json')]},
            ]}


def synthetic_care_plan():
    """Plan pielęgnacji (format 2027-care, D-094) wyłącznie z tekstów zastępczych — bez nazw produktów, leków i danych osobowych.
    Obejmuje wszystkie reguły: codziennie, dni tygodnia, okres od–do, doraźnie, ostrzeżenie, odczekanie, powiązanie ze slotem."""
    t = lambda s: f'[DANE TESTOWE] {s}'
    products = [{'id': f'p.t{i}', 'name': t(f'Produkt {c}'), 'area': a, 'status': st}
                for i, (c, a, st) in enumerate([('A', 'twarz', 'uzywany'), ('B', 'wlosy', 'uzywany'), ('C', 'cialo', 'zapas'),
                                                ('D', 'jama', 'uzywany'), ('E', 'detale', 'skonczony')], 1)]
    step = lambda i, pora, group, text, **k: {'id': f's.t{i}', 'pora': pora, 'group': t(group), 'order': i, 'text': t(text), **k}
    steps = [
        step(1, 'rano', 'Twarz', 'krok poranny 1', product='p.t1', slot='slot.0700'),
        step(2, 'rano', 'Twarz', 'krok poranny 2', warn=t('ostrzeżenie'), wait=10, slot='slot.0700'),
        step(3, 'rano', 'Jama ustna', 'krok poranny 3', product='p.t4', slot='slot.0700'),
        step(4, 'dzien', 'Twarz', 'krok doraźny', asNeeded=True),
        step(5, 'dzien', 'Twarz', 'krok w ciągu dnia'),
        step(6, 'wieczor', 'Włosy', 'krok PN i PT do 11.10', product='p.t2', days=[1, 5], until='2026-10-11', slot='slot.2035'),
        step(7, 'wieczor', 'Włosy', 'krok PN od 12.10', product='p.t2', days=[1], **{'from': '2026-10-12'}, slot='slot.2035'),
        step(8, 'wieczor', 'Ciało', 'krok ŚR i ND', product='p.t3', days=[3, 7]),
        step(9, 'wieczor', 'Ciało', 'krok niedzielny', days=[7], slot='slot.2015n'),
        step(10, 'wieczor', 'Twarz', 'krok wieczorny', product='p.t1', slot='slot.2145'),
    ]
    return {'format': '2027-care', 'schema': 1, 'created': '2026-01-01', 'source': 'tests/e2e/fixtures.py', 'products': products, 'steps': steps}


def write(obj, name):
    p = pathlib.Path(tempfile.mkdtemp(prefix='p2027-syn-')) / name
    p.write_text(json.dumps(obj, ensure_ascii=False), encoding='utf8')
    return p
