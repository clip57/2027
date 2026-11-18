// Ruch jako odpowiedź (D-114, System 4.0 „Instrument”): animuje się tylko to, co właśnie się zmieniło — po zapisie użytkownika albo
// z upływem czasu. Wyłącznie animacje jednorazowe (bez pętli — D-112), na transform/opacity/stroke; przy ograniczeniu ruchu — nic.
// Treść (tekst, atrybuty, aria-*) ma od razu wartość końcową — animacja jest tylko wizualna (czytniki ekranu i testy widzą stan od razu).
export const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

// Pamięć wartości między przerysowaniami (klucz → poprzednia wartość): komponent wie, czy i skąd animować.
// Zwraca poprzednią wartość (undefined przy pierwszym wyświetleniu) i zapamiętuje nową.
const memo = new Map();
export function recall(key, value) {
  const prev = memo.get(key);
  memo.set(key, value);
  return prev;
}
export const forget = key => memo.delete(key);

// Jednorazowa animacja klasy CSS (instrument.css: .mo-flip — liczba „przeskakuje” jak licznik, .mo-pop — zatwierdzenie,
// .mo-glow — rozbłysk koloru domeny). Klasa zdejmowana po zakończeniu (także gdy animacji nie było — zabezpieczenie czasem).
export function play(el, kind, ms = 700) {
  if (!el || reduced()) return el;
  el.classList.remove(`mo-${kind}`);
  void el.offsetWidth;   // ponowne uruchomienie tej samej animacji
  el.classList.add(`mo-${kind}`);
  const off = () => el.classList.remove(`mo-${kind}`);
  el.addEventListener('animationend', off, { once: true });
  setTimeout(off, ms);
  return el;
}

// Wartość zmieniona od poprzedniego wyświetlenia (ten sam klucz) → animacja klasy na elemencie. Pierwsze wyświetlenie — bez ruchu.
export function onChange(el, key, value, kind = 'flip') {
  const prev = recall(key, value);
  if (prev !== undefined && prev !== value) requestAnimationFrame(() => play(el, kind));
  return el;
}

// Łuk / pasek SVG „dochodzi” od poprzedniej długości do nowej (stroke-dasharray). Atrybut ma od razu wartość końcową.
export function sweep(el, key, len, total, ms = 520) {
  const prev = recall(key, len);
  if (reduced() || prev === undefined || prev === len || !el.animate) return el;
  requestAnimationFrame(() => el.animate([{ strokeDasharray: `${prev} ${total}` }, { strokeDasharray: `${len} ${total}` }],
    { duration: ms, easing: 'cubic-bezier(.2, 0, 0, 1)' }));
  return el;
}

// FLIP dla listy z kluczami (data-k): pozycje przed zmianą → zmiana (np. przerysowanie fragmentu) → płynne przejście elementów,
// które zmieniły miejsce. `root` może zostać podmieniony w `mutate` — wtedy funkcja zwraca nowy korzeń.
export function flip(root, mutate) {
  if (reduced() || !root?.isConnected) return mutate();
  const before = new Map([...root.querySelectorAll('[data-k]')].map(e => [e.dataset.k, e.getBoundingClientRect().top]));
  const next = mutate() || root;
  for (const e of next.querySelectorAll?.('[data-k]') || []) {
    const y0 = before.get(e.dataset.k);
    if (y0 == null) continue;
    const dy = y0 - e.getBoundingClientRect().top;
    if (Math.abs(dy) > 1 && e.animate) e.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2, 0, 0, 1)' });
  }
  return next;
}
