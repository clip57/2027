// Okno globalnego wyszukiwania (I4) i skróty klawiaturowe na komputerze (I5). Bez zmian w danych — tylko nawigacja.
import { h, clear } from './dom.js';
import { sheet } from './components.js';
import { icon } from './icons.js';
import { buildIndex, search, kindLabel } from '../core/search.js';
import { today, longDate, dayShort } from '../core/dates.js';
import { PLAN_START, PLAN_END } from '../core/resolver.js';
import { modulesOn, byId } from '../modules/registry.js';

let cache = { state: undefined, day: '', index: null };
const indexFor = state => {
  const d = today();
  if (cache.state !== state || cache.day !== d) cache = { state, day: d, index: buildIndex(state, d) };
  return cache.index;
};

// D-113 (F-G1): polecenia palety — wyłącznie nawigacja i preferencje interfejsu (bez zapisu danych). Pusta fraza: lista poleceń;
// fraza: pasujące polecenia nad wynikami wyszukiwania; data („12.11”, „12.11.2026”, „2026-11-12”) — „Przejdź do dnia”.
const norm = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
function dateOf(q) {
  const t = q.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{4}))?$/);
  if (!m) return null;
  const dd = m[1].padStart(2, '0'), mm = m[2].padStart(2, '0');
  const y = m[3] || (`${PLAN_START.slice(0, 4)}-${mm}-${dd}` >= PLAN_START ? PLAN_START.slice(0, 4) : PLAN_END.slice(0, 4));
  const d = `${y}-${mm}-${dd}`, x = new Date(`${d}T12:00:00`);
  return Number.isNaN(x.getTime()) || x.toISOString().slice(0, 10) !== d ? null : d;
}
export function commands(q, extra = {}) {
  const t = today(), study = studyNow();
  const list = [
    { title: 'Dziś', sub: 'plan dnia', href: '#/dzis', ic: 'sun' },
    { title: 'Tydzień', sub: 'przegląd 7 dni', href: '#/dzis?v=tydzien', ic: 'calendar-range' },
    { title: 'Plan zakupów', sub: 'Zapasy — lista na najbliższe zakupy', href: '#/zapasy?a=zakupy', ic: 'shopping-cart' },
    { title: 'Dodaj pozycję do Zapasów', sub: 'Zapasy — nowa pozycja', href: '#/zapasy?a=dodaj', ic: 'plus' },
    { title: 'Trening dnia', sub: 'serie, przerwy, dziennik sesji', href: `#/trening?d=${t}`, ic: 'dumbbell' },
    { title: `Bloki ${byId[study].name} na dziś`, sub: 'odhaczanie bloków', href: `#/${study}?v=dzien&d=${t}`, ic: 'graduation-cap' },
    { title: 'Jadłospis dnia', sub: 'Dieta — wybrany dzień', href: `#/dieta?d=${t}`, ic: 'utensils' },
    { title: 'Suplementacja dnia', sub: 'dawki i pory', href: `#/suplementy?d=${t}`, ic: 'pill' },
    { title: 'Kalendarz', sub: 'miesiąc planu', href: '#/kalendarz', ic: 'calendar' },
    { title: 'Synchronizacja i kopie', sub: 'Dane', href: '#/dane', ic: 'database' },
    { title: 'Ustawienia', sub: 'motyw, akcent, gęstość, dźwięki', href: '#/ustawienia', ic: 'settings' },
    extra.theme && { title: 'Zmień motyw', sub: 'ciemny → jasny → systemowy', run: extra.theme, ic: 'moon' },
    { title: 'Skróty klawiaturowe', sub: '?', run: () => helpSheet(), ic: 'keyboard' },
  ].filter(Boolean);
  const d = q && dateOf(q);
  const go = d ? [{ title: `Przejdź do dnia: ${dayShort(d)} ${longDate(d)}`, sub: 'Dziś — wybrany dzień', href: `#/dzis?d=${d}`, ic: 'calendar-clock' }] : [];
  if (!q?.trim()) return list;
  const n = norm(q.trim());
  return [...go, ...list.filter(c => norm(`${c.title} ${c.sub}`).includes(n))];
}

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
    const cmds = commands(input.value, cmdExtra).slice(0, input.value.trim() ? 4 : 13);
    clear(list).append(
      ...cmds.map(c => h('li', { class: 'gs-cmd' }, h('a', { class: 'gs-hit gs-hit-cmd', href: c.href || '#', onclick: e => { if (c.run) { e.preventDefault(); dlg.close(); c.run(); } else dlg.close(); } },
        h('span', { class: 'gs-kind' }, icon(c.ic || 'arrow-right', { size: 14 }), 'Polecenie'), h('span', { class: 'gs-t' }, c.title), c.sub && h('span', { class: 'gs-s' }, c.sub)))),
      ...hits.map(x => h('li', {}, h('a', { class: 'gs-hit', href: x.href, onclick: () => dlg.close() },
        h('span', { class: 'gs-kind' }, kindLabel(x.kind)), h('span', { class: 'gs-t' }, x.title), x.sub && h('span', { class: 'gs-s' }, x.sub)))));
    info.textContent = !input.value.trim() ? 'Polecenia — albo wpisz frazę (produkt, ćwiczenie, temat) lub datę, np. 12.11.' : hits.length ? `Wyniki: ${hits.length}${hits.length >= 40 ? ' (pierwsze 40)' : ''}` : cmds.length ? 'Brak wyników wyszukiwania — pasujące polecenia powyżej.' : 'Brak wyników.';
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
// U3 (audyt 23.10.2026): każdy moduł ma skrót (także Kalendarz, Pielęgnacja, MPW); „g n” — bieżący plan nauki tak jak zakładka na pasku
// (`modulesOn`: CFA do 11.11, od 12.11 MPW), „g c” i „g e” — zawsze CFA i MPW. Nazwy z rejestru modułów.
const GO = { d: 'dzis', w: 'dzis?v=tydzien', k: 'kalendarz', p: 'pielegnacja', i: 'dieta', s: 'suplementy', z: 'zapasy', m: 'mealprep', t: 'trening',
  r: 'rekompozycja', n: null, c: 'cfa', e: 'mpw', b: 'bezpieczenstwo', a: 'dane' };
const studyNow = () => modulesOn(today()).find(m => m.group === 'Nauka' && m.tab)?.id || 'cfa';
const target = k => GO[k] ?? (k === 'n' ? studyNow() : null);
const nameOf = k => (k === 'w' ? 'Tydzień' : k === 'n' ? `Nauka — bieżący plan (teraz: ${byId[studyNow()].name})` : byId[GO[k]].name);
let cmdExtra = {};
export const setCommandExtras = x => { cmdExtra = x; };
const isField = el => el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

function helpSheet() {
  if (document.querySelector('dialog.gs-help')) return;
  const row = (k, t) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, t)];
  const d = sheet('Skróty klawiaturowe', h('dl', { class: 'kv gs-help-list' },
    row('⌘ K  lub  /', 'Szukaj w aplikacji'), row('← →', 'Poprzedni / następny dzień (Dziś, CFA, MPW, Meal Prep, Pielęgnacja) albo tydzień (Tydzień, Trening)'),
    Object.keys(GO).map(k => row(`g ${k}`, nameOf(k))), row('?', 'Ta lista'), row('Esc', 'Zamknij okno')));
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
    if (gAt && Date.now() - gAt < 1500 && target(e.key)) { gAt = 0; e.preventDefault(); location.hash = `#/${target(e.key)}`; return; }
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
