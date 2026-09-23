// Proste wykresy SVG (offline, bez bibliotek). Etykiety tekstowe dostępne dla czytników ekranu.
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, String(v))); if (text != null) e.textContent = text; return e; };

export function barChart(items, { title = '', unit = '', height = 150, fmt = v => String(v) } = {}) {
  const W = 320, H = height, pad = 22, max = Math.max(1, ...items.map(i => i.value));
  const bw = (W - pad) / Math.max(1, items.length);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H + 18}`, class: 'chart', role: 'img', 'aria-label': `${title}: ${items.map(i => `${i.label} ${fmt(i.value)}${unit}`).join(', ')}` });
  svg.append(sv('line', { x1: pad, y1: H, x2: W, y2: H, class: 'ch-axis' }));
  svg.append(sv('text', { x: 0, y: 10, class: 'ch-lab' }, fmt(max)));
  items.forEach((it, i) => {
    const bh = (it.value / max) * (H - 14), x = pad + i * bw + bw * 0.15;
    svg.append(sv('rect', { x, y: H - bh, width: bw * 0.7, height: Math.max(0, bh), rx: 3, class: `ch-bar${it.hl ? ' ch-hl' : ''}` }));
    const every = Math.ceil(items.length / 6); // najwyżej ~6 podpisów, zawsze ostatni
    if (i % every === (items.length - 1) % every) svg.append(sv('text', { x: x + bw * 0.35, y: H + 12, 'text-anchor': 'middle', class: 'ch-lab' }, it.label));
  });
  return svg;
}

export function lineChart(points, { title = '', unit = '', height = 150, fmt = v => String(v) } = {}) {
  const W = 320, H = height, pad = 26;
  const vals = points.map(p => p.value), min = Math.min(...vals), max = Math.max(...vals);
  const lo = min === max ? min - 1 : min, hi = min === max ? max + 1 : max;
  const x = i => pad + (points.length === 1 ? (W - pad) / 2 : (i * (W - pad - 6)) / (points.length - 1));
  const y = v => H - 8 - ((v - lo) / (hi - lo)) * (H - 22);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H + 18}`, class: 'chart', role: 'img', 'aria-label': `${title}: ${points.map(p => `${p.label} ${fmt(p.value)}${unit}`).join(', ')}` });
  svg.append(sv('text', { x: 0, y: 10, class: 'ch-lab' }, fmt(hi)), sv('text', { x: 0, y: H - 6, class: 'ch-lab' }, fmt(lo)));
  svg.append(sv('polyline', { points: points.map((p, i) => `${x(i)},${y(p.value)}`).join(' '), class: 'ch-line' }));
  points.forEach((p, i) => svg.append(sv('circle', { cx: x(i), cy: y(p.value), r: 3.2, class: 'ch-dot' })));
  [0, points.length - 1].filter((v, i, a) => a.indexOf(v) === i).forEach(i =>
    svg.append(sv('text', { x: x(i), y: H + 12, 'text-anchor': i === 0 ? 'start' : 'end', class: 'ch-lab' }, points[i].label)));
  return svg;
}
