// Import paragonu tekstem (I7, audyt 25.09.2026): „banan 1,2 kg”, „kefir 2 × 400 ml”, „jajka 10 szt.”, „płatki owsiane 500 g”.
// Dopasowanie nazw do pozycji Zapasów (bez polskich znaków, dłuższa nazwa wygrywa), przeliczenie kg→g i l→ml.
// Bez jednostki: liczba całkowita ≤ 20 przy pozycji z opakowaniem = liczba opakowań; inaczej ilość w jednostce pozycji.
// Wynik zawsze do podglądu — zapis dopiero po potwierdzeniu (inv.move „purchase” albo inv.count), jak dotychczasowy import JSON.
import { norm } from './search.js';

const UNIT = { kg: ['g', 1000], g: ['g', 1], dag: ['g', 10], l: ['ml', 1000], ml: ['ml', 1], szt: ['szt.', 1], kaps: ['kaps.', 1], tabl: ['tabl.', 1], op: ['op', 1] };
const num = s => Number(String(s).replace(',', '.'));
const QTY = /(\d+(?:[.,]\d+)?)\s*(?:[x×*]\s*(\d+(?:[.,]\d+)?))?\s*(kg|dag|g|ml|l|szt|kaps|tabl|op)?\.?(?=\s|$)/gi;

export function parseLine(line) {
  const text = line.trim();
  if (!text) return null;
  let m, last = null;
  QTY.lastIndex = 0;
  while ((m = QTY.exec(text))) last = m;          // ilość = ostatnie wystąpienie liczby (nazwa może zawierać liczby, np. „Skyr 0%”)
  if (!last) return { name: text, qty: null, unit: null, raw: text };
  const [whole, a, b, u] = last;
  const count = b ? num(a) : 1, amount = b ? num(b) : num(a);
  const name = (text.slice(0, last.index) + text.slice(last.index + whole.length)).replace(/[-–:;,]+\s*$/, '').trim();
  return { name, qty: count * amount, unit: u ? u.toLowerCase() : null, packs: !b && !u && Number.isInteger(amount) && amount <= 20 ? amount : null, raw: text };
}

function matchItem(name, items) {
  const n = norm(name);
  if (!n) return null;
  let best = null, score = 0;
  for (const it of items) {
    const k = norm(it.name), id = norm(it.id);
    const s = n === k || n === id ? 1000 : n.includes(k) ? k.length + 100 : k.includes(n) && n.length >= 3 ? n.length : 0;
    if (s > score) { score = s; best = it; }
  }
  return best;
}

// → { rows: [{ raw, item, qty, note }], unknown: [raw] }
export function parseReceipt(text, items) {
  const rows = [], unknown = [];
  for (const line of String(text).split(/\r?\n|;/)) {
    const p = parseLine(line);
    if (!p) continue;
    const it = matchItem(p.name, items);
    if (!it || p.qty == null) { unknown.push(p.raw); continue; }
    let qty = null, note = '';
    if (p.unit) {
      const [base, f] = UNIT[p.unit] || [];
      const units = String(it.unit).split('/').map(u => (u === 'szt' ? 'szt.' : u));   // np. „ml/g” (kefir)
      if (p.unit === 'op') qty = p.qty * (it.packSize || 1), note = 'opakowania';
      else if (units.includes(base)) qty = p.qty * f;
      else { unknown.push(`${p.raw} (jednostka ${p.unit} ≠ ${it.unit})`); continue; }
    } else if (p.packs != null && (it.packSize || 1) > 1) { qty = p.packs * it.packSize; note = `${p.packs} × opakowanie ${it.packSize} ${it.unit}`; }
    else qty = p.qty;
    rows.push({ raw: p.raw, item: it, qty: Math.round(qty * 1000) / 1000, note });
  }
  return { rows, unknown };
}
