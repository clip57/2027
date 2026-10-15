import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { preview, apply } from '../../src/core/sync/bundle.js';
import { stockAt, forecast, status, statusInfo, shoppingList, nextShopping, allItems, setCustomItems } from '../../src/core/calc/inventory.js';
import { consumptionForDay } from '../../src/core/calc/consumption.js';
import { catalogById } from '../../src/core/data.js';

// Kopia użytkownika NIE jest w repozytorium (D-035) — test uruchamia się, gdy SOURCES_DIR ją zawiera.
const FILE = process.env.SOURCES_DIR && path.join(process.env.SOURCES_DIR, 'zapasy_kopia_2026-09-22.json');
const hasFile = FILE && fs.existsSync(FILE);

test('migracja kopii ZAPASY z 22.09: stany 1:1, odliczanie od następnego dnia planu (D-027, D-088)', { skip: !hasFile && 'brak pliku kopii w SOURCES_DIR' }, async () => {
  const backup = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const s = await new Store(new MemoryAdapter()).open();
  const pv = await preview(s, backup);
  assert.equal(pv.ok, true, pv.errors.join());
  assert.equal(pv.kind, 'zapasy-v31');
  assert.equal(pv.byType['inv.count'], 51 + 3);
  await apply(s, pv);
  for (const [id, qty] of Object.entries(backup.stocks)) assert.equal(stockAt(s.state.inv, id, '2026-09-22'), qty, id);
  for (const id of Object.keys(backup.stocks)) {
    const exp = Math.round((backup.stocks[id] - (consumptionForDay('2026-09-23')[id] || 0)) * 1e6) / 1e6;
    assert.equal(stockAt(s.state.inv, id, '2026-09-23'), exp, id);
  }
  assert.equal(stockAt(s.state.inv, 'glukozamina', '2026-09-22'), 180);
  // D-090: przyjmowanie od 27.09.2026 do 21.03.2027 (176 dni) przy stanie 180 / 360 z 22.09 — zostaje 4 / 8 kaps.
  assert.equal(stockAt(s.state.inv, 'glukozamina', '2026-09-26'), 180, 'przed 27.09 bez zużycia');
  assert.equal(stockAt(s.state.inv, 'glukozamina', '2027-03-21'), 4);
  assert.equal(stockAt(s.state.inv, 'chondroityna', '2027-03-21'), 8);
  assert.equal(stockAt(s.state.inv, 'glukozamina', '2027-03-31'), 4, 'po 21.03 bez zużycia');
  assert.equal(stockAt(s.state.inv, 'cynk', '2026-09-23'), null, 'cynk nieśledzony');
  assert.equal((await preview(s, backup)).fresh.length, 0, 'ponowny import niczego nie dodaje');
});

test('zakup po inwentaryzacji zwiększa stan; nowsza inwentaryzacja zastępuje starszą', async () => {
  // wtorek 20.10 – piątek 23.10.2026: bez wyjątków (T, T, NT, T)
  const s = await new Store(new MemoryAdapter()).open();
  await s.record('inv.count', { prod: 'banan', qty: 240, date: '2026-10-20' });
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-21'), 120);
  await s.record('inv.move', { prod: 'banan', qty: 600, date: '2026-10-21', kind: 'purchase' });
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-21'), 720);
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-22'), 720, 'czwartek bez banana');
  await s.record('inv.count', { prod: 'banan', qty: 100, date: '2026-10-22' });
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-23'), -20);
});

test('prognoza uwzględnia czwartki i fazy', async () => {
  const fc = forecast('banan', 240, '2026-10-20');
  assert.equal(fc.lastCovered, '2026-10-23', '21.10 i 23.10 po 120 g, 22.10 (czw) bez banana');
  assert.equal(fc.runOut, '2026-10-24');
  assert.equal(fc.days, 3);
  const oats = forecast('platki_owsiane', 70 * 8, '2026-10-01');   // 15–22.10: 8 dni × 70 g (D-102: dieta od 15.10; Faza 0 do 22.10)
  assert.equal(oats.runOut, '2026-10-23', 'od 23.10 (Faza 1) porcja 85 g');
  assert.equal(oats.lastCovered, '2026-10-22');
});

test('start planu i diety 15.10.2026 (D-102): brak zużycia przed startem; 15.10 dzień nietreningowy (bez banana i kefiru)', async () => {
  const fc = forecast('banan', 240, '2026-10-05');
  assert.equal(fc.lastCovered, '2026-10-17', '06–14.10 poza planem, 15.10 dzień NT (bez banana), 16.10 i 17.10 po 120 g (dzień T)');
  assert.equal(fc.runOut, '2026-10-18');
  const s = await new Store(new MemoryAdapter()).open();
  await s.record('inv.count', { prod: 'kefir', qty: 1000, date: '2026-10-05' });
  assert.equal(stockAt(s.state.inv, 'kefir', '2026-10-07'), 1000, 'inwentaryzacja z 05.10 bez odliczeń do 07.10 (poza planem)');
  assert.equal(stockAt(s.state.inv, 'kefir', '2026-10-14'), 1000, 'do 14.10 poza planem — historia (D-102)');
  assert.equal(stockAt(s.state.inv, 'kefir', '2026-10-15'), 1000, '15.10 — dzień NT, bez kefiru (D-102)');
  assert.equal(stockAt(s.state.inv, 'kefir', '2026-10-16'), 800, '16.10 — UPPER 2, dzień T');
});

test('statusy — klasyfikacja wg terminu przydatności (v31)', () => {
  const fresh = catalogById.banan, dry = catalogById.platki_owsiane;
  assert.equal(fresh.shelfLife, 'short');
  assert.equal(status(fresh, 100, { days: 1.9 }), 'CRITICAL');
  assert.equal(status(fresh, 100, { days: 3 }), 'WARNING');
  assert.equal(status(fresh, 100, { days: 4 }), 'OK', 'świeże: OK od 4 dni');
  assert.equal(status(dry, 100, { days: 6.9 }), 'CRITICAL');
  assert.equal(status(dry, 100, { days: 13 }), 'WARNING');
  assert.equal(status(dry, 100, { days: 14 }), 'OK');
  assert.equal(statusInfo(fresh, 0, { days: 0 }).badge, '⛔ BRAK (0)');
  assert.equal(statusInfo(fresh, 50, { days: 3 }).badge, '⚠️ Niski (2-3.9d)');
});

test('pozycje własne użytkownika zużywają się wg zużycia dziennego', async () => {
  setCustomItems([{ id: 'custom_x', daily_v31: 10 }]);
  const s = await new Store(new MemoryAdapter()).open();
  await s.record('inv.count', { prod: 'custom_x', qty: 100, date: '2026-09-22' });
  assert.equal(stockAt(s.state.inv, 'custom_x', '2026-09-25'), 70);
  setCustomItems([]);
});

test('statusy — progi v31 (suplementy i trwałe)', () => {
  const supp = catalogById.omega3, food = catalogById.platki_owsiane;
  assert.equal(status(supp, 10, { days: 9.9 }), 'CRITICAL');
  assert.equal(status(supp, 10, { days: 15 }), 'WARNING');
  assert.equal(status(supp, 10, { days: 20 }), 'OK');
  assert.equal(status(food, 10, { days: 6.9 }), 'CRITICAL');
  assert.equal(status(food, 10, { days: 13 }), 'WARNING');
  assert.equal(status(food, 0, { days: 0 }), 'CRITICAL');
  assert.equal(status(catalogById.cynk, null, null), 'UNTRACKED');
});

test('najbliższe zakupy wg planu dnia (D-097): czwartek po saunie 19:05–20:35, od 07.01 15:30–16:00; do końca slotu — dziś', () => {
  // D-101: 15.10, 22.10 i 29.10 zakupy 19:05–19:30; 05.11 bez zakupów; kolejne czwartki do 06.01 (także 12.11) — 19:05–20:35 po saunie
  const thu = { from: '19:05', to: '19:30' }, thuNoJ = { from: '19:05', to: '20:35' }, jan = { from: '15:30', to: '16:00' };
  assert.deepEqual(nextShopping('2026-09-29', 10), { date: '2026-10-15', inDays: 16, ...thu }, 'dni przed 12.10 wykreślone z kalendarza');
  assert.deepEqual(nextShopping('2026-10-12', 10), { date: '2026-10-15', inDays: 3, ...thu });
  assert.deepEqual(nextShopping('2026-10-15', 19, 29), { date: '2026-10-15', inDays: 0, ...thu });
  assert.deepEqual(nextShopping('2026-10-15', 19, 30), { date: '2026-10-22', inDays: 7, ...thu });
  assert.deepEqual(nextShopping('2026-10-29', 20), { date: '2026-11-12', inDays: 14, ...thuNoJ }, '05.11 bez zakupów — następne 12.11 (nominalnie, 19:05–20:35)');
  assert.deepEqual(nextShopping('2026-11-11', 10), { date: '2026-11-12', inDays: 1, ...thuNoJ });
  assert.deepEqual(nextShopping('2026-11-12', 20, 35), { date: '2026-11-19', inDays: 7, ...thuNoJ });
  assert.deepEqual(nextShopping('2026-10-16', 10), { date: '2026-10-22', inDays: 6, ...thu }, 'piątek i sobota bez zakupów');
  assert.deepEqual(nextShopping('2027-01-05', 8), { date: '2027-01-07', inDays: 2, ...jan });
  assert.deepEqual(nextShopping('2027-01-07', 15, 59), { date: '2027-01-07', inDays: 0, ...jan });
  assert.deepEqual(nextShopping('2027-01-07', 16), { date: '2027-01-14', inDays: 7, ...jan });
  assert.equal(nextShopping('2027-03-26', 9).date, '2027-04-01', 'po końcu planu — kolejny czwartek (bez godzin)');
});

test('lista zakupów: maxLimit, pełne opakowania, pomija suplementy czasowe i cynk', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  // tydzień bez wyjątków dat i bez zmiany fazy (wtorek 13.10 – wtorek 20.10; D-100)
  await s.record('inv.count', { prod: 'kefir', qty: 0, date: '2026-10-20' });
  await s.record('inv.count', { prod: 'glukozamina', qty: 0, date: '2026-10-20' });
  const list = shoppingList(s.state.inv, '2026-10-20', allItems());
  const kefir = list.find(x => x.id === 'kefir');
  assert.equal(kefir.raw, 1200, '7 dni: 6 dni po 200 ml (czwartek bez kefiru)');
  assert.equal(kefir.packs, 3);
  assert.equal(kefir.toBuy, 1200);
  assert.ok(!list.some(x => x.id === 'glukozamina' || x.id === 'cynk'));
});
