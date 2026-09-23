// Interaktywna animacja ruchu: postać człowieka wykonująca ćwiczenie (figure.js), odtwarzanie, suwak, wskazówki krok po kroku.
// Zastępuje abstrakcyjny schemat z TRENING.html na prośbę użytkownika (D-049); tor ruchu ze źródła pokazywany jako opis.
import { h } from './dom.js';
import { SRC } from '../core/data.js';
import { specFor, figureSVG, drawFrame } from './figure.js';


export function movementPlayer(name) {
  const info = SRC.training.info[name];
  const spec = info && specFor(name, info.v);
  if (!spec) return null;
  const { svg, g } = figureSVG(spec, `Animacja: ${name} — ${spec.label}`);
  // Cykl 0..1: 0–0,45 ruch do pozycji końcowej, 0,45–0,55 zatrzymanie, 0,55–1 powrót (kontrolowany).
  const ease = x => 0.5 - Math.cos(Math.PI * x) / 2;
  const tAt = c => (c < 0.45 ? ease(c / 0.45) : c < 0.55 ? 1 : ease(1 - (c - 0.55) / 0.45));
  const phase = h('span', { class: 'mv-phase' });
  const slider = h('input', { type: 'range', min: '0', max: '100', value: '0', 'aria-label': 'Pozycja w ruchu' });
  const set = c => {
    drawFrame(g, spec, spec.hold ? (Math.sin(c * Math.PI * 2) + 1) / 2 : tAt(c));
    phase.textContent = spec.hold ? 'utrzymaj pozycję — spokojny oddech'
      : c === 0 || c === 1 ? 'pozycja startowa' : c < 0.45 ? 'faza ruchu' : c < 0.55 ? 'pozycja końcowa' : 'powrót — kontrolowany';
    slider.value = String(Math.round(c * 100));
  };
  let raf = null, t0 = 0, pos = 0;
  const reduce = matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const play = h('button', { class: 'mv-play', onclick: () => {
    if (raf) { cancelAnimationFrame(raf); raf = null; play.textContent = '▶ Odtwórz'; return; }
    play.textContent = '⏸ Pauza'; t0 = performance.now() - pos * 3600;
    const step = now => { if (!svg.isConnected) { raf = null; return; } pos = ((now - t0) % 3600) / 3600; set(pos); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  } }, '▶ Odtwórz');
  slider.addEventListener('input', () => { if (raf) { cancelAnimationFrame(raf); raf = null; play.textContent = '▶ Odtwórz'; } pos = Number(slider.value) / 100; set(pos); });
  set(0);

  const cues = info.c || [];
  let ci = 0;
  const cueText = h('p', { class: 'mv-cue' });
  const cueNo = h('span', { class: 'muted' });
  const showCue = () => { cueText.textContent = cues[ci] || ''; cueNo.textContent = cues.length ? `Wskazówka ${ci + 1} / ${cues.length}` : ''; };
  showCue();
  if (reduce) play.title = 'Ograniczony ruch w ustawieniach systemu — użyj suwaka';
  return h('div', { class: 'mv' },
    h('div', { class: 'mv-stage' }, svg, h('p', { class: 'mv-cap' }, spec.label)),
    h('div', { class: 'mv-ctrl' }, play, slider, phase),
    info.ft && h('p', { class: 'mv-ft' }, h('strong', {}, 'Tor ruchu: '), info.ft),
    cues.length > 0 && h('div', { class: 'mv-cues' }, cueNo, cueText,
      h('div', { class: 'row' },
        h('button', { onclick: () => { ci = (ci - 1 + cues.length) % cues.length; showCue(); } }, '‹ Poprzednia'),
        h('button', { onclick: () => { ci = (ci + 1) % cues.length; showCue(); } }, 'Następna ›'))),
    h('p', { class: 'muted small' }, 'Rysunek poglądowy (własny): pozycja startowa i końcowa ruchu. Szczegóły techniki — wskazówki i filmy poniżej.'));
}
