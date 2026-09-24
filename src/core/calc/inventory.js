// Stan magazynu = ostatnia inwentaryzacja + zakupy/korekty − planowane zużycie dzień po dniu (D-003, D-027).
// Inwentaryzacja z datą D oznacza stan na KONIEC dnia D; odliczanie zaczyna się od D+1.
import { consumptionForDay } from './consumption.js';
import { catalogById } from '../data.js';
import { addDays, weekday } from '../dates.js';

const round = x => Math.round(x * 1e6) / 1e6;

// Pozycje dodane przez użytkownika (zdarzenia cat.upsert) mają własne zużycie dzienne (jak w v31).
let customDaily = {};
export function setCustomItems(items = []) { customDaily = Object.fromEntries(items.map(i => [i.id, Number(i.daily_v31) || 0])); }
const useFor = (prod, date) => consumptionForDay(date)[prod] ?? customDaily[prod] ?? 0;
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
  for (let d = addDays(base.date, 1); d <= date; d = addDays(d, 1)) q -= useFor(prod, d);
  // Korekty dnia (przyciski „+1 dzień / −1 dzień” z pierwotnego modułu): dodają lub odejmują
  // zużycie całego dnia dla wszystkich pozycji naraz.
  for (const s of inv.shifts || []) if (after(s, base) && s.date <= date) q += s.dir * useFor(prod, s.date);
  return round(q);
}

// Symulacja w przód: ile dni pokryje stan (z uwzględnieniem typów dni i faz).
// lastCovered = ostatni dzień w pełni pokryty („Wystarczy do” w v31); runOut = pierwszy dzień braku.
export function forecast(prod, stock, fromDate, maxDays = 400) {
  if (stock == null) return null;
  let left = stock, days = 0, d = fromDate, usedAny = false;
  while (days < maxDays) {
    const next = addDays(d, 1);
    const need = useFor(prod, next);
    if (need > 0) usedAny = true;
    if (need > left + 1e-9) return { days: round(days + (need ? Math.max(0, left) / need : 0)), lastCovered: d === fromDate ? null : d, runOut: next };
    left -= need; days++; d = next;
  }
  return { days: usedAny ? maxDays : Infinity, lastCovered: null, runOut: null };
}

// Klasyfikacja przeniesiona 1:1 z ZAPASY v31 (getProductStatus), z podziałem wg terminu przydatności:
//   stan 0 -> ⛔ BRAK; suplementy: <10 / <20 dni; świeże (shelfLife 'short', ≤ 7 dni): <2 / <4 dni; trwałe: <7 / <14 dni.
// Jedyna różnica: liczba dni pochodzi z symulacji (uwzględnia czwartki i fazy), a nie z ilorazu stan / porcja.
export function statusInfo(item, stock, fc) {
  if (item.tracked === false) return { code: 'UNTRACKED', badge: 'Nieśledzony', group: 'Suplementy' };
  if (stock == null) return { code: 'UNKNOWN', badge: 'Brak stanu', group: null };
  const group = item.category === 'Suplementy' ? 'Suplementy' : item.shelfLife === 'short' ? 'Świeże ≤7d' : 'Trwałe >7d';
  if (stock <= 0) return { code: 'CRITICAL', isZero: true, badge: '⛔ BRAK (0)', group, days: 0 };
  const days = fc ? fc.days : 0;
  const [crit, warn] = group === 'Suplementy' ? [10, 20] : group === 'Świeże ≤7d' ? [2, 4] : [7, 14];
  const warnLabel = group === 'Suplementy' ? '⚠️ Średni (10-19d)' : group === 'Świeże ≤7d' ? '⚠️ Niski (2-3.9d)' : '⚠️ Średni (7-13.9d)';
  if (days < crit) return { code: 'CRITICAL', badge: `🚨 < ${crit} dni`, group, days };
  if (days < warn) return { code: 'WARNING', badge: warnLabel, group, days };
  return { code: 'OK', badge: `🟢 OK (≥${warn}d)`, group, days };
}
export const status = (item, stock, fc) => statusInfo(item, stock, fc).code;

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
    for (let i = 1; i <= targetDays; i++) target += useFor(it.id, addDays(asOf, i));
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

// Pasek zapasu: ile dni pokrywa stan na tle horyzontu (14 dni; suplementy 30) i gdzie wypada dzień zakupów.
// Wyłącznie z prognozy (forecast) — bez nowych danych. null, gdy stan nieznany lub pozycja nie jest zużywana.
export function runway(item, fc, shopInDays) {
  if (!fc || fc.days === Infinity) return null;
  const horizon = item.category === 'Suplementy' ? 30 : 14;
  const days = Math.min(fc.days, horizon);
  return { days: fc.days, horizon, pct: Math.round((days / horizon) * 1000) / 10, shopPct: Math.round((Math.min(shopInDays, horizon) / horizon) * 1000) / 10,
    beforeShopping: fc.days < shopInDays };
}
