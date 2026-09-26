// I7: paragon tekstem — ilości, jednostki, opakowania, dopasowanie nazw (fikcyjne wpisy).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReceipt, parseLine } from '../../src/core/receipt.js';
import { allItems } from '../../src/core/calc/inventory.js';

const ITEMS = [...allItems(), { id: 'custom_test', name: '[TEST] Orzechy', unit: 'g', packSize: 200 }];
const q = (r, id) => r.rows.find(x => x.item.id === id)?.qty;

test('linie: liczba z przecinkiem, mnożenie, jednostka na końcu', () => {
  assert.deepEqual(['name', 'qty', 'unit'].map(k => parseLine('banan 1,2 kg')[k]), ['banan', 1.2, 'kg']);
  assert.deepEqual(['name', 'qty', 'unit'].map(k => parseLine('Kefir 1,5% 2 × 400 ml')[k]), ['Kefir 1,5%', 800, 'ml']);
  assert.equal(parseLine('   '), null);
});

test('paragon: przeliczenia, opakowania bez jednostki, nieznane pozycje i jednostki', () => {
  const r = parseReceipt('banan 1,2 kg\nkefir 2 × 400 ml\njajka 10 szt.\npłatki owsiane 2\nSkyr 3 op\n[test] orzechy 150 g\nczekolada 100 g\nbanan 3 szt', ITEMS);
  assert.equal(q(r, 'banan'), 1200);
  assert.equal(q(r, 'kefir'), 800);
  assert.equal(q(r, 'jajka'), 10);
  assert.equal(q(r, 'platki_owsiane'), 1000, '2 opakowania po 500 g');
  assert.equal(q(r, 'skyr'), 1200);
  assert.equal(q(r, 'custom_test'), 150);
  assert.ok(r.unknown.some(x => x.startsWith('czekolada')));
  assert.ok(r.unknown.some(x => x.includes('szt ≠ g')), 'banan w sztukach — nieprzeliczalne');
});
