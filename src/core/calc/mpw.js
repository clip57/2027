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

// Czas nauki MPW w dniu z godzin bloków (B6, audyt 23.10.2026) — bez godzin wpisanych na sztywno: czwartki od 07.01 o 16:00 (D-097),
// powtórka P1–P7 od 8:00 (D-096), symulacje po 60 min. `all` — wszystkie bloki, `sim` — bloki symulacji, `rest` — pozostałe; null = brak.
const mins = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const span = list => (list.length ? { n: list.length, from: list[0].godz.slice(0, 5), to: list[list.length - 1].godz.slice(-5),
  min: list.reduce((a, b) => a + mins(b.godz.slice(-5)) - mins(b.godz.slice(0, 5)), 0) } : null);
export function mpwDaySpan(blocks = []) {
  const sim = blocks.filter(b => b.tryb === 'SYMULACJA');
  return { all: span(blocks), sim: span(sim), rest: span(blocks.filter(b => b.tryb !== 'SYMULACJA')) };
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
