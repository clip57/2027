// T1 (audyt 10.11.2026): strażnik stylów — warstwa `instrument` tylko na tokenach, starsza warstwa `legacy` nie rośnie (nowe reguły tylko
// w instrument.css — D-114), żadnych reguł dla klas, których nie tworzy kod ani dane (martwy CSS nie wraca po porządkach).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const noComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
const LEGACY = { 'src/ui/styles.css': 908, 'src/ui/system.css': 877, 'src/ui/precision.css': 447 };   // liczba linii po porządkach T1 (22.11.2026)

test('T1: instrument.css — kolory wyłącznie z tokenów (bez #hex, rgb(), hsl(), oklch() wpisanych w regułę)', () => {
  const css = noComments(read('src/ui/instrument.css'));
  const hits = [...css.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/gi)].map(m => m[0]);
  assert.deepEqual(hits, [], 'kolor poza tokens.css');
});

test('T1: instrument.css — rozmiar pisma z tokenów (wyjątek: tekst w SVG w jednostkach rysunku)', () => {
  const SVG_TEXT = ['.dl-lab text', '.ch-scrub-t'];   // <text> w SVG tarczy i wykresu — jednostki układu współrzędnych rysunku
  const css = noComments(read('src/ui/instrument.css'));
  const bad = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim(), body = m[2];
    for (const d of body.matchAll(/font-size\s*:\s*([^;]+)/g)) {
      const v = d[1].trim();
      if (/^(var\(|inherit|clamp\(|calc\(var|[\d.]+(em|%)$)/.test(v) || SVG_TEXT.some(s => sel.includes(s))) continue;
      bad.push(`${sel} → ${v}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('T1: starsza warstwa stylów (legacy) nie rośnie — nowe reguły tylko w instrument.css (D-114)', () => {
  for (const [f, max] of Object.entries(LEGACY)) {
    const n = read(f).split('\n').length - 1;
    assert.ok(n <= max, `${f}: ${n} linii (limit ${max}) — przenieś regułę do src/ui/instrument.css`);
  }
});

test('T1: każda klasa z arkuszy jest tworzona przez kod lub dane (bez martwego CSS)', () => {
  const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const code = walk('src').filter(f => (/\.(js|html|json)$/.test(f)) && !f.endsWith('icons.js')).map(read).join('\n');
  const dyn = new Set([...code.matchAll(/([a-z][a-z0-9-]*-)\$\{/g)].map(m => m[1]));   // klasy składane w szablonach (`mw-p-${…}`)
  const used = c => new RegExp(`(?<![\\w-])${c.replace(/[-]/g, '\\-')}(?![\\w-])`).test(code) || [...dyn].some(p => c.startsWith(p));
  for (const f of ['src/ui/styles.css', 'src/ui/system.css', 'src/ui/precision.css', 'src/ui/instrument.css']) {
    const classes = new Set([...noComments(read(f)).replace(/url\([^)]*\)/g, '').matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
    const dead = [...classes].filter(c => !used(c));
    assert.deepEqual(dead, [], `${f}: klasy bez użycia w kodzie i danych`);
  }
});
