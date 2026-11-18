"""Strażnik wizualny (D-114, CI — D-115): porównanie dwóch katalogów zrzutów z tools/visual/snap.py.
Użycie: python3 tools/visual/compare.py <przed> <po> [katalog różnic]
Piksel różny = różnica kanału > TOL (szum wygładzania krawędzi pomijany); zrzut różny = więcej niż MIN_PX takich pikseli.
Z katalogiem różnic: obraz „przed | po | różnice” dla każdego zmienionego widoku i podsumowanie `podsumowanie.md` (tabela do GITHUB_STEP_SUMMARY).
Kod wyjścia: 0 — bez różnic; 1 — różnice (zadanie w CI decyduje, czy to błąd — STRICT); 2 — brak plików / inny rozmiar."""
import os, sys, pathlib
from PIL import Image, ImageChops
TOL, MIN_PX = int(os.environ.get('TOL', '24')), int(os.environ.get('MIN_PX', '30'))
a, b = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
out = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else None
if out: out.mkdir(parents=True, exist_ok=True)
changed, missing, rows = [], [], []
files = sorted(a.glob('*.png'))
for f in files:
  g = b / f.name
  if not g.exists(): print('BRAK', f.name); missing.append(f.name); continue
  x, y = Image.open(f).convert('RGB'), Image.open(g).convert('RGB')
  if x.size != y.size:
    print('ROZMIAR', f.name, x.size, y.size); changed.append(f.name); rows.append((f.name, f'rozmiar {x.size} → {y.size}'))
    if out:
      W, H = x.width + y.width + 16, max(x.height, y.height); c = Image.new('RGB', (W, H), (255, 0, 255)); c.paste(x, (0, 0)); c.paste(y, (x.width + 16, 0)); c.save(out / f.name)
    continue
  d = ImageChops.difference(x, y).convert('L').point(lambda v: 255 if v > TOL else 0)
  n = sum(1 for p in d.getdata() if p)
  if n > MIN_PX:
    box = d.getbbox(); print('RÓŻNICA', f.name, n, 'px', box); changed.append(f.name); rows.append((f.name, f'{n} px w obszarze {box}'))
    if out:
      red = Image.new('RGB', x.size, (255, 0, 64)); hl = Image.composite(red, y.point(lambda v: v // 3), d)
      c = Image.new('RGB', (x.width * 3 + 32, x.height), (40, 40, 40)); c.paste(x, (0, 0)); c.paste(y, (x.width + 16, 0)); c.paste(hl, (2 * x.width + 32, 0))
      c.thumbnail((2400, 6000)); c.save(out / f.name)
print('plików:', len(files), 'różnych:', len(changed), 'brakujących:', len(missing))
if out:
  md = ['### Strażnik wizualny', '', f'Zrzutów: {len(files)} · zmienionych: {len(changed)} · brakujących: {len(missing)}', '']
  if rows: md += ['| Widok | Zmiana |', '|---|---|'] + [f'| `{n}` | {t} |' for n, t in rows]
  else: md += ['Bez zmian wyglądu względem bazy.']
  (out / 'podsumowanie.md').write_text('\n'.join(md) + '\n', encoding='utf8')
sys.exit(2 if missing else 1 if changed else 0)
