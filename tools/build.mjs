// Budowa obu wariantów z jednego źródła (D-026). Nie edytuj plików w dist/ ręcznie.
//  dist/web/     — GitHub Pages: index.html + app.<hash>.js + app.<hash>.css + sw.js + manifest + ikony (offline, instalacja)
//  dist/single/  — 2027.html: jeden plik, wszystko wbudowane, bez service workera (Documents by Readdle, plik lokalny)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);
const pkg = JSON.parse(fs.readFileSync(P('package.json'), 'utf8'));

const res = await build({ entryPoints: [P('src/app.js')], bundle: true, format: 'iife', minify: true, write: false,
  target: ['safari16', 'chrome110', 'firefox115'], legalComments: 'none', charset: 'utf8' });
const js = res.outputFiles[0].text;
// Arkusz = tokeny (jedyne źródło wartości) + style modułów + warstwa komponentów systemu projektowego
const css = ['src/ui/tokens.css', 'src/ui/styles.css', 'src/ui/system.css'].map(f => fs.readFileSync(P(f), 'utf8')).join('\n');
const FONTS = fs.readdirSync(P('public/fonts')).filter(f => f.endsWith('.woff2'));
const tpl = fs.readFileSync(P('src/index.html'), 'utf8');
const version = `${pkg.version}+${hash(js + css)}${process.env.BUILD_TAG ? `-${process.env.BUILD_TAG}` : ''}`;
const stamp = `<meta name="app-version" content="${version}">`;

fs.rmSync(P('dist'), { recursive: true, force: true });
fs.mkdirSync(P('dist/web/icons'), { recursive: true });
fs.mkdirSync(P('dist/single'), { recursive: true });

// ---- web
const jsName = `app.${hash(js)}.js`, cssName = `app.${hash(css)}.css`;
fs.writeFileSync(P('dist/web', jsName), js);
fs.writeFileSync(P('dist/web', cssName), css);
for (const f of fs.readdirSync(P('public/icons'))) fs.copyFileSync(P('public/icons', f), P('dist/web/icons', f));
fs.mkdirSync(P('dist/web/fonts'), { recursive: true });
for (const f of fs.readdirSync(P('public/fonts'))) fs.copyFileSync(P('public/fonts', f), P('dist/web/fonts', f));
fs.copyFileSync(P('public/manifest.webmanifest'), P('dist/web/manifest.webmanifest'));
// Uwaga: podstawiamy funkcją, bo treść może zawierać wzorce $&, $` itp. (String.replace by je zinterpretował).
const put = (text, mark, value) => text.replace(mark, () => value);
fs.writeFileSync(P('dist/web/index.html'), put(put(tpl, '<!--HEAD-->',
  `${stamp}\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n<link rel="icon" href="icons/icon-192.png">\n<link rel="stylesheet" href="${cssName}">`),
  '<!--BODY-->', `<script src="${jsName}" defer></script>`));
const shell = ['./', 'index.html', jsName, cssName, ...FONTS.map(f => `fonts/${f}`), 'manifest.webmanifest', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
fs.writeFileSync(P('dist/web/sw.js'), `// Wygenerowane przez tools/build.mjs — wersja ${version}
// Aktualizacja KODU aplikacji (nie danych). Nowa wersja czeka na zgodę użytkownika („Nowa wersja — odśwież”).
const CACHE = 'p2027-v2-${hash(version)}';
const SHELL = ${JSON.stringify(shell)};
self.addEventListener('install', e => e.waitUntil((async () => {
  const before = await caches.keys();
  await (await caches.open(CACHE)).addAll(SHELL);
  // Jednorazowe przejście ze starej wersji (bez obsługi zgody): aktywacja bez przeładowania strony.
  // Otwarta strona działa dalej na starym kodzie; nowy kod uruchomi się przy następnym starcie aplikacji.
  if (!before.some(k => k.startsWith('p2027-v2-'))) await self.skipWaiting();
})()));
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k.startsWith('p2027-') && k !== CACHE).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));
// Dane użytkownika NIE są w pamięci podręcznej — tylko pliki aplikacji. Offline: pliki z pamięci podręcznej.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).catch(() => caches.match('index.html'))));
});
`);
fs.writeFileSync(P('dist/web/.nojekyll'), '');

// ---- single
const icon = 'data:image/png;base64,' + fs.readFileSync(P('public/icons/apple-touch-icon.png')).toString('base64');
const inlineJs = js.replace(/<\/script/gi, () => '<\\/script');
// Wariant jednoplikowy: fonty wbudowane jako data URI (bez zewnętrznych plików)
const cssSingle = FONTS.reduce((c, f) => c.split(`url("fonts/${f}")`).join(`url("data:font/woff2;base64,${fs.readFileSync(P('public/fonts', f)).toString('base64')}")`), css);
const single = put(put(tpl, '<!--HEAD-->', `${stamp}\n<link rel="apple-touch-icon" href="${icon}">\n<style>${cssSingle}</style>`),
  '<!--BODY-->', `<script>window.__SINGLE__=true;</script>\n<script>${inlineJs}</script>`);
// Kontrola: wbudowany skrypt i arkusz muszą być kompletne (wcześniej wzorzec $& obcinał kod).
if (!single.includes(inlineJs) || !single.includes(cssSingle)) throw new Error('Budowa wariantu jednoplikowego uszkodziła wbudowany kod');
fs.writeFileSync(P('dist/single/2027.html'), single);

const size = f => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
console.log(`wersja ${version}\n dist/web: ${jsName} ${size(P('dist/web', jsName))}, ${cssName}\n dist/single/2027.html ${size(P('dist/single/2027.html'))}`);
