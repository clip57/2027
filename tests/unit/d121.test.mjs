// D-121 (23.11.2026, decyzje użytkownika): nowy początek planu — Dzień zero 23.11, pełna chronologia nauki, dni bez treningu, dawki prywatne
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDay, dosesFor, setPrivateDoses, validPrivateDose, PRIVATE_DOSES_KEY } from '../../src/core/resolver.js';
import { SRC, cfaByDay, mpwByDay } from '../../src/core/data.js';
import { scheduleFor } from '../../src/core/calc/supplements.js';
import { consumptionForDay } from '../../src/core/calc/consumption.js';
import { careModel, stepsFor } from '../../src/core/calc/care.js';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { preview, apply, PRIVATE_DOSES_FORMAT } from '../../src/core/sync/bundle.js';
import cfaJson from '../../src/data/cfa.json' with { type: 'json' };
import mpwJson from '../../src/data/mpw.json' with { type: 'json' };

const ZERO = '2026-11-23';

test('D-121: pełna chronologia materiału — bloki w kolejności numerów, od 23.11; zaległe rano (MPW 14–16.12, CFA 17–18.12 i 24.12); wyrównanie z D-120 (MPW od popołudnia 16.12, CFA od 25.12)', () => {
  for (const [D, raw] of [[SRC.cfa.D, cfaJson.D.bloki], [SRC.mpw.D, mpwJson.D.bloki]]) {
    const B = [...D.bloki].sort((a, b) => a.nr - b.nr);
    assert.equal(B.length, raw.length);
    assert.equal(B[0].data, ZERO);
    assert.ok(B.every(b => b.data >= ZERO));
  }
  const key = b => `${b.data} ${b.godz}`;
  const cfa = [...SRC.cfa.D.bloki].sort((a, b) => a.nr - b.nr);
  assert.ok(cfa.every((b, i) => !i || key(b) > key(cfa[i - 1])), 'CFA chronologicznie');
  // MPW: chronologicznie poza dniami D-120 (06.03 i 13.03: P7 o 22:00 po symulacji — decyzja D-120)
  const mpw = [...SRC.mpw.D.bloki].sort((a, b) => a.nr - b.nr).filter(b => !['2027-03-06', '2027-03-13'].includes(b.data));
  assert.ok(mpw.every((b, i) => !i || key(b) > key(mpw[i - 1])), 'MPW chronologicznie');
  const at = (by, d) => (by[d] || []).map(b => b.godz.slice(0, 5));
  for (const d of ['2026-12-14', '2026-12-15', '2026-12-16']) assert.deepEqual(at(mpwByDay, d), ['08:00', '09:10', '10:10', '15:30', '16:40', '22:00'], d);
  for (const d of ['2026-12-17', '2026-12-18']) assert.deepEqual(at(cfaByDay, d), ['08:00', '09:10', '10:10', '12:20', '13:30', '14:30'], d);
  assert.deepEqual(at(cfaByDay, '2026-12-24'), ['08:00', '09:10', '10:10']);
  assert.deepEqual(at(mpwByDay, '2026-12-24'), ['12:20', '13:30', '14:30']);
  // wyrównanie: od 25.12 CFA, od 17.12 MPW — bloki w miejscach planu D-120 (ten sam numer co w pliku po przesunięciach D-120)
  const rawNr = (raw, d) => raw.filter(b => b.data === d).map(b => b.nr);
  assert.deepEqual((cfaByDay['2026-12-28'] || []).map(b => b.nr), rawNr(cfaJson.D.bloki, '2026-12-28'), 'CFA 28.12 — numery jak w planie');
  assert.deepEqual(mpwByDay['2026-12-17'].map(b => b.nr), rawNr(mpwJson.D.bloki, '2026-12-17'), 'MPW 17.12 — numery jak w planie');
});

test('D-121: Dzień zero 23.11 — w planie: nauka, bez diety, dawek, treningu i zużycia; pielęgnacja tylko wieczorna; dni wcześniejsze ukryte', () => {
  const r = resolveDay(ZERO);
  assert.deepEqual([r.outside, r.zero, r.noDiet, r.kcal, r.doses.length, r.training, r.sessionLabel], [false, true, true, null, 0, null, 'Dzień zero']);
  assert.equal(r.slots.filter(s => (s.cfa || []).length).length, 3);
  assert.deepEqual(consumptionForDay(ZERO), {});
  const m = careModel([
    { kind: 'step', id: 's.r', pora: 'rano', text: '[TEST] rano' },
    { kind: 'step', id: 's.d', pora: 'dzien', text: '[TEST] dzień' },
    { kind: 'step', id: 's.w', pora: 'wieczor', text: '[TEST] wieczór' },
  ]);
  assert.deepEqual(stepsFor(m, ZERO).map(s => s.id), ['s.w'], 'Dzień zero — tylko wieczór');
  assert.deepEqual(stepsFor(m, '2026-11-24').map(s => s.id), ['s.r', 's.d', 's.w']);
  assert.deepEqual(stepsFor(m, '2026-11-22'), [], 'przed startem planu — bez kroków (ukryte)');
  for (const d of ['2026-11-20', '2026-11-22']) assert.equal(resolveDay(d).outside, true, d);
});

test('D-121: dni bez treningu 12.12 (LOWER 2) i 24.12 (sauna) — dieta NT; suplementy czasowe do 30.04.2027', () => {
  for (const d of ['2026-12-12', '2026-12-24']) {
    const r = resolveDay(d);
    assert.deepEqual([r.dayType, r.session, r.sauna, r.dietVariant], ['free', null, 0, 'NT'], d);
    assert.ok(!r.slots.some(s => /Sauna|sauny|Trening/.test(s.title)), d);
  }
  const has = (d, id) => dosesFor(d).some(x => x.supp === id);
  for (const id of ['chondroityna', 'boswellia', 'glukozamina']) assert.deepEqual([has(ZERO, id), has('2026-11-24', id), has('2027-04-30', id), has('2027-05-01', id)], [false, true, true, false], id);
});

test('D-121: dawki prywatne (plik poza repozytorium) — w planie dnia i Suplementacji, okres od–do, bez Zapasów; import w „Dane” idempotentny', async () => {
  const doses = [
    { id: 'lek-a', time: '09:00', name: '[TEST] Lek A', label: '1 tabl.', from: '2026-11-24', until: '2026-11-30' },
    { id: 'lek-b', time: '09:00', name: '[TEST] Lek A', label: '2 tabl.', from: '2026-12-01' },
    { id: 'lek-c', time: '22:00', name: '[TEST] Lek C', label: '1 tabl.', from: '2026-11-24', weekdays: [1, 3, 5] },
  ];
  assert.ok(doses.every(validPrivateDose));
  assert.equal(validPrivateDose({ id: 'x', time: '9:00', name: 'a', label: 'b' }), false);
  try {
    setPrivateDoses(doses);
    const names = d => scheduleFor(d).flatMap(g => g.doses.filter(x => x.private).map(x => `${g.time} ${x.name} ${x.label}`));
    assert.deepEqual(names(ZERO), [], 'Dzień zero — bez dawek');
    assert.deepEqual(names('2026-11-30'), ['09:00 [TEST] Lek A 1 tabl.', '22:00 [TEST] Lek C 1 tabl.']);
    assert.deepEqual(names('2026-12-01'), ['09:00 [TEST] Lek A 2 tabl.']);
    assert.ok(resolveDay('2026-12-02').slots.some(s => s.doses.some(x => x.supp === 'priv.lek-c')), 'dawka w slocie planu dnia');
    assert.ok(!Object.keys(consumptionForDay('2026-12-02')).some(k => k.startsWith('priv.')), 'bez zużycia w Zapasach');
  } finally { setPrivateDoses([]); }
  assert.equal(dosesFor('2026-12-02').some(x => x.private), false);
  const s = await new Store(new MemoryAdapter()).open();
  const file = { format: PRIVATE_DOSES_FORMAT, version: 1, doses };
  const pv = await preview(s, file);
  assert.deepEqual([pv.ok, pv.kind, pv.fresh.length], [true, 'private-doses', 1]);
  await apply(s, pv);
  assert.deepEqual(s.state.settings[PRIVATE_DOSES_KEY].map(d => d.id), ['lek-a', 'lek-b', 'lek-c']);
  assert.equal((await preview(s, file)).fresh.length, 0, 'ponowny import niczego nie dodaje');
  const bad = await preview(s, { format: PRIVATE_DOSES_FORMAT, doses: [{ id: 'x', time: '25', name: 'a', label: 'b' }] });
  assert.equal(bad.ok, false);
  assert.equal((await preview(s, { format: PRIVATE_DOSES_FORMAT, doses: [doses[0], doses[0]] })).ok, false, 'powtórzony identyfikator');
});
