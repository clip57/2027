// Tarcza dnia (D-114, System 4.0 „Instrument”): pierścień 24 h — łuki punktów planu w kolorach domen (minione przygaszone, bieżący
// z upływem i poświatą), podziałka godzin, wskazówka „teraz”, wewnętrzny łuk postępu dnia. Północ na dole, południe na górze —
// dzień idzie jak słońce: rano po lewej, wieczór po prawej.
// Interakcja: dotknięcie albo przeciągnięcie po pierścieniu — podgląd punktu w środku tarczy (bez zmiany danych); klawiatura
// (rola slider): ← → poprzedni / następny punkt, Home / End, Enter — pokaż punkt w planie, Esc — powrót do „teraz”.
// Odświeżanie w miejscu (`update`) z zegara modułu (ctx.tick, co 30 s) — bez animacji ciągłych (D-112).
import { h } from './dom.js';
import { toMin, slotClock } from '../core/calc/now.js';
import { reduced } from './motion.js';

const NS = 'http://www.w3.org/2000/svg';
export const VIEW = 300, C = 150, R = 124, W = 14, R_DAY = 110;
const GAP = 0.9;   // stopnie przerwy między łukami
// `hidden` nie działa na elementach SVG (to atrybut HTML) — widoczność przez style.display
const show = (el, on) => { el.style.display = on ? '' : 'none'; };
const svg = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); return e; };

// Kąt (stopnie, SVG: 0° = oś x, rośnie zgodnie z ruchem wskazówek) dla minuty doby: 00:00 na dole, 06:00 po lewej, 12:00 u góry, 18:00 po prawej
export const angleOf = min => 90 + (min / 1440) * 360;
export const minOfAngle = deg => ((((deg - 90) % 360) + 360) % 360) / 360 * 1440;
export const polar = (r, deg) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)];
const f2 = n => Math.round(n * 100) / 100;
export function arcPath(r, a0, a1) {
  const [x0, y0] = polar(r, a0), [x1, y1] = polar(r, a1);
  return `M${f2(x0)} ${f2(y0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f2(x1)} ${f2(y1)}`;
}
// Zakresy punktów w minutach doby: `to` > `from` (punkt przez północ — np. sen 23:00–07:00 — kończy się po 1440)
export function spans(slots) {
  return slots.map((s, i) => { const a = toMin(s.from); let b = toMin(s.to); if (b <= a) b += 1440; return { s, i, a, b }; });
}
// Punkt planu obejmujący minutę doby (także po północy); ostatni pasujący wygrywa — jak currentSlot
export function spanAt(list, min) {
  let hit = null;
  for (const x of list) if ((min >= x.a && min < x.b) || (min + 1440 >= x.a && min + 1440 < x.b)) hit = x;
  return hit;
}
// „Czas własny” (U1) — neutralnie i ciszej niż punkty z treścią planu
const domainVar = s => (s.own ? 'var(--text-2)' : `var(--${s.domain || 'regen'})`);

// koniec dnia planu: ostatni punkt przez północ (sen) — godzina jego początku
export const dayEnd = slots => { const l = slots[slots.length - 1]; return l.to <= l.from ? l.from : l.to; };

let introDone = false;   // „włączenie przyrządu” — raz na uruchomienie aplikacji

// slots: punkty planu (resolveDay); hhmm: godzina teraz (null — dzień inny niż dziś, bez wskazówki); onShow(slot) — pokaż w planie
// caption: podpis w środku (np. „śr 18.11”); w środku tarczy dnia bieżącego — godzina (to zegar 24 h) i numer punktu planu
export function dayDial({ slots, hhmm = null, label = 'Tarcza dnia', caption = '', onShow = null }) {
  const list = spans(slots);
  const face = svg('svg', { viewBox: `0 0 ${VIEW} ${VIEW}`, class: 'dl-svg', 'aria-hidden': 'true', focusable: 'false' });
  face.append(svg('circle', { cx: C, cy: C, r: 149, class: 'dl-face' }));
  // podziałka: godziny (co 6 h dłuższe) i półgodziny
  const ticks = svg('g', { class: 'dl-ticks' });
  for (let i = 0; i < 48; i++) {
    const major = i % 12 === 0, hour = i % 2 === 0, a = angleOf(i * 30);
    const [x0, y0] = polar(major ? 134 : hour ? 139 : 142, a), [x1, y1] = polar(146, a);
    ticks.append(svg('line', { x1: f2(x0), y1: f2(y0), x2: f2(x1), y2: f2(y1), class: major ? 'dl-tk is-major' : hour ? 'dl-tk' : 'dl-tk is-minor' }));
  }
  const labels = svg('g', { class: 'dl-lab' });
  for (const [hh, txt] of [[0, '00'], [6, '06'], [12, '12'], [18, '18']]) {
    const [x, y] = polar(96, angleOf(hh * 60));
    const t = svg('text', { x: f2(x), y: f2(y + 3.5), 'text-anchor': 'middle' }); t.textContent = txt; labels.append(t);
  }
  const track = svg('circle', { cx: C, cy: C, r: R, class: 'dl-track' });
  const arcs = svg('g', { class: 'dl-arcs' });
  const arcEls = list.map(x => {
    const a0 = angleOf(x.a) + GAP / 2, a1 = angleOf(x.b) - GAP / 2;
    const p = svg('path', { d: arcPath(R, a0, Math.max(a0 + 0.3, a1)), class: `dl-arc${x.b - x.a >= 360 ? ' is-night' : x.s.own ? ' is-own' : ''}`, 'data-i': x.i, pathLength: 100 });
    p.style.setProperty('--dl-c', x.b - x.a >= 360 ? 'var(--tick)' : domainVar(x.s));
    p.style.setProperty('--dl-d', `${Math.round((x.a / 1440) * 600)}ms`);
    arcs.append(p);
    return p;
  });
  const elapsed = svg('path', { class: 'dl-elapsed' });
  const dayTrack = svg('circle', { cx: C, cy: C, r: R_DAY, class: 'dl-daytrack' });
  const dayArc = svg('path', { class: 'dl-day' });
  const sel = svg('path', { class: 'dl-sel' });
  const hand = svg('g', { class: 'dl-hand' });
  const handLine = svg('line', { x1: C, y1: C + R_DAY - 6, x2: C, y2: C + 147, class: 'dl-hand-l' });
  const handDot = svg('circle', { cx: C, cy: C + R, r: 4.5, class: 'dl-hand-d' });
  const handHalo = svg('circle', { cx: C, cy: C + R, r: 9.5, class: 'dl-hand-h' });
  hand.append(handLine, handHalo, handDot);
  face.append(ticks, labels, track, dayTrack, dayArc, arcs, elapsed, sel, hand);

  // środek tarczy: odczyt (dla czytników ekranu — tekst karty „Teraz” obok i aria-valuetext suwaka)
  const k = h('span', { class: 'dl-k' }), v = h('strong', { class: 'dl-v' }), u = h('small', {}), s2 = h('span', { class: 'dl-s' }), t2 = h('span', { class: 'dl-t' });
  v.append(document.createTextNode(''), u);
  const read = h('div', { class: 'dl-read', 'aria-hidden': 'true' }, k, t2, v, s2);
  const knob = h('div', { class: 'dl-face-w', role: 'slider', tabindex: '0', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': String(slots.length - 1) }, face);
  const root = h('div', { class: `dl${introDone || reduced() ? '' : ' is-intro'}` }, knob, read);
  introDone = true;

  let now = hhmm, pick = null, idle = null;
  const curSpan = () => (now ? spanAt(list, toMin(now)) : null);
  const setText = (key, title, big, unit, sub) => {
    k.textContent = key; t2.textContent = title || ''; t2.hidden = !title;
    v.firstChild.nodeValue = big; u.textContent = unit ? ` ${unit}` : ''; s2.textContent = sub || '';
  };
  function paint() {
    const nm = now ? toMin(now) : null, cur = curSpan();
    arcEls.forEach((p, i) => {
      const x = list[i];
      p.classList.toggle('is-past', nm != null && x !== cur && nm >= x.b);   // punkt przez północ (sen) kończy się po 1440 — nigdy „miniony”
      p.classList.toggle('is-now', x === cur);
      p.classList.toggle('is-pick', pick === x);
    });
    // upływ bieżącego punktu i postęp dnia (od pierwszego punktu planu do „teraz”)
    if (cur && nm != null) {
      const m = nm < cur.a ? nm + 1440 : nm;
      elapsed.setAttribute('d', arcPath(R, angleOf(cur.a) + GAP / 2, Math.max(angleOf(cur.a) + GAP / 2 + 0.3, angleOf(Math.min(m, cur.b)))));
      elapsed.style.setProperty('--dl-c', cur.b - cur.a >= 360 ? 'var(--tick-hi)' : domainVar(cur.s));
      show(elapsed, true);
    } else show(elapsed, false);
    const first = list[0]?.a ?? 0;
    if (nm != null && nm > first) { dayArc.setAttribute('d', arcPath(R_DAY, angleOf(first), angleOf(Math.min(nm, first + 1439)))); show(dayArc, true); } else show(dayArc, false);
    show(hand, nm != null);
    if (nm != null) hand.setAttribute('transform', `rotate(${f2(angleOf(nm) - 90)} ${C} ${C})`);
    if (pick) sel.setAttribute('d', arcPath(R, angleOf(pick.a) + GAP / 2, Math.max(angleOf(pick.a) + GAP, angleOf(pick.b) - GAP / 2)));
    show(sel, !!pick);
    // odczyt
    const shown = pick || cur;
    if (pick) {
      const d = nm == null ? null : pick.a - nm;
      const rel = nm == null ? '' : nm >= pick.b ? 'minął' : d >= 60 ? `za ${Math.floor(d / 60)} h ${String(d % 60).padStart(2, '0')} min` : `za ${Math.max(1, d)} min`;
      setText(`${pick.s.from}–${pick.s.to}`, pick.s.title, String(pick.b - pick.a), 'min', rel);
    } else if (nm != null) {
      setText(caption, '', now, '', cur ? `punkt ${cur.i + 1} z ${list.length}` : 'przed startem planu');
    } else {
      const n = list.length, w = n === 1 ? 'punkt' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'punkty' : 'punktów';
      setText(caption || 'Plan dnia', '', String(n), w, n ? `${slots[0].from}–${dayEnd(slots)}` : '');
    }
    root.classList.toggle('is-pick', !!pick);
    root.style.setProperty('--dl-now', shown ? domainVar(shown.s) : 'var(--accent)');
    knob.setAttribute('aria-valuenow', String(shown ? shown.i : 0));
    knob.setAttribute('aria-valuetext', shown ? `${shown.s.from}–${shown.s.to}: ${shown.s.title}${!pick && cur ? ' (teraz)' : ''}` : 'Brak punktu');
  }
  const choose = x => { pick = x && x !== curSpan() ? x : null; paint(); clearTimeout(idle); if (pick) idle = setTimeout(() => { pick = null; paint(); }, 8000); };
  // wskazanie na tarczy: minuta doby z położenia (tylko pas pierścienia — środek i okolice nie przechwytują przewijania)
  const minAt = (cx, cy) => {
    const r = knob.getBoundingClientRect(), sx = VIEW / r.width;
    const x = (cx - r.left) * sx - C, y = (cy - r.top) * sx - C, d = Math.hypot(x, y);
    return { d, min: minOfAngle((Math.atan2(y, x) * 180) / Math.PI) };
  };
  const onRing = d => d > R - 30 && d < 152;
  let drag = false;
  knob.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const p = minAt(e.touches[0].clientX, e.touches[0].clientY);
    drag = onRing(p.d);
    if (drag) choose(spanAt(list, Math.floor(p.min)));
  }, { passive: true });
  knob.addEventListener('touchmove', e => {
    if (!drag) return;
    if (e.cancelable) e.preventDefault();   // przeciąganie po pierścieniu nie przewija strony
    const p = minAt(e.touches[0].clientX, e.touches[0].clientY);
    const x = spanAt(list, Math.floor(p.min));
    if (x !== pick) choose(x);
  }, { passive: false });
  knob.addEventListener('touchend', () => { drag = false; });
  knob.addEventListener('mousedown', e => {
    const p = minAt(e.clientX, e.clientY);
    if (!onRing(p.d)) return;
    choose(spanAt(list, Math.floor(p.min)));
    const mv = ev => { const q = minAt(ev.clientX, ev.clientY); const x = spanAt(list, Math.floor(q.min)); if (x !== pick) choose(x); };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  });
  knob.addEventListener('keydown', e => {
    const base = pick || curSpan() || list[0];
    if (!base) return;
    const i = list.indexOf(base);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') choose(list[Math.min(list.length - 1, i + 1)]);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') choose(list[Math.max(0, i - 1)]);
    else if (e.key === 'Home') choose(list[0]);
    else if (e.key === 'End') choose(list[list.length - 1]);
    else if (e.key === 'Escape') { if (!pick) return; choose(null); }
    else if (e.key === 'Enter' || e.key === ' ') { onShow?.((pick || base).s); }
    else return;
    e.preventDefault(); e.stopPropagation();
  });
  read.addEventListener('click', () => { if (pick) onShow?.(pick.s); });
  paint();
  return { el: root, update(next) { now = next; paint(); }, picked: () => pick?.s || null, reset: () => choose(null) };
}
