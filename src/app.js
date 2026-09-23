// Start aplikacji: magazyn (IndexedDB), routing, nawigacja, banery stanu, service worker.
import { h, clear } from './ui/dom.js';
import { Store } from './core/storage/store.js';
import { IdbAdapter } from './core/storage/adapter-idb.js';
import { today } from './core/dates.js';
import { setCustomItems } from './core/calc/inventory.js';
import { MODULES, byId } from './modules/registry.js';
import { renderDzis } from './modules/dzis.js';
import { renderDane } from './modules/dane.js';
import { renderDieta } from './modules/dieta.js';
import { renderSuplementy } from './modules/suplementy.js';
import { renderZapasy } from './modules/zapasy.js';
import { renderMealPrep } from './modules/mealprep.js';
import { renderTrening } from './modules/trening.js';
import { renderCFA } from './modules/cfa.js';
import { renderBezpieczenstwo } from './modules/bezpieczenstwo.js';
import { renderRekompozycja } from './modules/rekompozycja.js';
import { renderPlaceholder } from './modules/placeholder.js';

const RENDER = { dzis: renderDzis, dane: renderDane, dieta: renderDieta, suplementy: renderSuplementy, zapasy: renderZapasy, mealprep: renderMealPrep, trening: renderTrening, cfa: renderCFA, bezpieczenstwo: renderBezpieczenstwo, rekompozycja: renderRekompozycja };
const ctx = { store: null, storeError: null };
let flash = null; // komunikat, który ma przetrwać ponowne wyrenderowanie widoku
const chan = 'BroadcastChannel' in globalThis ? new BroadcastChannel('p2027') : null;

function route() {
  const [path, qs] = (location.hash.replace(/^#\/?/, '') || 'dzis').split('?');
  return { id: byId[path] || path === 'wiecej' ? path : 'dzis', params: new URLSearchParams(qs || '') };
}

function nav(current) {
  const tabs = MODULES.filter(m => m.tab);
  const moreActive = !byId[current]?.tab;
  return [
    h('nav', { class: 'side', 'aria-label': 'Moduły' }, h('div', { class: 'brand' }, '2027'),
      MODULES.map(m => h('a', { href: `#/${m.id}`, 'aria-current': m.id === current ? 'page' : null, style: { '--dc': `var(--${m.domain})` } },
        h('span', { class: 'bar', 'aria-hidden': 'true' }), m.name))),
    h('nav', { class: 'tabs', 'aria-label': 'Główne moduły' },
      tabs.map(m => h('a', { href: `#/${m.id}`, 'aria-current': m.id === current ? 'page' : null }, h('span', { class: 'dot', 'aria-hidden': 'true' }), m.name)),
      h('a', { href: '#/wiecej', 'aria-current': moreActive ? 'page' : null }, h('span', { class: 'dot', 'aria-hidden': 'true' }), 'Więcej')),
  ];
}

async function render() {
  const app = document.getElementById('app');
  const { id, params } = route();
  setCustomItems(ctx.store?.state?.catalogUser || []);
  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
  clear(app).append(...nav(id), main);
  const health = ctx.store?.health;
  if (!ctx.store || !health?.ok) main.append(h('div', { class: 'banner err', role: 'alert' },
    (health?.error || ctx.storeError || 'Baza danych jest niedostępna.') + ' Zmiany nie będą zapisywane.'));
  if (flash) { main.append(h('div', { class: `banner ${flash.cls}`, role: 'status' }, flash.text)); flash = null; }
  if (id === 'wiecej') {
    main.append(h('h1', {}, 'Więcej'), h('div', { class: 'more-list' },
      MODULES.filter(m => !m.tab).map(m => h('a', { href: `#/${m.id}` }, m.name, h('small', {}, m.ready ? '' : `Etap ${m.stage}`)))));
  } else {
    const mod = byId[id];
    const c = { ...ctx, params, today: today(), rerender: render, flash: (text, cls = 'warn') => { flash = { text, cls }; } };
    try { await (RENDER[id] || ((r) => renderPlaceholder(r, mod)))(main, c); }
    catch (e) { main.append(h('div', { class: 'banner err', role: 'alert' }, `Błąd modułu: ${e.message}`)); console.error(e); }
  }
  // Dostępność: przewijane obszary osiągalne z klawiatury (WCAG 2.1.1, axe: scrollable-region-focusable)
  main.querySelectorAll('.scroll-x, .rules, .pills, .day-strip, .mp-jump').forEach(el => {
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Obszar przewijany');
  });
  document.title = `${id === 'wiecej' ? 'Więcej' : byId[id].name} · 2027`;
}

async function boot() {
  try {
    ctx.store = await new Store(new IdbAdapter()).open();
    ctx.store.on(() => chan?.postMessage('changed'));
  } catch (e) { ctx.storeError = e.message; console.error(e); }
  // Inna karta/okno zmieniło dane -> przeładuj z bazy zamiast nadpisywać (ochrona przed równoległą edycją).
  chan?.addEventListener('message', async () => { if (!ctx.store) return; ctx.store = await new Store(new IdbAdapter()).open(); render(); });
  addEventListener('hashchange', render);
  await render();
  if (!globalThis.__SINGLE__ && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    try { await navigator.serviceWorker.register('./sw.js'); } catch (e) { console.warn('Service worker:', e.message); }
  }
}
boot();
