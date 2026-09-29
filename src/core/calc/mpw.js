// Plan MPW (D-095): wyliczenia z planu (bez prognoz) — źródła pierwszego przejścia z postępem wg bloków i dni wolne w okresie planu.
import { SRC, mpwByDay } from '../data.js';
import { addDays } from '../dates.js';

const D = SRC.mpw.D;
let SOURCES = null;
// Źródła pierwszego przejścia (prawo i literatura) w kolejności pierwszego bloku: numery bloków i zakres dat
export function mpwSources() {
  if (SOURCES) return SOURCES;
  const m = new Map();
  for (const b of D.bloki) {
    if (!b.tryb.endsWith('FIRST PASS')) continue;
    const s = m.get(b.zrodlo) || m.set(b.zrodlo, { zrodlo: b.zrodlo, kategoria: b.kategoria, nrs: [], start: b.data, end: b.data }).get(b.zrodlo);
    s.nrs.push(b.nr); s.end = b.data;
  }
  return (SOURCES = [...m.values()]);
}

// Dni wolne w okresie planu (bez bloków) jako przedziały [od, do]
export function mpwFreeDays() {
  const out = [];
  for (let d = D.stat.start; d <= D.stat.end; d = addDays(d, 1)) {
    if (mpwByDay[d]) continue;
    const last = out[out.length - 1];
    if (last && addDays(last[1], 1) === d) last[1] = d; else out.push([d, d]);
  }
  return out;
}
