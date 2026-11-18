// Gesty (D-114, System 4.0 „Instrument”): bezpośrednia manipulacja — każdy gest ma odpowiednik przyciskiem w tym samym wierszu
// (klawiatura, mysz, czytniki ekranu), gest jest tylko skrótem.
// Przesunięcie wiersza: w prawo — akcja główna (np. „przyjęte”, „seria wykonana”), w lewo — druga akcja (np. cofnięcie).
// Zdarzenia dotyku z decyzją w pierwszym ruchu (D-112: na iPhonie zdarzenia wskaźnika przegrywają z przewijaniem): poziomo → gest
// (preventDefault, strona się nie przewija), pionowo → zwykłe przewijanie. Bez kodu w czasie przewijania.
import { h } from './dom.js';
import { icon } from './icons.js';
import { reduced } from './motion.js';

const NO_SWIPE = 'input, textarea, select, [contenteditable], .scroll-x';
const EDGE = 24;   // od lewej krawędzi ekranu — gest „wstecz” systemu

// row: element wiersza (pozostaje w miejscu w DOM); actions: { right: { label, ic, run, tone }, left: {...} } — tone: ok | neutral
export function swipeRow(row, { right = null, left = null } = {}) {
  if (!row || (!right && !left)) return row;
  let x0 = 0, y0 = 0, dx = 0, t0 = 0, state = 'idle', layer = null, width = 1;
  const reset = () => {
    state = 'idle'; dx = 0;
    row.style.transition = reduced() ? 'none' : 'transform var(--dur-3) var(--ease-spring)';
    row.style.transform = '';
    row.classList.remove('gx-on');
    const l = layer; layer = null;
    if (l) setTimeout(() => l.remove(), reduced() ? 0 : 320);
  };
  const paintLayer = () => {
    const act = dx > 0 ? right : left;
    if (!act) return;
    if (!layer || layer.dataset.side !== (dx > 0 ? 'r' : 'l')) {
      layer?.remove();
      const host = row.parentElement;   // warstwa w rodzicu wiersza (pozycjonowanym), w obrysie wiersza
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      layer = h('span', { class: `gx-act gx-${act.tone || 'ok'} gx-${dx > 0 ? 'r' : 'l'}`, 'aria-hidden': 'true', 'data-side': dx > 0 ? 'r' : 'l' },
        icon(act.ic || 'check', { size: 20 }), h('span', {}, act.label));
      // warstwa akcji pod wierszem, dokładnie w obrysie wiersza — offset* nie uwzględnia przesunięcia (transform) w trakcie gestu
      Object.assign(layer.style, { top: `${row.offsetTop}px`, left: `${row.offsetLeft}px`, width: `${row.offsetWidth}px`, height: `${row.offsetHeight}px` });
      host.append(layer);
    }
    layer.classList.toggle('is-armed', Math.abs(dx) > width * 0.32);
  };
  row.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || state !== 'idle') return;
    const t = e.touches[0];
    if (t.clientX < EDGE || e.target.closest(NO_SWIPE)) return;
    x0 = t.clientX; y0 = t.clientY; t0 = e.timeStamp; dx = 0; state = 'maybe'; width = row.offsetWidth || 1;
  }, { passive: true });
  row.addEventListener('touchmove', e => {
    if (state === 'idle') return;
    const t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
    if (state === 'maybe') {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      if (Math.abs(my) >= Math.abs(mx) || (mx > 0 && !right) || (mx < 0 && !left)) { state = 'idle'; return; }   // przewijanie
      state = 'drag'; row.classList.add('gx-on'); row.style.transition = 'none';
    }
    if (e.cancelable) e.preventDefault();
    dx = mx > 0 ? (right ? mx : 0) : (left ? mx : 0);
    const lim = width * 0.6, damp = v => (Math.abs(v) <= lim ? v : Math.sign(v) * (lim + (Math.abs(v) - lim) * 0.25));
    dx = damp(dx);
    row.style.transform = `translateX(${dx}px)`;
    paintLayer();
  }, { passive: false });
  const end = e => {
    if (state !== 'drag') { state = 'idle'; return; }
    const fast = Math.abs(dx) > 40 && Math.abs(dx) / Math.max(1, e.timeStamp - t0) > 0.6;
    const act = dx > 0 ? right : left;
    const go = act && (Math.abs(dx) > width * 0.32 || fast);
    layer?.classList.add(go ? 'is-done' : 'is-cancel');
    reset();
    if (go) act.run();
  };
  row.addEventListener('touchend', end);
  row.addEventListener('touchcancel', () => { if (state === 'drag') reset(); else state = 'idle'; });
  row.classList.add('gx-row');
  return row;
}
