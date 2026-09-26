// Sesje CFA Active Recall 22:00 (I11, audyt 25.09.2026): odhaczanie przez istniejący typ zdarzenia `setting`
// (klucz `cfa.recall:RRRR-MM-DD`, wartość true/false, LWW jak każde ustawienie) — bez nowego typu i bez zmiany modelu danych.
import { SRC } from '../data.js';
import { dayPlan } from '../resolver.js';
import { addDays } from '../dates.js';

export const recallKey = date => `cfa.recall:${date}`;
let DAYS = null;
// Dni z sesją recall = dni planu CFA z `recall` w planie tygodnia (z wyjątkami dat — dayPlan, D-087)
export function recallDays() {
  if (DAYS) return DAYS;
  DAYS = [];
  for (let d = SRC.cfa.D.stat.start; d <= SRC.cfa.D.stat.end; d = addDays(d, 1)) if (dayPlan(d).recall) DAYS.push(d);
  return DAYS;
}
export const recallDone = (settings, date) => settings?.[recallKey(date)] === true;
export function recallStats(settings, today) {
  const days = recallDays(), due = days.filter(d => d < today);
  return { total: days.length, done: days.filter(d => recallDone(settings, d)).length,
    due: due.length, doneDue: due.filter(d => recallDone(settings, d)).length };
}
