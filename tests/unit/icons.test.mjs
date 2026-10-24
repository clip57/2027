// Ikony Lucide (tools/icons.mjs → src/ui/icons.js): każdy element ze wszystkimi atrybutami z pliku SVG (B7, audyt 23.10.2026 —
// atrybuty z cyfrą w nazwie, np. x1/y2, były gubione i ikony „timer” i „monitor” rysowały się bez linii).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS } from '../../src/ui/icons.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../node_modules/lucide-static/icons');
const hasSrc = fs.existsSync(DIR);

test('każdy element ikony ma atrybuty (brak pustych elementów)', () => {
  for (const [name, els] of Object.entries(ICONS)) for (const [tag, attrs] of els) assert.ok(Object.keys(attrs).length > 0, `${name}: pusty element <${tag}>`);
  for (const [, attrs] of ICONS.timer.filter(([t]) => t === 'line')) for (const k of ['x1', 'x2', 'y1', 'y2']) assert.ok(k in attrs, `timer: linia bez ${k}`);
});

test('ikony zgodne z plikami SVG Lucide (elementy i wszystkie atrybuty)', { skip: !hasSrc && 'brak node_modules/lucide-static' }, () => {
  for (const [name, els] of Object.entries(ICONS)) {
    const svg = fs.readFileSync(path.join(DIR, `${name}.svg`), 'utf8').replace(/<svg[\s\S]*?>/, '');
    const src = [...svg.matchAll(/<(\w+)\b([^>]*?)\/?>/g)].filter(([, t]) => t !== 'svg')
      .map(([, t, a]) => [t, Object.fromEntries([...a.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]))]);
    assert.deepEqual(els, src, name);
  }
});
