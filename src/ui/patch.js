// Punktowe odświeżanie widoku (P2, D-092): po najczęstszych akcjach zamieniany jest tylko zmieniony fragment strony zamiast
// przerysowania całego widoku (przeliczenie stylu i układu całej strony — do kilkuset ms na telefonie przy długich listach).
// Fokus przechodzi na odpowiednik elementu w nowym fragmencie (ten sam znacznik, pierwsza klasa i pozycja) — jak `restoreFocus`
// w app.js po pełnym przerysowaniu.
const keyOf = (el, root) => {
  const sel = el.tagName.toLowerCase() + (el.classList[0] ? `.${CSS.escape(el.classList[0])}` : '');
  return { sel, idx: el === root ? -1 : [...root.querySelectorAll(sel)].indexOf(el) };
};
const find = (root, k) => (k.idx < 0 ? root : root.querySelectorAll(k.sel)[k.idx] || null);

// Zapamiętanie fokusu wewnątrz `old`; zwrócona funkcja przenosi go na odpowiednik w `next` (po zamianie lub przeniesieniu).
export function holdFocus(old) {
  const a = document.activeElement;
  const key = a && a !== document.body && old?.contains(a) ? keyOf(a, old) : null;
  return next => { if (key && next?.isConnected && !next.contains(document.activeElement)) find(next, key)?.focus({ preventScroll: true }); };
}

// Zamiana elementu `old` na `next`. Zwraca element obecny w dokumencie po zamianie.
export function swap(old, next) {
  if (!old?.isConnected) return next;
  const a = document.activeElement;
  const key = a && a !== document.body && old.contains(a) ? keyOf(a, old) : null;
  old.replaceWith(next);
  if (key) find(next, key)?.focus({ preventScroll: true });
  return next;
}

// Fragment odświeżany funkcją budującą (może zwrócić nic — fragment znika). `r.el` wstawia się w widok raz;
// `r.refresh()` buduje fragment ponownie i podmienia go w miejscu wyznaczonym niewidoczną kotwicą (działa także wtedy,
// gdy fragment w międzyczasie zniknął, np. zamknięty licznik przerwy).
export function region(build) {
  const anchor = document.createComment('');
  let cur = build() || null;
  const el = document.createDocumentFragment();
  el.append(anchor);
  if (cur) el.append(cur);
  return {
    el,
    get node() { return cur; },
    refresh() {
      const next = build() || null;
      if (cur?.isConnected) { if (next) cur = swap(cur, next); else { cur.remove(); cur = null; } }
      else if (next && anchor.isConnected) { anchor.after(next); cur = next; }
      else cur = next;
      return cur;
    },
  };
}
