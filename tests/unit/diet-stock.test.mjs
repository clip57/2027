// Dieta ↔ Zapasy (Faza 5): godziny posiłków, następny posiłek, pasek zapasu — dane fikcyjne i dane planu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mealTimes, nextMeal, dietSummary } from '../../src/core/calc/diet.js';
import { runway } from '../../src/core/calc/inventory.js';
import { resolveDay } from '../../src/core/resolver.js';

test('mealTimes: godziny posiłków z planu dnia', () => {
  const t = mealTimes(resolveDay('2026-09-28').slots);
  assert.equal(t.breakfast, '09:00');
  assert.equal(t.dinner, '16:23');                         // D-037
  assert.equal(t.drinks, undefined);                       // napoje bez godziny
});

test('nextMeal: pierwszy posiłek o godzinie ≥ teraz, null wieczorem', () => {
  const times = mealTimes(resolveDay('2026-09-28').slots);
  const meals = dietSummary(0, 'T').meals;
  assert.equal(nextMeal(meals, times, '06:00').id, 'breakfast');
  assert.equal(nextMeal(meals, times, '09:00').id, 'breakfast');
  assert.equal(nextMeal(meals, times, '09:01').id, 'snack');
  assert.equal(nextMeal(meals, times, '16:30').id, 'post');
  assert.equal(nextMeal(meals, times, '21:01'), null);
});

test('runway: zapas na tle horyzontu i dnia zakupów', () => {
  const food = { category: 'Obiad' }, supp = { category: 'Suplementy' };
  assert.deepEqual(runway(food, { days: 7 }, 5), { days: 7, horizon: 14, pct: 50, shopPct: 35.7, beforeShopping: false });
  assert.equal(runway(food, { days: 2 }, 5).beforeShopping, true);
  assert.equal(runway(food, { days: 40 }, 5).pct, 100);
  assert.equal(runway(supp, { days: 15 }, 3).horizon, 30);
  assert.equal(runway(food, { days: Infinity }, 5), null);
  assert.equal(runway(food, null, 5), null);
});
