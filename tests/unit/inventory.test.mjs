import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { preview, apply } from '../../src/core/sync/bundle.js';
import { stockAt, forecast, status, statusInfo, shoppingList, nextShopping, allItems, setCustomItems, lastOperation, undoOperation, restoreRows } from '../../src/core/calc/inventory.js';
import { reduce } from '../../src/core/storage/store.js';
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
  // wtorek 20.10 – sobota 24.10.2026: T, T, NT (czwartek), NT (23.10 bez treningu, D-103), T
  const s = await new Store(new MemoryAdapter()).open();
  await s.record('inv.count', { prod: 'banan', qty: 240, date: '2026-10-20' });
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-21'), 120);
  await s.record('inv.move', { prod: 'banan', qty: 600, date: '2026-10-21', kind: 'purchase' });
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-21'), 720);
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-22'), 720, 'czwartek bez banana');
  await s.record('inv.count', { prod: 'banan', qty: 100, date: '2026-10-22' });
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-23'), 100, '23.10 — dzień NT, bez banana (D-103)');
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-24'), -20, 'sobota — dzień T');
});

test('prognoza uwzględnia czwartki i fazy', async () => {
  const fc = forecast('banan', 240, '2026-10-20');
  assert.equal(fc.lastCovered, '2026-10-24', '21.10 i 24.10 po 120 g, 22.10 (czw) i 23.10 (bez treningu) bez banana');
  assert.equal(fc.runOut, '2026-10-25');
  assert.equal(fc.days, 4);
  const oats = forecast('platki_owsiane', 70 * 25, '2026-10-01');   // 18.10–11.11: 25 dni × 70 g (D-103c: dieta od 18.10; Faza 0 do 11.11, D-103)
  assert.equal(oats.runOut, '2026-11-12', 'od 12.11 (Faza 1) porcja 85 g');
  assert.equal(oats.lastCovered, '2026-11-11');
});

test('start planu i diety 18.10.2026 (D-102, D-103c): brak zużycia przed startem (także 15–17.10); 18.10 niedziela z basenem (dzień T)', async () => {
  const fc = forecast('banan', 240, '2026-10-05');
  assert.equal(fc.lastCovered, '2026-10-19', '06–15.10 poza planem, 16–17.10 dni NT (bez banana, D-103b), 18.10 i 19.10 po 120 g (dzień T)');
  assert.equal(fc.runOut, '2026-10-20');
  const s = await new Store(new MemoryAdapter()).open();
  await s.record('inv.count', { prod: 'kefir', qty: 1000, date: '2026-10-05' });
  assert.equal(stockAt(s.state.inv, 'kefir', '2026-10-07'), 1000, 'inwentaryzacja z 05.10 bez odliczeń do 07.10 (poza planem)');
  assert.equal(stockAt(s.state.inv, 'kefir', '2026-10-14'), 1000, 'do 14.10 poza planem — historia (D-102)');
  assert.equal(stockAt(s.state.inv, 'kefir', '2026-10-15'), 1000, '15.10 — poza planem (D-103b)');
  assert.equal(stockAt(s.state.inv, 'kefir', '2026-10-16'), 1000, '16.10 — dzień nietreningowy, bez kefiru (D-103)');
  assert.equal(stockAt(s.state.inv, 'kefir', '2026-10-17'), 1000, '17.10 — wyjątkowo bez treningu, dzień NT (D-103b)');
  assert.equal(stockAt(s.state.inv, 'kefir', '2026-10-18'), 800, '18.10 — niedziela z basenem, dzień T');
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
  // D-103, D-103b: pierwsze zakupy 22.10 (15.10 usunięty z kalendarza), 22 i 29.10 zakupy 17:45–18:40 bez sauny; 05.11 i 24.12 bez zakupów; kolejne czwartki do 06.01 (także 12.11) — 19:05–20:35 po saunie
  const thuZl = { from: '17:45', to: '18:40' }, thuNoJ = { from: '19:05', to: '20:35' }, jan = { from: '15:30', to: '16:00' };
  assert.deepEqual(nextShopping('2026-09-29', 10), { date: '2026-10-22', inDays: 23, ...thuZl }, 'dni przed 16.10 wykreślone z kalendarza');
  assert.deepEqual(nextShopping('2026-10-12', 10), { date: '2026-10-22', inDays: 10, ...thuZl }, '15.10 usunięty z kalendarza (D-103b) — pierwsze zakupy 22.10');
  assert.deepEqual(nextShopping('2026-10-15', 10), { date: '2026-10-22', inDays: 7, ...thuZl });
  assert.deepEqual(nextShopping('2026-10-22', 18, 39), { date: '2026-10-22', inDays: 0, ...thuZl }, 'do końca slotu 17:45–18:40 — dziś');
  assert.deepEqual(nextShopping('2026-10-29', 20), { date: '2026-11-12', inDays: 14, ...thuNoJ }, '05.11 bez zakupów — następne 12.11 (nominalnie, 19:05–20:35)');
  assert.deepEqual(nextShopping('2026-11-11', 10), { date: '2026-11-12', inDays: 1, ...thuNoJ });
  assert.deepEqual(nextShopping('2026-11-12', 20, 35), { date: '2026-11-19', inDays: 7, ...thuNoJ });
  assert.deepEqual(nextShopping('2026-10-16', 10), { date: '2026-10-22', inDays: 6, ...thuZl }, 'piątek i sobota bez zakupów');
  assert.deepEqual(nextShopping('2026-10-22', 18, 41), { date: '2026-10-29', inDays: 7, ...thuZl }, 'po zakupach 22.10 — kolejne 29.10');
  assert.deepEqual(nextShopping('2026-12-23', 10), { date: '2027-01-07', inDays: 15, ...jan }, '24.12 i 31.12 bez zakupów (D-103, D-109) — następne 07.01');
  assert.deepEqual(nextShopping('2026-12-17', 20, 36), { date: '2027-01-07', inDays: 21, ...jan }, 'po zakupach 17.12 — następne dopiero 07.01 (D-109)');
  assert.deepEqual(nextShopping('2026-12-17', 19), { date: '2026-12-17', inDays: 0, ...thuNoJ }, '17.12 — ostatnie zakupy przed świętami');
  assert.deepEqual(nextShopping('2027-01-05', 8), { date: '2027-01-07', inDays: 2, ...jan });
  assert.deepEqual(nextShopping('2027-01-07', 15, 59), { date: '2027-01-07', inDays: 0, ...jan });
  assert.deepEqual(nextShopping('2027-01-07', 16), { date: '2027-01-14', inDays: 7, ...jan });
  assert.equal(nextShopping('2027-03-26', 9).date, '2027-04-01', 'po końcu planu — kolejny czwartek (bez godzin)');
});

test('lista zakupów: maxLimit, pełne opakowania, pomija suplementy czasowe i cynk', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  // tydzień bez wyjątków dat i bez zmiany fazy (wtorek 17.11 – poniedziałek 23.11; Faza 1 od 12.11 do 10.12)
  await s.record('inv.count', { prod: 'kefir', qty: 0, date: '2026-11-17' });
  await s.record('inv.count', { prod: 'glukozamina', qty: 0, date: '2026-11-17' });
  const list = shoppingList(s.state.inv, '2026-11-17', allItems());
  const kefir = list.find(x => x.id === 'kefir');
  assert.equal(kefir.raw, 1200, '7 dni: 6 dni po 200 ml (czwartek bez kefiru)');
  assert.equal(kefir.packs, 3);
  assert.equal(kefir.toBuy, 1200);
  assert.ok(!list.some(x => x.id === 'glukozamina' || x.id === 'cynk'));
});

test('D-104: skyr 75 g (śniadanie + lunch) — zużycie 150 g dziennie w prognozie, liście zakupów i limicie zapasu', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  assert.equal(catalogById.skyr.daily_v31, 150);
  assert.equal(catalogById.skyr.maxLimit, 1800, '12 dni × 150 g');
  // 1200 g (3 opakowania po 400 g) starcza na 8 dni po 150 g (wtorek 20.10 → wtorek 27.10), a nie na 6 dni po 200 g
  const fc = forecast('skyr', 1200, '2026-10-19');
  assert.equal(fc.days, 8);
  assert.equal(fc.lastCovered, '2026-10-27');
  assert.equal(fc.runOut, '2026-10-28');
  // lista zakupów: cel 7 dni = 1050 g → 3 pełne opakowania (1200 g) w limicie 1800 g (było 4 opakowania po 200 g dziennie)
  await s.record('inv.count', { prod: 'skyr', qty: 0, date: '2026-10-19' });
  const sk = shoppingList(s.state.inv, '2026-10-19', allItems()).find(x => x.id === 'skyr');
  assert.deepEqual([sk.raw, sk.packs, sk.toBuy, sk.overLimit ?? false], [1050, 3, 1200, false]);
  // stan 1800 g = limit: nic do kupienia
  await s.record('inv.count', { prod: 'skyr', qty: 1800, date: '2026-10-19' });
  assert.ok(!shoppingList(s.state.inv, '2026-10-19', allItems()).some(x => x.id === 'skyr' && x.toBuy > 0));
});

// B1 (audyt 23.10.2026): „Cofnij” w Zapasach — operacja (także zbiorcza) cofana tak, jakby jej nie było; bez przełączania tam i z powrotem
test('B1: cofnięcie pomyłki w stanie — stan z poprzedniej inwentaryzacji minus zużycie od niej; drugie „Cofnij” sięga dalej', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  const use = d => consumptionForDay(d).banan || 0;
  await s.record('inv.count', { prod: 'banan', qty: 1000, date: '2026-10-26' });
  const expected = 1000 - use('2026-10-27') - use('2026-10-28') - use('2026-10-29');
  assert.equal(expected, 760, 'wt i śr po 120 g, czwartek 29.10 bez banana (NT)');
  await s.record('inv.count', { prod: 'banan', qty: 5, date: '2026-10-29' });   // pomyłka
  let op = lastOperation(s.allEvents());
  assert.deepEqual(op.events.map(e => e.d.qty), [5]);
  let u = undoOperation(s.state.inv, op, '2026-10-29');
  assert.deepEqual(u.list, [['inv.count', { prod: 'banan', qty: 760, date: '2026-10-29', undo: op.key }]]);
  await s.recordMany(u.list);
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-29'), 760, 'po „Cofnij” — 760 g (wcześniej 1000 g)');
  op = lastOperation(s.allEvents());
  assert.deepEqual(op.events.map(e => e.d.qty), [1000], 'drugie „Cofnij” = wcześniejsza operacja, nie ponowna pomyłka');
  u = undoOperation(s.state.inv, op, '2026-10-29');
  assert.deepEqual(u.unknown, ['banan'], 'pierwsza inwentaryzacja — brak wcześniejszego stanu');
  await s.recordMany(u.list);
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-29'), 760, 'pozycja bez wcześniejszego stanu — stan bez zmian');
  assert.equal(lastOperation(s.allEvents()), null, 'wszystko cofnięte — „Cofnij” nieaktywne');
});

test('B1: zakup z wcześniejszą datą cofany ruchem z tą samą datą; korekta dnia — odwrotną korektą', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  const use = d => consumptionForDay(d).banan || 0;
  await s.record('inv.count', { prod: 'banan', qty: 500, date: '2026-10-26' });
  await s.record('inv.move', { prod: 'banan', qty: 1200, date: '2026-10-27', kind: 'purchase' });   // wpisany później, z datą 27.10
  const base = 500 - use('2026-10-27') - use('2026-10-28') - use('2026-10-29');
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-29'), base + 1200);
  let op = lastOperation(s.allEvents());
  let u = undoOperation(s.state.inv, op, '2026-10-29');
  assert.deepEqual(u.list, [['inv.move', { prod: 'banan', qty: -1200, date: '2026-10-27', kind: 'adjust', undo: op.key }]]);
  await s.recordMany(u.list);
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-29'), base);
  await s.record('inv.dayshift', { date: '2026-10-29', dir: -1 });
  op = lastOperation(s.allEvents());
  assert.equal(op.events[0].t, 'inv.dayshift');
  await s.recordMany(undoOperation(s.state.inv, op, '2026-10-29').list);
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-29'), base, 'korekta dnia cofnięta');
});

test('B1: zapis zbiorczy (wspólne `op`) cofany w całości; pole `op`/`undo` nie zmienia stanu', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  await s.recordMany([['inv.count', { prod: 'banan', qty: 900, date: '2026-10-26' }], ['inv.count', { prod: 'kefir', qty: 2000, date: '2026-10-26' }]]);
  const before = ['banan', 'kefir', 'skyr'].map(p => stockAt(s.state.inv, p, '2026-10-28'));
  await s.recordMany(['banan', 'kefir', 'skyr'].map(p => ['inv.count', { prod: p, qty: 0, date: '2026-10-28', op: 'op:test' }]));   // „Zeruj stany”
  assert.deepEqual(['banan', 'kefir', 'skyr'].map(p => stockAt(s.state.inv, p, '2026-10-28')), [0, 0, 0], 'pole `op` nie wpływa na stan');
  const op = lastOperation(s.allEvents());
  assert.equal(op.key, 'op:test');
  assert.equal(op.events.length, 3, 'cała operacja, nie ostatnia pozycja');
  const u = undoOperation(s.state.inv, op, '2026-10-28');
  assert.deepEqual(u.unknown, ['skyr']);
  await s.recordMany(u.list);
  assert.deepEqual(['banan', 'kefir'].map(p => stockAt(s.state.inv, p, '2026-10-28')), before.slice(0, 2), 'stany sprzed zerowania');
  assert.equal(stockAt(s.state.inv, 'skyr', '2026-10-28'), 0, 'skyr bez wcześniejszego stanu — bez zmian');
  const next = lastOperation(s.allEvents());
  assert.deepEqual(next.events.map(e => [e.d.prod, e.d.qty]), [['kefir', 2000]], 'następne „Cofnij” — ostatnia wcześniejsza operacja (zapis bez `op` = osobne operacje)');
});

test('B1: stos cofnięć — zakup cofany po cofnięciu późniejszej pomyłki (późniejsza inwentaryzacja nie przesłania cofnięcia)', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  const use = d => consumptionForDay(d).banan || 0;
  await s.record('inv.count', { prod: 'banan', qty: 500, date: '2026-10-26' });
  await s.record('inv.move', { prod: 'banan', qty: 1200, date: '2026-10-27', kind: 'purchase' });
  await s.record('inv.count', { prod: 'banan', qty: 5, date: '2026-10-29' });   // pomyłka
  const base = 500 - use('2026-10-27') - use('2026-10-28') - use('2026-10-29');
  for (let i = 0; i < 2; i++) await s.recordMany(undoOperation(s.state.inv, lastOperation(s.allEvents()), '2026-10-29').list);
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-29'), base, 'po dwóch „Cofnij”: bez pomyłki i bez zakupu');
  await s.recordMany(undoOperation(s.state.inv, lastOperation(s.allEvents()), '2026-10-29').list);
  assert.equal(stockAt(s.state.inv, 'banan', '2026-10-29'), base, 'trzecie „Cofnij” — pierwsza inwentaryzacja: bez wcześniejszego stanu, stan bez zmian');
  assert.equal(lastOperation(s.allEvents()), null);
});

test('U8 (audyt 23.10.2026): przywrócenie stanów Zapasów z kopii automatycznej — stan z kopii z odliczeniem zużycia do dziś, jedna operacja do cofnięcia', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  const use = (p, d) => consumptionForDay(d)[p] || 0;
  await s.recordMany([['inv.count', { prod: 'banan', qty: 1000, date: '2026-10-26' }], ['inv.count', { prod: 'kefir', qty: 2000, date: '2026-10-26' }]]);
  await s.backup('przed importem (sync)');
  const [bk] = await s.adapter.getBackups();
  // po kopii: import nadpisał banana, dodał stan pozycji nieobecnej w kopii; kefir bez zmian
  await s.recordMany([['inv.count', { prod: 'banan', qty: 5, date: '2026-10-28' }], ['inv.count', { prod: 'skyr', qty: 900, date: '2026-10-28' }]]);
  const items = allItems(), today = '2026-10-29';
  const rows = restoreRows(reduce(bk.events).inv, s.state.inv, items, today);
  const want = 1000 - use('banan', '2026-10-27') - use('banan', '2026-10-28') - use('banan', '2026-10-29');
  assert.deepEqual(rows.map(r => [r.it.id, r.from, r.to]), [['banan', 5 - use('banan', '2026-10-29'), want]], 'tylko banan: kefir bez zmian, skyr bez stanu w kopii');
  const op = 'op:test-u8';
  await s.recordMany(rows.map(r => ['inv.count', { prod: r.it.id, qty: r.to, date: today, op }]));
  assert.equal(stockAt(s.state.inv, 'banan', today), want);
  assert.equal(stockAt(s.state.inv, 'skyr', today), 900 - use('skyr', '2026-10-29'), 'pozycja bez stanu w kopii — bez zmian');
  assert.deepEqual(restoreRows(reduce(bk.events).inv, s.state.inv, items, today), [], 'po przywróceniu nic do zmiany');
  // „Cofnij” w Zapasach cofa przywrócenie jako całość
  const last = lastOperation(s.allEvents());
  assert.equal(last.key, op);
  await s.recordMany(undoOperation(s.state.inv, last, today).list);
  assert.equal(stockAt(s.state.inv, 'banan', today), 5 - use('banan', '2026-10-29'));
});
