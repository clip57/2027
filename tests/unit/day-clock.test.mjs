// D-110: upływ czasu bieżącego punktu planu („Teraz” — pasek i „zostało N min”, linia osi czasu --el). Także przez północ (sen 23:00–07:00).
import test from 'node:test';
import assert from 'node:assert/strict';
import { slotClock, currentSlot } from '../../src/modules/dzis.js';

test('D-110: upływ i pozostały czas punktu planu', () => {
  assert.deepEqual(slotClock({ from: '10:10', to: '11:03' }, '10:40'), { frac: 30 / 53, left: 23 });
  assert.deepEqual(slotClock({ from: '10:10', to: '11:03' }, '10:10'), { frac: 0, left: 53 });
  assert.deepEqual(slotClock({ from: '10:10', to: '11:03' }, '11:03'), { frac: 1, left: 0 });
  assert.deepEqual(slotClock({ from: '10:10', to: '11:03' }, '11:30'), { frac: 1, left: 0 }, 'po końcu — pełny, bez wartości ujemnych');
});

test('D-110: punkt przez północ (sen) — przed i po północy', () => {
  assert.deepEqual(slotClock({ from: '23:00', to: '07:00' }, '23:30'), { frac: 30 / 480, left: 450 });
  assert.deepEqual(slotClock({ from: '23:00', to: '07:00' }, '01:30'), { frac: 150 / 480, left: 330 });
  assert.deepEqual(slotClock({ from: '22:30', to: '06:30' }, '06:29'), { frac: 479 / 480, left: 1 });
});

test('D-110: zgodność z wyborem bieżącego punktu (currentSlot)', () => {
  const slots = [{ from: '07:00', to: '09:00' }, { from: '09:00', to: '10:10' }, { from: '10:10', to: '11:03' }, { from: '23:00', to: '07:00' }];
  const now = currentSlot(slots, '10:40');
  assert.equal(now.current, slots[2]);
  assert.equal(slotClock(now.current, '10:40').left, 23);
  assert.equal(currentSlot(slots, '23:15').current, slots[3]);
});
