"""M7 (audyt 10.11.2026): obrazy startowe iOS (`apple-touch-startup-image`) dla aplikacji z ekranu początkowego.

iOS nie korzysta z `background_color` z manifestu — bez obrazu startowego przy uruchomieniu widać pusty (biały) ekran.
Obraz musi mieć dokładnie rozdzielczość ekranu urządzenia (szerokość × wysokość × gęstość pikseli, orientacja pionowa),
dlatego jest po jednym pliku na rozmiar ekranu iPhone'a obsługiwanego przez iOS 26/27. iOS pobiera obraz przy dodawaniu
aplikacji do ekranu początkowego — istniejąca instalacja dostanie go po usunięciu ikony i ponownym dodaniu z Safari.

Wygląd: tło motywu ciemnego (#090a0d, jak `background_color` i `theme_color`) i znak aplikacji (pierścień + „27”, jak ikona)
rysowany wektorowo — płaskie tło kompresuje się do kilku KB, więc pliki mogą trafić do listy SHELL service workera (zasada §3.7).

Uruchomienie (wymaga Playwright i Pillow dla Pythona, jak testy E2E i strażnik wizualny):  python3 tools/splash.py
Wynik: public/splash/splash-<szer>x<wys>.png  i  public/splash/splash.json (lista z zapytaniami media dla tools/build.mjs).
"""
import io, json, pathlib, base64
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'splash'
BG = '#090a0d'
# Ekrany iPhone'ów (pionowo): szerokość i wysokość w punktach CSS, gęstość pikseli — od iPhone'a SE (2. gen.) do serii 17
DEVICES = [
    (375, 667, 2),   # SE 2./3. gen.
    (375, 812, 3),   # 11 Pro, 12 mini, 13 mini
    (414, 896, 2),   # 11
    (414, 896, 3),   # 11 Pro Max
    (390, 844, 3),   # 12, 12 Pro, 13, 13 Pro, 14, 16e
    (428, 926, 3),   # 12 Pro Max, 13 Pro Max, 14 Plus
    (393, 852, 3),   # 14 Pro, 15, 15 Pro, 16
    (430, 932, 3),   # 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
    (402, 874, 3),   # 16 Pro, 17, 17 Pro
    (440, 956, 3),   # 16 Pro Max, 17 Pro Max
    (420, 912, 3),   # Air
]

FONT = base64.b64encode((ROOT / 'public' / 'fonts' / 'inter-display.woff2').read_bytes()).decode()
HTML = f"""<!doctype html><meta charset="utf-8">
<style>
@font-face {{ font-family: D; src: url(data:font/woff2;base64,{FONT}) format('woff2'); font-weight: 100 900; }}
html, body {{ margin: 0; height: 100%; background: {BG}; }}
body {{ display: grid; place-items: center; }}
svg {{ width: 112px; height: 112px; }}
text {{ font-family: D, system-ui, sans-serif; font-weight: 650; font-size: 40px; letter-spacing: -1px; fill: #f4f3f8; }}
</style>
<svg viewBox="0 0 112 112" aria-hidden="true">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9bcff"/><stop offset="1" stop-color="#7a66f0"/></linearGradient></defs>
  <circle cx="56" cy="56" r="46" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="7"/>
  <circle cx="56" cy="56" r="46" fill="none" stroke="url(#g)" stroke-width="7" stroke-linecap="round"
          stroke-dasharray="{2 * 3.14159265 * 46 * 0.83:.2f} 999" transform="rotate(-90 56 56)"/>
  <text x="56" y="56" text-anchor="middle" dominant-baseline="central">27</text>
</svg>"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('splash-*.png'):
        old.unlink()
    entries = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w, h, dpr in DEVICES:
            pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=dpr)
            pg.set_content(HTML)
            pg.evaluate('document.fonts.ready')
            name = f'splash-{w * dpr}x{h * dpr}.png'
            # paleta 64 kolorów + maksymalna kompresja: płaskie tło i znak — kilka KB zamiast ok. 35 KB z przeglądarki
            img = Image.open(io.BytesIO(pg.screenshot())).convert('RGB').quantize(colors=64, method=Image.Quantize.MEDIANCUT)
            img.save(OUT / name, optimize=True)
            pg.close()
            entries.append({'file': name, 'media': f'(device-width: {w}px) and (device-height: {h}px) and '
                                                  f'(-webkit-device-pixel-ratio: {dpr}) and (orientation: portrait)'})
        b.close()
    (OUT / 'splash.json').write_text(json.dumps(entries, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    total = sum((OUT / e['file']).stat().st_size for e in entries)
    print(f'{len(entries)} obrazów startowych, razem {total / 1024:.0f} KB → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
