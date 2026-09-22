import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../../src/core/dates.js';

test('dzień tygodnia: 21.09.2026 = poniedziałek (1), 27.09 = niedziela (7)', () => {
  assert.equal(D.weekday('2026-09-21'), 1);
  assert.equal(D.weekday('2026-09-27'), 7);
});
test('addDays przez zmianę czasu (25.10.2026) i przełom roku', () => {
  assert.equal(D.addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(D.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(D.diffDays('2026-09-22', '2027-03-21'), 180);
});
test('isValidDay odrzuca nieistniejące daty', () => {
  assert.ok(D.isValidDay('2027-02-28'));
  assert.ok(!D.isValidDay('2027-02-29'));
  assert.ok(!D.isValidDay('2026-9-1'));
});
test('ymd używa czasu lokalnego (nie UTC)', () => {
  const d = new Date(2026, 8, 22, 0, 30); // 00:30 lokalnie
  assert.equal(D.ymd(d), '2026-09-22');
});
