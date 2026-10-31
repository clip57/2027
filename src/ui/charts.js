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

// ==========================================================================
// System 3.0 „Precision” (D-113): zestaw wykresów SVG — wyłącznie z prawdziwych danych (zasada 6), bez bibliotek, działające offline
// i w obu wariantach budowy. Kolor z `--ch` (domyślnie akcent) na elemencie nadrzędnym; każdy wykres ma etykietę dla czytników ekranu.
// ==========================================================================

// Mini-wykres (sparkline): słupki albo linia z polem; ostatni punkt wyróżniony. values: liczby (null = brak danych)
export function sparkline(values, { label = '', kind = 'bars', max = null, w = 112, h = 32 } = {}) {
  const n = Math.max(1, values.length), top = Math.max(1e-9, max ?? Math.max(0, ...values.map(v => v ?? 0)));
  const svg = sv('svg', { viewBox: `0 0 ${w} ${h}`, class: `spark spark-${kind}`, role: 'img', 'aria-label': label, preserveAspectRatio: 'none' });
  if (kind === 'bars') {
    const bw = w / n;
    values.forEach((v, i) => {
      const bh = v == null ? 0 : Math.max(v > 0 ? 2 : 0, (v / top) * (h - 2));
      svg.append(sv('rect', { x: (i * bw + bw * 0.14).toFixed(2), y: (h - bh).toFixed(2), width: (bw * 0.72).toFixed(2), height: bh.toFixed(2), rx: 1.5,
        class: `sp-b${i === n - 1 ? ' is-last' : ''}${v == null ? ' is-na' : ''}` }));
      if (v != null && v === 0) svg.append(sv('rect', { x: (i * bw + bw * 0.14).toFixed(2), y: h - 1.5, width: (bw * 0.72).toFixed(2), height: 1.5, class: 'sp-0' }));
    });
    return svg;
  }
  const x = i => (n === 1 ? w / 2 : (i * (w - 4)) / (n - 1) + 2), y = v => h - 3 - ((v ?? 0) / top) * (h - 6);
  const pts = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  svg.append(sv('path', { d: `M${x(0)},${h} L${pts.join(' L')} L${x(n - 1)},${h} Z`, class: 'sp-area' }), sv('polyline', { points: pts.join(' '), class: 'sp-line' }));
  svg.append(sv('circle', { cx: x(n - 1).toFixed(2), cy: y(values[n - 1]).toFixed(2), r: 2.6, class: 'sp-dot' }));
  return svg;
}

// Wykres obszaru z osią (np. postęp nauki: wykonane vs plan). series: [{ values, cls }] — wspólna oś X (labels)
export function areaChart(labels, series, { title = '', height = 140, max = null, fmt = v => String(v), mark = null } = {}) {
  const W = 320, H = height, pad = 6, n = Math.max(2, labels.length);
  const top = Math.max(1, max ?? Math.max(...series.flatMap(s => s.values.filter(v => v != null))));
  const x = i => pad + (i * (W - 2 * pad)) / (n - 1), y = v => H - 4 - (v / top) * (H - 14);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H + 16}`, class: 'chart ch-area', role: 'img', 'aria-label': title });
  [0.5, 1].forEach(f => svg.append(sv('line', { x1: pad, x2: W - pad, y1: y(top * f), y2: y(top * f), class: 'ch-grid' })));
  for (const s of series) {
    const idx = s.values.map((v, i) => [v, i]).filter(([v]) => v != null);
    if (!idx.length) continue;
    const pts = idx.map(([v, i]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    if (s.fill !== false) svg.append(sv('path', { d: `M${x(idx[0][1])},${H - 4} L${pts.join(' L')} L${x(idx[idx.length - 1][1])},${H - 4} Z`, class: `ar-fill ${s.cls || ''}` }));
    svg.append(sv('polyline', { points: pts.join(' '), class: `ar-line ${s.cls || ''}` }));
  }
  if (mark != null && mark >= 0 && mark < labels.length) svg.append(sv('line', { x1: x(mark), x2: x(mark), y1: 6, y2: H - 4, class: 'ch-mark' }));
  svg.append(sv('text', { x: pad, y: H + 13, class: 'ch-lab' }, labels[0]), sv('text', { x: W - pad, y: H + 13, 'text-anchor': 'end', class: 'ch-lab' }, labels[labels.length - 1]));
  svg.append(sv('text', { x: W - pad, y: y(top) - 3, 'text-anchor': 'end', class: 'ch-lab' }, fmt(top)));
  return svg;
}

// Pierścień udziałów (np. makroskładniki w kcal). parts: [{ value, cls, label }]
export function donut(parts, { label = '', size = 72, stroke = 9, center = null } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, sum = parts.reduce((a, p) => a + p.value, 0) || 1, gap = parts.length > 1 ? 2 : 0;
  const svg = sv('svg', { viewBox: `0 0 ${size} ${size}`, class: 'donut', role: 'img', 'aria-label': label, width: size, height: size });
  svg.append(sv('circle', { cx: size / 2, cy: size / 2, r, class: 'dn-bg', 'stroke-width': stroke }));
  let off = 0;
  for (const p of parts) {
    const len = Math.max(0, (p.value / sum) * c - gap);
    svg.append(sv('circle', { cx: size / 2, cy: size / 2, r, class: `dn-seg ${p.cls || ''}`, 'stroke-width': stroke,
      'stroke-dasharray': `${len.toFixed(2)} ${c.toFixed(2)}`, 'stroke-dashoffset': (-off).toFixed(2), transform: `rotate(-90 ${size / 2} ${size / 2})` }));
    off += (p.value / sum) * c;
  }
  if (center != null) svg.append(sv('text', { x: size / 2, y: size / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'dn-t' }, center));
  return svg;
}

// Mapa ciepła (tygodnie × dni): cells — { date, v (0…1 albo null = poza zakresem), today, title }; kolumny = tygodnie
export function heatmap(weeks, { label = '', cell = 12, gapPx = 3, rows = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'] } = {}) {
  const lw = 18, W = lw + weeks.length * (cell + gapPx), H = 7 * (cell + gapPx);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'heat', role: 'img', 'aria-label': label, width: W, height: H });
  rows.forEach((r, i) => i % 2 === 0 && svg.append(sv('text', { x: 0, y: i * (cell + gapPx) + cell - 2, class: 'ht-lab' }, r)));
  weeks.forEach((wk, wi) => wk.forEach((c, di) => {
    if (!c) return;
    const lvl = c.v == null ? 'na' : c.v <= 0 ? 0 : c.v < 0.34 ? 1 : c.v < 0.67 ? 2 : c.v < 1 ? 3 : 4;
    const rect = sv('rect', { x: lw + wi * (cell + gapPx), y: di * (cell + gapPx), width: cell, height: cell, rx: 3, class: `ht-c ht-${lvl}${c.today ? ' is-today' : ''}` });
    if (c.title) rect.append(sv('title', {}, c.title));
    svg.append(rect);
  }));
  return svg;
}

// Oś zapasu: dni pokrycia na skali `span` dni, kreska dnia zakupów, strefa „brak”. days = Infinity → pełny pasek
export function stockAxis(days, shopIn, { span = 14, label = '' } = {}) {
  const W = 200, H = 10, f = v => Math.max(0, Math.min(1, v / span)) * W;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H + 2}`, class: 'saxis', role: 'img', 'aria-label': label, preserveAspectRatio: 'none' });
  svg.append(sv('rect', { x: 0, y: 3, width: W, height: H - 4, rx: 3, class: 'sa-bg' }));
  const cover = Number.isFinite(days) ? f(days) : W;
  svg.append(sv('rect', { x: 0, y: 3, width: cover.toFixed(1), height: H - 4, rx: 3, class: `sa-f${Number.isFinite(days) && days < shopIn ? ' is-short' : ''}` }));
  if (shopIn != null && shopIn <= span) svg.append(sv('rect', { x: Math.min(W - 2, f(shopIn)).toFixed(1), y: 0, width: 2, height: H + 2, rx: 1, class: 'sa-shop' }));
  return svg;
}
