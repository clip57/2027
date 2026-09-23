// Wspólne komponenty interfejsu. Bez innerHTML, z obsługą klawiatury i czytników ekranu.
import { h } from './dom.js';

// Przełącznik segmentowy (faza, wariant, dzień). options: [{value, label, hint}]
export function segmented(label, options, value, onChange) {
  const box = h('div', { class: 'seg', role: 'group', 'aria-label': label });
  for (const o of options) {
    box.append(h('button', { class: 'seg-b', 'aria-pressed': String(o.value === value),
      onclick: () => onChange(o.value) }, h('span', {}, o.label), o.hint && h('small', {}, o.hint)));
  }
  return h('div', { class: 'seg-wrap' }, h('span', { class: 'seg-label' }, label), box);
}

export const stat = (label, value, hint) => h('div', { class: 'stat' },
  h('span', { class: 'stat-l' }, label), h('strong', { class: 'stat-v' }, value), hint && h('span', { class: 'stat-h' }, hint));

export const statGrid = (...cells) => h('div', { class: 'stats' }, cells.filter(Boolean));

export const section = (id, title, ...body) => h('section', { class: 'panel', 'aria-labelledby': id },
  h('h2', { id }, title), ...body.filter(Boolean));

export const macroChips = (m, unit = 'g') => h('span', { class: 'macros' },
  h('span', { class: 'kcal' }, `${m.kcal} kcal`),
  h('span', { class: 'm m-p' }, `B ${m.p}${unit}`), h('span', { class: 'm m-c' }, `W ${m.c}${unit}`), h('span', { class: 'm m-f' }, `T ${m.f}${unit}`));

// Pierścień postępu (SVG). Treść tekstowa dostępna dla czytników ekranu.
export function progressRing(done, total, label = '') {
  const NS = 'http://www.w3.org/2000/svg';
  const pct = total ? done / total : 0, r = 26, c = 2 * Math.PI * r;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64'); svg.setAttribute('class', 'ring'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${label} ${done} z ${total}`);
  const mk = (cls, extra = {}) => { const e = document.createElementNS(NS, 'circle');
    Object.entries({ cx: 32, cy: 32, r, class: cls, ...extra }).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
  svg.append(mk('ring-bg'), mk('ring-fg', { 'stroke-dasharray': `${c * pct} ${c}`, transform: 'rotate(-90 32 32)' }));
  const t = document.createElementNS(NS, 'text');
  Object.entries({ x: 32, y: 36, 'text-anchor': 'middle', class: 'ring-t' }).forEach(([k, v]) => t.setAttribute(k, v));
  t.textContent = `${Math.round(pct * 100)}%`;
  svg.append(t);
  return svg;
}
