// Wspólne komponenty interfejsu. Bez innerHTML, z obsługą klawiatury i czytników ekranu.
import { h, clear } from './dom.js';

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

// Pierścień postępu (SVG). Treść tekstowa dostępna dla czytników ekranu. D-110: łuk w gradiencie koloru domeny (kolory punktów
// gradientu z CSS — .ring .rg-a / .rg-b na podstawie --ring), identyfikator gradientu unikalny w dokumencie.
let ringSeq = 0;
export function progressRing(done, total, label = '') {
  const NS = 'http://www.w3.org/2000/svg';
  const pct = total ? done / total : 0, r = 26, c = 2 * Math.PI * r, gid = `rg-${++ringSeq}`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64'); svg.setAttribute('class', 'ring'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${label} ${done} z ${total}`);
  const mk = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
  const grad = mk('linearGradient', { id: gid, x1: 0, y1: 0, x2: 1, y2: 1 });
  grad.append(mk('stop', { offset: 0, class: 'rg-a' }), mk('stop', { offset: 1, class: 'rg-b' }));
  const defs = mk('defs'); defs.append(grad);
  svg.append(defs, mk('circle', { cx: 32, cy: 32, r, class: 'ring-bg' }),
    mk('circle', { cx: 32, cy: 32, r, class: 'ring-fg', stroke: `url(#${gid})`, 'stroke-dasharray': `${c * pct} ${c}`, transform: 'rotate(-90 32 32)' }));
  const t = document.createElementNS(NS, 'text');
  Object.entries({ x: 32, y: 36, 'text-anchor': 'middle', class: 'ring-t' }).forEach(([k, v]) => t.setAttribute(k, v));
  t.textContent = `${Math.round(pct * 100)}%`;
  svg.append(t);
  return svg;
}

// Arkusz (okno modalne): nazwa dostępna z tytułu (aria-labelledby), własny obszar komunikatów (błąd widoczny w oknie,
// nie pod nim) i usunięcie z DOM po każdym zamknięciu — także klawiszem Esc (B2, B3).
let sheetSeq = 0;
export function sheet(title, ...body) {
  const id = `sheet-h-${++sheetSeq}`;
  const msg = h('div', { class: 'sheet-msg', role: 'alert' });
  const d = h('dialog', { class: 'sheet', 'aria-labelledby': id, onclose: () => d.remove() });
  const close = () => { if (d.open) d.close(); d.remove(); };
  const head = h('div', { class: 'sheet-head' }, h('h2', { id }, title), h('button', { onclick: close, 'aria-label': 'Zamknij' }, '✕'));
  d.append(head, h('div', { class: 'sheet-body' }, msg, ...body.filter(Boolean)));
  dragToClose(d, head, close);
  document.body.append(d); d.showModal();
  return { el: d, close, error: e => { clear(msg).append(h('div', { class: 'banner err' }, e?.message || String(e))); msg.scrollIntoView?.({ block: 'nearest' }); } };
}

// D-110: telefon (dotyk, < 600 px) — arkusz zamykany także przeciągnięciem w dół: za nagłówek z uchwytem albo za treść, gdy jest
// przewinięta do samej góry (jak arkusze systemu iOS). Mniej niż próg — arkusz wraca na miejsce. Zamknięcie dokładnie jak przyciskiem ✕
// (fokus wraca do elementu, który otworzył okno). D-112: zdarzenia dotyku z preventDefault w pierwszym i kolejnych touchmove — na iPhonie
// zdarzenia wskaźnika przegrywały z przewijaniem (Safari przejmował gest i przerywał przeciąganie).
const NO_DRAG = 'button, a, input, textarea, select, [contenteditable], .seg, .scroll-x, .tl-chips, .pills, .day-strip';
function dragToClose(d, head, close) {
  let y0 = null, x0 = 0, dy = 0, t0 = 0, active = false, decided = false;
  const back = () => { d.style.transition = 'transform var(--dur-2) var(--ease-out)'; };
  d.addEventListener('touchstart', e => {
    y0 = null;
    if (e.touches.length !== 1 || matchMedia('(min-width: 600px)').matches) return;
    const t = e.target, onHead = head.contains(t) && !t.closest('button');
    if (!onHead && (d.scrollTop > 0 || t.closest(NO_DRAG))) return;   // treść: tylko arkusz przewinięty do góry, nie pola i paski
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; t0 = e.timeStamp; active = onHead; decided = onHead;
  }, { passive: true });
  d.addEventListener('touchmove', e => {
    if (y0 == null) return;
    const ty = e.touches[0].clientY, tx = e.touches[0].clientX;
    if (!decided) {   // treść: decyzja przy pierwszym ruchu — w dół i pionowo → przeciąganie arkusza, inaczej zwykłe przewijanie
      decided = true;
      if (d.scrollTop > 0 || ty - y0 <= 0 || Math.abs(tx - x0) > Math.abs(ty - y0)) { y0 = null; return; }
      active = true;
    }
    if (!active) return;
    if (e.cancelable) e.preventDefault();
    dy = Math.max(0, ty - y0);
    d.style.transition = 'none';
    d.style.transform = dy ? `translateY(${dy}px)` : '';
  }, { passive: false });
  const end = e => {
    if (y0 == null || !active) { y0 = null; return; }
    y0 = null; active = false;
    const fast = dy > 24 && dy / Math.max(1, e.timeStamp - t0) > 0.5;
    back();
    if (dy > Math.min(140, d.offsetHeight / 3) || fast) { d.style.transform = 'translateY(100%)'; setTimeout(close, 200); }
    else d.style.transform = '';
  };
  d.addEventListener('touchend', end);
  d.addEventListener('touchcancel', end);
}
