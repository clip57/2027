// Podzbiór fontu Inter (D-111, tools/fonts.py → public/fonts/*.woff2 + tools/fonts.json): pliki odpowiadają opisowi, reguły
// @font-face w tokens.css obejmują ich znaki, a każdy znak ze źródeł aplikacji jest w podzbiorze albo świadomie przy foncie
// systemowym (emoji, znaki bez glifu w Inter). Nowy znak w tekstach → `python3 tools/fonts.py` (skrypt dopisze go do podzbioru
// albo do listy fontu systemowego).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/fonts.json'), 'utf8'));
const ranges = s => { const out = new Set(); for (const [, a, b] of s.matchAll(/U\+([0-9A-F]+)(?:-([0-9A-F]+))?/gi)) for (let c = parseInt(a, 16); c <= parseInt(b || a, 16); c++) out.add(c); return out; };
const hex = c => `U+${c.toString(16).toUpperCase().padStart(4, '0')} „${String.fromCodePoint(c)}”`;

// Ta sama reguła co used_text() / ignorable() w tools/fonts.py
function usedText() {
  const files = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|css|html|json)$/.test(e.name)) files.push(p); } };
  walk(path.join(ROOT, 'src'));
  return files.sort().concat(path.join(ROOT, 'public/manifest.webmanifest')).map(f => fs.readFileSync(f, 'utf8')).join('');
}
const ignorable = ch => { const c = ch.codePointAt(0); return c < 0x20 || c === 0x7f || (c >= 0xfe00 && c <= 0xfe0f) || /\p{Cf}/u.test(ch); };

const covered = new Set(Object.values(M.files).flatMap(f => [...ranges(f.ranges)]));

test('pliki fontu odpowiadają opisowi w tools/fonts.json (sumy SHA-256)', () => {
  assert.deepEqual(fs.readdirSync(path.join(ROOT, 'public/fonts')).filter(f => f.endsWith('.woff2')).sort(), Object.keys(M.files).sort());
  for (const [name, f] of Object.entries(M.files)) {
    const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'public/fonts', name))).digest('hex');
    assert.equal(sha, f.sha256, `${name}: plik różni się od wygenerowanego skryptem — uruchom python3 tools/fonts.py`);
  }
});

test('unicode-range w tokens.css obejmuje znaki każdego pliku', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/ui/tokens.css'), 'utf8');
  const rules = Object.fromEntries([...css.matchAll(/@font-face\s*\{[^}]*?url\("fonts\/([^"]+)"\)[^}]*?unicode-range:\s*([^;]+);/g)].map(m => [m[1], ranges(m[2])]));
  for (const [name, f] of Object.entries(M.files)) {
    assert.ok(rules[name], `brak reguły @font-face dla ${name}`);
    const out = [...ranges(f.ranges)].filter(c => c > 0x20 && !rules[name].has(c));
    assert.deepEqual(out.map(hex), [], `${name}: znaki poza unicode-range (przeglądarka ich z tego pliku nie użyje)`);
  }
});

test('każdy znak ze źródeł aplikacji: w podzbiorze Inter albo na liście fontu systemowego', () => {
  const text = usedText(), fallback = new Set([...M.fallback].map(c => c.codePointAt(0)));
  const missing = new Set();
  for (const ch of text) { const c = ch.codePointAt(0); if (!ignorable(ch) && !covered.has(c) && !fallback.has(c)) missing.add(c); }
  assert.deepEqual([...missing].map(hex), [], 'nowe znaki w tekstach — uruchom python3 tools/fonts.py');
  // znak z selektorem emoji (U+FE0F, np. „⚠️”) zostaje przy foncie systemowym — czarno-biały glif Inter zastąpiłby emoji
  for (const [, ch] of text.matchAll(/(.)️/gsu)) assert.ok(!covered.has(ch.codePointAt(0)), `${hex(ch.codePointAt(0))}: emoji w podzbiorze Inter`);
});

test('podzbiór: ASCII, polskie litery, typografia i symbole interfejsu', () => {
  const need = ' AZaz09ąćęłńóśźżĄĆĘŁŃÓŚŹŻ–—„”’…•·×€§²→←≤≥≈≠✓⌘';
  assert.deepEqual([...need].map(c => c.codePointAt(0)).filter(c => !covered.has(c)).map(hex), []);
});
