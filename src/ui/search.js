// Okno globalnego wyszukiwania (I4) i skróty klawiaturowe na komputerze (I5). Bez zmian w danych — tylko nawigacja.
import { h, clear } from './dom.js';
import { sheet } from './components.js';
import { icon } from './icons.js';
import { buildIndex, search, kindLabel } from '../core/search.js';
import { today } from '../core/dates.js';

let cache = { state: undefined, day: '', index: null };
const indexFor = state => {
  const d = today();
  if (cache.state !== state || cache.day !== d) cache = { state, day: d, index: buildIndex(state, d) };
  return cache.index;
};

export function openSearch(getState, initial = '') {
  if (document.querySelector('dialog.gs-dialog')) return;
  const input = h('input', { type: 'search', class: 'gs-input', placeholder: 'Produkt, ćwiczenie, temat CFA, strona…', 'aria-label': 'Szukaj w aplikacji',
    autocomplete: 'off', value: initial || null });
  const list = h('ul', { class: 'gs-list', 'aria-label': 'Wyniki' });
  const info = h('p', { class: 'muted gs-info', role: 'status', 'aria-live': 'polite' });
  const dlg = sheet('Szukaj', input, info, list,
    h('p', { class: 'muted gs-keys' }, 'Enter — pierwszy wynik · ↑ ↓ — wybór · Esc — zamknij'));
  dlg.el.classList.add('gs-dialog');
  const run = () => {
    const hits = search(indexFor(getState()), input.value);
    clear(list).append(...hits.map(x => h('li', {}, h('a', { class: 'gs-hit', href: x.href, onclick: () => dlg.close() },
      h('span', { class: 'gs-kind' }, kindLabel(x.kind)), h('span', { class: 'gs-t' }, x.title), x.sub && h('span', { class: 'gs-s' }, x.sub)))));
    info.textContent = !input.value.trim() ? 'Wpisz co najmniej jedno słowo.' : hits.length ? `Wyniki: ${hits.length}${hits.length >= 40 ? ' (pierwsze 40)' : ''}` : 'Brak wyników.';
  };
  input.addEventListener('input', run);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const a = list.querySelector('a'); if (a) { e.preventDefault(); a.click(); } }
    if (e.key === 'ArrowDown') { e.preventDefault(); list.querySelector('a')?.focus(); }
    if (e.key === 'Escape') { e.preventDefault(); dlg.close(); }   // pole „search” samo tylko czyściłoby tekst
  });
  list.addEventListener('keydown', e => {
    const links = [...list.querySelectorAll('a')], i = links.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); links[Math.min(i + 1, links.length - 1)]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? input : links[i - 1]).focus(); }
  });
  run();
  input.focus();
}

// Skróty: ⌘K / Ctrl+K lub „/” — szukaj; ← → — poprzedni / następny dzień (tydzień); g + litera — moduł; ? — lista skrótów.
const GO = { d: 'dzis', w: 'dzis?v=tydzien', i: 'dieta', s: 'suplementy', z: 'zapasy', m: 'mealprep', t: 'trening', c: 'cfa', b: 'bezpieczenstwo', r: 'rekompozycja', a: 'dane' };
const NAMES = { d: 'Dziś', w: 'Tydzień', i: 'Dieta', s: 'Suplementacja', z: 'Zapasy', m: 'Meal Prep', t: 'Trening', c: 'CFA', b: 'Bezpieczeństwo', r: 'Rekompozycja', a: 'Dane' };
const isField = el => el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

function helpSheet() {
  if (document.querySelector('dialog.gs-help')) return;
  const row = (k, t) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, t)];
  const d = sheet('Skróty klawiaturowe', h('dl', { class: 'kv gs-help-list' },
    row('⌘ K  lub  /', 'Szukaj w aplikacji'), row('← →', 'Poprzedni / następny dzień (Dziś, Tydzień, CFA, Meal Prep)'),
    Object.entries(NAMES).map(([k, n]) => row(`g ${k}`, n)), row('?', 'Ta lista'), row('Esc', 'Zamknij okno')));
  d.el.classList.add('gs-help');
}

export function setupShortcuts(getState) {
  let gAt = 0;
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(getState); return; }
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isField(document.activeElement) || document.querySelector('dialog[open]')) return;
    if (e.key === '/') { e.preventDefault(); openSearch(getState); return; }
    if (e.key === '?') { e.preventDefault(); helpSheet(); return; }
    if (e.key === 'g') { gAt = Date.now(); return; }
    if (gAt && Date.now() - gAt < 1500 && GO[e.key]) { gAt = 0; e.preventDefault(); location.hash = `#/${GO[e.key]}`; return; }
    gAt = 0;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const want = e.key === 'ArrowLeft' ? /^Poprzedni (dzień|tydzień)$/ : /^Następny (dzień|tydzień)$/;
      const a = [...document.querySelectorAll('main a')].find(x => want.test(x.getAttribute('aria-label') || x.textContent.trim()));
      if (a) { e.preventDefault(); a.click(); }
    }
  });
}

export const searchButton = (getState, cls = '') => h('button', { class: `gs-open ${cls}`.trim(), 'aria-label': 'Szukaj w aplikacji', 'aria-keyshortcuts': 'Meta+K Control+K /',
  onclick: () => openSearch(getState) }, icon('search', { size: 18 }), h('span', {}, 'Szukaj'), h('kbd', { class: 'gs-kbd', 'aria-hidden': 'true' }, '⌘K'));
