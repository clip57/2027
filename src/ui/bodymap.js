// Mapa mięśni (przód i tył). Własny rysunek — bez grafik z zewnątrz (offline, bez praw autorskich osób trzecich).
// Nazwy regionów = słownik free-exercise-db (17 grup). Rysunek poglądowy, nie atlas anatomiczny.
const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  kids.flat().forEach(k => k && el.append(k));
  return el;
};

export const MUSCLE_PL = {
  abdominals: 'Mięśnie brzucha', abductors: 'Odwodziciele biodra', adductors: 'Przywodziciele uda', biceps: 'Biceps',
  calves: 'Łydki', chest: 'Klatka piersiowa', forearms: 'Przedramiona', glutes: 'Pośladki', hamstrings: 'Tył uda (dwugłowe)',
  lats: 'Najszersze grzbietu', 'lower back': 'Dolny odcinek pleców', 'middle back': 'Środek pleców', neck: 'Szyja',
  quadriceps: 'Czworogłowe uda', shoulders: 'Barki (naramienne)', traps: 'Czworoboczny (kaptury)', triceps: 'Triceps',
};

// Kształty regionów: [widok, grupa, element SVG]. Układ symetryczny, viewBox 0 0 100 210.
const ell = (cx, cy, rx, ry, rot = 0) => dir => s('ellipse', { cx: 50 + (cx - 50) * dir, cy, rx, ry, transform: rot ? `rotate(${rot * dir} ${50 + (cx - 50) * dir} ${cy})` : '' });
const poly = pts => dir => s('polygon', { points: pts.map(([x, y]) => `${50 + (x - 50) * dir},${y}`).join(' ') });
const both = shape => [shape(1), shape(-1)];

const FRONT = {
  neck: [s('rect', { x: 45, y: 25, width: 10, height: 8, rx: 3 })],
  traps: [...both(poly([[44, 31], [36, 36], [44, 36]]))],
  shoulders: [...both(ell(32, 42, 7, 7.5))],
  chest: [...both(poly([[50, 39], [37, 40], [35, 50], [40, 57], [50, 56]]))],
  biceps: [...both(ell(27.5, 58, 4.6, 10, 10))],
  forearms: [...both(ell(22.5, 81, 4, 12, 12))],
  abdominals: [s('rect', { x: 42, y: 59, width: 16, height: 35, rx: 5 }), ...both(poly([[41, 60], [36, 64], [37, 88], [41, 92]]))],
  abductors: [...both(ell(34.5, 101, 3.5, 9))],
  adductors: [...both(ell(45.5, 116, 3.5, 13, -4))],
  quadriceps: [...both(ell(39, 128, 7, 21, 4))],
  calves: [...both(ell(40, 172, 4.2, 15))],
};
const BACK = {
  neck: [s('rect', { x: 45, y: 25, width: 10, height: 8, rx: 3 })],
  traps: [poly([[50, 28], [64, 38], [50, 62], [36, 38]])(1)],
  shoulders: [...both(ell(32, 42, 7, 7.5))],
  'middle back': [...both(poly([[48, 40], [40, 44], [41, 60], [48, 64]]))],
  lats: [...both(poly([[39, 46], [34, 52], [37, 76], [45, 80], [42, 60]]))],
  'lower back': [s('rect', { x: 43, y: 70, width: 14, height: 20, rx: 4 })],
  triceps: [...both(ell(27.5, 58, 4.6, 10, 10))],
  forearms: [...both(ell(22.5, 81, 4, 12, 12))],
  glutes: [...both(ell(42.5, 101, 8.5, 9))],
  abductors: [...both(ell(33.5, 97, 3, 6))],
  adductors: [...both(ell(46, 120, 3, 11, -4))],
  hamstrings: [...both(ell(40, 132, 7, 19, 3))],
  calves: [...both(ell(40, 170, 5.5, 15))],
};

// Sylwetka (tło)
const silhouette = () => s('g', { class: 'bm-body' },
  s('circle', { cx: 50, cy: 14, r: 10 }),
  s('path', { d: 'M38 34 Q50 30 62 34 L69 38 Q76 42 76 52 L79 70 L81 96 L77 98 L72 72 L68 56 L66 92 L68 104 L64 150 L62 196 L54 197 L52 150 L50 116 L48 150 L46 197 L38 196 L36 150 L32 104 L34 92 L32 56 L28 72 L23 98 L19 96 L21 70 L24 52 Q24 42 31 38 Z' }));

function figure(regions, active, label) {
  const g = s('g', {}, silhouette());
  for (const [group, shapes] of Object.entries(regions)) {
    const state = active.primary.includes(group) ? 'p' : active.secondary.includes(group) ? 's' : 'n';
    shapes.forEach(sh => { sh = sh.cloneNode(); sh.setAttribute('class', `bm-m bm-${state}`); sh.setAttribute('data-muscle', group); g.append(sh); });
  }
  g.append(s('text', { x: 50, y: 208, 'text-anchor': 'middle', class: 'bm-label' }, document.createTextNode(label)));
  return g;
}

export function bodyMap({ primary = [], secondary = [] }, { size = 'md', title } = {}) {
  const svg = s('svg', { viewBox: '0 0 210 212', class: `bodymap bm-${size}`, role: 'img',
    'aria-label': title || `Mięśnie główne: ${primary.map(m => MUSCLE_PL[m] || m).join(', ') || 'brak'}; pomocnicze: ${secondary.map(m => MUSCLE_PL[m] || m).join(', ') || 'brak'}` });
  const front = figure(FRONT, { primary, secondary }, 'przód');
  const back = figure(BACK, { primary, secondary }, 'tył');
  back.setAttribute('transform', 'translate(110 0)');
  svg.append(front, back);
  return svg;
}
