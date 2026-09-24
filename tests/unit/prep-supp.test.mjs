// Meal Prep ↔ Zapasy (Faza 5): pokrycie zużycia jutra stanem na dziś — dane fikcyjne w pamięci.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverage } from '../../src/core/calc/inventory.js';
import { consumptionForDay } from '../../src/core/calc/consumption.js';

const inv = q => ({ counts: Object.fromEntries(Object.entries(q).map(([p, qty]) => [p, [{ id: `c-${p}`, qty, date: '2026-09-27', hlc: '1' }]])), moves: {}, shifts: [] });

test('coverage: brak, gdy stan na koniec dziś < zużycie jutra', () => {
  const need = consumptionForDay('2026-09-29').kurczak;                 // wtorek: dzień treningowy, obiad z kurczakiem
  assert.ok(need > 0);
  const todayUse = consumptionForDay('2026-09-28').kurczak;
  const ok = coverage(inv({ kurczak: todayUse + need }), ['kurczak'], '2026-09-28', '2026-09-29')[0];
  assert.deepEqual([ok.short, ok.need], [false, need]);
  const short = coverage(inv({ kurczak: todayUse + need - 1 }), ['kurczak'], '2026-09-28', '2026-09-29')[0];
  assert.equal(short.short, true);
});

test('coverage: stan nieznany bez oceny; pozycje niezużywane jutro pominięte; bez duplikatów', () => {
  const r = coverage(inv({}), ['kurczak', 'kurczak', 'banan'], '2026-09-30', '2026-10-01');   // czwartek: bez banana (NT)
  assert.deepEqual(r.map(x => [x.prod, x.stock, x.short]), [['kurczak', null, null]]);
});
