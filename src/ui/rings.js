// D-119 „Instrument+”: pierścień segmentów — przyrząd modułów Suplementacja (pory dnia) i Pielęgnacja (kroki pory). Każdy segment
// to łuk z torem i wypełnieniem (część wykonana 0…1) oraz stanem (`done`, `next`, `miss`, `todo`) — kolory w instrument.css (.rg-*).
// Rysunek dekoracyjny dla czytników ekranu ma jedną etykietę; nawigacja do segmentów — osobnymi przyciskami/odnośnikami obok.
import { reduced } from './motion.js';

const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); return e; };

/**
 * @param {{ v: number, tone?: string }[]} segs
 * @param {{ size?: number, stroke?: number, gap?: number, label?: string, cls?: string, animate?: boolean }} [o]
 */
export function segRing(segs, { size = 132, stroke = 10, gap = 4, label = '', cls = '', animate = false } = {}) {
  const r = (size - stroke) / 2 - 1, c = 2 * Math.PI * r, n = Math.max(1, segs.length);
  const step = c / n, gapLen = n > 1 ? Math.min(gap, step / 3) : 0, len = step - gapLen;
  // bez etykiety — rysunek tylko ozdobny (nazwę ma element nadrzędny, np. odnośnik pory)
  const svg = mk('svg', { viewBox: `0 0 ${size} ${size}`, class: `rg ${cls}`.trim(), focusable: 'false', ...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }) });
  const g = mk('g', { transform: `rotate(-90 ${size / 2} ${size / 2})` });
  segs.forEach((s, i) => {
    const off = -(i * step + gapLen / 2), fill = Math.max(0, Math.min(1, s.v)) * len;
    const at = { cx: size / 2, cy: size / 2, r, 'stroke-width': stroke, 'stroke-dashoffset': off };
    g.append(mk('circle', { ...at, class: `rg-tr${s.tone ? ` is-${s.tone}` : ''}`, 'stroke-dasharray': `${len} ${c - len}` }));
    if (fill > 0.01) {
      const f = mk('circle', { ...at, class: `rg-f${s.tone ? ` is-${s.tone}` : ''}`, 'stroke-dasharray': `${fill} ${c - fill}` });
      if (animate && !reduced() && f.animate) f.animate([{ strokeDasharray: `0 ${c}` }, { strokeDasharray: `${fill} ${c - fill}` }], { duration: 520, delay: i * 40, easing: 'cubic-bezier(.2, 0, 0, 1)', fill: 'backwards' });
      g.append(f);
    }
  });
  svg.append(g);
  return svg;
}
