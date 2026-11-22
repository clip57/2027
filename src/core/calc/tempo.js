// D-119: szacunek tempa nauki (CFA, MPW) — wyłącznie z prawdziwych danych: data odhaczenia bloku = pole `at` zdarzenia, które wygrywa
// w dzienniku (najnowsze `hlc` dla bloku). Tempo = bloki odhaczone w ostatnich dniach (domyślnie 14, nie wcześniej niż od pierwszego
// odhaczenia) na dzień kalendarzowy; koniec = dziś + pozostałe bloki ÷ tempo. Zawsze opisywany w interfejsie jako szacunek.
// Bez DOM — testy w tests/unit/tempo.test.mjs.
import { addDays, diffDays, ymd } from '../dates.js';

export const TEMPO_MIN_DAYS = 7;   // krócej — szacunek byłby przypadkowy

/** Data (lokalna) odhaczenia każdego wykonanego bloku. @param {Iterable<any>} events @param {string} type @param {Set<number>} done */
export function completionDates(events, type, done) {
  const win = new Map();
  for (const e of events) {
    if (e?.t !== type || e.d?.block == null) continue;
    const p = win.get(e.d.block);
    if (!p || e.hlc > p.hlc) win.set(e.d.block, e);
  }
  const out = new Map();
  for (const [nr, e] of win) if (done.has(nr) && e.d.done && e.at) out.set(nr, ymd(new Date(e.at)));
  return out;
}

/**
 * @param {{ dates: Map<number, string>, total: number, doneCount: number, today: string, planEnd: string, window?: number }} o
 * @returns {{ ok: boolean, reason?: 'none'|'short'|'zero', wait?: number, finished?: boolean, rate?: number, n?: number, span?: number, end?: string, delta?: number, need?: number }}
 */
export function tempo({ dates, total, doneCount, today, planEnd, window = 14 }) {
  const remaining = Math.max(0, total - doneCount);
  const daysLeft = Math.max(1, diffDays(today, planEnd) + 1);
  const need = remaining / daysLeft;   // tempo wymagane do końca planu (bloki / dzień)
  if (remaining === 0) return { ok: true, finished: true, need: 0 };
  const ds = [...dates.values()].filter(d => d <= today).sort();
  if (!ds.length) return { ok: false, reason: 'none', need };
  const from = addDays(today, -(window - 1)), start = ds[0] > from ? ds[0] : from;
  const span = diffDays(start, today) + 1;
  if (span < TEMPO_MIN_DAYS) return { ok: false, reason: 'short', wait: TEMPO_MIN_DAYS - span, need };
  const n = ds.filter(d => d >= start).length, rate = n / span;
  if (!n) return { ok: false, reason: 'zero', span, need };
  const end = addDays(today, Math.ceil(remaining / rate));
  return { ok: true, rate, n, span, end, delta: diffDays(planEnd, end), need };
}
