// Generuje src/ui/icons.js z wybranych ikon Lucide (licencja ISC, node_modules/lucide-static).
// Uruchom po zmianie listy: node tools/icons.mjs. Wynik jest wersjonowany — build nie wymaga pakietu.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'node_modules/lucide-static/icons');
export const NAMES = ['sun', 'moon', 'monitor', 'utensils', 'dumbbell', 'graduation-cap', 'ellipsis', 'pill', 'package', 'chef-hat',
  'shield-check', 'target', 'database', 'cloud-upload', 'cloud-download', 'panel-left-close', 'panel-left-open', 'chevron-left',
  'chevron-right', 'chevron-down', 'check', 'x', 'triangle-alert', 'info', 'clock', 'calendar', 'flame', 'timer', 'play', 'pause',
  'plus', 'minus', 'search', 'list-checks', 'book-open', 'refresh-cw', 'circle-check', 'shopping-cart', 'heart-pulse', 'zap',
  'square', 'copy', 'skip-forward', 'calendar-clock', 'list-todo',
  'undo-2', 'history', 'bot', 'save', 'receipt', 'sliders-horizontal', 'package-check', 'clock-3',
  'cloud', 'cloud-check', 'cloud-off', 'lock', 'log-in', 'log-out'];
const out = {};
for (const n of NAMES) {
  const svg = fs.readFileSync(path.join(DIR, `${n}.svg`), 'utf8');
  out[n] = [...svg.matchAll(/<(path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*?)\/?>/g)].map(([, tag, attrs]) =>
    [tag, Object.fromEntries([...attrs.matchAll(/([a-z-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]))]);
  if (!out[n].length) throw new Error(`Pusta ikona: ${n}`);
}
fs.writeFileSync(path.join(ROOT, 'src/ui/icons.js'), `// Wygenerowane przez tools/icons.mjs — ikony Lucide (ISC, https://lucide.dev). Nie edytuj ręcznie.
const NS = 'http://www.w3.org/2000/svg';
export const ICONS = ${JSON.stringify(out)};
// Ikona SVG bez innerHTML. Domyślnie dekoracyjna (aria-hidden); z etykietą — rola img.
export function icon(name, { size = 20, label = null, cls = '' } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  const at = { xmlns: NS, width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: \`ico \${cls}\`.trim(), focusable: 'false' };
  Object.entries(at).forEach(([k, v]) => svg.setAttribute(k, String(v)));
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of ICONS[name] || []) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    svg.append(el);
  }
  return svg;
}
`);
console.log('icons.js:', NAMES.length, 'ikon,', fs.statSync(path.join(ROOT, 'src/ui/icons.js')).size, 'B');
