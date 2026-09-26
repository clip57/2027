// „Wymaga uwagi” (I2): sygnały liczone z tych samych danych co moduły źródłowe (fikcyjne zdarzenia).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { attention } from '../../src/core/calc/attention.js';
import { cfaPace } from '../../src/core/calc/cfa.js';
import { SRC } from '../../src/core/data.js';

const ids = l => l.map(x => x.id);

test('Wymaga uwagi: zaległe CFA zgodne z modułem CFA, braki przed zakupami, suplementy bez nazw (D-041)', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  await s.recordMany([['inv.count', { prod: 'banan', qty: 120, date: '2026-10-05' }], ['inv.count', { prod: 'kreatyna', qty: 5, date: '2026-10-05' }],
    ['inv.count', { prod: 'kefir', qty: 99999, date: '2026-10-05' }]]);
  const a = attention(s.state, { today: '2026-10-06', hour: 10 });
  const cfa = a.find(x => x.id === 'cfa');
  assert.equal(cfa.text, `Zaległe bloki CFA: ${cfaPace(SRC.cfa.D.bloki, new Set(), '2026-10-06').overdue.length}`);
  assert.match(a.find(x => x.id === 'shop').text, /Banan/);
  assert.doesNotMatch(a.find(x => x.id === 'shop').text, /Kefir/);
  const supp = a.find(x => x.id === 'supp');
  assert.ok(supp && !/Kreatyna/i.test(supp.text), 'suplementy tylko liczbą');
  assert.ok(ids(a).includes('recall'));
});

test('Wymaga uwagi: pusty dziennik przed startem CFA — brak ostrzeżeń; koniec preparatów czasowych 14 dni wcześniej', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  assert.deepEqual(attention(s.state, { today: '2026-09-25' }), []);
  const end = attention(s.state, { today: '2027-03-10' }).find(x => x.id.startsWith('end-'));
  assert.match(end.text, /21\.03/);
  assert.equal(attention(s.state, { today: '2027-03-01' }).find(x => x.id.startsWith('end-')), undefined);
});
