// Tokeny wyglądu (src/ui/tokens.css): spójność motywu ciemnego i kontrast WCAG par używanych w interfejsie.
// Uzupełnia axe-core, który nie widzi stanów (odhaczone serie, zwinięte sekcje) ani tła z color-mix().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../../src/ui/tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const block = (start) => { const i = css.indexOf(start); assert.ok(i >= 0, `brak bloku ${start}`); const a = css.indexOf('{', i + start.length - 1); return css.slice(a + 1, css.indexOf('}', a)); };
const vars = (body) => Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
const light = vars(block(':root {'));
const dark = vars(block(':root[data-theme="dark"] {'));
const darkSystem = vars(block(':root:not([data-theme]) {'));

const lum = (hex) => {
  const n = hex.replace('#', ''), full = n.length === 3 ? [...n].map(c => c + c).join('') : n;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('motyw ciemny: blok ręczny i systemowy są identyczne', () => {
  assert.deepEqual(darkSystem, dark);
});

test('motyw ciemny nadpisuje każdy kolor motywu jasnego', () => {
  const colors = Object.keys(light).filter(k => /^#[0-9a-f]{3,8}$/i.test(light[k]));
  assert.deepEqual(colors.filter(k => !(k in dark)), []);
});

// [tekst/element, tło, minimalny kontrast] — tekst 4,5:1, elementy interfejsu 3:1 (WCAG 1.4.3, 1.4.11)
const PAIRS = [
  ['--text', '--bg', 4.5], ['--text', '--surface', 4.5], ['--text', '--surface-2', 4.5], ['--text', '--sunken', 4.5],
  ['--text-2', '--surface', 4.5], ['--text-2', '--sunken', 4.5], ['--muted', '--surface', 4.5], ['--muted', '--bg', 4.5],
  ['--accent', '--surface', 4.5], ['--accent-ink', '--accent', 4.5],
  ['--on-success', '--success', 4.5],                                      // odhaczona seria / blok CFA
  ['--success', '--surface', 4.5], ['--warning', '--surface', 4.5], ['--danger', '--surface', 4.5],
  ['--cfa', '--surface', 4.5], ['--train', '--surface', 4.5], ['--regen', '--surface', 4.5], // tekst w kolorze domeny (plakietki, opisy)
  ['--p-col', '--surface', 4.5], ['--c-col', '--surface', 4.5], ['--f-col', '--surface', 4.5], ['--org', '--surface', 4.5],
  ['--warn-ink', '--warn-bg', 4.5], ['--ok-ink', '--surface', 4.5],
  ['--border-strong', '--surface', 3],
];
for (const [name, theme] of [['jasny', light], ['ciemny', { ...light, ...dark }]]) {
  test(`kontrast par tokenów — motyw ${name}`, () => {
    const bad = PAIRS.map(([f, b, min]) => [f, b, min, ratio(theme[f], theme[b])]).filter(([, , min, r]) => r < min)
      .map(([f, b, min, r]) => `${f} na ${b}: ${r.toFixed(2)} < ${min}`);
    assert.deepEqual(bad, []);
  });
}
