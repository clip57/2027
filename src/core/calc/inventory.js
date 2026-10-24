// Stan magazynu = ostatnia inwentaryzacja + zakupy/korekty − planowane zużycie dzień po dniu (D-003, D-027).
// Inwentaryzacja z datą D oznacza stan na KONIEC dnia D; odliczanie zaczyna się od D+1.
import { consumptionForDay } from './consumption.js';
import { templateFor } from '../resolver.js';
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

// ---- Cofanie zmian zapasów (B1, audyt 23.10.2026) ----
// „Cofnij” cofa ostatnią OPERACJĘ: pojedynczą zmianę (stan, zakup, korekta, korekta dnia) albo zapis zbiorczy — zdarzenia ze wspólnym `d.op`
// (plan zakupów, paragon, zerowanie, przywrócenie stanu z historii). Zdarzenia cofające niosą `d.undo` (klucz cofniętej operacji): same nie są
// cofane, a cofnięta operacja nie wraca do „Cofnij” (wcześniej drugie „Cofnij” przywracało błąd). Pola `op` i `undo` są pomocnicze i opcjonalne —
// reduce() i starsze wersje aplikacji je pomijają, więc stan istniejących danych się nie zmienia.
export const INV_TYPES = ['inv.count', 'inv.move', 'inv.dayshift'];
export const opKey = e => e.d?.op || e.id;

export function lastOperation(events) {
  const inv = events.filter(e => INV_TYPES.includes(e.t));
  const undone = new Set(inv.map(e => e.d.undo).filter(Boolean));
  let last = null;
  for (const e of inv) if (!e.d.undo && !undone.has(opKey(e)) && (!last || e.hlc > last.hlc)) last = e;
  if (!last) return null;
  const key = opKey(last);
  return { key, events: inv.filter(e => !e.d.undo && opKey(e) === key).sort((a, b) => (a.hlc < b.hlc ? -1 : 1)) };
}

// Zdarzenia cofające operację (jeden zapis `recordMany`) i pozycje bez wcześniejszego stanu. Cofanie działa jak stos: wszystko, co zapisano
// po tej operacji, to operacje już cofnięte i ich cofnięcia — stan „jakby operacji nie było” liczony jest bez niej i bez nich:
//  • korekta dnia → odwrotna korekta tego samego dnia;
//  • zakup / korekta ilości → ruch odwrotny z TĄ SAMĄ datą (znosi się dokładnie, także ruch wpisany z wcześniejszą datą);
//  • stan (inwentaryzacja) — oraz pozycja, której późniejsza (cofnięta) inwentaryzacja przesłoniłaby ruch odwrotny → stan na dziś bez tej
//    operacji: wcześniejsza inwentaryzacja + ruchy − zużycie z planu (wcześniej wracała sama ilość poprzedniej inwentaryzacji, bez zużycia od
//    tamtego dnia). Pozycja bez wcześniejszego stanu nie może wrócić do „brak stanu” — zostaje bieżący stan (`unknown`), a zapis tylko oznacza
//    operację jako cofniętą.
// Stany zapisywane po ruchach i korektach dnia — nowa inwentaryzacja jest ostatnia, więc nic z tej operacji nie liczy się po niej podwójnie.
export function undoOperation(inv, op, today) {
  const ids = new Set(op.events.map(e => e.id)), lastHlc = op.events[op.events.length - 1].hlc;
  const gone = x => ids.has(x.id) || x.hlc > lastHlc;
  const keep = rows => Object.fromEntries(Object.entries(rows || {}).map(([p, l]) => [p, l.filter(x => !gone(x))]));
  const without = { counts: keep(inv.counts), moves: keep(inv.moves), shifts: (inv.shifts || []).filter(x => !gone(x)) };
  const later = new Set(Object.entries(inv.counts || {}).filter(([, l]) => l.some(x => x.hlc > lastHlc)).map(([p]) => p));
  const shift = op.events.some(e => e.t === 'inv.dayshift');
  const counted = new Set([...op.events.filter(e => e.t === 'inv.count' || (e.t === 'inv.move' && later.has(e.d.prod))).map(e => e.d.prod),
    ...(shift ? later : [])]);
  const undo = op.key, list = [], unknown = [];
  for (const e of op.events) {
    if (e.t === 'inv.dayshift') list.push(['inv.dayshift', { date: e.d.date, dir: -e.d.dir, undo }]);
    else if (e.t === 'inv.move' && !counted.has(e.d.prod)) list.push(['inv.move', { prod: e.d.prod, qty: -e.d.qty, date: e.d.date, kind: 'adjust', undo }]);
  }
  for (const prod of counted) {
    const q = stockAt(without, prod, today);
    if (q == null) unknown.push(prod);
    list.push(['inv.count', { prod, qty: Math.max(0, q ?? stockAt(inv, prod, today) ?? 0), date: today, undo }]);
  }
  return { list, unknown };
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

// Najbliższe zakupy wg planu dnia (slot z `shop`; D-097: czwartki po saunie 19:05–20:35, od 07.01.2027 15:30–16:00) —
// dziś, dopóki slot zakupów się nie skończył. Tydzień bez zakupów (np. 28.09–04.10.2026) i święta są pomijane.
// Poza planem (po 28.03.2027) — najbliższy czwartek. Bez dat zakodowanych na sztywno (W-12).
export function nextShopping(todayStr, hour, minute = 0) {
  const now = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  for (let i = 0; i < 35; i++) {
    const date = addDays(todayStr, i), s = templateFor(date).find(x => x.shop);
    if (s && !(i === 0 && now >= s.to)) return { date, inDays: i, from: s.from, to: s.to };
  }
  const n = ((4 - weekday(todayStr) + 7) % 7) || 7;
  return { date: addDays(todayStr, n), inDays: n, from: null, to: null };
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

// Pokrycie zużycia wskazanego dnia (`forDate`) stanem na koniec dnia `asOf` — np. „czy mam składniki na jutro”.
// Wyłącznie plan (zużycie dnia) i dziennik; stock === null = stan nieznany (bez oceny).
export function coverage(inv, prods, asOf, forDate) {
  const use = consumptionForDay(forDate);
  return [...new Set(prods)].filter(p => use[p] > 0).map(p => {
    const stock = stockAt(inv, p, asOf);
    return { prod: p, need: round(use[p]), stock, short: stock == null ? null : stock < use[p] - 1e-9 };
  });
}
