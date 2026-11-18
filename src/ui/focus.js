// Tryby skupienia (D-114): wspólna powłoka — pasek (✕, tytuł, postęp, akcja), podziałka kroków, pierścień minutnika, klawiatura.
// Trasa `?v=fokus` w Treningu, Nauce (CFA / MPW) i Meal Prep: app.js chowa nawigację (html[data-focus]) i podtrzymuje ekran (wake lock).
// Zapisy zawsze tymi samymi funkcjami co widok modułu — tryb skupienia to inny wygląd tych samych danych.
import { h } from './dom.js';
import { icon } from './icons.js';
import { countdown, startCountdown, stopCountdown } from './signal.js';

export function focusTop({ exit, title, sub, onExit, info }) {
  return h('header', { class: 'fx-top' },
    h('a', { class: 'fx-x', href: exit, 'aria-label': 'Zakończ tryb skupienia', onclick: () => onExit?.() }, icon('x', { size: 22 })),
    h('div', { class: 'fx-title' }, h('h1', {}, title), sub && h('span', { class: 'fx-sub' }, sub)),
    info ? h('button', { class: 'fx-tech', 'aria-label': info.label, onclick: info.run }, icon(info.ic || 'info', { size: 22 })) : h('span', { 'aria-hidden': 'true' }));
}

// groups: [[{ done, cur }]] — kreska na krok, grupy rozdzielone odstępem
export const focusScale = (groups, label) => h('div', { class: 'fx-scale', role: 'img', 'aria-label': label },
  groups.map(g => h('span', { class: 'fx-sc-g' }, g.map(x => h('span', { class: `fx-sc${x.done ? ' is-done' : ''}${x.cur ? ' is-cur' : ''}` })))));

// Pierścień minutnika (globalny minutnik signal.js — działa i sygnalizuje także po wyjściu z trybu; widoczny w pigułce „na żywo”)
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function focusTimer(key, minutes, label, flash) {
  const NS = 'http://www.w3.org/2000/svg', R = 54, L = 2 * Math.PI * R;
  const ring = document.createElementNS(NS, 'svg');
  ring.setAttribute('viewBox', '0 0 128 128'); ring.setAttribute('class', 'fx-ring'); ring.setAttribute('aria-hidden', 'true');
  const bg = document.createElementNS(NS, 'circle'), fg = document.createElementNS(NS, 'circle');
  for (const [c, cls] of [[bg, 'fx-ring-bg'], [fg, 'fx-ring-fg']]) { c.setAttribute('cx', 64); c.setAttribute('cy', 64); c.setAttribute('r', R); c.setAttribute('class', cls); }
  fg.setAttribute('transform', 'rotate(-90 64 64)'); fg.setAttribute('stroke-dasharray', `${L} ${L}`);
  ring.append(bg, fg);
  const t = h('strong', { class: 'fx-rest-t' }), note = h('span', { class: 'fx-rest-n' }), btn = h('button', { class: 'fx-tbtn' });
  const box = h('section', { class: 'fx-rest fx-timer', 'aria-label': `Minutnik ${minutes} min` },
    h('div', { class: 'fx-rest-dial' }, ring, h('div', { class: 'fx-rest-read' }, note, t, h('span', { class: 'fx-rest-p' }, `${minutes} min`))),
    h('div', { class: 'fx-rest-act' }, btn));
  let id = null;
  const paint = () => {
    const c = countdown(key), run = c && !c.done;
    const left = !c ? minutes * 60 : c.left;
    t.textContent = c?.done ? '0:00' : mmss(left);
    note.textContent = c?.done ? 'Czas minął' : run ? 'Trwa' : 'Gotowy';
    fg.setAttribute('stroke-dashoffset', String(c ? Math.min(L, ((minutes * 60 - left) / (minutes * 60)) * L) : 0));
    btn.replaceChildren(icon(run ? 'square' : 'play', { size: 18 }), h('span', {}, run ? 'Zatrzymaj' : c?.done ? 'Od nowa' : `Start ${minutes} min`));
    btn.setAttribute('aria-label', run ? `Zatrzymaj minutnik: ${label}` : `Start minutnika ${minutes} min: ${label}`);
    box.classList.toggle('is-ready', !!c?.done);
    if (!run && id) { clearInterval(id); id = null; }
  };
  const loop = () => { if (!id) id = setInterval(() => (box.isConnected ? paint() : (clearInterval(id), id = null)), 1000); };
  btn.onclick = () => {
    const c = countdown(key);
    if (c && !c.done) stopCountdown(key);
    else { startCountdown(key, minutes * 60, label, l => flash?.(`Minutnik: ${l} — czas minął.`, 'info')); loop(); }
    paint();
  };
  paint();
  if (countdown(key) && !countdown(key).done) loop();
  return box;
}

// Klawiatura (komputer): Esc — wyjście, Enter — akcja główna (poza polami i przyciskami), ← → — poprzedni / następny krok
export function focusKeys(root, { exit, primary = null, nav = null }) {
  const on = ev => {
    if (!root.isConnected) { document.removeEventListener('keydown', on); return; }
    if (document.querySelector('dialog[open]')) return;
    const inField = ev.target.closest?.('input, textarea, select');
    if (ev.key === 'Escape') { ev.preventDefault(); location.hash = exit; }
    else if (!inField && ev.key === 'Enter' && primary && !ev.target.closest?.('button, a, summary')) { ev.preventDefault(); primary(); }
    else if (!inField && nav && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) { ev.preventDefault(); nav(ev.key === 'ArrowLeft' ? -1 : 1); }
  };
  document.addEventListener('keydown', on);
}
