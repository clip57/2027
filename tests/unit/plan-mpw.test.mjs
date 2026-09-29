// Plan MPW (D-095): spójność planu z mpw.json (354 bloki, 118 dni × 3, 17.11.2026–20.03.2027, egzamin 21.03.2027), nowe typy zdarzeń
// `mpw.done` / `mpw.err.*`, zamiana zakładki CFA → MPW od 12.11.2026, dzień bez zmian w szablonie godzin, integracje (uwaga, ⌘K, .ics).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SRC, mpwByDay } from '../../src/core/data.js';
import { addDays, dayName, range } from '../../src/core/dates.js';
import { MPW_BLOCKS, validateEvent } from '../../src/core/storage/validate.js';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { resolveDay } from '../../src/core/resolver.js';
import { byId, isTab, modulesOn } from '../../src/modules/registry.js';
import { mpwSources, mpwFreeDays } from '../../src/core/calc/mpw.js';
import { attention } from '../../src/core/calc/attention.js';
import { cfaPace } from '../../src/core/calc/cfa.js';
import { planEvents } from '../../src/core/ics.js';
import { buildIndex, search } from '../../src/core/search.js';
import { exportBundle, preview, apply } from '../../src/core/sync/bundle.js';

const D = SRC.mpw.D, B = D.bloki;
const START = '2026-11-17', END = '2027-03-20', FREE = ['2026-12-24', '2026-12-25', '2026-12-26', '2026-12-27', '2027-02-19', '2027-02-20'];

test('MPW: 354 bloki 1–354, 118 dni × 3 (A 15:30, B 16:30, C 17:30), dni wolne 24–27.12 i 19–20.02, egzamin 21.03.2027 11:00', () => {
  assert.equal(B.length, 354);
  assert.deepEqual(B.map(b => b.nr), [...Array(354)].map((_, i) => i + 1));
  assert.deepEqual([D.stat.start, D.stat.end, SRC.mpw.exam, SRC.mpw.examTime], [START, END, '2027-03-21', '11:00']);
  assert.deepEqual(Object.keys(mpwByDay), [...range(START, END)].filter(d => !FREE.includes(d)));
  assert.deepEqual(mpwFreeDays(), [['2026-12-24', '2026-12-27'], ['2027-02-19', '2027-02-20']]);
  for (const b of B) assert.equal(b.dzien, dayName(b.data), `nr ${b.nr}`);
  for (const [d, list] of Object.entries(mpwByDay)) {
    assert.equal(list.map(b => b.blok).join(''), 'ABC', d);
    const sim = D.mockCFA.includes(d);
    assert.deepEqual(list.map(b => b.godz), sim ? ['15:30–16:30', '16:30–17:30', '17:30–18:30'] : ['15:30–16:23', '16:30–17:23', '17:30–18:23'], d);
  }
  assert.ok(B.every(b => b.egzamin === 'MPW'));
  assert.ok(MPW_BLOCKS >= B.length, 'plan mieści się w limicie walidacji');
});

test('MPW: statystyki, fazy i symulacje zgodne z blokami', () => {
  const count = key => B.reduce((m, b) => ((m[b[key]] = (m[b[key]] || 0) + 1), m), {});
  assert.deepEqual(count('kategoria'), D.stat.kat);
  assert.deepEqual(count('tryb'), D.stat.tryb);
  assert.equal(D.stat.dni, Object.keys(mpwByDay).length);
  for (const f of Object.values(D.faza)) assert.equal(B.filter(b => b.data >= f.od && b.data <= f.do).length, f.bl);
  assert.equal(D.mockCFA.length, 6);
  for (const d of D.mockCFA) { assert.ok(mpwByDay[d].every(b => b.tryb === 'SYMULACJA'), d); assert.match(D.simTest[d], /^\d\d\.\d\d\.\d{4}$/); }
  assert.equal(B.filter(b => b.tryb === 'SYMULACJA').length, 18);
  // Źródła pierwszego przejścia: każdy blok FP dokładnie w jednym źródle
  const src = mpwSources();
  assert.equal(src.reduce((n, s) => n + s.nrs.length, 0), D.stat.kat['Prawo MPW'] + D.stat.kat['Literatura MPW']);
  assert.ok(B.filter(b => b.data > D.fpEnd).every(b => !b.tryb.endsWith('FIRST PASS')), 'pierwsze przejście do fpEnd');
});

test('mpw.done i mpw.err.*: walidacja, stan niezależny od CFA (ten sam numer bloku), LWW, usunięcie wpisu', async () => {
  const ev = (t, d) => ({ id: `${t}:x`, hlc: '1790000000000:0000:dtest', dev: 'dtest', t, d, v: 1 });
  assert.equal(validateEvent(ev('mpw.done', { block: 354, done: true })), null);
  assert.ok(validateEvent(ev('mpw.done', { block: MPW_BLOCKS + 1, done: true })));
  assert.ok(validateEvent(ev('mpw.done', { block: 0, done: true })));
  assert.equal(validateEvent(ev('mpw.err.put', { id: 'e_1', data: { egz: 'MPW', temat: 'x' } })), null);
  assert.equal(validateEvent(ev('mpw.err.del', { id: 'e_1' })), null);
  const s = await new Store(new MemoryAdapter()).open();
  assert.deepEqual([s.state.mpwDone.size, s.state.mpwErrors], [0, []]);
  await s.record('mpw.done', { block: 1, done: true });
  await s.record('cfa.done', { block: 2, done: true });
  assert.deepEqual([[...s.state.mpwDone], [...s.state.cfaDone]], [[1], [2]]);
  await s.record('mpw.done', { block: 1, done: false });
  await s.record('mpw.err.put', { id: 'e_1', data: { egz: 'MPW', temat: 'KSH', rodzaj: 'pośpiech' } });
  await s.record('cfa.err.put', { id: 'e_1', data: { egz: 'CFA', temat: 'FI' } });
  assert.equal(s.state.mpwDone.size, 0);
  assert.deepEqual(s.state.mpwErrors.map(e => e.temat), ['KSH']);
  assert.deepEqual(s.state.cfaErrors.map(e => e.temat), ['FI'], 'ten sam identyfikator wpisu w obu planach — osobne rekordy');
  await s.record('mpw.err.del', { id: 'e_1' });
  assert.deepEqual([s.state.mpwErrors.length, s.state.cfaErrors.length], [0, 1]);
});

test('Zakładka: CFA do 11.11.2026, od 12.11.2026 MPW (koniec planu CFA); w grupie „Nauka” moduł z zakładką pierwszy', () => {
  assert.equal(byId.cfa.tabUntil, SRC.cfa.D.stat.end);
  assert.equal(byId.mpw.tabFrom, addDays(SRC.cfa.D.stat.end, 1));
  const tabs = d => modulesOn(d).filter(m => m.tab).map(m => m.id);
  const nauka = d => modulesOn(d).filter(m => m.group === 'Nauka').map(m => m.id);
  assert.deepEqual(tabs('2026-09-29'), ['dzis', 'dieta', 'trening', 'cfa']);
  assert.deepEqual(tabs('2026-11-11'), ['dzis', 'dieta', 'trening', 'cfa']);
  assert.deepEqual(tabs('2026-11-12'), ['dzis', 'dieta', 'trening', 'mpw']);
  assert.deepEqual(tabs('2027-04-01'), ['dzis', 'dieta', 'trening', 'mpw']);
  assert.deepEqual([nauka('2026-10-01'), nauka('2026-11-12')], [['cfa', 'mpw'], ['mpw', 'cfa']]);
  assert.equal(modulesOn('2026-11-12').length, 12);
  assert.ok(!isTab(byId.mpw, '2026-11-11') && isTab(byId.mpw, '2026-11-12'));
});

test('Dzień z MPW: bloki w resolverze, szablon godzin bez zmian (decyzja 29.09.2026), symulacja', () => {
  const r = resolveDay('2026-11-17'), ref = resolveDay('2026-11-10');   // oba wtorki, 10.11 — jeszcze CFA
  assert.deepEqual([r.mpw.inPlan, r.mpw.blocks.map(b => b.nr), r.mpw.isSim], [true, [1, 2, 3], false]);
  assert.deepEqual(r.slots.map(s => `${s.id} ${s.from}–${s.to}`), ref.slots.map(s => `${s.id} ${s.from}–${s.to}`));
  assert.ok(!JSON.stringify(r.slots).includes('MPW'), 'bloki MPW nie trafiają do slotów');
  assert.equal(resolveDay('2027-01-23').mpw.isSim, true);
  assert.deepEqual([resolveDay('2026-12-25').mpw.inPlan, resolveDay('2026-12-25').mpw.blocks.length], [true, 0]);
  assert.deepEqual([resolveDay('2026-11-16').mpw.inPlan, resolveDay('2027-03-21').mpw.inPlan], [false, false]);
});

test('Wymaga uwagi: CFA do egzaminu CFA (12.11), potem zaległe bloki MPW', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  const ids = d => attention(s.state, { today: d }).map(x => x.id);
  assert.ok(ids('2026-11-11').includes('cfa') && !ids('2026-11-11').includes('mpw'));
  assert.ok(!ids('2026-11-18').includes('cfa') && !ids('2026-11-18').includes('recall'));
  const mpw = attention(s.state, { today: '2026-11-20' }).find(x => x.id === 'mpw');
  assert.equal(mpw.text, `Zaległe bloki MPW: ${cfaPace(B, new Set(), '2026-11-20').overdue.length}`);
  assert.equal(mpw.href, '#/mpw?v=harmonogram&zal=1');
  await s.recordMany(B.filter(b => b.data < '2026-11-20').map(b => ['mpw.done', { block: b.nr, done: true }]));
  assert.ok(!ids('2026-11-20').includes('mpw'));
});

test('.ics: bloki MPW w godzinach planu MPW; symulacja jako jedno wydarzenie 15:30–18:30', () => {
  const NOW = new Date('2026-11-01T12:00:00Z');
  const day = planEvents('2026-11-17', ['mpw'], NOW).join('\n');
  assert.equal((day.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.match(day, /DTSTART;TZID=Europe\/Warsaw:20261117T153000/);
  assert.match(day, /DTEND;TZID=Europe\/Warsaw:20261117T182300/);
  assert.match(day, /UID:2026-11-17-mpw-A@p2027/);
  const sim = planEvents('2027-01-23', ['mpw'], NOW).join('\n');
  assert.equal((sim.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(sim, /SUMMARY:Symulacja egzaminu MPW/);
  assert.match(sim, /DTEND;TZID=Europe\/Warsaw:20270123T183000/);
  assert.equal(planEvents('2026-11-17', ['cfa'], NOW).length, 0, 'bez bloków CFA po 11.11');
});

test('⌘K: bloki MPW i error log MPW', () => {
  const idx = buildIndex({ mpwErrors: [{ id: 'e1', temat: '[TEST] próg wezwania', rodzaj: 'pośpiech' }] }, '2026-11-17');
  assert.ok(search(idx, 'kodeks cywilny zdolnosc prawna').some(x => x.kind === 'mpw' && x.href === '#/mpw?v=dzien&d=2026-11-17'));
  assert.ok(search(idx, 'prog wezwania').some(x => x.kind === 'mpwerr' && x.href === '#/mpw?v=log'));
  assert.ok(search(idx, 'mpw').some(x => x.kind === 'mod'));
});

test('Synchronizacja plikiem: postęp i error log MPW między urządzeniami (format 2027-sync bez zmian), import idempotentny', async () => {
  const phone = await new Store(new MemoryAdapter()).open(), mac = await new Store(new MemoryAdapter()).open();
  await phone.recordMany([['mpw.done', { block: 1, done: true }], ['mpw.err.put', { id: 'e_p', data: { egz: 'MPW', temat: '[TEST] A' } }]]);
  await mac.record('mpw.done', { block: 2, done: true });
  const rt = o => JSON.parse(JSON.stringify(o));
  const file = rt(await exportBundle(phone));
  assert.deepEqual(Object.keys(file).sort(), ['count', 'device', 'events', 'exportedAt', 'format', 'schema', 'sha256']);
  await apply(mac, await preview(mac, file));
  await apply(phone, await preview(phone, rt(await exportBundle(mac))));
  assert.deepEqual([[...phone.state.mpwDone].sort(), [...mac.state.mpwDone].sort()], [[1, 2], [1, 2]]);
  assert.deepEqual(mac.state.mpwErrors.map(e => e.temat), ['[TEST] A']);
  assert.equal((await preview(mac, file)).fresh.length, 0);
});
