// Start aplikacji: magazyn (IndexedDB), routing, nawigacja, banery stanu, service worker, synchronizacja automatyczna (D-084).
import { h, clear, add } from './ui/dom.js';
import { Store } from './core/storage/store.js';
import { IdbAdapter } from './core/storage/adapter-idb.js';
import { today } from './core/dates.js';
import { createAutoSync } from './core/sync/cloud-auto.js';
import { autoRound, autoCheck, describeError, cloudStatus } from './core/sync/cloud-local.js';
import { setCustomItems } from './core/calc/inventory.js';
import { MODULES, GROUPS, byId } from './modules/registry.js';
import { icon } from './ui/icons.js';
import { THEMES, themePref, applyTheme, setTheme, sideCollapsed, setSideCollapsed } from './ui/prefs.js';
import { setupShortcuts, searchButton } from './ui/search.js';
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
const ctx = { store: null, storeError: null, update: { state: 'idle', check: async () => {}, apply: () => {} }, cloudAuto: null };
// Komunikaty po akcji (B4): stały obszar nad dolnym paskiem, poza przerysowywanym <main> — widoczny także przy przewiniętej
// stronie. Region aria-live istnieje od startu, więc czytniki ekranu odczytują każdy komunikat. Znika po 6 s.
let toastTimer = null;
function toastBox() {
  let box = document.getElementById('toast');
  if (!box) { box = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  return box;
}
function toast(text, cls = 'warn') {
  const box = toastBox();
  clearTimeout(toastTimer);
  clear(box).append(h('div', { class: `banner ${cls}` }, text));
  toastTimer = setTimeout(() => clear(box), 6000);
}

// Fokus po przerysowaniu (B5): zapis przerysowuje cały widok, więc element z fokusem jest zastępowany nowym. Klucz elementu:
// najbliższy przodek z `id` + znacznik i pierwsza klasa + numer wśród takich elementów w przodku (etykieta może się zmienić,
// np. „Seria 1 do wykonania” → „wykonana”). Przywrócenie bez przewijania; tylko przy przerysowaniu tej samej trasy.
function focusKey() {
  const el = document.activeElement, app = document.getElementById('app');
  if (!el || el === document.body || !app?.contains(el)) return null;
  if (el.id) return { id: el.id };
  const host = el.parentElement?.closest('[id]');
  const sel = el.tagName.toLowerCase() + (el.classList[0] ? `.${CSS.escape(el.classList[0])}` : '') + (el.getAttribute('type') ? `[type="${el.getAttribute('type')}"]` : '');
  return { host: host && app.contains(host) ? host.id : null, sel, idx: [...(host || app).querySelectorAll(sel)].indexOf(el) };
}
function restoreFocus(k) {
  if (!k) return;
  let el = k.id ? document.getElementById(k.id) : null;
  if (!el && k.sel) { const host = k.host ? document.getElementById(k.host) : document.getElementById('app'); el = host?.querySelectorAll(k.sel)[k.idx] || null; }
  if (el && el !== document.activeElement) {
    el.focus({ preventScroll: true });
    if (el.tagName === 'INPUT' && ['search', 'text'].includes(el.type)) el.setSelectionRange(el.value.length, el.value.length);   // kursor na końcu wpisu
  }
}
const chan = 'BroadcastChannel' in globalThis ? new BroadcastChannel('p2027') : null;
const cloudUi = { dismissed: false, stale: false, shown: '' };   // baner synchronizacji: zamknięty w tej sesji / zaległość > 24 h

// Każda instancja magazynu (także po przeładowaniu z powodu zmiany w innej karcie — poprawka A4): powiadom inne karty
// i zaplanuj automatyczną wysyłkę. Bez tego po pierwszym przeładowaniu zmiany z tej karty nie docierałyby nigdzie.
function attachStore(store) {
  store.on(() => { chan?.postMessage('changed'); ctx.cloudAuto?.changed(); });
  return store;
}

// Przerysowanie „w tle” (np. po pobraniu zmian z innego urządzenia): nie w trakcie wpisywania ani przy otwartym oknie —
// czeka, aż pole straci fokus / okno zostanie zamknięte (wpis ani otwarty arkusz nie giną).
let softTimer = null;
function softRender() {
  if (softTimer) return;
  const go = () => {
    softTimer = null;
    if (document.body.classList.contains('kbd') || document.querySelector('dialog[open]')) { softTimer = setTimeout(go, 1000); return; }
    render(true);
  };
  softTimer = setTimeout(go, 0);
}

// Baner synchronizacji poza modułem Dane: tylko gdy potrzebne działanie użytkownika (sesja, klucz, hasło szyfrowania, RLS,
// brak tabel) albo zmiany czekają na wysłanie ponad dobę. Najwyżej raz na sesję (zamknięcie = do ponownego uruchomienia).
function cloudBannerText(s) {
  if (!s || cloudUi.dismissed) return '';
  if (s.phase === 'paused') return `Synchronizacja w chmurze wstrzymana: ${describeError(s.error)}`;
  if (s.phase === 'retry' && cloudUi.stale) return 'Zmiany z tego urządzenia czekają na wysłanie do chmury ponad dobę (brak połączenia z serwerem). Dane są bezpieczne na tym urządzeniu.';
  return '';
}
async function onCloudState(s) {
  if (s.phase === 'retry' && ctx.store) {
    const st = await cloudStatus(ctx.store).catch(() => null);
    cloudUi.stale = !!(st?.pending && st.lastSync && Date.now() - Date.parse(st.lastSync) > 24 * 3600e3);
  } else if (s.phase === 'idle') cloudUi.stale = false;
  const text = cloudBannerText(s);
  if (text !== cloudUi.shown) { cloudUi.shown = text; if (route().id !== 'dane') softRender(); }
}

function route() {
  const [path, qs] = (location.hash.replace(/^#\/?/, '') || 'dzis').split('?');
  return { id: byId[path] || path === 'wiecej' ? path : 'dzis', params: new URLSearchParams(qs || '') };
}

// Przełącznik motywu (per urządzenie): ciemny / jasny / systemowy
function themeSwitch(compact = false) {
  const cur = themePref();
  return h('div', { class: `theme-switch${compact ? ' is-compact' : ''}`, role: 'group', 'aria-label': 'Motyw' },
    THEMES.map(([v, label, ic]) => h('button', { class: 'ts-b', 'aria-pressed': String(cur === v), 'aria-label': `Motyw: ${label}`, title: label,
      onclick: () => { setTheme(v); render(true); } }, icon(ic, { size: 18 }), !compact && h('span', {}, label))));
}

function nav(current) {
  const tabs = MODULES.filter(m => m.tab);
  const moreActive = !byId[current]?.tab;
  const collapsed = sideCollapsed();
  return [
    h('a', { class: 'skip-link', href: '#main' }, 'Przejdź do treści'),   // U-i: pominięcie panelu nawigacji
    h('nav', { class: `side${collapsed ? ' is-min' : ''}`, 'aria-label': 'Moduły' },
      h('div', { class: 'side-top' },
        h('a', { class: 'brand', href: '#/dzis', 'aria-label': '2027 — Dziś' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, '27'), h('span', { class: 'brand-t' }, '2027')),
        h('button', { class: 'side-toggle', 'aria-label': collapsed ? 'Rozwiń panel' : 'Zwiń panel', 'aria-expanded': String(!collapsed),
          onclick: () => { setSideCollapsed(!collapsed); render(true); } }, icon(collapsed ? 'panel-left-open' : 'panel-left-close', { size: 18 }))),
      searchButton(() => ctx.store?.state, 'side-search'),   // I4: globalne wyszukiwanie (⌘K)
      h('div', { class: 'side-groups' }, GROUPS.map(g => h('div', { class: 'side-group' },
        h('p', { class: 'side-gl' }, g),
        MODULES.filter(m => m.group === g).map(m => h('a', { href: `#/${m.id}`, class: 'side-a', 'aria-current': m.id === current ? 'page' : null,
          title: collapsed ? m.name : null, style: { '--dc': `var(--${m.domain})` } },
          icon(m.icon, { size: 20 }), h('span', { class: 'side-n' }, m.name)))))),
      h('div', { class: 'side-foot' }, themeSwitch(true))),
    h('nav', { class: 'tabs', 'aria-label': 'Główne sekcje' },
      tabs.map(m => h('a', { href: `#/${m.id}`, 'aria-current': m.id === current ? 'page' : null }, icon(m.icon, { size: 22 }), h('span', {}, m.name))),
      h('a', { href: '#/wiecej', 'aria-current': moreActive ? 'page' : null }, icon('ellipsis', { size: 22 }), h('span', {}, 'Więcej'))),
  ];
}

async function render(keepFocus = false) {
  const app = document.getElementById('app');
  const focus = keepFocus === true ? focusKey() : null;
  const { id, params } = route();
  setCustomItems(ctx.store?.state?.catalogUser || []);
  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
  clear(app).append(...nav(id), main);
  app.classList.toggle('side-min', sideCollapsed());
  const health = ctx.store?.health;
  if (!ctx.store || !health?.ok) main.append(h('div', { class: 'banner err', role: 'alert' },
    (health?.error || ctx.storeError || 'Baza danych jest niedostępna.') + ' Zmiany nie będą zapisywane.'));
  // Aktualizacja KODU aplikacji (nie synchronizacja danych) — tylko za zgodą użytkownika
  if (ctx.update.state === 'ready') main.append(h('div', { class: 'banner info update-banner', role: 'status' },
    h('span', {}, 'Dostępna nowa wersja aplikacji. Twoje dane pozostaną bez zmian.'),
    h('button', { class: 'primary', onclick: () => ctx.update.apply() }, 'Nowa wersja — odśwież')));
  // Integralność: zdarzenia z nowszej wersji są zachowane, ale pomijane w obliczeniach — informujemy wprost
  const up = ctx.store?.state?.unprocessed;
  if (up?.count > 0) main.append(h('div', { class: 'banner warn', role: 'alert' },
    `Niepełne przetwarzanie danych: ${up.count} zdarzeń z nowszej wersji aplikacji (${Object.keys(up.types).join(', ')}) jest zachowanych, ale nie jest uwzględnianych w widokach. Zaktualizuj aplikację na tym urządzeniu.`));
  const cloudText = id === 'dane' ? '' : cloudBannerText(ctx.cloudAuto?.state());
  if (cloudText) main.append(h('div', { class: 'banner warn cloud-banner', role: 'status' }, h('span', {}, cloudText),
    h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/dane' }, 'Przejdź do Dane'),
      h('button', { 'aria-label': 'Zamknij komunikat synchronizacji', onclick: () => { cloudUi.dismissed = true; render(true); } }, 'Zamknij'))));
  if (id === 'wiecej') {
    add(main, h('h1', {}, 'Więcej'), searchButton(() => ctx.store?.state, 'more-search'),
      GROUPS.map(g => { const list = MODULES.filter(m => m.group === g && !m.tab); return list.length ? h('section', { class: 'more-sec' },
        h('p', { class: 'side-gl' }, g),
        h('div', { class: 'more-list' }, list.map(m => h('a', { href: `#/${m.id}`, style: { '--dc': `var(--${m.domain})` } },
          h('span', { class: 'more-ic' }, icon(m.icon, { size: 20 })), h('span', { class: 'more-n' }, m.name), icon('chevron-right', { size: 18 }))))) : null; }),
      h('section', { class: 'more-sec' }, h('p', { class: 'side-gl' }, 'Wygląd'), themeSwitch(false)));
  } else {
    const mod = byId[id];
    const c = { ...ctx, params, today: today(), rerender: () => render(true), flash: (text, cls = 'warn') => toast(text, cls) };
    try { await (RENDER[id] || ((r) => renderPlaceholder(r, mod)))(main, c); }
    catch (e) { main.append(h('div', { class: 'banner err', role: 'alert' }, `Błąd modułu: ${e.message}`)); console.error(e); }
  }
  // Dostępność: przewijane obszary osiągalne z klawiatury (WCAG 2.1.1, axe: scrollable-region-focusable)
  main.querySelectorAll('.scroll-x, .rules, .pills, .day-strip, .mp-jump').forEach(el => {
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Obszar przewijany');
  });
  document.title = `${id === 'wiecej' ? 'Więcej' : byId[id].name} · 2027`;
  restoreFocus(focus);
}

// Odnośniki w obrębie strony (#id, bez „/”): przewinięcie do elementu zamiast zmiany trasy. Router traktowałby
// „#mp-ph-1” jak nieznany moduł i pokazywał „Dziś”. Fokus przechodzi na cel (czytniki ekranu, klawiatura).
function inPageLink(e) {
  const a = e.target.closest?.('a[href^="#"]');
  if (!a || e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = a.getAttribute('href');
  if (href.startsWith('#/')) return;
  e.preventDefault();
  let el = null;
  try { el = document.getElementById(decodeURIComponent(href.slice(1))); } catch { /* niepoprawny zapis %xx — brak celu */ }
  if (!el) return;
  el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  if (!el.matches('a[href], button, input, select, textarea, [tabindex]')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

async function boot() {
  applyTheme();
  toastBox();
  setupShortcuts(() => ctx.store?.state);   // I5: skróty klawiaturowe (⌘K, /, ← →, g + litera, ?)
  document.addEventListener('click', inPageLink);
  // Klawiatura ekranowa (pole w fokusie) — chowamy dolny pasek, żeby nie „pływał” nad klawiaturą na iOS
  const isField = el => el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button', 'file'].includes(el.type)));
  document.addEventListener('focusin', e => { if (isField(e.target)) document.body.classList.add('kbd'); });
  document.addEventListener('focusout', () => setTimeout(() => { if (!isField(document.activeElement)) document.body.classList.remove('kbd'); }, 50));
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (themePref() === 'system') applyTheme('system'); });
  try {
    ctx.store = attachStore(await new Store(new IdbAdapter()).open());
  } catch (e) { ctx.storeError = e.message; console.error(e); }
  // Inna karta/okno zmieniło dane -> przeładuj z bazy zamiast nadpisywać (ochrona przed równoległą edycją).
  chan?.addEventListener('message', async () => { if (!ctx.store) return; ctx.store = attachStore(await new Store(new IdbAdapter()).open()); render(true); });
  addEventListener('hashchange', () => render());
  // Synchronizacja automatyczna w chmurze (D-084) i automatyczne pobieranie zmian (D-085): działają tylko po skonfigurowaniu
  // chmury i przy włączonych przełącznikach. Telefon (wskaźnik dotykowy) sprawdza zmiany rzadziej (60 s) niż komputer (30 s).
  const coarse = matchMedia('(pointer: coarse)');
  ctx.cloudAuto = createAutoSync({
    getStore: () => ctx.store, run: (store, mode) => autoRound(store, mode), check: store => autoCheck(store),
    isVisible: () => document.visibilityState !== 'hidden', isOnline: () => navigator.onLine !== false, isMobile: () => coarse.matches,
    onApplied: softRender, onChange: s => { onCloudState(s); },
  });
  addEventListener('online', () => ctx.cloudAuto.online());
  addEventListener('offline', () => ctx.cloudAuto.offline());
  document.addEventListener('visibilitychange', () => ctx.cloudAuto.visibility(document.visibilityState !== 'hidden'));
  addEventListener('pagehide', () => ctx.cloudAuto.flush());
  // Powrót do okna (MacBook: okno widoczne, praca na innym urządzeniu) i interakcja użytkownika (koniec bezczynności)
  addEventListener('focus', () => ctx.cloudAuto.focus());
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, () => ctx.cloudAuto.activity(), { capture: true, passive: true });
  await render();
  ctx.cloudAuto.boot();
  if (!globalThis.__SINGLE__ && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    try { setupUpdates(await navigator.serviceWorker.register('./sw.js')); } catch (e) { console.warn('Service worker:', e.message); }
  }
}
// Aktualizacja kodu: nowy service worker jest pobierany w tle i CZEKA. Przeładowanie tylko po kliknięciu użytkownika.
function setupUpdates(reg) {
  let userAsked = false;
  // Pokazanie przycisku wymaga przerysowania widoku — nie w trakcie wpisywania (pole w fokusie), żeby nie stracić wpisu.
  const show = () => (document.body.classList.contains('kbd') ? setTimeout(show, 1000) : render(true));
  const markReady = () => { if (reg.waiting && navigator.serviceWorker.controller && ctx.update.state !== 'ready') { ctx.update.state = 'ready'; show(); } };
  ctx.update = {
    state: 'idle',
    // Gdy nowa wersja już czeka na zgodę, kolejne sprawdzenia (np. przy każdym powrocie na ekran) niczego nie przerysowują.
    check: async () => { if (ctx.update.state === 'ready') return; ctx.update.state = 'checking'; try { await reg.update(); } catch { /* offline */ } if (ctx.update.state === 'checking') ctx.update.state = 'idle'; markReady(); },
    apply: () => { if (!reg.waiting) return; userAsked = true; reg.waiting.postMessage({ type: 'SKIP_WAITING' }); },
  };
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => { if (w.state === 'installed') markReady(); });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (userAsked) location.reload(); });
  // iOS: aplikacja z ekranu początkowego zwykle jest wznawiana, a nie uruchamiana — sprawdzamy przy powrocie na ekran
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ctx.update.check(); });
  markReady();
}

boot();
