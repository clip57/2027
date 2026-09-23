// Animowana postać człowieka wykonująca ćwiczenie (rysunek własny, poglądowy).
// Model: przegubowy szkielet 2D (widok z boku lub z przodu). Pozycja = kąty segmentów (stopnie; 0 = w prawo, 90 = w dół)
// + położenie bioder. Stawy ze stałym punktem podparcia (stopy na podłodze, dłonie na drążku) liczone kinematyką odwrotną.
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, String(v))); return e; };
const L = { T: 30, N: 4, HR: 5, UA: 15, FA: 14, TH: 18, SH: 18, FT: 7 };
const FLOOR = 86;
const rad = d => (d * Math.PI) / 180;
const pt = (p, ang, len) => [p[0] + len * Math.cos(rad(ang)), p[1] + len * Math.sin(rad(ang))];
const lerp = (a, b, t) => a + (b - a) * t;

// Kinematyka odwrotna dwóch segmentów: punkt pośredni (kolano / łokieć) między korzeniem a celem.
function ik(root, target, l1, l2, bend) {
  const dx = target[0] - root[0], dy = target[1] - root[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const a = Math.atan2(dy, dx), c = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const ang = a + bend * c;
  return [root[0] + l1 * Math.cos(ang), root[1] + l1 * Math.sin(ang)];
}

// ---------- Sprzęt ----------
const line = (a, b, cls = 'fg-eq') => sv('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls });
const rect = (x, y, w, h, cls = 'fg-eq-f') => sv('rect', { x, y, width: w, height: h, rx: 1.2, class: cls });
const plate = (p, r = 4.2) => sv('circle', { cx: p[0], cy: p[1], r, class: 'fg-plate' });
const dumbbell = p => [sv('rect', { x: p[0] - 4, y: p[1] - 1.2, width: 8, height: 2.4, rx: 1, class: 'fg-eq-f' }), plate([p[0] - 4, p[1]], 2.3), plate([p[0] + 4, p[1]], 2.3)];
const bench = (x1, x2, y) => [rect(x1, y, x2 - x1, 3.2), line([x1 + 3, y + 3], [x1 + 3, FLOOR]), line([x2 - 3, y + 3], [x2 - 3, FLOOR])];
const cable = (a, b) => [line(a, b, 'fg-cable'), sv('circle', { cx: b[0], cy: b[1], r: 2.2, class: 'fg-eq-f' })];

// ---------- Pozycje (a = start, b = koniec) ----------
// Pola: hip [x,y], t (tułów), ua/fa (ramię/przedramię), th/sh (udo/podudzie), ft (stopa);
// ankle / ankle2 / hand = cel kinematyki odwrotnej; view: 'side' | 'front'; s* = skrócenie perspektywiczne w widoku z przodu.
const STAND = { t: -90, th: 90, sh: 90, ft: 0 };
export const POSES = {
  'push-h': { label: 'leżenie na ławce, sztanga z klatki w górę', a: { hip: [66, 60], t: 180, ua: 30, fa: -95, th: 25, sh: 95, ft: 0 }, b: { ua: -80, fa: -92 },
    equip: j => [...bench(20, 80, 63), plate(j.hand)] },
  'pull-h': { label: 'siad, uchwyt ciągnięty do brzucha', a: { hip: [42, 66], t: -80, ua: 5, fa: 0, th: 0, sh: 15, ft: -75 }, b: { t: -95, ua: 150, fa: 5 },
    equip: j => [rect(28, 68, 26, 3.5), line([40, 71.5], [40, FLOOR]), rect(j.ankle[0] + 2, 56, 3, 22), ...cable(j.hand, [114, 40])] },
  'push-v': { label: 'stanie, ciężar z barków nad głowę', a: { hip: [60, 50], ...STAND, ua: 75, fa: -80 }, b: { ua: -85, fa: -90 }, equip: j => [plate(j.hand)] },
  'pull-v': { label: 'siad, drążek ściągany do górnej części klatki', a: { hip: [52, 68], t: -90, ua: -80, fa: -85, th: 0, sh: 90, ft: 0 }, b: { ua: 100, fa: -95 },
    equip: j => [rect(36, 70, 24, 3.5), line([46, 73.5], [46, FLOOR]), rect(j.knee[0] - 5, j.knee[1] - 6, 10, 3), ...cable(j.hand, [58, -14]), line([j.hand[0] - 8, j.hand[1]], [j.hand[0] + 8, j.hand[1]])] },
  fly: { view: 'front', label: 'ramiona z boków do środka przed klatką', a: { hip: [60, 50], ua: 188, fa: 185, th: 95, sh: 90 }, b: { ua: 20, fa: 20, sua: 0.55, sfa: 0.12 },
    equip: j => [...cable(j.hand, [10, 4]), ...cable(j.hand2, [110, 4])] },
  raise: { view: 'front', label: 'hantle unoszone bokiem do wysokości barków', a: { hip: [60, 50], ua: 100, fa: 97, th: 95, sh: 90 }, b: { ua: 180, fa: 182 },
    equip: j => [...dumbbell(j.hand), ...dumbbell(j.hand2)] },
  ext: { label: 'łokcie przy tułowiu, wyprost łokci w dół', a: { hip: [60, 50], ...STAND, t: -86, ua: 95, fa: -30 }, b: { fa: 80 }, equip: j => [...cable(j.hand, [96, -12])] },
  curl: { label: 'łokcie przy tułowiu, ciężar do barków', a: { hip: [60, 50], ...STAND, ua: 92, fa: 88 }, b: { fa: -70 }, equip: j => [plate(j.hand, 3.2)] },
  'push-d': { label: 'ławka skośna, sztanga nad górną część klatki', a: { hip: [70, 58], t: -140, ua: 50, fa: -100, th: 20, sh: 90, ft: 0 }, b: { ua: -85, fa: -90 },
    equip: j => [line([74, 61], [42, 34], 'fg-bench'), line([62, 61], [62, FLOOR]), rect(58, 60, 18, 3.2), plate(j.hand)] },
  'row-bent': { label: 'opad tułowia, sztanga do brzucha', a: { hip: [52, 48], t: -20, ua: 90, fa: 90, ankle: [53, FLOOR], th: 80, ft: 0 }, b: { ua: 200, fa: 95 },
    equip: j => [plate(j.hand)] },
  chin: { label: 'zwis, klatka do drążka', a: { hip: [60, 56], t: -90, hand: [63, 1], handBend: 1, th: 100, sh: 140, ft: 60 }, b: { hip: [60, 41], hand: [63, 1] },
    equip: () => [line([42, 1], [78, 1], 'fg-bar')] },
  rfly: { view: 'front', torsoScale: 0.55, label: 'opad tułowia, ramiona na boki (tylny bark)', a: { hip: [60, 50], ua: 95, fa: 95, th: 95, sh: 90 }, b: { ua: 178, fa: 180 },
    equip: j => [sv('circle', { cx: j.hand[0], cy: j.hand[1], r: 2, class: 'fg-eq-f' }), sv('circle', { cx: j.hand2[0], cy: j.hand2[1], r: 2, class: 'fg-eq-f' })] },
  skull: { label: 'leżenie, ramiona pionowo, wyprost łokci', a: { hip: [66, 60], t: 180, ua: -80, fa: 160, th: 25, sh: 95, ft: 0 }, b: { fa: -85 },
    equip: j => [...bench(20, 80, 63), plate(j.hand, 3.2)] },
  rcrunch: { label: 'leżenie, kolana do klatki, miednica unosi się', a: { hip: [60, 82], t: 180, ua: 0, fa: 0, th: -80, sh: 0, ft: -70 }, b: { hip: [58, 78], t: 176, th: -122, sh: -10 },
    equip: () => [rect(8, 84, 104, 2, 'fg-mat')] },
  crunch: { label: 'leżenie, łopatki unoszą się nad podłogę', a: { hip: [62, 82], t: 180, ua: 20, fa: 15, ankle: [84, FLOOR - 2], th: -45, ft: 0 }, b: { t: 203, ua: 5, fa: 5 },
    equip: () => [rect(8, 84, 104, 2, 'fg-mat')] },
  iso: { hold: true, label: 'podpór na przedramionach, ciało w linii', a: { hip: [60, 70], t: -8, ua: 90, fa: 0, th: 172, sh: 172, ft: 100 }, b: { hip: [60, 70.8] },
    equip: () => [rect(8, 84, 104, 2, 'fg-mat')] },
  'iso-side': { hold: true, label: 'podpór bokiem na jednym przedramieniu, drugie ramię w górę', a: { hip: [60, 70], t: -12, ua: 95, fa: 0, ua2: -95, fa2: -95, th: 170, sh: 170, ft: 90 }, b: { hip: [60, 69.2] },
    equip: () => [rect(8, 84, 104, 2, 'fg-mat')] },
  lpress: { label: 'siad na suwnicy, platforma wypychana nogami', a: { hip: [45, 62], t: -152, ua: 60, fa: 0, th: -70, sh: -8, ft: -60 }, b: { th: -36, sh: -40, ft: -95 },
    equip: j => [line([48, 66], [16, 48], 'fg-bench'), line([45, 66], [45, FLOOR]), line([60, 70], [104, 26], 'fg-rail'),
      sv('rect', { x: j.ankle[0] - 1, y: j.ankle[1] - 9, width: 3.5, height: 18, rx: 1, class: 'fg-eq-f', transform: `rotate(-45 ${j.ankle[0]} ${j.ankle[1]})` })] },
  hinge: { label: 'biodra w tył, plecy proste, sztanga wzdłuż nóg', a: { hip: [60, 50], ...STAND, ua: 90, fa: 90 }, b: { hip: [52, 50], t: -15, ankle: [54, FLOOR], th: 80 },
    equip: j => [plate(j.hand)] },
  kext: { label: 'siad na maszynie, wyprost kolan', a: { hip: [50, 60], t: -95, ua: 100, fa: 10, th: 0, sh: 90, ft: 0 }, b: { sh: 5, ft: -85 },
    equip: j => [rect(36, 62, 34, 3.5), line([38, 62], [36, 30], 'fg-bench'), line([48, 65.5], [48, FLOOR]), sv('circle', { cx: j.ankle[0], cy: j.ankle[1] - 1, r: 3, class: 'fg-eq-f' })] },
  'iso-knee': { hold: true, label: 'plecy przy ścianie, kolana ok. 90°', a: { hip: [34, 68], t: -90, ua: 90, fa: 90, th: 0, sh: 90, ft: 0 }, b: { hip: [34, 68.8] },
    equip: () => [line([29, -10], [29, FLOOR], 'fg-wall')] },
  plantar: { label: 'wspięcie na palce', a: { hip: [60, 50], ...STAND, ua: 90, fa: 90 }, b: { hip: [60, 45.5], ft: 45 },
    equip: () => [rect(56, 86, 20, 3, 'fg-eq-f')] },
  hipup: { label: 'łopatki na ławce, biodra w górę', a: { hip: [58, 76], t: -139, ua: 90, fa: 0, ankle: [76, FLOOR], ft: 0 }, b: { hip: [66, 58], t: -180 },
    equip: j => [...bench(10, 38, 60), plate(j.hip)] },
  kflex: { label: 'leżenie przodem, pięty do pośladków', a: { hip: [60, 60], t: 180, ua: 100, fa: 0, th: 0, sh: 0, ft: 90 }, b: { sh: -100, ft: -10 },
    equip: j => [...bench(24, 82, 63), sv('circle', { cx: j.ankle[0], cy: j.ankle[1] - 3, r: 3, class: 'fg-eq-f' })] },
  step: { label: 'wejście jedną nogą na podest', a: { hip: [55, 50], t: -88, ua: 90, fa: 90, ankle: [72, 68], ankle2: [55, FLOOR], ft: 0 }, b: { hip: [72, 32], ankle: [72, 68], ankle2: [66, 64] },
    equip: () => [rect(64, 68, 30, 18, 'fg-box')] },
  abd: { view: 'front', torsoScale: 0.9, label: 'siad, kolana odsuwane na boki', a: { hip: [60, 58], ua: 95, fa: 85, th: 97, sh: 90, sth: 0.6 }, b: { th: 150 },
    equip: j => [rect(44, 60, 32, 4), line([48, 64], [48, FLOOR]), line([72, 64], [72, FLOOR]), sv('circle', { cx: j.knee[0] - 2, cy: j.knee[1], r: 2.4, class: 'fg-eq-f' }), sv('circle', { cx: j.knee2[0] + 2, cy: j.knee2[1], r: 2.4, class: 'fg-eq-f' })] },
};
// Warianty ćwiczeń o tym samym typie ruchu, ale innym ustawieniu
export const OVERRIDES = {
  'Face pull': { label: 'lina do twarzy, łokcie wysoko i w tył', a: { hip: [42, 50], ...STAND, ua: -8, fa: -5 }, b: { ua: 178, fa: -80 },
    equip: j => [...cable(j.hand, [114, 18])] },
  'Łydki siedząc': { label: 'siad, pięty unoszone', a: { hip: [45, 68], t: -90, ua: 60, fa: 0, th: 0, sh: 90, ft: 0 }, b: { hip: [45, 68], sh: 90, ft: 40, lift: 4 },
    equip: j => [rect(30, 70, 26, 3.5), line([40, 73.5], [40, FLOOR]), rect(j.knee[0] - 5, j.knee[1] - 5, 11, 3)] },
  'Wyciskanie hantli nad głowę': { label: 'siad, hantle z barków nad głowę', a: { hip: [52, 68], t: -90, ua: 75, fa: -80, th: 0, sh: 90, ft: 0 }, b: { ua: -85, fa: -90 },
    equip: j => [rect(38, 70, 22, 3.5), line([40, 70], [40, 38], 'fg-bench'), line([48, 73.5], [48, FLOOR]), ...dumbbell(j.hand)] },
};

function joints(p, view, spec) {
  const side = view !== 'front';
  const ts = spec.torsoScale || 1;
  const hip = p.hip;
  const sh = pt(hip, p.t ?? -90, L.T * ts);
  const head = pt(sh, p.t ?? -90, L.N + L.HR);
  const J = { hip, sh, head };
  if (side) {
    if (p.hand) { J.elbow = ik(sh, p.hand, L.UA, L.FA, p.handBend ?? -1); J.hand = p.hand; }
    else { J.elbow = pt(sh, p.ua, L.UA); J.hand = pt(J.elbow, p.fa, L.FA); }
    const legTo = (target, bend) => { const knee = ik(hip, target, L.TH, L.SH, bend); return { knee, ankle: target }; };
    if (p.ankle) Object.assign(J, legTo(p.ankle, -1));
    else { J.knee = pt(hip, p.th, L.TH); J.ankle = pt(J.knee, p.sh, L.SH); }
    if (p.lift) J.ankle = [J.ankle[0], J.ankle[1] - p.lift];
    J.toe = pt(J.ankle, p.ft ?? 0, L.FT);
    if (p.ankle2) { const k2 = ik(hip, p.ankle2, L.TH, L.SH, -1); J.knee2 = k2; J.ankle2 = p.ankle2; J.toe2 = pt(p.ankle2, 0, L.FT); }
  } else {
    // Widok z przodu: barki i biodra na szerokość, kończyny lustrzane (kąt lewej strony; prawa = 180 − kąt).
    const shL = [sh[0] - 8, sh[1] + 2], shR = [sh[0] + 8, sh[1] + 2], hipL = [hip[0] - 5, hip[1]], hipR = [hip[0] + 5, hip[1]];
    const mir = a => 180 - a;
    const eL = pt(shL, p.ua, L.UA * (p.sua ?? 1)), eR = pt(shR, mir(p.ua), L.UA * (p.sua ?? 1));
    const kL = pt(hipL, p.th, L.TH * (p.sth ?? 1)), kR = pt(hipR, mir(p.th), L.TH * (p.sth ?? 1));
    Object.assign(J, { shL, shR, hipL, hipR, elbow: eL, elbow2: eR, hand: pt(eL, p.fa, L.FA * (p.sfa ?? 1)), hand2: pt(eR, mir(p.fa), L.FA * (p.sfa ?? 1)),
      knee: kL, knee2: kR, ankle: pt(kL, p.sh ?? 90, L.SH), ankle2: pt(kR, mir(p.sh ?? 90), L.SH) });
  }
  return J;
}

// Kąty interpolowane najkrótszą drogą (inaczej np. tułów w hip thruście obracałby się dookoła).
const ANG = new Set(['t', 'ua', 'fa', 'th', 'sh', 'ft', 'ua2', 'fa2']);
const lerpAng = (x, y, t) => { let d = ((y - x) % 360 + 540) % 360 - 180; return x + d * t; };
function interp(a, b, t) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k], y = b[k] ?? a[k];
    if (Array.isArray(x)) out[k] = [lerp(x[0], y[0], t), lerp(x[1], y[1], t)];
    else if (typeof x === 'number' && ANG.has(k)) out[k] = lerpAng(x, y, t);
    else if (typeof x === 'number') out[k] = lerp(x, y, t);
    else out[k] = y ?? x;
  }
  return out;
}

export function specFor(name, vizType) { return OVERRIDES[name] || POSES[vizType] || null; }

// Rysuje klatkę animacji dla postępu t ∈ [0,1] (0 = pozycja startowa, 1 = końcowa).
export function drawFrame(g, spec, t) {
  while (g.firstChild) g.firstChild.remove();
  const a = spec.a, b = { ...a, ...spec.b };
  const p = interp(a, b, t);
  const J = joints(p, spec.view, spec);
  g.append(sv('line', { x1: 0, y1: FLOOR, x2: 120, y2: FLOOR, class: 'fg-floor' }));
  (spec.equip?.(J) || []).flat().forEach(e => e && g.append(e));
  const limb = (pts, cls) => g.append(sv('polyline', { points: pts.map(q => q.map(v => v.toFixed(1)).join(',')).join(' '), class: cls }));
  if (spec.view === 'front') {
    limb([J.shL, J.elbow, J.hand], 'fg-limb'); limb([J.shR, J.elbow2, J.hand2], 'fg-limb');
    limb([J.hipL, J.knee, J.ankle], 'fg-limb'); limb([J.hipR, J.knee2, J.ankle2], 'fg-limb');
    g.append(sv('polygon', { points: [J.shL, J.shR, J.hipR, J.hipL].map(q => q.join(',')).join(' '), class: 'fg-torso-f' }));
  } else {
    // kończyny dalsze (półprzezroczyste), tułów, kończyny bliższe
    if (p.ua2 != null) { const e2 = pt(J.sh, p.ua2, L.UA); limb([J.sh, e2, pt(e2, p.fa2, L.FA)], 'fg-limb fg-far'); }
    else limb([J.sh, J.elbow, J.hand].map(q => [q[0] + 1.5, q[1] - 0.8]), 'fg-limb fg-far');
    if (J.knee2) limb([J.hip, J.knee2, J.ankle2, J.toe2], 'fg-limb fg-far');
    else limb([J.hip, J.knee, J.ankle, J.toe].map(q => [q[0] + 1.5, q[1] - 0.8]), 'fg-limb fg-far');
    limb([J.hip, J.sh], 'fg-torso');
    limb([J.hip, J.knee, J.ankle, J.toe], 'fg-limb');
    limb([J.sh, J.elbow, J.hand], 'fg-limb');
  }
  g.append(sv('circle', { cx: J.head[0], cy: J.head[1], r: L.HR, class: 'fg-head' }));
  return J;
}

export function figureSVG(spec, label) {
  const svg = sv('svg', { viewBox: '0 -18 120 108', class: 'fig-svg', role: 'img', 'aria-label': label });
  const g = sv('g');
  svg.append(g);
  drawFrame(g, spec, 0);
  return { svg, g };
}
