// Budowanie DOM bez innerHTML: dane użytkownika i źródłowe trafiają wyłącznie do textContent/atrybutów (W-1 z audytu).
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export const clear = el => { while (el.firstChild) el.firstChild.remove(); return el; };
export const fmt = (n, d = 0) => n == null ? '—' : Number(n).toLocaleString('pl-PL', { maximumFractionDigits: d, minimumFractionDigits: 0 });

// Odmiana rzeczownika po liczbie (dzień/dni, pozycja/pozycje/pozycji).
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a === 1) return one;
  if (b >= 2 && b <= 4 && (a < 12 || a > 14)) return few;
  return many;
}

// Dołączanie dzieci z pominięciem wartości false/null i spłaszczaniem tablic (jak w h()).
export function add(parent, ...kids) {
  for (const c of kids.flat(Infinity)) if (c != null && c !== false && c !== '') parent.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return parent;
}
