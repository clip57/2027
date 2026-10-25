// Start aplikacji: magazyn (IndexedDB), routing, nawigacja, banery stanu, service worker, synchronizacja automatyczna (D-084).
import { h, clear, add } from './ui/dom.js';
import { Store } from './core/storage/store.js';
import { IdbAdapter } from './core/storage/adapter-idb.js';
import { today } from './core/dates.js';
import { createAutoSync } from './core/sync/cloud-auto.js';
import { autoRound, autoCheck, describeError, cloudStatus } from './core/sync/cloud-local.js';
import { setCustomItems } from './core/calc/inventory.js';
import { GROUPS, byId, modulesOn } from './modules/registry.js';
import { icon } from './ui/icons.js';
import { THEMES, themePref, applyTheme, saveTheme, sideCollapsed, setSideCollapsed } from './ui/prefs.js';
import { setupShortcuts, searchButton } from './ui/search.js';
import { renderDzis } from './modules/dzis.js';
import { renderDane } from './modules/dane.js';
import { renderDieta } from './modules/dieta.js';
import { renderSuplementy } from './modules/suplementy.js';
import { renderZapasy } from './modules/zapasy.js';
import { renderMealPrep } from './modules/mealprep.js';
import { renderTrening } from './modules/trening.js';
import { renderCFA } from './modules/cfa.js';
import { renderMPW } from './modules/mpw.js';
import { renderKalendarz } from './modules/kalendarz.js';
import { renderBezpieczenstwo } from './modules/bezpieczenstwo.js';
import { renderRekompozycja } from './modules/rekompozycja.js';
import { renderPielegnacja } from './modules/pielegnacja.js';
import { renderPlaceholder } from './modules/placeholder.js';

const RENDER = { dzis: renderDzis, dane: renderDane, dieta: renderDieta, suplementy: renderSuplementy, zapasy: renderZapasy, mealprep: renderMealPrep, trening: renderTrening, cfa: renderCFA, mpw: renderMPW, kalendarz: renderKalendarz, bezpieczenstwo: renderBezpieczenstwo, rekompozycja: renderRekompozycja, pielegnacja: renderPielegnacja };
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
const SPOT = '.dz-card, .dz-kpi, .wk-day, .kl-day, .more-list a, .sf-card, .hist-item, .ex, .prep-card, .meal, .tl-card, .pg-prod-card, .dz-attn';   // karty z poświatą kursora
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
      onclick: e => switchTheme(v, e.currentTarget) }, icon(ic, { size: 18 }), !compact && h('span', {}, label))));
}
// D-110: zmiana motywu odsłaniana kołem od wybranego przycisku (View Transitions; bez obsługi lub przy ograniczeniu ruchu — natychmiast).
// Wybór zapisany od razu (przeładowanie w trakcie przejścia go nie gubi); wygląd zmienia się w przejściu.
function switchTheme(v, btn) {
  saveTheme(v);
  const apply = () => { applyTheme(v); return render(true); };
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return; }
  const r = btn.getBoundingClientRect(), root = document.documentElement;
  root.style.setProperty('--vt-x', `${Math.round(r.left + r.width / 2)}px`);
  root.style.setProperty('--vt-y', `${Math.round(r.top + r.height / 2)}px`);
  root.classList.add('vt-theme');
  const vt = document.startViewTransition(apply);
  vt.ready.catch(() => {}); vt.updateCallbackDone.catch(e => console.error(e));
  vt.finished.catch(() => {}).finally(() => root.classList.remove('vt-theme'));
}

function nav(current) {
  // Zakładki i kolejność w grupach zależne od dnia (D-095: od 12.11.2026 MPW zamiast CFA)
  const MODULES = modulesOn(today());
  const tabs = MODULES.filter(m => m.tab);
  const moreActive = !tabs.some(m => m.id === current);
  const collapsed = sideCollapsed();
  return [
    h('a', { class: 'skip-link', href: '#main' }, 'Przejdź do treści'),   // U-i: pominięcie panelu nawigacji
    // D-110: pasek tytułu na telefonie — widoczny po przewinięciu poza nagłówek strony (duplikat h1, ukryty dla czytników ekranu)
    h('div', { class: 'appbar', 'aria-hidden': 'true' }, h('span', { class: 'appbar-t' }, current === 'wiecej' ? 'Więcej' : byId[current]?.name || '')),
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

// Upływ czasu (B3, audyt 23.10.2026): widok zależny od daty i godziny nie może zostać „wczorajszy” (aplikacja z ekranu początkowego jest
// wznawiana, a nie uruchamiana od nowa). Zmiana dnia → przerysowanie w tle; w ciągu dnia moduł może zgłosić własne sprawdzenie (`ctx.tick`),
// np. „Teraz” w „Dziś”. Co 30 s, przy powrocie do aplikacji i przy powrocie do okna — tylko gdy strona jest widoczna. To nie jest
// synchronizacja danych (bez zapytań do sieci i bez zapisów).
let renderedDay = null, tick = null;
function clockTick() {
  if (document.visibilityState === 'hidden' || !renderedDay) return;
  if (today() !== renderedDay) { softRender(); return; }
  try { tick?.(); } catch (e) { console.error(e); }
}

async function render(keepFocus = false) {
  const app = document.getElementById('app');
  const focus = keepFocus === true ? focusKey() : null;
  // D-112: przerysowanie w miejscu (zapis, zmiana z chmury w tle) zachowuje przewinięcie — moduł rysowany asynchronicznie (Dane, MPW)
  // na chwilę skraca stronę i przeglądarka przycinała przewinięcie do góry („skok na początek tej samej strony”)
  const keepY = keepFocus === true ? scrollY : null, t0 = performance.now();
  const { id, params } = route();
  renderedDay = today(); tick = null;
  setCustomItems(ctx.store?.state?.catalogUser || []);
  const main = h('main', { class: 'main', id: 'main', tabindex: '-1', 'data-enter': keepFocus === true ? null : enterType });
  enterType = null;
  clear(app).append(...nav(id), main);
  // D-110: poświata tła w kolorze modułu (moduł może ją zmienić, np. „Dziś” — kolor bieżącego punktu planu)
  document.documentElement.dataset.domain = byId[id]?.domain || 'regen';
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
      GROUPS.map(g => { const list = modulesOn(today()).filter(m => m.group === g && !m.tab); return list.length ? h('section', { class: 'more-sec' },
        h('p', { class: 'side-gl' }, g),
        h('div', { class: 'more-list' }, list.map(m => h('a', { href: `#/${m.id}`, style: { '--dc': `var(--${m.domain})` } },
          h('span', { class: 'more-ic' }, icon(m.icon, { size: 20 })), h('span', { class: 'more-n' }, m.name), icon('chevron-right', { size: 18 }))))) : null; }),
      h('section', { class: 'more-sec' }, h('p', { class: 'side-gl' }, 'Wygląd'), themeSwitch(false)));
  } else {
    const mod = byId[id];
    const c = { ...ctx, params, today: renderedDay, rerender: () => render(true), flash: (text, cls = 'warn') => toast(text, cls),
      soft: softRender, tick: fn => { tick = fn; } };
    try { await (RENDER[id] || ((r) => renderPlaceholder(r, mod)))(main, c); }
    catch (e) { main.append(h('div', { class: 'banner err', role: 'alert' }, `Błąd modułu: ${e.message}`)); console.error(e); }
  }
  // Dostępność: przewijane obszary osiągalne z klawiatury (WCAG 2.1.1, axe: scrollable-region-focusable)
  main.querySelectorAll('.scroll-x, .rules, .pills, .day-strip, .mp-jump').forEach(el => {
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Obszar przewijany');
  });
  document.title = `${id === 'wiecej' ? 'Więcej' : byId[id].name} · 2027`;
  // „Dziś”: w pasku tytułu nazwa wyświetlanego dnia (h1), nie modułu
  if (id === 'dzis') { const t = main.querySelector('h1')?.textContent; const bar = app.querySelector('.appbar-t'); if (t && bar) bar.textContent = t; }
  watchTitle();
  if (keepY != null && Math.abs(scrollY - keepY) > 1 && touchedAt < t0) scrollTo(0, keepY);
  restoreFocus(focus);
}

// ---- D-110: przewijanie i przejścia między ekranami ----
// Pozycja przewinięcia per wpis historii: nowy moduł lub widok otwiera się od góry (wcześniej zostawało przewinięcie poprzedniego
// modułu), „Wstecz/Dalej” wraca tam, gdzie użytkownik był; filtry i dni w obrębie widoku nie zmieniają przewinięcia. Wpis rozpoznawany
// po znaczniku w history.state (Zapasy zachowują stan przy replaceState).
// D-112 (iPhone: słabe przewijanie, „skoki” strony): żadnego kodu w trakcie przewijania — pozycję opuszczanego widoku zapisuje zmiana trasy
// (przeglądarka sama jej nie przywraca: scrollRestoration = 'manual', bez drugiego skoku), pasek tytułu przełącza IntersectionObserver
// nagłówka strony (bez odczytu układu w każdej klatce); na górę — od razu przy zmianie modułu (nie po przerysowaniu, gdy można już
// przewijać), powrót do zapamiętanej pozycji („Wstecz”) tylko wtedy, gdy użytkownik w międzyczasie nie dotknął ekranu.
const scrollMemo = new Map();
let entrySeq = 0, shownKey = null, navSeq = 0, touchedAt = -1, forceTop = false;
const entryKey = () => history.state?.p2027 ?? null;
function stampEntry() {
  const k = `${Date.now().toString(36)}.${++entrySeq}`;
  try { history.replaceState({ ...(history.state || {}), p2027: k }, ''); } catch { /* ograniczenie liczby wywołań — bez pamięci przewinięcia */ }
  return k;
}
// Pasek tytułu (telefon): pokazany, gdy nagłówek strony (h1) schował się pod górną krawędzią (pas 44 px)
const titleIO = 'IntersectionObserver' in globalThis ? new IntersectionObserver(es => {
  const e = es[es.length - 1];
  document.getElementById('app')?.classList.toggle('is-scrolled', !e.isIntersecting && e.boundingClientRect.bottom < 44);
}, { rootMargin: '-44px 0px 0px 0px' }) : null;
function watchTitle() {
  if (!titleIO) return;
  titleIO.disconnect();
  const h1 = document.querySelector('#main h1');
  if (h1) titleIO.observe(h1); else document.getElementById('app')?.classList.remove('is-scrolled');
}
// Rodzaj zmiany trasy: inny moduł / inny widok modułu (v; w Bezpieczeństwie m) — wejście od dołu; kolejny / poprzedni dzień (d) lub miesiąc (m) — przesunięcie
// w poziomie; pozostałe (filtry, wyszukiwanie) — bez przejścia, jak dotąd.
const DAY = /^\d{4}-\d{2}-\d{2}$/, MONTH = /^\d{4}-\d{2}$/;   // d — dzień, m — miesiąc (Kalendarz); `m` w innych modułach to tryb widoku
const posOf = r => (DAY.test(r.params.get('d') || '') ? ['d', r.params.get('d')] : MONTH.test(r.params.get('m') || '') ? ['m', r.params.get('m')] : null);
const viewOf = r => r.params.get('v') || (MONTH.test(r.params.get('m') || '') ? '' : r.params.get('m') || '');
function transitionType(a, b) {
  if (!a || a.id !== b.id) return 'module';
  if (viewOf(a) !== viewOf(b)) return 'view';
  const x = posOf(a), y = posOf(b), kind = x?.[0] || y?.[0];
  if (!kind || (x && y && x[0] !== y[0])) return null;
  const now = kind === 'm' ? today().slice(0, 7) : today(), from = x ? x[1] : now, to = y ? y[1] : now;
  return from === to ? null : to > from ? 'forward' : 'back';
}
let shownRoute = null, enterType = null;
// Zmiana trasy: przerysowanie od razu (bez opóźnienia — dane, fokus i testy jak dotąd), nowa treść wchodzi krótką animacją CSS
// (main[data-enter]: moduł / widok — od dołu, kolejny / poprzedni dzień — z boku). Przy ograniczeniu ruchu — bez animacji.
// (Pomiar: View Transitions opóźniały przerysowanie o 50–300 ms przy renderowaniu bez GPU — zostały tylko przy zmianie motywu.)
function navigate() {
  const k = entryKey(), back = k && scrollMemo.has(k) ? scrollMemo.get(k) : null;
  if (shownKey) scrollMemo.set(shownKey, scrollY);   // opuszczany widok
  if (!k) stampEntry();
  shownKey = entryKey();
  const next = route(), type = transitionType(shownRoute, next);
  shownRoute = next;
  const top = back ?? (forceTop || type === 'module' || type === 'view' ? 0 : null);
  forceTop = false;
  enterType = type && !matchMedia('(prefers-reduced-motion: reduce)').matches ? type : null;
  if (top === 0) scrollTo(0, 0);
  const seq = ++navSeq, at = performance.now();
  render().then(() => { if (top && seq === navSeq && touchedAt < at) scrollTo(0, top); });
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
  // Inna karta/okno zmieniło dane -> doczytanie nowych zdarzeń z bazy do TEJ SAMEJ instancji magazynu (B10: bez nowego połączenia z IndexedDB
  // przy każdej zmianie; słuchacze i odwołania w otwartych oknach zostają) i przerysowanie w tle (softRender — wpis w polu i otwarte okno
  // nie giną). Powiadomienia w trakcie odczytu łączone w jeden kolejny odczyt.
  let reloading = null, again = false;
  chan?.addEventListener('message', () => {
    if (!ctx.store?.health?.ok) return;
    if (reloading) { again = true; return; }
    reloading = (async () => { do { again = false; if (await ctx.store.reload()) softRender(); } while (again); })()
      .catch(e => console.error(e)).finally(() => { reloading = null; });
  });
  try { history.scrollRestoration = 'manual'; } catch { /* starsza przeglądarka — jak dotąd */ }
  if (!entryKey()) stampEntry();
  shownKey = entryKey();
  addEventListener('hashchange', navigate);
  // dotyk / kółko / klawisz po rozpoczęciu zmiany trasy — bez przywracania pozycji po przerysowaniu (D-112)
  for (const ev of ['touchstart', 'wheel', 'keydown']) addEventListener(ev, () => { touchedAt = performance.now(); }, { capture: true, passive: true });
  // Zakładka bieżącego modułu (pasek dolny, panel boczny): ponowne dotknięcie przewija na górę, jak w aplikacjach systemowych;
  // przejście z widoku dnia / filtra do modułu przez zakładkę — od góry (D-112)
  document.addEventListener('click', e => {
    const a = e.target.closest?.('.tabs a, .side a[href^="#/"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.getAttribute('href') === (location.hash || '#/dzis')) {
      e.preventDefault();
      scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    } else forceTop = true;
  });
  // D-110: komputer (mysz) — delikatna poświata pod kursorem na kartach (pozycja jako zmienne CSS karty; bez wpływu na treść)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let spotRaf = 0, spotEv = null;
    document.addEventListener('pointermove', e => {
      spotEv = e;
      if (spotRaf) return;
      spotRaf = requestAnimationFrame(() => {
        spotRaf = 0;
        const el = spotEv.target.closest?.(SPOT);
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${Math.round(spotEv.clientX - r.left)}px`);
        el.style.setProperty('--my', `${Math.round(spotEv.clientY - r.top)}px`);
      });
    }, { passive: true });
  }
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
  shownRoute = route();
  await render();
  setInterval(clockTick, 30000);
  document.addEventListener('visibilitychange', clockTick);
  addEventListener('pageshow', clockTick);
  addEventListener('focus', clockTick);
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
