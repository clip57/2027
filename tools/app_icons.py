"""Ikony aplikacji (D-110): znak „27” w pierścieniu postępu na tle „aurora” — ten sam język co znak w panelu bocznym.
Generuje public/icons/{apple-touch-icon,icon-192,icon-512,icon-maskable-512}.png z jednego rysunku SVG (Playwright + Chromium,
font Inter z public/fonts wbudowany jako data:). Treść znaku mieści się w strefie bezpiecznej ikon maskowalnych (koło 80 %).
Uruchomienie: python3 tools/app_icons.py   (wymaga Playwright dla Pythona i Pillow — jak testy E2E)."""
import asyncio, base64, io, pathlib
from PIL import Image
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/icons'
FONT = base64.b64encode((ROOT / 'public/fonts/inter-latin.woff2').read_bytes()).decode()
R, W = 318, 46                      # promień i grubość pierścienia (1024 px); zewnętrzna krawędź 341 px < 409 px (strefa bezpieczna)
ARC = 2 * 3.14159265 * R * 0.78     # łuk 78 % — „plan w toku”

SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
<defs>
  <radialGradient id="bg" cx="28%" cy="16%" r="100%"><stop offset="0" stop-color="#23245a"/><stop offset=".42" stop-color="#0e0f1d"/><stop offset="1" stop-color="#07080c"/></radialGradient>
  <radialGradient id="g2" cx="92%" cy="96%" r="62%"><stop offset="0" stop-color="#6fd6c9" stop-opacity=".22"/><stop offset="1" stop-color="#6fd6c9" stop-opacity="0"/></radialGradient>
  <linearGradient id="arc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4d5ff"/><stop offset=".5" stop-color="#a5a8ff"/><stop offset="1" stop-color="#c9a0ff"/></linearGradient>
  <linearGradient id="txt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d6d8ff"/></linearGradient>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
</defs>
<rect width="1024" height="1024" fill="url(#bg)"/>
<rect width="1024" height="1024" fill="url(#g2)"/>
<circle cx="512" cy="512" r="{R}" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="{W}"/>
<circle cx="512" cy="512" r="{R}" fill="none" stroke="url(#arc)" stroke-width="{W}" stroke-linecap="round" stroke-dasharray="{ARC:.1f} 9999" transform="rotate(-90 512 512)" filter="url(#soft)" opacity=".75"/>
<circle cx="512" cy="512" r="{R}" fill="none" stroke="url(#arc)" stroke-width="{W}" stroke-linecap="round" stroke-dasharray="{ARC:.1f} 9999" transform="rotate(-90 512 512)"/>
<text x="512" y="520" text-anchor="middle" dominant-baseline="central" font-family="Inter" font-weight="800" font-size="290" letter-spacing="-14" fill="url(#txt)">27</text>
</svg>"""

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: "Inter"; font-weight: 100 900; src: url(data:font/woff2;base64,{FONT}) format("woff2"); }}
html, body {{ margin: 0; background: #07080c; }} svg {{ display: block; }}
</style></head><body>{SVG}</body></html>"""

SIZES = {'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512, 'icon-maskable-512.png': 512}


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1024, 'height': 1024})
        await pg.set_content(HTML)
        await pg.evaluate('document.fonts.ready')
        png = await pg.locator('svg').screenshot()
        await b.close()
    big = Image.open(io.BytesIO(png)).convert('RGB')
    for name, size in SIZES.items():
        # paleta 256 kolorów z ditheringiem — gradienty bez pasm, plik kilka razy mniejszy (ikona trafia też do 2027.html jako data:)
        im = big.resize((size, size), Image.LANCZOS).quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        im.save(OUT / name, optimize=True)
        print(f'{name}: {size}×{size}, {(OUT / name).stat().st_size} B')


if __name__ == '__main__':
    asyncio.run(main())
