import test from 'node:test';
import assert from 'node:assert/strict';
import { e1rm, sets, sessions, weekly, muscleSets, exerciseHistory, records, streakWeeks, EX_BY_ID } from '../../src/core/calc/training.js';

const bench = Object.values(EX_BY_ID).find(e => e.name === 'Wyciskanie sztangi leżąc').id;
const rdl = Object.values(EX_BY_ID).find(e => e.name === 'Martwy ciąg rumuński').id;
const T = {
  [`2026-11-30|${bench}|1`]: { date: '2026-11-30', ex: bench, set: 1, done: true, kg: 45, reps: 10, rir: 2 },
  [`2026-11-30|${bench}|2`]: { date: '2026-11-30', ex: bench, set: 2, done: true, kg: 45, reps: 8, rir: 2 },
  [`2026-12-07|${bench}|1`]: { date: '2026-12-07', ex: bench, set: 1, done: true, kg: 50, reps: 8, rir: 2 },
  [`2026-12-01|${rdl}|1`]: { date: '2026-12-01', ex: rdl, set: 1, done: false, kg: null, reps: null, rir: null },
};

test('Epley: 1RM = kg × (1 + powt./30); 1 powtórzenie = ciężar', () => {
  assert.equal(e1rm(45, 10), 60);
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(0, 5), 0);
});

test('serie liczone tylko wykonane lub z wpisanymi wartościami; objętość = kg × powt.', () => {
  const s = sets(T);
  assert.equal(s.length, 3);
  assert.equal(s.reduce((a, x) => a + x.volume, 0), 45 * 10 + 45 * 8 + 50 * 8);
});

test('sesje z czasem trwania i agregaty tygodniowe', () => {
  const ss = sessions(T, { '2026-11-30': { date: '2026-11-30', minutes: 75 } });
  assert.deepEqual(ss.map(x => [x.date, x.sets, x.minutes]), [['2026-11-30', 2, 75], ['2026-12-07', 1, null]]);
  const w = weekly(T, { '2026-11-30': { minutes: 75 } }, 2, '2026-12-09');
  assert.deepEqual(w.map(x => [x.week, x.sessions, x.minutes]), [['2026-11-30', 1, 75], ['2026-12-07', 1, 0]]);
});

test('serie na grupę mięśni: główny 1, pomocniczy 0,5', () => {
  const m = muscleSets(T, '2026-11-30', '2026-12-06');
  assert.equal(m.chest, 2);
  assert.equal(m.triceps, 1);
  assert.equal(m.shoulders, 1);
});

test('historia ćwiczenia i rekordy', () => {
  const h = exerciseHistory(T, 'Wyciskanie sztangi leżąc');
  assert.deepEqual(h.map(x => [x.date, x.bestE1rm, x.topKg]), [['2026-11-30', 60, 45], ['2026-12-07', 63.3, 50]]);
  const r = records(T).find(x => x.name === 'Wyciskanie sztangi leżąc');
  assert.equal(r.e1rm.value, 63.3); assert.equal(r.kg.value, 50); assert.equal(r.reps.value, 10); assert.equal(r.volume.value, 450);
});

test('seria tygodni z treningiem', () => {
  assert.equal(streakWeeks(T, {}, '2026-12-09'), 2);
  assert.equal(streakWeeks(T, {}, '2026-12-29'), 0);
});

test('serie sprzed startu treningu (24.11.2026) zostają w dzienniku, ale nie wchodzą do statystyk (D-088, D-121)', () => {
  const pre = { ...T, [`2026-10-21|${bench}|1`]: { date: '2026-10-21', ex: bench, set: 1, done: true, kg: 100, reps: 5, rir: 0 } };
  assert.equal(sets(pre).length, sets(T).length);
  assert.ok(!sessions(pre, { '2026-11-20': { minutes: 60 } }).some(x => x.date < '2026-11-24'));
  assert.equal(records(pre).find(x => x.name === 'Wyciskanie sztangi leżąc').kg.value, 50);
  for (const d of ['2026-11-22', '2026-11-23']) assert.equal(sets({ [`${d}|${bench}|1`]: { date: d, ex: bench, set: 1, done: true, kg: 40, reps: 8 } }).length, 0, `${d} — przed startem treningu (D-121; 23.11 — Dzień zero)`);
  assert.equal(sets({ [`2026-11-24|${bench}|1`]: { date: '2026-11-24', ex: bench, set: 1, done: true, kg: 40, reps: 8 } }).length, 1, 'dzień startu treningu (24.11) liczony');
});
