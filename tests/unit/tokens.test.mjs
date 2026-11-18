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

// D-114: kolory zapisane w OKLCH (oklch(L C H)) albo szesnastkowo — przeliczenie na sRGB (OKLab, B. Ottosson; poza gamutem — przycięcie)
const gam = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
export const rgbOf = (c) => {
  const m = String(c).trim().match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (m) {
    const L = Number(m[1]) / (m[2] ? 100 : 1), C = Number(m[3]), H = (Number(m[4]) * Math.PI) / 180, a = C * Math.cos(H), b = C * Math.sin(H);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s]
      .map(v => Math.round(Math.min(1, Math.max(0, gam(v))) * 255) / 255);
  }
  assert.match(String(c), /^#[0-9a-f]{3,8}$/i, `nieznany zapis koloru: ${c}`);
  const n = c.replace('#', ''), full = n.length === 3 ? [...n].map(x => x + x).join('') : n;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
};
const lum = (c) => {
  const [r, g, b] = rgbOf(c).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('motyw ciemny: blok ręczny i systemowy są identyczne', () => {
  assert.deepEqual(darkSystem, dark);
});

test('motyw ciemny nadpisuje każdy kolor motywu jasnego', () => {
  const colors = Object.keys(light).filter(k => /^(#[0-9a-f]{3,8}|oklch\()/i.test(light[k]));
  assert.deepEqual(colors.filter(k => !(k in dark)), []);
});

// [tekst/element, tło, minimalny kontrast] — tekst 4,5:1, elementy interfejsu 3:1 (WCAG 1.4.3, 1.4.11)
const PAIRS = [
  ['--text', '--bg', 4.5], ['--text', '--surface', 4.5], ['--text', '--surface-2', 4.5], ['--text', '--sunken', 4.5],
  ['--text-2', '--surface', 4.5], ['--text-2', '--sunken', 4.5], ['--muted', '--surface', 4.5], ['--muted', '--bg', 4.5],
  ['--accent', '--surface', 4.5], ['--accent-ink', '--accent', 4.5],
  ['--on-success', '--success', 4.5],                                      // odhaczona seria / blok CFA
  ['--success', '--surface', 4.5], ['--warning', '--surface', 4.5], ['--danger', '--surface', 4.5],
  ['--cfa', '--surface', 4.5], ['--train', '--surface', 4.5], ['--regen', '--surface', 4.5], ['--care', '--surface', 4.5], ['--care', '--bg', 4.5], // tekst w kolorze domeny (plakietki, opisy)
  ['--p-col', '--surface', 4.5], ['--c-col', '--surface', 4.5], ['--f-col', '--surface', 4.5], ['--org', '--surface', 4.5],
  ['--warn-ink', '--warn-bg', 4.5], ['--ok-ink', '--surface', 4.5],
  ['--border-strong', '--surface', 3],
  // System 2.0 (D-110): przycisk domyślny (--btn), górny kraniec gradientu przycisku głównego (--accent-hi), aktywna zakładka (--accent-soft)
  ['--text', '--btn', 4.5], ['--text-2', '--btn', 4.5], ['--muted', '--btn', 4.5], ['--danger', '--btn', 4.5],
  ['--accent-ink', '--accent-hi', 4.5], ['--accent', '--accent-soft', 4.5], ['--text-2', '--bg', 4.5],
];
for (const [name, theme] of [['jasny', light], ['ciemny', { ...light, ...dark }]]) {
  test(`kontrast par tokenów — motyw ${name}`, () => {
    const bad = PAIRS.map(([f, b, min]) => [f, b, min, ratio(theme[f], theme[b])]).filter(([, , min, r]) => r < min)
      .map(([f, b, min, r]) => `${f} na ${b}: ${r.toFixed(2)} < ${min}`);
    assert.deepEqual(bad, []);
  });
}

// D-113: akcenty z Ustawień (data-accent) — kontrast par akcentu w obu motywach; blok systemowy ciemny = ręczny ciemny
const ACCENT_PAIRS = [['--accent', '--surface', 4.5], ['--accent', '--bg', 4.5], ['--accent-ink', '--accent', 4.5], ['--accent-ink', '--accent-hi', 4.5], ['--accent', '--accent-soft', 4.5]];
for (const name of ['teal', 'amber']) {
  const l = vars(block(`:root[data-accent="${name}"] {`)), d = vars(block(`:root[data-theme="dark"][data-accent="${name}"] {`));
  const ds = vars(block(`:root:not([data-theme])[data-accent="${name}"] {`));
  test(`akcent ${name}: blok systemowy ciemny = ręczny ciemny`, () => assert.deepEqual(ds, d));
  for (const [tn, theme] of [['jasny', { ...light, ...l }], ['ciemny', { ...light, ...dark, ...d }]]) {
    test(`akcent ${name} — kontrast par (${tn})`, () => {
      const bad = ACCENT_PAIRS.map(([f, b, min]) => [f, b, min, ratio(theme[f], theme[b])]).filter(([, , min, r]) => r < min).map(([f, b, min, r]) => `${f} na ${b}: ${r.toFixed(2)} < ${min}`);
      assert.deepEqual(bad, []);
    });
  }
}

// D-114: głęboka czerń (OLED) — tylko w motywie ciemnym; blok systemowy = ręczny, te same pary kontrastu na czarnym tle i uniesionych powierzchniach
const oled = vars(block(':root[data-oled][data-theme="dark"] {'));
const oledSystem = vars(block(':root[data-oled]:not([data-theme]) {'));
test('OLED: blok systemowy ciemny = ręczny ciemny', () => assert.deepEqual(oledSystem, oled));
test('kontrast par tokenów — motyw ciemny OLED', () => {
  const theme = { ...light, ...dark, ...oled };
  const bad = PAIRS.map(([f, b, min]) => [f, b, min, ratio(theme[f], theme[b])]).filter(([, , min, r]) => r < min).map(([f, b, min, r]) => `${f} na ${b}: ${r.toFixed(2)} < ${min}`);
  assert.deepEqual(bad, []);
});
// D-114: kolory zapisane w OKLCH mieszczą się w gamucie sRGB — tolerancja 3/255 (zaokrąglenie zapisu kolorów na granicy gamutu, np. kanał 0 lub 255);
// kolor dalej poza gamutem byłby na ekranie przycięty i różniłby się od projektu
test('kolory OKLCH w gamucie sRGB', () => {
  const out = [];
  for (const [name, t] of [['jasny', light], ['ciemny', dark], ['OLED', oled]]) for (const [k, v] of Object.entries(t)) {
    const m = String(v).match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
    if (!m) continue;
    const L = +m[1], C = +m[2], H = (+m[3] * Math.PI) / 180, a = C * Math.cos(H), b = C * Math.sin(H);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin = [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s];
    if (lin.some(x => x < -3 / 255 || x > 1 + 3 / 255)) out.push(`${name} ${k}: ${v}`);
  }
  assert.deepEqual(out, []);
});
