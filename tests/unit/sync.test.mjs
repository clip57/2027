import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { exportBundle, preview, apply } from '../../src/core/sync/bundle.js';
import { cfaProgressEvents, cfaErrorLogEvents, parseCsv } from '../../src/core/migrate/cfa.js';
import { SRC } from '../../src/core/data.js';
import { sha256 } from '../../src/core/hash.js';

const open = async () => new Store(new MemoryAdapter()).open();
const roundTrip = o => JSON.parse(JSON.stringify(o));

test('iPhone ↔ Mac: wymiana plików scala dane obu urządzeń', async () => {
  const phone = await open(), mac = await open();
  await phone.record('cfa.done', { block: 1, done: true, plan: 15 });
  await mac.record('cfa.done', { block: 2, done: true, plan: 15 });
  await apply(mac, await preview(mac, roundTrip(await exportBundle(phone))));
  await apply(phone, await preview(phone, roundTrip(await exportBundle(mac))));
  assert.deepEqual([...phone.state.cfaDone].sort(), [1, 2]);
  assert.deepEqual([...mac.state.cfaDone].sort(), [1, 2]);
  assert.equal(phone.allEvents().length, mac.allEvents().length);
});

test('import idempotentny: ten sam plik drugi raz nic nie dodaje', async () => {
  const a = await open(), b = await open();
  await a.record('setting', { key: 'shopDay', value: 6 });
  const f = roundTrip(await exportBundle(a));
  assert.equal(await apply(b, await preview(b, f)), 1);
  const pv = await preview(b, f);
  assert.equal(pv.fresh.length, 0);
  assert.equal(await apply(b, pv), 0);
});

test('konflikt: ta sama pozycja zmieniona na obu urządzeniach — wygrywa późniejsza, deterministycznie', async () => {
  const a = await open(), b = await open();
  await a.record('train.set', { date: '2026-09-22', ex: 'ex.wt.1', set: 1, done: true, kg: 100 });
  await new Promise(r => setTimeout(r, 5));
  await b.record('train.set', { date: '2026-09-22', ex: 'ex.wt.1', set: 1, done: true, kg: 110 });
  const pvA = await preview(a, roundTrip(await exportBundle(b)));
  assert.equal(pvA.conflicts.length, 1);
  assert.equal(pvA.conflicts[0].winner, 'plik');
  await apply(a, pvA);
  await apply(b, await preview(b, roundTrip(await exportBundle(a))));
  assert.equal(a.state.train['2026-09-22|ex.wt.1|1'].kg, 110);
  assert.equal(b.state.train['2026-09-22|ex.wt.1|1'].kg, 110);
  assert.equal(a.state.superseded.length, 1, 'przegrana wersja zachowana');
});

test('plik zmieniony ręcznie lub uszkodzony jest odrzucany (suma kontrolna)', async () => {
  const a = await open(), b = await open();
  await a.record('cfa.done', { block: 1, done: true, plan: 15 });
  const f = roundTrip(await exportBundle(a));
  f.events[0].d.block = 2;
  const pv = await preview(b, f);
  assert.equal(pv.ok, false);
  assert.match(pv.errors.join(), /Suma kontrolna/);
  await assert.rejects(() => apply(b, pv));
});

test('nierozpoznany plik — jasny komunikat', async () => {
  const pv = await preview(await open(), { foo: 1 });
  assert.equal(pv.ok, false);
  assert.match(pv.errors[0], /Nie rozpoznano pliku/);
});

test('import tworzy kopię zapasową stanu sprzed importu', async () => {
  const a = await open(), b = await open();
  await b.record('cfa.done', { block: 9, done: true, plan: 15 });
  await a.record('cfa.done', { block: 1, done: true, plan: 15 });
  await apply(b, await preview(b, roundTrip(await exportBundle(a))));
  const backups = await b.adapter.getBackups();
  assert.equal(backups.length, 1);
  assert.equal(backups[0].events.length, 1);
});

test('CFA v3: postep-nauki.json i error-log.csv (średniki, cudzysłowy, BOM)', async () => {
  const s = await open();
  // R2: plik postępu bieżącego planu (wersja V44) — numery spoza planu pominięte
  const ev = cfaProgressEvents({ wersja: SRC.cfa.D.version, zapis: '2026-10-22T10:00:00.000Z', wykonane: [1, 2, 3, 999] });
  assert.equal(ev.length, 3);
  const csv = '\ufeffegzamin;data;temat_zrodlo;rodzaj_bledu;prawidlowa_regula\n"CFA";"2026-09-22";"QM; TVM";"pośpiech";"PV = FV/(1+r)^n, ""dokładnie"""\n';
  assert.deepEqual(parseCsv(csv)[1], ['CFA', '2026-09-22', 'QM; TVM', 'pośpiech', 'PV = FV/(1+r)^n, "dokładnie"']);
  const errs = await cfaErrorLogEvents(csv, sha256);
  assert.equal(await s.appendMany([...ev, ...errs], 'test'), 4);
  assert.equal(s.state.cfaErrors[0].temat, 'QM; TVM');
  assert.equal(await s.appendMany([...cfaProgressEvents({ wersja: SRC.cfa.D.version, zapis: '2026-10-22T10:00:00.000Z', wykonane: [1, 2, 3] })], 'test'), 0, 'idempotentne');
});

test('R2 (audyt 23.10.2026): postep-nauki.json z innego planu CFA zablokowany, z poprzedniej wersji przeliczony, bez wersji — z ostrzeżeniem', async () => {
  const { cfaProgressPlan, cfaProgressNotice } = await import('../../src/core/migrate/cfa.js');
  const D = SRC.cfa.D, s = await open();
  // inna wersja planu (np. V3 z D-101 — numeracja bloków niezgodna z V44)
  const v3 = { wersja: 'CFA_20261013_326_CUR265_P31_A12_M0610_V3', zapis: '2026-10-14T20:00:00.000Z', wykonane: [1, 2, 3] };
  assert.equal(cfaProgressPlan(v3).status, 'foreign');
  assert.throws(() => cfaProgressEvents(v3), /z planu „CFA_20261013_326_CUR265_P31_A12_M0610_V3”/);
  let pv = await preview(s, v3);
  assert.equal(pv.ok, false);
  assert.match(pv.errors.join(' '), /import zablokowany/);
  // plik bez wersji zapisany przed powstaniem bieżącego planu, bez daty, z numerami spoza planu
  for (const o of [{ zapis: '2026-10-10T10:00:00.000Z', wykonane: [1] }, { wykonane: [1] }, { zapis: '2026-10-20T10:00:00.000Z', wykonane: [1, D.bloki.length + 1] }]) {
    assert.equal(cfaProgressPlan(o).status, 'foreign', JSON.stringify(o));
    assert.equal((await preview(s, o)).ok, false);
  }
  // bieżący plan — bez ostrzeżenia; opis bloków do oznaczenia
  pv = await preview(s, { wersja: D.version, zapis: '2026-10-22T10:00:00.000Z', wykonane: [1, 2] });
  assert.equal(pv.ok, true);
  assert.equal(pv.notice.level, 'info');
  assert.match(pv.notice.text, /Bloki do oznaczenia: 2 — od nr 1 \(16\.10 A\) do nr 2 \(16\.10 B\)/);
  // plik bez wersji z okresu bieżącego planu — dozwolony z ostrzeżeniem
  pv = await preview(s, { zapis: '2026-10-22T10:00:00.000Z', wykonane: [1, 2] });
  assert.deepEqual([pv.ok, pv.notice.level, pv.fresh.length], [true, 'warn', 2]);
  assert.match(pv.notice.text, /bez oznaczenia wersji planu/);
  // poprzednia wersja planu (V43): numery przeliczone wg planu (`progressRequirements`) — blok V44 nr 210 odpowiada blokowi V43 nr 236
  assert.equal(D.previousVersion, 'CFA_20261016_SCHWESER2026_V43');
  assert.deepEqual(D.progressRequirements['210'], [236]);
  const v43 = { wersja: D.previousVersion, zapis: '2026-10-16T12:00:00.000Z', wykonane: [1, 236, 237] };
  assert.deepEqual(cfaProgressEvents(v43).map(e => e.d.block), [1, 210, 211]);
  assert.ok(cfaProgressEvents(v43).every(e => e.d.plan === 15));
  assert.match(cfaProgressNotice(v43).text, /przeliczony na bieżący plan/);
  await apply(s, await preview(s, v43));
  assert.deepEqual([...s.state.cfaDone].sort((a, b) => a - b), [1, 210, 211]);
});
