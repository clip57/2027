// D-119: szacunek tempa nauki — daty odhaczeń z dziennika i prognoza końca
import test from 'node:test';
import assert from 'node:assert/strict';
import { completionDates, tempo } from '../../src/core/calc/tempo.js';

const ev = (nr, done, at, hlc) => ({ t: 'mpw.done', d: { block: nr, done }, at, hlc });

test('completionDates: zwycięskie zdarzenie (najnowsze hlc), tylko bloki wykonane', () => {
  const events = [ev(1, true, '2026-11-20T09:00:00', '001'), ev(1, false, '2026-11-21T09:00:00', '002'), ev(1, true, '2026-11-22T09:00:00', '003'),
    ev(2, true, '2026-11-21T10:00:00', '004'), ev(3, true, '2026-11-21T10:00:00', '005'), { t: 'setting', d: {}, hlc: '006' }];
  const m = completionDates(events, 'mpw.done', new Set([1, 2]));
  assert.deepEqual([...m.entries()].sort(), [[1, '2026-11-22'], [2, '2026-11-21']]);
});

test('tempo: za mało dni, brak odhaczeń, koniec planu', () => {
  const base = { total: 100, today: '2026-11-22', planEnd: '2027-03-20' };
  assert.equal(tempo({ ...base, dates: new Map(), doneCount: 0 }).reason, 'none');
  const short = tempo({ ...base, dates: new Map([[1, '2026-11-20']]), doneCount: 1 });
  assert.equal(short.reason, 'short'); assert.equal(short.wait, 4);
  assert.equal(tempo({ ...base, dates: new Map(), doneCount: 100 }).finished, true);
});

test('tempo: 28 bloków w 14 dni = 2 / dzień → koniec za połowę pozostałych bloków', () => {
  const dates = new Map([...Array(28)].map((_, i) => [i + 1, `2026-11-${String(9 + Math.floor(i / 2)).padStart(2, '0')}`]));
  const t = tempo({ dates, total: 128, doneCount: 28, today: '2026-11-22', planEnd: '2027-03-20' });
  assert.equal(t.ok, true); assert.equal(t.span, 14); assert.equal(t.n, 28); assert.equal(t.rate, 2);
  assert.equal(t.end, '2027-01-11');   // 100 bloków / 2 = 50 dni
  assert.ok(t.delta < 0, 'przed końcem planu');
});

test('tempo: okno od pierwszego odhaczenia, nie wcześniej (dni bez używania aplikacji nie zaniżają tempa)', () => {
  const dates = new Map([...Array(10)].map((_, i) => [i + 1, '2026-11-16']));
  const t = tempo({ dates, total: 20, doneCount: 10, today: '2026-11-22', planEnd: '2026-12-31' });
  assert.equal(t.span, 7); assert.equal(t.n, 10);
});
