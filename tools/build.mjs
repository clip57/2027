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
const css = fs.readFileSync(P('src/ui/styles.css'), 'utf8');
const tpl = fs.readFileSync(P('src/index.html'), 'utf8');
const version = `${pkg.version}+${hash(js + css)}`;
const stamp = `<meta name="app-version" content="${version}">`;

fs.rmSync(P('dist'), { recursive: true, force: true });
fs.mkdirSync(P('dist/web/icons'), { recursive: true });
fs.mkdirSync(P('dist/single'), { recursive: true });

// ---- web
const jsName = `app.${hash(js)}.js`, cssName = `app.${hash(css)}.css`;
fs.writeFileSync(P('dist/web', jsName), js);
fs.writeFileSync(P('dist/web', cssName), css);
for (const f of fs.readdirSync(P('public/icons'))) fs.copyFileSync(P('public/icons', f), P('dist/web/icons', f));
fs.copyFileSync(P('public/manifest.webmanifest'), P('dist/web/manifest.webmanifest'));
fs.writeFileSync(P('dist/web/index.html'), tpl
  .replace('<!--HEAD-->', `${stamp}\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n<link rel="icon" href="icons/icon-192.png">\n<link rel="stylesheet" href="${cssName}">`)
  .replace('<!--BODY-->', `<script src="${jsName}" defer></script>`));
const shell = ['./', 'index.html', jsName, cssName, 'manifest.webmanifest', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
fs.writeFileSync(P('dist/web/sw.js'), `// Wygenerowane przez tools/build.mjs — wersja ${version}
const CACHE = 'p2027-${hash(version)}';
const SHELL = ${JSON.stringify(shell)};
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('p2027-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).catch(() => caches.match('index.html'))));
});
`);
fs.writeFileSync(P('dist/web/.nojekyll'), '');

// ---- single
const icon = 'data:image/png;base64,' + fs.readFileSync(P('public/icons/apple-touch-icon.png')).toString('base64');
fs.writeFileSync(P('dist/single/2027.html'), tpl
  .replace('<!--HEAD-->', `${stamp}\n<link rel="apple-touch-icon" href="${icon}">\n<style>${css}</style>`)
  .replace('<!--BODY-->', `<script>window.__SINGLE__=true;</script>\n<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`));

const size = f => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
console.log(`wersja ${version}\n dist/web: ${jsName} ${size(P('dist/web', jsName))}, ${cssName}\n dist/single/2027.html ${size(P('dist/single/2027.html'))}`);
