import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { exportBundle, preview, apply } from '../../src/core/sync/bundle.js';
import { cfaProgressEvents, cfaErrorLogEvents, parseCsv } from '../../src/core/migrate/cfa.js';
import { sha256 } from '../../src/core/hash.js';

const open = async () => new Store(new MemoryAdapter()).open();
const roundTrip = o => JSON.parse(JSON.stringify(o));

test('iPhone ↔ Mac: wymiana plików scala dane obu urządzeń', async () => {
  const phone = await open(), mac = await open();
  await phone.record('cfa.done', { block: 1, done: true });
  await mac.record('cfa.done', { block: 2, done: true });
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
  await a.record('cfa.done', { block: 1, done: true });
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
  await b.record('cfa.done', { block: 9, done: true });
  await a.record('cfa.done', { block: 1, done: true });
  await apply(b, await preview(b, roundTrip(await exportBundle(a))));
  const backups = await b.adapter.getBackups();
  assert.equal(backups.length, 1);
  assert.equal(backups[0].events.length, 1);
});

test('CFA v3: postep-nauki.json i error-log.csv (średniki, cudzysłowy, BOM)', async () => {
  const s = await open();
  const ev = cfaProgressEvents({ wersja: 'MASTER SCHEDULE FINAL', zapis: '2026-09-22T10:00:00.000Z', wykonane: [1, 2, 3, 999] });
  assert.equal(ev.length, 3);
  const csv = '\ufeffegzamin;data;temat_zrodlo;rodzaj_bledu;prawidlowa_regula\n"CFA";"2026-09-22";"QM; TVM";"pośpiech";"PV = FV/(1+r)^n, ""dokładnie"""\n';
  assert.deepEqual(parseCsv(csv)[1], ['CFA', '2026-09-22', 'QM; TVM', 'pośpiech', 'PV = FV/(1+r)^n, "dokładnie"']);
  const errs = await cfaErrorLogEvents(csv, sha256);
  assert.equal(await s.appendMany([...ev, ...errs], 'test'), 4);
  assert.equal(s.state.cfaErrors[0].temat, 'QM; TVM');
  assert.equal(await s.appendMany([...cfaProgressEvents({ zapis: '2026-09-22T10:00:00.000Z', wykonane: [1, 2, 3] })], 'test'), 0, 'idempotentne');
});
