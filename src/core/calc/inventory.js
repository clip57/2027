// Stan magazynu = ostatnia inwentaryzacja + zakupy/korekty − planowane zużycie dzień po dniu (D-003, D-027).
// Inwentaryzacja z datą D oznacza stan na KONIEC dnia D; odliczanie zaczyna się od D+1.
import { consumptionForDay } from './consumption.js';
import { catalogById } from '../data.js';
import { addDays, weekday } from '../dates.js';

const round = x => Math.round(x * 1e6) / 1e6;
const after = (a, b) => a.date > b.date || (a.date === b.date && a.hlc > b.hlc);

export function baseCount(inv, prod, date) {
  let best = null;
  for (const c of inv.counts[prod] || []) if (c.date <= date && (!best || after(c, best))) best = c;
  return best;
}

export function stockAt(inv, prod, date) {
  const base = baseCount(inv, prod, date);
  if (!base) return null; // brak inwentaryzacji = stan nieznany
  let q = base.qty;
  for (const m of inv.moves[prod] || []) if (after(m, base) && m.date <= date) q += m.qty;
  for (let d = addDays(base.date, 1); d <= date; d = addDays(d, 1)) q -= consumptionForDay(d)[prod] || 0;
  return round(q);
}

// Symulacja w przód: ile dni pokryje stan (z uwzględnieniem typów dni i faz).
// lastCovered = ostatni dzień w pełni pokryty („Wystarczy do” w v31); runOut = pierwszy dzień braku.
export function forecast(prod, stock, fromDate, maxDays = 400) {
  if (stock == null) return null;
  let left = stock, days = 0, d = fromDate, usedAny = false;
  while (days < maxDays) {
    const next = addDays(d, 1);
    const need = consumptionForDay(next)[prod] || 0;
    if (need > 0) usedAny = true;
    if (need > left + 1e-9) return { days: round(days + (need ? Math.max(0, left) / need : 0)), lastCovered: d === fromDate ? null : d, runOut: next };
    left -= need; days++; d = next;
  }
  return { days: usedAny ? maxDays : Infinity, lastCovered: null, runOut: null };
}

// Progi statusów przeniesione 1:1 z ZAPASY v31 (getProductStatus).
export function status(item, stock, fc) {
  if (item.tracked === false) return 'UNTRACKED';
  if (stock == null) return 'UNKNOWN';
  if (stock <= 0) return 'CRITICAL';
  const days = fc ? fc.days : 0;
  if (item.category === 'Suplementy') return days < 10 ? 'CRITICAL' : days < 20 ? 'WARNING' : 'OK';
  return days < 7 ? 'CRITICAL' : days < 14 ? 'WARNING' : 'OK';
}

// Najbliższy dzień zakupów (domyślnie sobota, po 18:00 kolejna) — bez dat zakodowanych na sztywno (W-12).
export function nextShopping(todayStr, hour, shopWeekday = 6, cutoffHour = 18) {
  let n = (shopWeekday - weekday(todayStr) + 7) % 7;
  if (n === 0 && hour >= cutoffHour) n = 7;
  return { date: addDays(todayStr, n), inDays: n };
}

// Lista zakupów: reguły v31 (cel 7 dni świeże / 14 dni trwałe, maxLimit, zaokrąglenie do opakowań),
// ale cel liczony rzeczywistym przyszłym zużyciem zamiast stałej porcji dziennej.
export function shoppingList(inv, asOf, items) {
  const out = [];
  for (const it of items) {
    if (it.tracked === false || it.noShopping) continue;
    const current = stockAt(inv, it.id, asOf);
    if (current == null) continue;
    const targetDays = it.shelfLife === 'short' ? 7 : 14;
    let target = 0;
    for (let i = 1; i <= targetDays; i++) target += consumptionForDay(addDays(asOf, i))[it.id] || 0;
    const cur = Math.max(0, current);
    let raw = Math.max(0, target - cur);
    if (it.maxLimit && cur + raw > it.maxLimit) raw = Math.max(0, it.maxLimit - cur);
    if (raw <= 0) continue;
    const packSize = it.packSize || 1;
    const packs = Math.ceil(round(raw / packSize));
    const toBuy = packs * packSize;
    out.push({ id: it.id, name: it.name, unit: it.unit, category: it.category, targetDays, current: cur,
      raw: round(raw), packs, packSize, toBuy, overLimit: !!(it.maxLimit && cur + toBuy > it.maxLimit) });
  }
  return out;
}

export const allItems = () => Object.values(catalogById);
