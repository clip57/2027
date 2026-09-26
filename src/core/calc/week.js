// Widok tygodnia (I3, audyt 25.09.2026): 7 dni od poniedziałku, wyłącznie z resolvera dnia (trening, sauna, dieta, CFA,
// recall, zakupy w sobotę, wyjątki dat D-087, dni poza planem D-088). Bez nowych danych.
import { resolveDay } from '../resolver.js';
import { addDays, weekday } from '../dates.js';

export const mondayOf = date => addDays(date, 1 - weekday(date));

export function weekSummary(date) {
  const monday = mondayOf(date);
  return [...Array(7)].map((_, i) => {
    const d = addDays(monday, i), r = resolveDay(d);
    return {
      date: d, weekday: r.weekday, dayName: r.dayName, outside: r.outside, phase: r.phase,
      training: r.sessionLabel, dayType: r.dayType, sauna: r.sauna,
      diet: r.dietVariant, kcal: r.kcal,
      cfa: r.cfa.blocks.length, mock: r.cfa.isMock, recall: r.cfa.recall,
      shopping: r.slots.some(s => s.id === 'slot.1213z'),
      note: r.note, exception: r.exception && r.exception !== 'D-088' ? r.exception : null,
    };
  });
}
