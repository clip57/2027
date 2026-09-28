// Pielęgnacja (D-094): walidacja typów `care.def` / `care.done`, stan, reguły harmonogramu i import planu.
// Wyłącznie dane syntetyczne („[DANE TESTOWE]”) — plan użytkownika nie trafia do repozytorium (D-035).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { validateEvent, classifyEvent } from '../../src/core/storage/validate.js';
import { careModel, stepsFor, progress, byPora, slotProgress, ruleText, productUse, weekGrid, upcomingChanges, isCarePlan, careDefsFromPlan } from '../../src/core/calc/care.js';
import { preview, apply } from '../../src/core/sync/bundle.js';

const PLAN = {
  format: '2027-care', schema: 1,
  products: [
    { id: 'p.a', name: '[DANE TESTOWE] Produkt A', area: 'twarz', status: 'uzywany' },
    { id: 'p.b', name: '[DANE TESTOWE] Produkt B', area: 'wlosy', status: 'zapas' },
    { id: 'p.c', name: '[DANE TESTOWE] Produkt C', area: 'cialo' },
  ],
  steps: [
    { id: 's.r1', pora: 'rano', group: 'Twarz', order: 1, text: 'Mycie', product: 'p.a', slot: 'slot.0700' },
    { id: 's.r2', pora: 'rano', group: 'Twarz', order: 2, text: 'Krem', warn: 'Odczekaj', wait: 10, slot: 'slot.0700' },
    { id: 's.d1', pora: 'dzien', group: 'Twarz', order: 1, text: 'Doraźnie', asNeeded: true },
    { id: 's.w1', pora: 'wieczor', group: 'Włosy', order: 1, text: 'Szampon PN i PT', product: 'p.b', days: [1, 5], until: '2026-10-11', slot: 'slot.2035' },
    { id: 's.w2', pora: 'wieczor', group: 'Włosy', order: 1, text: 'Szampon PN', product: 'p.b', days: [1], from: '2026-10-12', slot: 'slot.2035' },
    { id: 's.w3', pora: 'wieczor', group: 'Ciało', order: 2, text: 'Niedziela i środa', product: 'p.c', days: [3, 7] },
  ],
};

test('care.def i care.done: walidacja treści i zgodność koperty', () => {
  const ev = (t, d) => ({ id: `${t}:x`, hlc: '1790000000000:0000:dtest', dev: 'dtest', t, d, v: 1 });
  assert.equal(validateEvent(ev('care.def', { id: 's.1', kind: 'step', data: { text: 'x' } })), null);
  assert.equal(validateEvent(ev('care.def', { id: 's.1', kind: 'step', data: {}, deleted: true })), null);
  assert.ok(validateEvent(ev('care.def', { id: 's.1', kind: 'inne', data: {} })));
  assert.ok(validateEvent(ev('care.def', { id: 's 1', kind: 'step', data: {} })), 'identyfikator bez spacji');
  assert.equal(validateEvent(ev('care.done', { date: '2026-10-05', step: 's.1', done: true })), null);
  assert.ok(validateEvent(ev('care.done', { date: '2026-13-05', step: 's.1', done: true })));
  assert.equal(classifyEvent(ev('care.done', { date: '2026-10-05', step: 's.1', done: false })), 'ok');
});

test('Store: definicje (ostatnia zmiana wygrywa, usunięcie) i odhaczenia w stanie', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  assert.deepEqual([s.state.careDefs, s.state.careDone], [[], {}]);
  await s.record('care.def', { id: 's.1', kind: 'step', data: { pora: 'rano', text: 'A' } });
  await s.record('care.def', { id: 's.1', kind: 'step', data: { pora: 'rano', text: 'B' } });
  await s.record('care.def', { id: 's.2', kind: 'step', data: { pora: 'rano', text: 'C' } });
  await s.record('care.done', { date: '2026-10-05', step: 's.1', done: true });
  assert.deepEqual(s.state.careDefs.map(d => [d.id, d.text]), [['s.1', 'B'], ['s.2', 'C']]);
  assert.equal(s.state.careDone['2026-10-05|s.1'], true);
  await s.record('care.def', { id: 's.2', kind: 'step', data: {}, deleted: true });
  await s.record('care.done', { date: '2026-10-05', step: 's.1', done: false });
  assert.deepEqual(s.state.careDefs.map(d => d.id), ['s.1']);
  assert.equal(s.state.careDone['2026-10-05|s.1'], false);
});

test('reguły: dni tygodnia, okres od–do, doraźne poza postępem, pory i grupy, sloty planu dnia', () => {
  const m = careModel(careDefsFromPlan(PLAN).map(d => ({ ...d.data, id: d.id, kind: d.kind })));
  assert.deepEqual(m.steps.map(s => s.id), ['s.r1', 's.r2', 's.d1', 's.w1', 's.w2', 's.w3']);
  const ids = d => stepsFor(m, d).map(s => s.id);
  assert.deepEqual(ids('2026-10-05'), ['s.r1', 's.r2', 's.d1', 's.w1']);          // pn, szampon do 11.10
  assert.deepEqual(ids('2026-10-09'), ['s.r1', 's.r2', 's.d1', 's.w1']);          // pt
  assert.deepEqual(ids('2026-10-16'), ['s.r1', 's.r2', 's.d1']);                  // pt po 11.10 — bez szamponu
  assert.deepEqual(ids('2026-10-12'), ['s.r1', 's.r2', 's.d1', 's.w2']);          // pn od 12.10
  assert.deepEqual(ids('2026-10-07'), ['s.r1', 's.r2', 's.d1', 's.w3']);          // śr
  assert.deepEqual(ids('2026-10-11'), ['s.r1', 's.r2', 's.d1', 's.w3']);          // nd
  const done = { '2026-10-05|s.r1': true, '2026-10-05|s.d1': true, '2026-10-05|s.w1': false };
  assert.deepEqual(progress(stepsFor(m, '2026-10-05'), done, '2026-10-05'), { done: 1, total: 3 });
  assert.deepEqual(byPora(stepsFor(m, '2026-10-07')).map(p => [p.id, p.groups.map(g => g.name)]), [['rano', ['Twarz']], ['dzien', ['Twarz']], ['wieczor', ['Ciało']]]);
  assert.deepEqual(slotProgress(m, done, '2026-10-05'), { 'slot.0700': { done: 1, total: 2 }, 'slot.2035': { done: 0, total: 1 } });
  assert.deepEqual(m.steps.map(ruleText), ['codziennie', 'codziennie', 'doraźnie', 'PN, PT · do 11.10', 'PN · od 12.10', 'ŚR, ND']);
  assert.deepEqual(productUse(m, 'p.b').map(u => u.rule), ['PN, PT · do 11.10', 'PN · od 12.10']);
});

test('tydzień i zapowiedź zmian w planie', () => {
  const m = careModel(careDefsFromPlan(PLAN).map(d => ({ ...d.data, id: d.id, kind: d.kind })));
  const w = weekGrid(m, { '2026-10-05|s.r1': true }, '2026-10-05');
  assert.deepEqual(w.map(d => d.date), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
  assert.deepEqual(w.map(d => d.total), [3, 2, 3, 2, 3, 2, 3]);
  assert.equal(w[0].done, 1);
  assert.deepEqual(w.map(d => d.special.map(s => s.id)), [['s.w1'], [], ['s.w3'], [], ['s.w1'], [], ['s.w3']]);
  assert.deepEqual(upcomingChanges(m, '2026-10-01').map(x => [x.date, x.step.id, x.kind]), [['2026-10-12', 's.w1', 'koniec'], ['2026-10-12', 's.w2', 'start']]);
  assert.deepEqual(upcomingChanges(m, '2026-10-20'), []);
});

test('import planu (format 2027-care): podgląd, zapis, ponowny import bez zmian, zmieniona definicja = nowa wersja', async () => {
  assert.ok(isCarePlan(PLAN) && !isCarePlan({ format: '2027-care' }));
  const s = await new Store(new MemoryAdapter()).open();
  const pv = await preview(s, PLAN);
  assert.deepEqual([pv.ok, pv.kind, pv.fresh.length, pv.byType['care.def']], [true, 'care', 9, 9]);
  await apply(s, pv);
  assert.equal(careModel(s.state.careDefs).steps.length, 6);
  assert.equal((await preview(s, PLAN)).fresh.length, 0, 'ten sam plik — nic nowego');
  const changed = structuredClone(PLAN); changed.products[0].status = 'skonczony';
  const pv2 = await preview(s, changed);
  assert.deepEqual([pv2.fresh.length, pv2.conflicts.length, pv2.conflicts[0].winner], [1, 1, 'plik']);
  await apply(s, pv2);
  assert.equal(careModel(s.state.careDefs).product['p.a'].status, 'skonczony');
});
