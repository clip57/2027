"""Podzbiór fontu Inter dla aplikacji (D-111) — odtwarzalny z jednego źródła.

Źródło: pakiet npm inter-ui@4.1.1 (Inter 4.001, OFL — public/fonts/OFL-Inter.txt), plik package/variable/InterVariable.woff2;
suma SHA-256 pakietu sprawdzana przed użyciem. Oś „opsz” ustalona na 14 (jak w dotychczasowych plikach z Google Fonts — te same
szerokości znaków i metryki), oś „wght” zostaje zmienna (100–900).

Wynik (nazwy i podział bez zmian — tools/build.mjs bierze wszystkie pliki z public/fonts):
- public/fonts/inter-latin.woff2 — wszystkie znaki Inter z zakresu `unicode-range` pierwszej reguły @font-face w src/ui/tokens.css
  (Latin-1, interpunkcja ogólna: ’ “ ” € … — także w tekstach wpisywanych przez użytkownika);
- public/fonts/inter-latin-ext.woff2 — Latin Extended-A (polskie i inne litery europejskie), rumuńskie ș ț, najczęstsze znaki
  łączące (tekst rozłożony NFD, np. wklejony z macOS: akcenty, daszek, tylda, kreska, ogonek, cedylla, przecinek dolny …) oraz znaki
  używane w źródłach aplikacji spoza zakresu łacińskiego, które Inter ma
  (strzałki, ≤ ≥ ≈ ≠, ✓, ⌘, indeksy górne …). Zakres `unicode-range` tej reguły w tokens.css skrypt zapisuje sam (dokładnie ten zbiór);
- tools/fonts.json — źródło, sumy plików, pokrycie i znaki wyświetlane fontem systemowym (emoji, znaki bez glifu w Inter);
  test tests/unit/fonts.test.mjs sprawdza, że każdy znak ze źródeł aplikacji jest w podzbiorze albo na tej liście.

Znaki z selektorem emoji (U+FE0F, np. „⚠️”) zostają przy foncie systemowym, nawet gdy Inter ma ich czarno-biały glif.
Uruchomienie: python3 tools/fonts.py [inter-ui-4.1.1.tgz]   (fonttools + brotli; bez argumentu pakiet pobiera `npm pack`)."""
import hashlib, io, json, pathlib, re, subprocess, sys, tarfile, tempfile, unicodedata
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parents[1]
PKG, PKG_SHA = 'inter-ui@4.1.1', 'e392e4d71f18a7c1f23dfecd833d68fa05eeab41862686584e80fd2b5d87e9c0'
MEMBER = 'package/variable/InterVariable.woff2'
OPSZ = 14
FEATURES = ['kern', 'liga', 'calt', 'tnum', 'case', 'ccmp', 'locl', 'mark', 'mkmk']
EXT_BASE = [(0x0100, 0x017F), (0x0218, 0x021B), (0x0300, 0x0308), (0x030A, 0x030C), (0x0326, 0x0328)]   # Extended-B i rzadkie znaki łączące: +30 KB — pominięte
TOKENS = ROOT / 'src/ui/tokens.css'
FACES = ('inter-latin.woff2', 'inter-latin-ext.woff2')


def used_text():
    """Znaki ze źródeł aplikacji (ta sama reguła co w tests/unit/fonts.test.mjs)."""
    files = sorted(p for p in (ROOT / 'src').rglob('*') if p.is_file() and p.suffix in ('.js', '.css', '.html', '.json'))
    return ''.join(p.read_text(encoding='utf8') for p in files + [ROOT / 'public/manifest.webmanifest'])


def ignorable(ch):
    cp = ord(ch)   # sterujące, formatujące (ZWJ, BOM) i selektory wariantu (FE0F — znak emoji)
    return cp < 0x20 or cp == 0x7F or 0xFE00 <= cp <= 0xFE0F or unicodedata.category(ch) == 'Cf'


def parse_ranges(s):
    out = set()
    for part in re.findall(r'U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?', s):
        a = int(part[0], 16); b = int(part[1], 16) if part[1] else a
        out.update(range(a, b + 1))
    return out


def fmt_ranges(cps):
    cps, out = sorted(cps), []
    i = 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1: j += 1
        out.append(f'U+{cps[i]:04X}' + (f'-{cps[j]:04X}' if j > i else ''))
        i = j + 1
    return ', '.join(out)


def face_rules(css):
    """Reguły @font-face z tokens.css: nazwa pliku → (zakres unicode-range, położenie tekstu zakresu)."""
    rules = {}
    for m in re.finditer(r'@font-face\s*\{[^}]*?url\("fonts/([^"]+)"\)[^}]*?unicode-range:\s*([^;]+);', css):
        rules[m.group(1)] = (m.group(2), m.span(2))
    return rules


def source_font(arg):
    if arg: data = pathlib.Path(arg).read_bytes()
    else:
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(['npm', 'pack', PKG, '--pack-destination', tmp, '--silent'], check=True, stdout=subprocess.DEVNULL)
            data = next(pathlib.Path(tmp).glob('*.tgz')).read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    if sha != PKG_SHA: sys.exit(f'Suma SHA-256 pakietu {PKG} nie zgadza się: {sha}')
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tar:
        font = TTFont(io.BytesIO(tar.extractfile(MEMBER).read()), recalcTimestamp=False)   # bez bieżącej daty — wynik powtarzalny
    # usWin z granic pełnego fontu (jak w plikach Google Fonts) — bez przycinania wysokich znaków w Windows; przeglądarki używają
    # metryk typo (USE_TYPO_METRICS), identycznych z dotychczasowymi
    font['OS/2'].usWinAscent, font['OS/2'].usWinDescent = font['head'].yMax, -font['head'].yMin
    font = instancer.instantiateVariableFont(font, {'opsz': OPSZ})
    font.recalcTimestamp = False
    return font


def write_subset(font, cps, path):
    buf = io.BytesIO(); font.save(buf); buf.seek(0)
    f = TTFont(buf, recalcTimestamp=False)
    opts = subset.Options()
    opts.flavor, opts.layout_features, opts.hinting, opts.notdef_outline = 'woff2', FEATURES, False, True
    s = subset.Subsetter(opts); s.populate(unicodes=sorted(cps)); s.subset(f)
    f.flavor = 'woff2'; f.recalcTimestamp = False
    f.save(path)
    return set(f.getBestCmap())


def main():
    font = source_font(sys.argv[1] if len(sys.argv) > 1 else None)
    have = set(font.getBestCmap())
    css = TOKENS.read_text(encoding='utf8')
    rules = face_rules(css)
    if set(rules) != set(FACES): sys.exit(f'tokens.css: oczekiwane reguły @font-face dla {FACES}, są {sorted(rules)}')
    latin_range = parse_ranges(rules['inter-latin.woff2'][0])
    text = used_text()
    emoji = {ord(m.group(1)) for m in re.finditer(r'(.)️', text, re.S)}   # znak z selektorem emoji → font systemowy
    used = {ord(c) for c in text if not ignorable(c)} | {0x20}
    latin = (have & latin_range) - emoji
    ext = {cp for a, b in EXT_BASE for cp in range(a, b + 1)} | (used - latin_range)
    ext = (ext & have) - emoji - latin
    out = ROOT / 'public/fonts'
    got = {'inter-latin.woff2': write_subset(font, latin, out / 'inter-latin.woff2'),
           'inter-latin-ext.woff2': write_subset(font, ext, out / 'inter-latin-ext.woff2')}
    # unicode-range reguły rozszerzonej = dokładnie zawartość pliku (bez spacji i U+0020 dokładanych przez fonttools)
    ext_range = fmt_ranges(got['inter-latin-ext.woff2'] - latin_range)
    a, b = rules['inter-latin-ext.woff2'][1]
    TOKENS.write_text(css[:a] + ext_range + css[b:], encoding='utf8')
    covered = got['inter-latin.woff2'] | got['inter-latin-ext.woff2']
    fallback = ''.join(chr(cp) for cp in sorted(used - covered))
    files = {n: {'sha256': hashlib.sha256((out / n).read_bytes()).hexdigest(), 'bytes': (out / n).stat().st_size,
                 'chars': len(got[n]), 'ranges': fmt_ranges(got[n])} for n in FACES}
    manifest = {'source': {'package': PKG, 'sha256': PKG_SHA, 'file': MEMBER, 'version': font['name'].getDebugName(5)},
                'axes': {'opsz': OPSZ, 'wght': '100–900'}, 'features': FEATURES, 'files': files,
                'fallback': fallback, 'fallbackNote': 'znaki ze źródeł aplikacji wyświetlane fontem systemowym: emoji (także z U+FE0F) i znaki bez glifu w Inter'}
    (ROOT / 'tools/fonts.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    for n in FACES: print(f'{n}: {files[n]["chars"]} znaków, {files[n]["bytes"]} B')
    print(f'font systemowy: {len(fallback)} znaków; unicode-range (rozszerzony): {ext_range}')


if __name__ == '__main__':
    main()
