import test from 'node:test';
import assert from 'node:assert/strict';
import { e1rm, sets, sessions, weekly, muscleSets, exerciseHistory, records, streakWeeks, EX_BY_ID } from '../../src/core/calc/training.js';

const bench = Object.values(EX_BY_ID).find(e => e.name === 'Wyciskanie sztangi leżąc').id;
const rdl = Object.values(EX_BY_ID).find(e => e.name === 'Martwy ciąg rumuński').id;
const T = {
  [`2026-10-19|${bench}|1`]: { date: '2026-10-19', ex: bench, set: 1, done: true, kg: 45, reps: 10, rir: 2 },
  [`2026-10-19|${bench}|2`]: { date: '2026-10-19', ex: bench, set: 2, done: true, kg: 45, reps: 8, rir: 2 },
  [`2026-10-26|${bench}|1`]: { date: '2026-10-26', ex: bench, set: 1, done: true, kg: 50, reps: 8, rir: 2 },
  [`2026-10-20|${rdl}|1`]: { date: '2026-10-20', ex: rdl, set: 1, done: false, kg: null, reps: null, rir: null },
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
  const ss = sessions(T, { '2026-10-19': { date: '2026-10-19', minutes: 75 } });
  assert.deepEqual(ss.map(x => [x.date, x.sets, x.minutes]), [['2026-10-19', 2, 75], ['2026-10-26', 1, null]]);
  const w = weekly(T, { '2026-10-19': { minutes: 75 } }, 2, '2026-10-28');
  assert.deepEqual(w.map(x => [x.week, x.sessions, x.minutes]), [['2026-10-19', 1, 75], ['2026-10-26', 1, 0]]);
});

test('serie na grupę mięśni: główny 1, pomocniczy 0,5', () => {
  const m = muscleSets(T, '2026-10-19', '2026-10-25');
  assert.equal(m.chest, 2);
  assert.equal(m.triceps, 1);
  assert.equal(m.shoulders, 1);
});

test('historia ćwiczenia i rekordy', () => {
  const h = exerciseHistory(T, 'Wyciskanie sztangi leżąc');
  assert.deepEqual(h.map(x => [x.date, x.bestE1rm, x.topKg]), [['2026-10-19', 60, 45], ['2026-10-26', 63.3, 50]]);
  const r = records(T).find(x => x.name === 'Wyciskanie sztangi leżąc');
  assert.equal(r.e1rm.value, 63.3); assert.equal(r.kg.value, 50); assert.equal(r.reps.value, 10); assert.equal(r.volume.value, 450);
});

test('seria tygodni z treningiem', () => {
  assert.equal(streakWeeks(T, {}, '2026-10-28'), 2);
  assert.equal(streakWeeks(T, {}, '2026-11-17'), 0);
});

test('serie sprzed startu regularnego treningu (17.10.2026) zostają w dzienniku, ale nie wchodzą do statystyk (D-088, D-101, D-103)', () => {
  const pre = { ...T, [`2026-09-21|${bench}|1`]: { date: '2026-09-21', ex: bench, set: 1, done: true, kg: 100, reps: 5, rir: 0 } };
  assert.equal(sets(pre).length, sets(T).length);
  assert.ok(!sessions(pre, { '2026-10-16': { minutes: 60 } }).some(x => x.date < '2026-10-17'));
  assert.equal(records(pre).find(x => x.name === 'Wyciskanie sztangi leżąc').kg.value, 50);
  assert.equal(sets({ [`2026-10-16|${bench}|1`]: { date: '2026-10-16', ex: bench, set: 1, done: true, kg: 40, reps: 8 } }).length, 0, '16.10 — przed startem regularnego treningu');
  assert.equal(sets({ [`2026-10-17|${bench}|1`]: { date: '2026-10-17', ex: bench, set: 1, done: true, kg: 40, reps: 8 } }).length, 1, 'dzień startu treningu liczony');
});
