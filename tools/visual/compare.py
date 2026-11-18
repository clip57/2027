"""Strażnik wizualny (D-114): porównanie dwóch katalogów zrzutów z tools/visual/snap.py — liczba różniących się pikseli (próg 0)."""
import sys, pathlib
from PIL import Image, ImageChops
a, b = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
bad = 0
for f in sorted(a.glob('*.png')):
  g = b / f.name
  if not g.exists(): print('BRAK', f.name); bad += 1; continue
  x, y = Image.open(f).convert('RGB'), Image.open(g).convert('RGB')
  if x.size != y.size: print('ROZMIAR', f.name, x.size, y.size); bad += 1; continue
  d = ImageChops.difference(x, y); box = d.getbbox()
  if box:
    n = sum(1 for p in d.getdata() if p != (0, 0, 0)); print('RÓŻNICA', f.name, n, 'px', box); bad += 1
print('plików:', len(list(a.glob('*.png'))), 'różnych:', bad)
