// Pigułka „na żywo” (D-114, System 4.0 „Instrument”): stały element powłoki — gdziekolwiek jesteś, widać, co trwa i ile zostało.
// Pierwszeństwo: przerwa między seriami → działający minutnik (najbliższy koniec) → bieżący punkt planu dnia. Ukryta tam, gdzie moduł
// pokazuje to samo (punkt planu w „Dziś”, pasek przerwy w Treningu, minutnik na stronie, z której go uruchomiono) i w trybie skupienia.
// Odświeżanie: co 1 s tylko przy działającej przerwie lub minutniku (sam tekst, bez animacji); punkt planu — z zegarem aplikacji (30 s).
// Stan wyłącznie interfejsu (w pamięci karty) — nie trafia do dziennika zdarzeń ani do synchronizacji.
import { h, clear } from './dom.js';
import { icon } from './icons.js';
import { runningTimers, stopCountdown, onTimers, timersChanged, signal } from './signal.js';
import { resolveDay } from '../core/resolver.js';
import { currentSlot, slotClock, hhmmNow, minLabel } from '../core/calc/now.js';
import { today } from '../core/dates.js';

// ---- Przerwa między seriami (D-068): od D-114 stan globalny — pigułka pokazuje ją w każdym module ----
// { key, date, name, set, of, next: { e, set, of }, start, min, max, label, signaled, href }
let rest = null;
export const restNow = () => rest;
export function setRest(r) { rest = r; timersChanged(); }
export const restLeft = (r = rest, at = Date.now()) => (r ? r.min - (at - r.start) / 1000 : null);
// dawno zakończona (ponad 5 min po górnej granicy) — nie wracamy do niej
export const restStale = (r = rest, at = Date.now()) => !!r && (at - r.start) / 1000 > r.max + 300;
export function restSignal() {   // raz na przerwę, tylko w chwili końca (nie po powrocie do widoku); „+30 s” — ponownie
  const left = restLeft();
  if (rest && left <= 0 && !rest.signaled) { rest.signaled = true; if (left > -5) signal(); return true; }
  return false;
}

const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let el = null, sig = '', ivl = null, info = { id: null, title: '', focus: false }, day = { date: null, r: null };
let parts = null;   // { v, s } — pola odświeżane bez przebudowy

export function mountLive() {
  if (el) return el;
  el = h('div', { id: 'live', class: 'lv', role: 'region', 'aria-label': 'Na żywo', hidden: true });
  document.body.append(el);
  onTimers(paint);
  return el;
}
// po każdym przerysowaniu widoku (app.js): trasa, tytuł karty, tryb skupienia
export function liveRoute(id, title, focus = false) { info = { id, title, focus }; sig = ''; paint(); }
export const liveTick = () => paint();

// moduł pokazuje własny pasek „na żywo” (przerwa w Treningu, odliczanie w Pielęgnacji, tryb skupienia) — pigułka nie dubluje go i nie zasłania
const ownBar = () => !!document.querySelector('#main .tr-rest, #main .pg-timer, #main .fx');
function state() {
  if (info.focus) return null;
  if (rest && restStale()) rest = null;
  if (rest) {
    const left = restLeft();
    return { kind: 'rest', key: `rest:${rest.key}`, href: rest.href || `#/trening?d=${rest.date}`, label: left > 0 ? 'Przerwa' : 'Możesz zaczynać',
      sub: `Następnie: ${rest.next.e.name} · seria ${rest.next.set}`, value: left > 0 ? mmss(Math.ceil(left)) : `+${mmss(-left)}`, dom: 'train',
      hidden: rest.href === location.hash || ownBar() };   // widok, który sam pokazuje przerwę
  }
  const t = runningTimers()[0];
  if (t) return { kind: 'timer', key: `timer:${t.key}`, href: t.href || '#/dzis', label: t.label, sub: 'Minutnik', value: mmss(t.left), dom: 'accent', t,
    hidden: (t.href && t.href === location.hash) || ownBar() };
  const d = today();
  if (day.date !== d) day = { date: d, r: resolveDay(d) };
  const r = day.r;
  if (!r || r.outside || !r.slots?.length) return null;
  const hm = hhmmNow(), { current } = currentSlot(r.slots, hm);
  if (!current) return null;
  const left = slotClock(current, hm).left;
  return { kind: 'slot', key: `slot:${d}:${current.id}`, href: `#/dzis`, label: current.title, sub: `do ${current.to}`, value: minLabel(left),
    dom: current.own ? 'muted' : current.domain || 'accent', hidden: info.id === 'dzis' || ownBar() };
}

function build(st) {
  const v = h('strong', { class: 'lv-v' }, st.value), s = h('span', { class: 'lv-s' }, st.sub);
  const main = h('a', { class: 'lv-main', href: st.href, 'aria-label': `${st.label}: ${st.value} — otwórz` },
    h('span', { class: 'lv-ic', 'aria-hidden': 'true' }, st.kind === 'slot' ? h('span', { class: 'lv-dot' }) : icon('timer', { size: 18 })),
    h('span', { class: 'lv-t' }, h('span', { class: 'lv-l' }, st.label), s), v);
  const acts = st.kind === 'rest' ? [
    h('button', { class: 'lv-b', 'aria-label': 'Wydłuż przerwę o 30 s', onclick: () => { if (!rest) return; rest.min += 30; rest.max += 30; rest.signaled = false; timersChanged(); } }, '+30 s'),
    h('button', { class: 'lv-b', 'aria-label': 'Zakończ przerwę', onclick: () => setRest(null) }, icon('skip-forward', { size: 18 }))]
    : st.kind === 'timer' ? [h('button', { class: 'lv-b', 'aria-label': `Zatrzymaj minutnik: ${st.label}`, onclick: () => stopCountdown(st.t.key) }, icon('square', { size: 16 }))] : [];
  clear(el).append(main, ...acts);
  el.className = `lv is-${st.kind}`;
  el.style.setProperty('--dc', `var(--${st.dom})`);
  parts = { v, s, main, l: main.querySelector('.lv-l') };
}

function paint() {
  if (!el) return;
  const st = state();
  const show = !!st && !st.hidden;
  el.hidden = !show;
  document.documentElement.toggleAttribute('data-live', show);
  if (!show) { sig = ''; stop(); if (info.title) document.title = info.title; return; }
  const key = `${st.key}|${st.label}`;
  if (key !== sig) { sig = key; build(st); }
  else { parts.v.textContent = st.value; parts.s.textContent = st.sub; parts.l.textContent = st.label; parts.main.setAttribute('aria-label', `${st.label}: ${st.value} — otwórz`); }
  if (st.kind === 'rest') restSignal();
  if (st.kind === 'slot') { stop(); document.title = info.title; }
  else { document.title = `${st.value} · ${st.label} · 2027`; if (!ivl) ivl = setInterval(paint, 1000); }
}
const stop = () => { if (ivl) { clearInterval(ivl); ivl = null; } };
