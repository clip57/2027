// D-113: odhaczanie dawek (F-D4) i listy zakupów (F-Z2) przez `setting` — klucze zgodne z walidacją, LWW per pozycja.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doseKey, doseDone, dosesProgress, shopKey, shopChecked, settingEvents } from '../../src/core/calc/checks.js';
import { classifyEvent } from '../../src/core/storage/validate.js';
import { dosesFor } from '../../src/core/resolver.js';
import { allItems } from '../../src/core/calc/inventory.js';

const env = (t, d) => ({ id: 'x'.repeat(16), t, d, hlc: '1793000000000:0000:dev', dev: 'dev', v: 1, at: '2026-12-26T10:00:00.000Z' });

test('klucze dawek i zakupów mieszczą się w walidacji `setting` (każda dawka planu, każda pozycja katalogu)', () => {
  const doses = dosesFor('2026-12-26');
  assert.ok(doses.length > 5);
  for (const d of doses) assert.equal(classifyEvent(env('setting', { key: doseKey('2026-12-26', d), value: true })), 'ok', doseKey('2026-12-26', d));
  for (const it of allItems()) assert.equal(classifyEvent(env('setting', { key: shopKey('2027-01-07', it.id), value: true })), 'ok', it.id);
});

test('stan z ustawień: odhaczone / cofnięte (false) / brak klucza', () => {
  const doses = dosesFor('2026-12-26'), [a, b] = doses;
  const settings = { [doseKey('2026-12-26', a)]: true, [doseKey('2026-12-26', b)]: false };
  assert.equal(doseDone(settings, '2026-12-26', a), true);
  assert.equal(doseDone(settings, '2026-12-26', b), false);
  assert.equal(doseDone(settings, '2026-12-27', a), false);
  assert.deepEqual(dosesProgress(settings, '2026-12-26', doses), { done: 1, total: doses.length });
  assert.equal(shopChecked({ [shopKey('2027-01-07', 'banan')]: true }, '2027-01-07', 'banan'), true);
  assert.equal(shopChecked({ [shopKey('2027-01-07', 'banan')]: true }, '2027-01-14', 'banan'), false);
  assert.deepEqual(settingEvents(['k1', 'k2'], false), [['setting', { key: 'k1', value: false }], ['setting', { key: 'k2', value: false }]]);
});
