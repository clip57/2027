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
  const ui = captureUi(old);
  old.replaceWith(next);
  restoreUi(next, ui);   // D-115 (T2): otwarte sekcje i przesunięte paski — jak w poprzednim fragmencie
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

// D-115 (T2 audytu 10.11): łatanie stanu interfejsu po kluczach. Pełne przerysowanie w miejscu (zapis, zmiana z chmury — `render(true)`
// w app.js) i podmiana fragmentu (`swap`) budują elementy od nowa, więc rozwinięte sekcje się zwijały, a przewinięte w poziomie paski
// (dni, filtry, zakładki) wracały na początek — pułapki „<details> przerysowywany po każdym zapisie” i pokrewne. Teraz stan
// przechodzi na odpowiednik w nowym drzewie, znaleziony po kluczu: `id` › `data-key` › tekst nagłówka sekcji (z numerem powtórzenia),
// a dla pasków — znacznik i pierwsza klasa z numerem. Przenoszone jest tylko to, co użytkownik zmienił (otwarta sekcja, przesunięty
// pasek) — sekcja, którą moduł sam rysuje jako otwartą, zostaje otwarta.
const SCROLLERS = '.scroll-x, .day-strip, .tl-chips, .pills, .seg, .tabs-x, .wk-strip, .kl-strip';
const textKey = el => (el.querySelector(':scope > summary')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
function detailsKeys(root) {
  const seen = new Map(), out = [];
  for (const d of root.querySelectorAll('details')) {
    let k = d.id ? `#${d.id}` : d.dataset.key ? `@${d.dataset.key}` : `${d.classList[0] || ''}|${textKey(d)}`;
    if (!d.id && !d.dataset.key) { const n = (seen.get(k) || 0) + 1; seen.set(k, n); k += `|${n}`; }
    out.push([k, d]);
  }
  return out;
}
const scrollKeys = root => {
  const seen = new Map();
  return [...root.querySelectorAll(SCROLLERS)].map(el => {
    const base = el.id ? `#${el.id}` : el.tagName.toLowerCase() + (el.classList[0] ? `.${el.classList[0]}` : '');
    const n = (seen.get(base) || 0) + 1; seen.set(base, n);
    return [`${base}|${n}`, el];
  });
};

/** Stan interfejsu w `root`: otwarte sekcje i przesunięcia pasków (po kluczach). */
export function captureUi(root) {
  if (!root?.querySelectorAll) return null;
  return {
    open: new Set(detailsKeys(root).filter(([, d]) => d.open).map(([k]) => k)),
    scroll: new Map(scrollKeys(root).filter(([, el]) => el.scrollLeft > 0).map(([k, el]) => [k, el.scrollLeft])),
  };
}

/** Przeniesienie stanu na nowe drzewo `root` (po wstawieniu do dokumentu). */
export function restoreUi(root, st) {
  if (!st || !root?.querySelectorAll) return;
  if (st.open.size) for (const [k, d] of detailsKeys(root)) if (st.open.has(k) && !d.open) d.open = true;
  if (st.scroll.size) for (const [k, el] of scrollKeys(root)) { const x = st.scroll.get(k); if (x) el.scrollLeft = x; }
}
