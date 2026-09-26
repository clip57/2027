// I4: globalne wyszukiwanie — indeks z danych planu i stanu, bez diakrytyków, wszystkie słowa naraz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, search, norm } from '../../src/core/search.js';
import { resolveDay } from '../../src/core/resolver.js';

const IDX = buildIndex({ catalogUser: [{ id: 'custom_x', name: '[TEST] Pozycja', category: 'Inne' }], cfaErrors: [{ id: 'e1', temat: '[TEST] duration', rodzaj: 'pośpiech' }] }, '2026-09-28');

test('normalizacja: bez polskich znaków', () => assert.equal(norm('Żółć ŁĄKA'), 'zolc laka'));

test('wyniki: produkty, ćwiczenia z najbliższym dniem sesji, bloki CFA, error log, bezpieczeństwo, rekompozycja', () => {
  const bench = search(IDX, 'wyciskanie sztangi').find(x => x.kind === 'ex');
  assert.ok(bench && /^#\/trening\?d=2026-09-28$/.test(bench.href), 'poniedziałek 28.09 — UPPER 1');
  assert.ok(resolveDay('2026-09-28').training.some(e => e.name === bench.title));
  assert.ok(search(IDX, 'platki').some(x => x.kind === 'inv' && x.title.startsWith('Płatki')));
  assert.ok(search(IDX, 'hypothesis testing').some(x => x.kind === 'cfa' && x.href.startsWith('#/cfa?v=dzien&d=')));
  assert.ok(search(IDX, 'duration').some(x => x.kind === 'err'));
  assert.ok(search(IDX, 'test pozycja').some(x => x.kind === 'inv' && x.href.includes('zapasy')));
  assert.ok(search(IDX, 'skyr').some(x => x.kind === 'safe'));
  assert.ok(search(IDX, 'punkt startowy').some(x => x.kind === 'rek' && x.href === '#/rekompozycja?s=s1'));
  assert.equal(search(IDX, 'zapasy')[0].kind, 'mod', 'trafienie w tytule najpierw');
  assert.deepEqual(search(IDX, '   '), []);
  assert.ok(search(IDX, 'a', 5).length <= 5);
});
