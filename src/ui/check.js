// D-119: przycisk odhaczenia (Instrument+) — wspólny dla dawek, bloków nauki, serii treningu i recall. Okrąg w kolorze domeny
// (zmienna --ck z kontekstu w instrument.css), w środku litera bloku / numer serii; po odhaczeniu wypełnienie i znacznik SVG.
// Animacja (rysowanie znacznika, sprężyste „pyknięcie”, fala) tylko dla przycisku właśnie przełączonego — także gdy moduł przerysował
// widok po zapisie (ten sam klucz w ciągu 1,5 s). Bez wibracji. Klasa `set-toggle` i `aria-pressed` bez zmian (testy, gesty).
import { h } from './dom.js';
import { play } from './motion.js';

const NS = 'http://www.w3.org/2000/svg';
let last = '', lastAt = 0;

/** Znacznik SVG (ścieżka o długości 1 — rysowanie przez stroke-dashoffset). */
export function checkSvg(cls = 'ck-svg') {
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', class: cls, 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(k, v);
  const p = document.createElementNS(NS, 'path');
  for (const [k, v] of Object.entries({ d: 'M5.5 12.5l4.2 4.2L18.5 7.8', pathLength: '1', class: 'ck-path' })) p.setAttribute(k, v);
  svg.append(p);
  return svg;
}

/** Zapamiętanie klucza przełączanego elementu (np. gest albo „Przyjmij wszystkie” przełącza kilka naraz). */
export function markToggled(...keys) { last = keys.join('\n'); lastAt = Date.now(); }
const wasToggled = key => Date.now() - lastAt < 1500 && last.split('\n').includes(key);

/**
 * @param {{ key: string, on: boolean, label?: any, aria: string, onclick: (e: Event) => any, cls?: string, disabled?: boolean }} o
 */
export function checkBtn({ key, on, label = '', aria, onclick, cls = '', disabled = false }) {
  const b = h('button', { class: `set-toggle ck${cls ? ` ${cls}` : ''}`, type: 'button', 'aria-pressed': String(on), 'aria-label': aria, disabled: disabled || null,
    onclick: e => {
      markToggled(key);
      onclick(e);
      // przycisk zaktualizowany w miejscu (bez przerysowania) — animacja od razu
      requestAnimationFrame(() => { if (b.isConnected && b.getAttribute('aria-pressed') !== String(on)) play(b, on ? 'uncheck' : 'check'); });
    } },
  h('span', { class: 'ck-l', 'aria-hidden': 'true' }, label), checkSvg());
  if (wasToggled(key)) requestAnimationFrame(() => play(b, on ? 'check' : 'uncheck'));
  return b;
}

/** Pole wyboru (Pielęgnacja): wygląd jak checkBtn; animacja po zmianie przez użytkownika. */
export function checkInput(el) {
  el.classList.add('ck-in');
  el.addEventListener('change', () => play(el, el.checked ? 'check' : 'uncheck'));
  return el;
}
