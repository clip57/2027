// D-113 (F-G1): polecenia palety ⌘K — tylko nawigacja; data wpisana w polu → „Przejdź do dnia” (rok z zakresu planu).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commands } from '../../src/ui/search.js';

test('pusta fraza: lista poleceń (nawigacja, bez zapisu danych)', () => {
  const c = commands('');
  assert.ok(c.length >= 10);
  assert.ok(c.every(x => (x.href && x.href.startsWith('#/')) || typeof x.run === 'function'));
  assert.ok(c.some(x => x.href === '#/zapasy?a=zakupy') && c.some(x => x.href === '#/ustawienia'));
});

test('data: dd.mm (rok wg zakresu planu), dd.mm.rrrr, ISO; niepoprawna data — bez polecenia', () => {
  assert.equal(commands('12.11')[0].href, '#/dzis?d=2026-11-12');
  assert.equal(commands('5.3')[0].href, '#/dzis?d=2027-03-05');
  assert.equal(commands('1.1.2027')[0].href, '#/dzis?d=2027-01-01');
  assert.equal(commands('2026-12-24')[0].href, '#/dzis?d=2026-12-24');
  assert.ok(!commands('29.02').some(x => x.href?.startsWith('#/dzis?d=')));
  assert.ok(!commands('31.11').some(x => x.href?.startsWith('#/dzis?d=')));
});

test('fraza bez polskich znaków dopasowuje polecenia', () => {
  assert.ok(commands('zakupow').some(x => x.href === '#/zapasy?a=zakupy'));
  assert.ok(commands('jadlospis').some(x => x.href.startsWith('#/dieta?d=')));
});
