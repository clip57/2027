// Statystyki treningowe (styl Hevy): sesje, objętość, szacowany 1RM (Epley), rekordy, serie na grupę mięśni, tygodnie.
// Wejście: stan dziennika serii (state.train) i sesji (state.trainSessions); słownik ćwiczeń z danych TRENING.
import { SRC } from '../data.js';
import { addDays, weekday } from '../dates.js';
import muscles from '../../data/muscles.json' with { type: 'json' };

export const EX_BY_ID = Object.freeze(Object.fromEntries(Object.values(SRC.training.days).flat().map(e => [e.id, e])));
export const e1rm = (kg, reps) => (kg > 0 && reps > 0 ? (reps === 1 ? kg : kg * (1 + reps / 30)) : 0); // Epley
const r1 = x => Math.round(x * 10) / 10;
export const weekStart = d => addDays(d, 1 - weekday(d));

// Serie „liczone”: odhaczone albo z wpisanym ciężarem/powtórzeniami (wpisane wartości = wykonana seria).
export function sets(train) {
  return Object.values(train).filter(s => s.done || s.kg != null || s.reps != null).map(s => {
    const ex = EX_BY_ID[s.ex];
    const name = ex?.name || s.ex;
    return { ...s, name, volume: (s.kg || 0) * (s.reps || 0), e1rm: e1rm(s.kg || 0, s.reps || 0) };
  });
}

export function sessions(train, sess = {}) {
  const byDate = {};
  for (const s of sets(train)) (byDate[s.date] ||= []).push(s);
  const dates = new Set([...Object.keys(byDate), ...Object.keys(sess).filter(d => sess[d]?.minutes > 0)]);
  return [...dates].sort().map(date => {
    const list = byDate[date] || [];
    return { date, minutes: sess[date]?.minutes ?? null, sets: list.length, volume: r1(list.reduce((a, s) => a + s.volume, 0)),
      reps: list.reduce((a, s) => a + (s.reps || 0), 0), exercises: [...new Set(list.map(s => s.name))], optional: list.filter(s => s.opt).length };
  });
}

export function weekly(train, sess = {}, weeks = 12, today) {
  const all = sessions(train, sess);
  const out = [];
  let w = weekStart(today);
  for (let i = 0; i < weeks; i++, w = addDays(w, -7)) {
    const end = addDays(w, 6), inW = all.filter(s => s.date >= w && s.date <= end);
    out.unshift({ week: w, sessions: inW.length, sets: inW.reduce((a, s) => a + s.sets, 0), volume: r1(inW.reduce((a, s) => a + s.volume, 0)),
      minutes: inW.reduce((a, s) => a + (s.minutes || 0), 0) });
  }
  return out;
}

// Serie na grupę mięśni: mięsień główny = 1 seria, pomocniczy = 0,5 (konwencja liczenia objętości treningowej).
export function muscleSets(train, from, to) {
  const out = {};
  for (const s of sets(train)) {
    if (s.date < from || s.date > to) continue;
    const m = muscles.exercises[s.name];
    if (!m) continue;
    m.primary.forEach(x => { out[x] = (out[x] || 0) + 1; });
    m.secondary.forEach(x => { out[x] = (out[x] || 0) + 0.5; });
  }
  return out;
}

export function exerciseHistory(train, name) {
  const byDate = {};
  for (const s of sets(train)) if (s.name === name) (byDate[s.date] ||= []).push(s);
  return Object.entries(byDate).sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, l]) => ({
    date, sets: l.length, bestE1rm: r1(Math.max(0, ...l.map(s => s.e1rm))), topKg: Math.max(0, ...l.map(s => s.kg || 0)),
    volume: r1(l.reduce((a, s) => a + s.volume, 0)), bestSet: l.slice().sort((a, b) => b.e1rm - a.e1rm)[0],
  }));
}

export function records(train) {
  const out = {};
  for (const s of sets(train)) {
    const r = out[s.name] ||= { name: s.name, e1rm: null, kg: null, reps: null, volume: null };
    if (s.e1rm && (!r.e1rm || s.e1rm > r.e1rm.value)) r.e1rm = { value: r1(s.e1rm), date: s.date, kg: s.kg, reps: s.reps };
    if (s.kg && (!r.kg || s.kg > r.kg.value)) r.kg = { value: s.kg, date: s.date, reps: s.reps };
    if (s.reps && (!r.reps || s.reps > r.reps.value)) r.reps = { value: s.reps, date: s.date, kg: s.kg };
    if (s.volume && (!r.volume || s.volume > r.volume.value)) r.volume = { value: r1(s.volume), date: s.date, kg: s.kg, reps: s.reps };
  }
  return Object.values(out).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

// Liczba kolejnych tygodni (do bieżącego włącznie) z co najmniej jedną sesją.
export function streakWeeks(train, sess, today) {
  const ws = new Set(sessions(train, sess).map(s => weekStart(s.date)));
  let n = 0, w = weekStart(today);
  if (!ws.has(w)) w = addDays(w, -7); // bieżący tydzień może być jeszcze pusty
  while (ws.has(w)) { n++; w = addDays(w, -7); }
  return n;
}
