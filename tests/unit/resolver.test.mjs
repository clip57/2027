import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDay, phaseFor, templateFor, dayPlan, mTrainDay } from '../../src/core/resolver.js';
import { SRC, mpwByDay } from '../../src/core/data.js';
import { range } from '../../src/core/dates.js';

// Od 21.09 — kilkanaście dni przed początkiem planu (18.10.2026, D-102, D-103c) — do kilku dni po końcu planu (28.03.2027) (D-088)
const ALL = [...range('2026-09-21', '2027-04-05')];
const PLAN0 = '2026-10-18', END = '2027-03-28';
const EXC = SRC.week.exceptions;
// Liczba slotów wg wariantu dnia: zwykły 34, niedziela „basen” 32, czwartek „czwartek” 30 (sauna i zakupy), „czwartek_k” 31 (wariant nieużywany od D-103b — dawniej 15.10), „czwartek_zl” 29 (22/29.10: bez sauny, zakupy 17:45–18:40,
// D-103), „czwartek_bz” 30 (24.12 bez zakupów, D-103), od 07.01 „czwartek_st” 32 (D-094, D-097); dni treningowe z blokiem M — 31 (D-103); dni z blokami K/L/M bez treningu — okno treningowe pomniejszone o bloki (D-103)
const SLOTS = { basen: 32, czwartek: 30, czwartek_k: 31, czwartek_zl: 29, czwartek_bz: 30, czwartek_st: 32 };
// dni bez treningu z blokami w oknie treningowym: 23.10, 03–11.11 (K, L, M) oraz — D-103b — 01.11, 02.11 (M): okno pomniejszone o bloki, liczba slotów zależy od dnia
const KL = ['2026-10-23', '2026-11-01', '2026-11-02', ...range('2026-11-03', '2026-11-11')];

test('fazy kalendarzowe D-017 (plan od 18.10.2026 — Faza 0 do 11.11 (treningi do 31.10, 01.11 i 02.11 wyjątkowo bez); Faza 1 12.11–10.12, Faza 2 od 11.12 — D-102, D-103, D-103b, D-103c)', () => {
  assert.equal(phaseFor('2026-09-21'), null);
  for (const d of ['2026-10-15', '2026-10-16', '2026-10-17']) assert.equal(phaseFor(d), null, `${d} poza planem (D-103c)`);
  assert.equal(phaseFor(PLAN0), 0);
  assert.equal(phaseFor('2026-10-22'), 0);
  assert.equal(phaseFor('2026-10-23'), 0);
  assert.equal(phaseFor('2026-11-02'), 0);
  assert.equal(phaseFor('2026-11-11'), 0);
  assert.equal(phaseFor('2026-11-12'), 1);
  assert.equal(phaseFor('2026-12-10'), 1);
  assert.equal(phaseFor('2026-12-11'), 2);
});

test('każdy dzień 21.09.2026–05.04.2027: sloty z godzinami szablonu — 34, niedziele 32, czwartki 30 / od 07.01 32, dni z blokiem M 31 (D-004, D-086, D-094, D-097, D-103)', () => {
  for (const d of ALL) {
    const r = resolveDay(d), v = dayPlan(d).variant;
    if (r.outside) assert.equal(v, null, d);
    if (!KL.includes(d)) assert.equal(r.slots.filter(s => !s.extra).length, mTrainDay(d) ? 31 : SLOTS[v] || 34, d);   // bez dodatkowych slotów bloków (D-099)
    if (!r.outside) assert.equal(v || null, { 4: EXC[d] && 'variant' in EXC[d] ? EXC[d].variant : d >= '2027-01-07' ? 'czwartek_st' : 'czwartek', 7: EXC[d] && 'variant' in EXC[d] ? EXC[d].variant : 'basen' }[r.weekday] || null, d);
    assert.equal(r.slots.filter(s => !s.extra).map(s => `${s.from}-${s.to}`).join(), templateFor(d).map(s => `${s.from}-${s.to}`).join(), d);
  }
});

test('typy dni i dieta T/NT (D-018)', () => {
  const exp = { 1: ['strength_sauna', 'T'], 2: ['strength', 'T'], 3: ['cardio_sauna', 'T'], 4: ['rest_sauna2', 'NT'], 5: ['strength', 'T'], 6: ['strength_sauna', 'T'], 7: ['swim', 'T'] };
  for (const d of ALL) {
    const r = resolveDay(d);
    if (d < PLAN0 || d > END) assert.deepEqual([r.outside, r.dayType, r.session, r.training], [true, 'free', null, null], d);   // D-088
    else if (EXC[d]?.dayType) assert.deepEqual([r.dayType, r.dietVariant], [EXC[d].dayType, EXC[d].diet || exp[r.weekday][1]], d);   // D-087
    else assert.deepEqual([r.dayType, r.dietVariant], exp[r.weekday], d);
  }
});

test('kcal dnia = RAZEM z właściwego PDF (skyr 75 g w śniadaniu i lunchu — D-104)', () => {
  assert.equal(resolveDay('2026-10-18').kcal, 2595); // nd 18.10: początek planu — basen, F0 T — pierwszy trening
  assert.equal(resolveDay('2026-10-20').kcal, 2595); // wt F0 T
  assert.equal(resolveDay('2026-10-22').kcal, 2298); // czw F0 NT
  assert.equal(resolveDay('2026-10-23').kcal, 2298); // pt 23.10 bez treningu (K i L w oknie treningowym): F0 NT
  assert.equal(resolveDay('2026-10-26').kcal, 2595); // pn F0 T (Faza 0 trwa do 11.11)
  assert.equal(resolveDay('2026-10-31').kcal, 2595); // sob 31.10: ostatni trening Fazy 0
  for (const d of ['2026-11-01', '2026-11-02']) assert.equal(resolveDay(d).kcal, 2298, d); // 01.11 i 02.11 wyjątkowo bez treningu (D-103b): F0 NT
  for (const d of ['2026-11-03', '2026-11-07', '2026-11-09', '2026-11-11']) assert.equal(resolveDay(d).kcal, 2298, d); // 03–11.11 bez treningu: dieta NT Fazy 0 (D-103)
  for (const d of ['2026-11-13', '2026-11-14', '2026-11-15']) assert.equal(resolveDay(d).kcal, 2750, d); // 13–15.11 nominalnie: F1 T
  assert.equal(resolveDay('2026-11-12').kcal, 2453, '12.11 — czwartek F1 NT (Faza 1 od 12.11)');
  assert.equal(resolveDay('2026-11-19').kcal, 2453); // czw F1 NT
  assert.equal(resolveDay('2026-11-23').kcal, 2750); // pn F1 T (Faza 2 dopiero od 11.12)
  assert.equal(resolveDay('2026-11-26').kcal, 2453); // czw F1 NT
  assert.equal(resolveDay('2026-12-10').kcal, 2453); // czw F1 NT — ostatni dzień Fazy 1
  assert.equal(resolveDay('2026-12-11').kcal, 2931); // pt F2 T — pierwszy dzień Fazy 2
  assert.equal(resolveDay('2026-12-17').kcal, 2634); // czw F2 NT
  for (const d of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']) assert.equal(resolveDay(d).outside, true, `${d}: przed początkiem planu (15–17.10 usunięte, D-103b, D-103c)`);
});

test('slot sauny: czwartek i dni bez sauny = „Wolne”; w dni z blokiem M (D-103) slotu sauny nie ma (D-018, D-101)', () => {
  const sauna = d => resolveDay(d).slots.find(s => s.id === 'slot.1945')?.title ?? null;
  assert.equal(sauna('2026-10-19'), null, 'poniedziałek 19.10: blok M 19:40 — bez sauny (D-103)');
  assert.equal(sauna('2026-10-20'), null, 'wtorek z blokiem M — slot sauny zastąpiony powrotem i prysznicem');
  assert.equal(sauna('2026-10-21'), null);
  assert.equal(sauna('2026-10-12'), 'Wolne', '12–15.10 — bez treningu i sauny (D-101)');
  assert.equal(resolveDay('2026-10-22').slots.some(s => s.id === 'slot.1755c'), false, 'czwartek 22.10 bez sauny (D-103): zakupy 17:45–18:40');
  assert.equal(resolveDay('2026-10-22').slots.find(s => s.id === 'slot.1745z').title, 'Zakupy');
  assert.equal(resolveDay('2026-10-15').slots.some(s => s.id === 'slot.1755c'), false, '15.10 — usunięty z kalendarza (D-103b): zwykły szablon poza planem');
  assert.equal(resolveDay('2026-11-05').slots.some(s => s.id === 'slot.1755c'), false, '05.11 — bez treningu i bez wariantu czwartkowego (D-101)');
  assert.equal(sauna('2026-10-15'), 'Wolne', '15.10 poza planem (D-103b) — szablon podstawowy, okno treningowe „Wolne”');
  for (const d of ['2026-10-16', '2026-10-17']) assert.equal(sauna(d), 'Wolne', `${d} — poza planem (D-103c): szablon podstawowy, bez przycinania pod bloki`);
  assert.equal(sauna('2026-10-24'), null, 'sobota 24.10: LOWER 2 z blokiem M — bez sauny (D-103)');
  assert.equal(sauna('2026-11-07'), null, '07.11 — bez treningu, okno zajęte przez blok M (D-103)');
  assert.equal(sauna('2026-10-23'), 'Wolne', '23.10 — bez treningu, bez bloku M (K i L wcześniej)');
  assert.equal(resolveDay('2026-11-12').slots.some(s => s.id === 'slot.1945'), false, '12.11 — nominalny czwartek (sauna 17:55–19:05)');
  assert.equal(resolveDay('2026-11-12').slots.find(s => s.id === 'slot.1755c').title, '2 rundy sauny wg protokołu', '12.11 — nominalnie, bez wyjątku (D-101)');
  assert.equal(resolveDay('2026-12-24').slots.find(s => s.id === 'slot.1755c').title, '2 rundy sauny wg protokołu', '24.12 — sauna zostaje, bez zakupów (D-103)');
  assert.equal(sauna('2026-11-13'), 'Wolne', '13.11 — UPPER 2 bez sauny (nominalnie)');
  assert.equal(sauna('2026-11-14'), 'Sauna', '14.11 — LOWER 2 + sauna (nominalnie, bez bloku M)');
  assert.equal(sauna('2026-11-16'), 'Sauna', '16.11 — UPPER 1 + sauna');
  assert.equal(resolveDay('2026-10-18').slots.some(s => s.id === 'slot.1945'), false, 'niedziela: relaks zamiast okna sauny (D-094)');
  assert.equal(resolveDay('2026-11-15').slots.some(s => s.id === 'slot.1945'), false, '15.11 — basen bez sauny (D-101)');
  assert.equal(sauna('2026-09-21'), 'Wolne', 'poza planem (D-088)');
});

test('posiłek potreningowy: 19:15 w dni z blokiem M (D-103), 20:15 w pozostałe; czwartek „Posiłek po saunie”, 114 kcal (w slocie zakupów do 06.01, od 07.01 po saunie); dni T 230 kcal', () => {
  const post = d => resolveDay(d).slots.find(s => s.id === 'slot.2015');
  const thu2 = resolveDay('2026-11-19').slots.find(s => s.id === 'slot.1905c').items.find(i => i.kind === 'meal');   // pozostałe czwartki: w slocie zakupów
  assert.deepEqual([thu2.text, thu2.kcal], ['Posiłek po saunie (20:15)', 114]);
  const thu3 = resolveDay('2026-10-22').slots.find(s => s.id === 'slot.2015z').items.find(i => i.kind === 'meal');   // 22/29.10 (D-103): posiłek 20:15 w slocie 20:15–20:35, bez sauny
  assert.deepEqual([thu3.text, thu3.kcal], ['Posiłek po saunie (20:15)', 114]);
  assert.equal(post('2027-01-07').mealName, 'Posiłek po saunie');
  assert.equal(post('2027-01-07').kcal, 114);
  assert.equal(post('2026-11-17').kcal, 230);   // wtorek bez bloku M — 20:15
  const m = resolveDay('2026-10-20').slots.find(s => s.id === 'slot.1915m');   // wtorek z blokiem M: posiłek potreningowy 19:15 (D-103)
  assert.deepEqual([m.from, m.to, m.mealName, m.kcal, m.items.find(i => i.kind === 'meal').text], ['19:15', '19:25', 'Posiłek potreningowy', 230, 'Posiłek potreningowy (19:15)']);
  assert.equal(resolveDay('2026-10-20').slots.some(s => s.id === 'slot.2015'), false);
});

test('suplementy: tauryna codziennie (D-014), cynk czw+nd, D-015 18.10.2026–28.03.2027; poza planem bez dawek (D-088, D-102, D-103c)', () => {
  for (const d of ALL) {
    const r = resolveDay(d);
    const s = r.doses.map(x => x.supp);
    if (d < PLAN0 || d > END) { assert.deepEqual(s, [], `${d}: poza planem bez dawek (D-088, D-102)`); continue; }
    assert.ok(s.includes('tauryna'), d);
    assert.equal(s.includes('cynk'), r.weekday === 4 || r.weekday === 7, d);
    const on = d >= PLAN0 && d <= END;
    for (const t of ['boswellia', 'glukozamina']) assert.equal(s.includes(t), on, `${t} ${d}`);
    assert.equal(s.filter(x => x === 'chondroityna').length, on ? 2 : 0, d);
    assert.equal(s.filter(x => x === 'witamina_c').length, 3, d);
  }
});

test('suplementy przypięte do slotów wg godziny', () => {
  const r = resolveDay('2026-10-19');   // poniedziałek F1 (J-day): dawki przypięte do slotów wg godziny
  const at = id => r.slots.find(s => s.id === id).doses.map(d => d.supp).sort().join();
  assert.equal(at('slot.0853'), 'boswellia,d3_k2,omega3,witamina_c');
  assert.equal(at('slot.1010'), 'l_teanina');
  assert.equal(at('slot.1213'), '');
  assert.equal(at('slot.1220'), '');
  assert.equal(at('slot.1313'), 'glukozamina,witamina_c');
  assert.equal(at('slot.1640'), 'kolagen,tauryna,witamina_c');
  assert.equal(at('slot.2200'), 'glicyna,magnez_glicynian,melatonina');
  const total = r.slots.reduce((n, s) => n + s.doses.length, 0);
  assert.equal(total, r.doses.length, 'każda dawka w dokładnie jednym slocie');
});

test('CFA V3: bloki A–I w slotach szablonu, J / K / L / M jako dodatkowe sloty wg planu (D-099, D-101); mock w A–E, F wolne (D-019, D-036, D-086, D-093); czwartki od 07.01 — sloty MPW', () => {
  const CFA0 = SRC.cfa.D.stat.start;   // plan CFA V3 od 13.10 (D-101)
  const AG = ['08:00', '09:10', '10:10', '11:20', '12:20', '13:30', '14:30'];
  for (const d of ALL) {
    const r = resolveDay(d);
    const sat = false;
    const cfaSlots = r.slots.filter(s => s.role === 'cfa' && !s.extra), extraSlots = r.slots.filter(s => s.extra);   // J (21:00–21:53) — dodatkowy slot (D-099)
    assert.deepEqual(cfaSlots.map(s => s.from), dayPlan(d).variant === 'czwartek_st' ? [...AG, '16:00', '17:00', '18:00'] : [...AG, '15:30', '16:40'], d);
    const n = [...cfaSlots, ...extraSlots].reduce((a, s) => a + s.cfa.length, 0);
    if (d >= CFA0 && d <= '2026-11-11') assert.equal(n, SRC.cfa.D.bloki.filter(b => b.data === d).length, d); else assert.equal(n, 0, d);
    const extraLetters = [...new Set(r.cfa.blocks.filter(b => !/^[A-I]$|^S/.test(b.blok)).sort((a, b) => a.godz.localeCompare(b.godz)).map(b => b.blok))];
    assert.deepEqual(extraSlots.map(s => s.title), extraLetters.map(l => `CFA blok ${l}`), d);   // K 17:40, L 18:40, M 19:40, J 21:00 — wg planu
    if (d < CFA0) assert.ok(cfaSlots.every(s => s.title === 'Brak bloku CFA'), d);
    if (SRC.cfa.D.mockCFA.includes(d)) {
      assert.deepEqual(cfaSlots.slice(0, 4).map(s => s.title), ['Mock CFA — sesja 1', 'Mock CFA — sesja 1', 'Mock CFA — sesja 2', 'Mock CFA — sesja 2']);
      // E (12:20–13:13) = kontynuacja sesji 2 do 13:00 (D-086), F wolne (D-036)
      assert.deepEqual(cfaSlots.slice(4, 6).map(s => [s.title, s.desc]), [['Mock CFA — sesja 2', 'Kontynuacja sesji (10:45–13:00)'], ['Wolne', 'Dzień mocka — brak bloku w planie (D-036)']]);
      assert.deepEqual(cfaSlots.slice(6).map(s => s.title), ['CFA blok G', 'CFA blok H', 'CFA blok I']);
    } else if (d >= CFA0 && d <= '2026-11-11') {
      assert.deepEqual(cfaSlots.map(s => s.title), [...(sat ? 'ABCDFGHI' : 'ABCDEFGHI')].map(l => `CFA blok ${l}`), d);
    }
  }
});

test('CFA: każdy blok w slocie o godzinach z planu (D-086); sesje mocka w pierwszym slocie sesji', () => {
  let placed = 0;
  for (const d of range(SRC.cfa.D.stat.start, '2026-11-11')) {   // plan CFA od 13.10 (D-102: niezależnie od początku planu 15.10)
    const r = resolveDay(d);
    for (const s of r.slots.filter(x => x.role === 'cfa')) for (const b of s.cfa) {
      placed++;
      if (b.blok.startsWith('S')) assert.equal(s.id, b.blok === 'S1' ? 'slot.0800' : 'slot.1010', `${d} ${b.nr}`);
      else assert.equal(b.godz, `${s.from}–${s.to}`, `${d} ${b.nr}`);
    }
    assert.deepEqual(r.cfa.blocks.map(b => b.nr), SRC.cfa.D.bloki.filter(b => b.data === d).map(b => b.nr), d);
  }
  assert.equal(placed, SRC.cfa.D.bloki.length, 'wszystkie bloki planu w planie dnia');
});

test('posiłki i suplementy w dniu mocka bez zmian godzin (D-019)', () => {
  const a = resolveDay('2026-11-10'), b = resolveDay('2026-11-03');   // wtorek z mockiem (D-093) i zwykły wtorek (oba bez treningu, dieta NT)
  const meals = r => r.slots.filter(s => s.role === 'meal').map(s => `${s.from}:${s.kcal}`).join();
  assert.equal(meals(a), meals(b));
  assert.deepEqual(a.doses.map(d => d.time + d.supp), b.doses.map(d => d.time + d.supp));
});

test('recall: sesje 22:00 wg harmonogramu CFA V44 (25 sesji), brak 15.10, 23.10, 25.10, przed startem planu CFA (16.10) i po 11.11 (D-086, D-101, D-103)', () => {
  let n = 0;
  const night = new Set(SRC.cfa.D.nightRecall.map(r => r.data));
  for (const d of ALL) {
    const r = resolveDay(d); if (r.cfa.recall) n++;
    assert.equal(r.cfa.recall, night.has(d), d);
    if (d < SRC.cfa.D.stat.start || d > '2026-11-11') assert.equal(r.cfa.recall, false, d);
  }
  for (const d of ['2026-10-15', '2026-10-23', '2026-10-25']) assert.equal(resolveDay(d).cfa.recall, false, d);
  assert.equal(resolveDay('2026-10-16').cfa.recall, true, 'piątek 16.10 z recall (pierwszy dzień V44, bez J)');
  assert.equal(n, 25);
  assert.equal(n, SRC.cfa.D.stat.recallEvening);
});

test('trening: liczba serii wg fazy', () => {
  const s = d => resolveDay(d).training.reduce((a, e) => a + e.seriesToday, 0);
  assert.equal(s('2026-10-19'), 10); // UPPER 1 F0 (poniedziałek 19.10)
  assert.equal(s('2026-10-26'), 10); // UPPER 1 nadal F0 (Faza 0 do 11.11, D-103)
  assert.equal(s('2026-10-30') > 0, true); // UPPER 2 F0 — ostatni piątek Fazy 0
  assert.equal(s('2026-11-16'), 18); // UPPER 1 F1 (Faza 1 od 12.11)
  assert.equal(s('2026-12-14'), 26); // UPPER 1 F2 (Faza 2 od 11.12)
  for (const d of ['2026-10-08', '2026-10-11', '2026-10-12', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-23', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-11']) assert.equal(resolveDay(d).training, null, `${d}: bez treningu (D-101, D-103, D-103b)`);
});

// --- Poprawki po teście akceptacyjnym (D-038, D-039, D-040, D-001)
import { cfaSourceLine } from '../../src/core/resolver.js';
const SUPP_WORDS = /chondroityn|cynk|boswelli|d3|omega|askorbinian|witamina c|l-teanin|glukozamin|kolagen|tauryn|kreatyn|glicyn|magnez|melatonin/i;

test('D-001: żaden widoczny podpunkt slotu nie powtarza suplementów (wszystkie dni)', () => {
  for (const d of ALL) for (const s of resolveDay(d).slots)
    for (const i of s.items) assert.ok(!SUPP_WORDS.test(i.text), `${d} ${s.from}: „${i.text}”`);
});

test('D-038: pomiar wagi i ciśnienia', () => {
  const t = resolveDay('2026-10-13').slots[0].items.map(i => i.text);
  assert.ok(t.includes('Pomiar wagi i ciśnienia na czczo po toalecie.'));
  assert.ok(!t.includes('Pomiar wagi na czczo po toalecie.'));
});

test('D-040: nazwa treningu w nagłówku dnia', () => {
  const exp = ['Poza planem', 'Poza planem', 'Poza planem', 'Poza planem', 'Poza planem', 'Basen', 'UPPER 1'];   // 13–17.10 przed początkiem planu (D-103c), początek planu i pierwszy trening 18.10 (w dni z blokiem M bez sauny, D-103)
  [...range('2026-10-13', '2026-10-19')].forEach((d, i) => assert.equal(resolveDay(d).sessionLabel, exp[i], d));
  assert.deepEqual(['2026-09-29', '2026-10-05', '2026-10-08', '2026-10-10', '2026-10-11', '2026-10-12', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'].map(d => resolveDay(d).sessionLabel),
    ['Poza planem', 'Poza planem', 'Poza planem', 'Poza planem', 'Poza planem', 'Poza planem', 'Bez treningu, 2 × sauna', 'UPPER 2', 'LOWER 2 + sauna', 'Basen']); // D-102: 12.10 poza planem, 12–15.11 nominalnie
});

test('D-039: linia źródła bloku CFA', () => {
  const a = resolveDay('2026-10-16').slots.find(s => s.id === 'slot.0800').cfa[0];   // pierwszy blok planu CFA V44: 16.10, 08:00 (D-103)
  assert.equal(cfaSourceLine(a), 'SchweserNotes 2026 Book 1 — QM, PDF 14–21 (8 s.); łącznie 8 s.');
  const p = resolveDay('2026-10-17').slots.find(s => s.id === 'slot.cfa.J').cfa[0];   // blok practice
  assert.equal(cfaSourceLine(p), 'CFAI LES — QM, 17 pytań: QM LM6 (R6): 6 pyt.; licznik 1–6/7; QM LM7 (R7): 11 pyt.; licznik 1–11/21');
});

test('podpunkty posiłków: nazwa i kcal z właściwej fazy i wariantu', () => {
  const lunch = d => resolveDay(d).slots.find(s => s.id === 'slot.1313').items.find(i => i.kind === 'meal');
  assert.equal(lunch('2026-10-20').kcal, 448, 'Faza 0: skyr 75 g (D-104) — 465 − 17 kcal');
  assert.equal(lunch('2026-10-27').kcal, 448, 'Faza 0 trwa do 11.11 (D-103)');
  assert.ok(lunch('2026-11-17').kcal > 448, 'Faza 1: większa porcja makaronu');
  const bf = d => resolveDay(d).slots.find(s => s.id === 'slot.0853').items.find(i => i.kind === 'meal');
  assert.equal(bf('2026-10-20').kcal, 612, 'śniadanie Faza 0: skyr 75 g (D-104) — 629 − 17 kcal');
  const post = resolveDay('2026-11-19').slots.find(s => s.id === 'slot.1905c').items.find(i => i.kind === 'meal');   // czwartek: w slocie zakupów (D-097)
  assert.deepEqual([post.text, post.kcal], ['Posiłek po saunie (20:15)', 114]);
});

test('D-088/D-102/D-103c: dni przed 18.10.2026 (historia, 15–17.10 usunięte) i po 28.03.2027 poza planem — ciągłość dat bez treningu, dawek i zużycia; 18.10 początkiem planu (pierwszy trening); plan CFA V44 (od 16.10) ma własny zakres', () => {
  for (const d of [...range('2026-01-01', '2026-10-17'), ...range('2027-03-29', '2027-04-30')]) {
    const r = resolveDay(d), cfa = d >= '2026-10-16' && d <= '2026-10-17';   // plan CFA V44 od 16.10 ma własny zakres (bloki i recall także w 16–17.10, które są już poza planem dnia, D-103c)
    assert.equal(r.outside, true, d);
    assert.deepEqual([r.training, r.doses.length, r.cfa.blocks.length > 0, r.cfa.recall, r.sauna, r.sessionName, r.noDiet], [null, 0, cfa, cfa, 0, 'Poza planem', false], d);
    assert.equal(r.slots.length >= 34, true, d);                           // szablon godzin bez zmian (ciągłość widoków); dodatkowe sloty bloków CFA
    assert.ok(r.slots.filter(s => s.domain === 'train').every(s => s.title === 'Wolne'), d);
    assert.deepEqual(r.meals.length, r.meals.length);
  }
  const s = resolveDay(PLAN0);
  assert.deepEqual([s.outside, s.dietVariant, s.noDiet, s.kcal > 0, s.phase, s.preStart, s.sessionLabel, s.cfa.inPlan], [false, 'T', false, true, 0, false, 'Basen', true]);   // 18.10 — początek planu (pierwszy trening: basen)
  assert.equal(resolveDay('2027-03-29').after, true);
  assert.equal(SRC.phases.start, PLAN0);
  assert.equal(resolveDay('2026-09-29').zero, false, 'Dzień zero 29.09 usunięty z kalendarza (D-100)');
  assert.equal(resolveDay('2026-10-13').cfa.inPlan, false, 'plan CFA V44 od 16.10 (D-103)');
  for (const d of ['2026-10-16', '2026-10-17']) assert.deepEqual([resolveDay(d).outside, resolveDay(d).cfa.inPlan, resolveDay(d).cfa.blocks.length, resolveDay(d).cfa.recall], [true, true, d === '2026-10-16' ? 9 : 11, true], `${d}: poza planem dnia, ale w planie CFA`);
});

test('D-102, D-103, D-103c: pierwszy tydzień planu 18–24.10.2026 — początek planu i treningów w niedzielę 18.10 (basen), UPPER 1 bez sauny w dni z blokiem M, 15–17.10 poza planem (plan CFA ma własny zakres od 16.10)', () => {
  const row = d => { const r = resolveDay(d); return [r.dayType, r.sessionLabel, r.dietVariant, (r.training || []).length > 0, r.sauna, r.noDiet]; };
  for (const d of ['2026-10-15', '2026-10-16', '2026-10-17']) assert.deepEqual(row(d).slice(0, 2), ['free', 'Poza planem'], `${d} usunięty z kalendarza (D-103b, D-103c)`);
  assert.deepEqual(row('2026-10-18'), ['swim', 'Basen', 'T', false, 0, false]);
  assert.deepEqual(row('2026-10-19'), ['strength_sauna', 'UPPER 1', 'T', true, 0, false]);
  assert.deepEqual(row('2026-10-22'), ['free', 'Bez treningu', 'NT', false, 0, false]);
  const main = d => resolveDay(d).slots.find(s => s.id.startsWith('slot.1815')).title;
  assert.deepEqual(['2026-10-14', '2026-10-17', '2026-10-18', '2026-10-19'].map(main), ['Wolne', 'Wolne', 'Basen 55 min', 'Trening siłowy: UPPER 1']);
  assert.ok(!['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'].some(d => resolveDay(d).slots.some(s => s.shop)));
  assert.ok(resolveDay('2026-10-22').slots.some(s => s.shop), '22.10 (czwartek) — pierwsze zakupy planu 17:45–18:40');
  assert.equal(resolveDay('2026-10-13').cfa.recall, false, 'przed planem CFA V44 — bez recall');
  for (const d of ['2026-10-16', '2026-10-17', '2026-10-18']) assert.equal(resolveDay(d).cfa.recall, true, `${d}: recall CFA od 16.10`);
  assert.equal(resolveDay('2026-10-15').cfa.recall, false, '15.10 — przed planem CFA');
});

// Dodatkowe sloty bloków wypełniają „dziury” w szablonie: slot może kończyć się tam, gdzie zaczyna się następny, albo tuż przed blokami, które ten odstęp zajmują (D-099, D-103)
const extraBlocks = d => SRC.cfa.D.bloki.filter(b => b.data === d && !/^([A-I]|S\d)$/.test(b.blok)).map(b => b.godz.split('–'));
const filled = (d, from, to) => { const ex = extraBlocks(d); let at = from; for (let moved = true; moved && at < to;) { moved = false; for (const [f, e] of ex) if (f <= at && e > at) { at = e; moved = true; } } return at >= to; };

test('D-099, D-101, D-103: bloki J 21:00–21:53, K 17:40, L 18:40, M 19:40 — dodatkowe sloty; wieczór w dni z J: kolacja 20:50–21:00 (z chondroityną), blok J, przygotowanie 21:53–22:00; bez J: 15.10, 16.10, 23.10, 25.10 i poza planem', () => {
  const ev = r => r.slots.filter(s => s.from >= '20:15' && s.from < '22:00').map(s => `${s.from}–${s.to} ${s.title}`);
  const tue = resolveDay('2026-11-03');   // wtorek bez treningu, bloki K, L, M (mycie głowy przed M), powrót 20:15–20:35
  assert.deepEqual(ev(tue), ['20:15–20:35 Powrót do domu', '20:35–20:50 Przygotowywanie kolacji i zmywanie', '20:50–21:00 Kolacja', '21:00–21:53 CFA blok J', '21:53–22:00 Przygotowywanie posiłków, melisy i wieczorna pielęgnacja']);
  const sup = tue.slots.find(s => s.id === 'slot.2100');
  assert.deepEqual([sup.items.find(i => i.kind === 'meal').text, sup.items.find(i => i.kind === 'meal').kcal > 0, sup.doses.map(d => `${d.time} ${d.supp}`)], ['Kolacja (20:50)', true, ['20:50 chondroityna']]);
  assert.deepEqual(tue.slots.find(s => s.id === 'slot.2015').items.map(i => i.text), ['Posiłek po saunie (20:15)'], 'posiłek 20:15 w skróconym slocie (dzień NT)');
  const j = tue.slots.find(s => s.id === 'slot.cfa.J');
  assert.deepEqual([j.from, j.to, j.role, j.extra, j.title, j.cfa.length, j.cfa[0].blok, j.doses.length], ['21:00', '21:53', 'cfa', true, 'CFA blok J', 1, 'J', 0]);
  // dni treningowe z blokiem M (D-103): po bloku M przygotowanie kolacji od 20:33, kolacja 20:50–21:00, blok J
  assert.deepEqual(ev(resolveDay('2026-10-20')), ['20:33–20:50 Przygotowywanie kolacji i zmywanie', '20:50–21:00 Kolacja', '21:00–21:53 CFA blok J', '21:53–22:00 Przygotowywanie posiłków, melisy i wieczorna pielęgnacja']);
  // wszystkie dni z J (24): sloty szablonu bez luk i nakładania, kolacja 20:50–21:00, blok J między kolacją a przygotowaniem posiłków
  const days = [...new Set(SRC.cfa.D.bloki.filter(b => b.blok === 'J').map(b => b.data))];
  assert.equal(days.length, 24);
  const letters = d => [...new Set(SRC.cfa.D.bloki.filter(b => b.data === d && !/^[A-I]$|^S/.test(b.blok)).map(b => b.blok))];
  for (const d of days) {
    const r = resolveDay(d), base = r.slots.filter(s => !s.extra);
    base.forEach((s, i) => { const next = base[(i + 1) % base.length].from; assert.ok(s.to === next || filled(d, s.to, next), `${d} ${s.id}: ${s.to} → ${next}`); });
    assert.deepEqual([r.slots.find(s => s.id === 'slot.2100').from, r.slots.find(s => s.id === 'slot.2100').to, r.slots.find(s => s.id === 'slot.2145').from], ['20:50', '21:00', '21:53'], d);
    assert.equal(r.slots.filter(s => s.extra).length, letters(d).length, d);
    assert.ok(r.slots.some(s => s.id === 'slot.cfa.J'), d);
    assert.equal(r.doses.every(x => x.time !== '21:00'), true, `${d}: chondroityna z kolacją 20:50`);
  }
  // niedziela (basen) z blokiem M: powrót 19:15–19:25, prysznic i mycie głowy 19:25–19:40, blok M, przygotowanie kolacji od 20:33
  assert.deepEqual(resolveDay('2026-10-18').slots.filter(s => s.from >= '19:15' && s.from < '20:50').map(s => `${s.from}–${s.to} ${s.title}`),
    ['19:15–19:25 Powrót do domu', '19:25–19:40 Prysznic i mycie głowy', '19:40–20:33 CFA blok M', '20:33–20:50 Przygotowywanie kolacji i zmywanie']);
  // dni bez J — wieczór jak dotąd (21:00–21:45 kolacja, 21:45–22:00 przygotowanie)
  for (const d of ['2026-10-15', '2026-10-16', '2026-10-23', '2026-10-25', '2026-10-07', '2026-11-12', '2026-11-17']) {
    const r = resolveDay(d);
    assert.equal(r.slots.some(s => s.id === 'slot.cfa.J'), false, d);
    assert.deepEqual([r.slots.find(s => s.id === 'slot.2100').from, r.slots.find(s => s.id === 'slot.2100').to, r.slots.find(s => s.id === 'slot.2145').from], ['21:00', '21:45', '21:45'], d);
    if (!r.outside) assert.ok(r.doses.some(x => x.supp === 'chondroityna' && x.time === '21:00'), d);
  }
  // bloki po południu: 03–11.11 K, L, M; 23.10 K i L; 22.10 i 29.10 L i M; M także w dni treningowe; pozostałe dni bez
  const ext = d => resolveDay(d).slots.filter(s => s.extra).map(s => `${s.id.slice(-1)} ${s.from}–${s.to}`).join();
  assert.equal(ext('2026-11-03'), 'K 17:40–18:33,L 18:40–19:33,M 19:40–20:33,J 21:00–21:53', 'wtorek 03.11');
  assert.equal(ext('2026-11-10'), 'K 17:40–18:33,L 18:40–19:33,M 19:40–20:33,J 21:00–21:53', 'wtorek z mockiem 10.11: sesje S1/S2, G–I, K–M i J');
  assert.equal(ext('2026-10-22'), 'L 18:40–19:33,M 19:40–20:33,J 21:00–21:53');
  assert.equal(ext('2026-10-23'), 'K 17:40–18:33,L 18:40–19:33');
  assert.equal(ext('2026-10-17'), 'M 19:40–20:33,J 21:00–21:53');
  for (const d of ['2026-10-16', '2026-10-25', '2026-10-15', '2026-10-13']) assert.equal(ext(d), '', d);
  const m = resolveDay('2026-11-03').slots.map(s => s.id), order = ['slot.1733', 'slot.cfa.K', 'slot.1815'].map(id => m.indexOf(id));
  assert.ok(order[0] >= 0 && order[0] < order[1] && order[1] < order[2], 'K 17:40 między zmywaniem a resztą okna treningowego — kolejność chronologiczna');
});

test('D-101, D-103: mycie głowy tuż przed blokiem M — 19:33–19:40 między blokami L i M (03–11.11), 19:33–19:40 po zakupach i bloku L (22.10, 29.10); posiłek 20:15 zostaje w trakcie bloku M; w dni treningowe — „Prysznic i mycie głowy” 19:25–19:40', () => {
  const at = (r, id) => r.slots.find(s => s.id === id);
  for (const d of [...range('2026-11-03', '2026-11-11')]) {
    const r = resolveDay(d), mycie = at(r, 'slot.2035'), post = at(r, 'slot.2015');
    assert.equal(r.slots.filter(s => s.id === 'slot.2035').length, 1, `${d}: slot mycia (kroki pielęgnacji przypięte do slot.2035)`);
    assert.deepEqual([mycie.from, mycie.to, mycie.title], ['19:33', '19:40', 'Wieczorne mycie głowy i suszenie'], d);
    const L = at(r, 'slot.cfa.L'), M = at(r, 'slot.cfa.M');
    assert.deepEqual([L.to, M.from], ['19:33', '19:40'], `${d}: mycie dokładnie między L i M`);
    assert.deepEqual([post.from, post.to, post.items.find(i => i.kind === 'meal').text], ['20:15', '20:35', 'Posiłek po saunie (20:15)'], `${d}: posiłek 20:15 w trakcie bloku M (19:40–20:33)`);
    assert.deepEqual(r.slots.filter(s => !s.extra && s.to > s.from && s.from >= '18:15' && s.to <= '19:45').map(s => `${s.from}–${s.to} ${s.title}`), ['18:33–18:40 Wolne', '19:33–19:40 Wieczorne mycie głowy i suszenie'], `${d}: okno treningowe pomniejszone o bloki K, L, M (D-103)`);
    assert.deepEqual([at(r, 'slot.2045').from, at(r, 'slot.2045').to, at(r, 'slot.2100').from], ['20:35', '20:50', '20:50'], d);
  }
  for (const d of ['2026-10-22', '2026-10-29']) {
    const r = resolveDay(d);
    assert.deepEqual([at(r, 'slot.2035').from, at(r, 'slot.2035').to, at(r, 'slot.cfa.L').to, at(r, 'slot.cfa.M').from, at(r, 'slot.2015z').from, at(r, 'slot.2015z').items.find(i => i.kind === 'meal').time], ['19:33', '19:40', '19:33', '19:40', '20:15', '20:15'], d);
  }
  // dni treningowe z blokiem M: mycie głowy w slocie „Prysznic i mycie głowy” 19:25–19:40, osobnego slotu mycia nie ma
  for (const d of ['2026-10-19', '2026-10-24', '2026-10-31']) {
    const r = resolveDay(d);
    assert.equal(r.slots.some(s => s.id === 'slot.2035'), false, d);
    assert.deepEqual([at(r, 'slot.1925m').from, at(r, 'slot.1925m').to, at(r, 'slot.1925m').title, at(r, 'slot.cfa.M').from], ['19:25', '19:40', 'Prysznic i mycie głowy', '19:40'], d);
    assert.ok(at(r, 'slot.1925m').items.some(i => /prysznic/i.test(i.text)), `${d}: krok prysznica przeniesiony z dawnego slotu`);
  }
  // D-103b: dni wyjątkowo bez treningu z samym blokiem M (01.11, 02.11): mycie głowy 19:30–19:40 tuż przed blokiem, posiłek 20:15 w trakcie bloku (jak 22/29.10 przed D-103)
  for (const d of ['2026-11-01', '2026-11-02']) {
    const r = resolveDay(d);
    assert.deepEqual([at(r, 'slot.2035').from, at(r, 'slot.2035').to, at(r, 'slot.cfa.M').from, at(r, 'slot.cfa.M').to], ['19:30', '19:40', '19:40', '20:33'], d);
    assert.deepEqual([at(r, 'slot.2015').from, at(r, 'slot.2015').to, at(r, 'slot.2015').items.find(i => i.kind === 'meal').text], ['20:15', '20:35', 'Posiłek po saunie (20:15)'], `${d}: dieta NT`);
    assert.equal(r.slots.some(s => s.id === 'slot.1915m'), false, `${d}: bez układu dnia treningowego z blokiem M`);
    assert.equal(r.slots.filter(s => s.domain === 'train' && s.title === 'Wolne').every(w => w.to <= '19:30' || w.from >= '20:33'), true, `${d}: „Wolne” poza blokiem M i myciem`);
  }
  assert.deepEqual([at(resolveDay('2026-10-13'), 'slot.2035').from, at(resolveDay('2026-10-13'), 'slot.2035').to], ['20:35', '20:45'], 'dni bez bloku M — mycie jak dotąd');
  assert.deepEqual([at(resolveDay('2026-11-19'), 'slot.2035').from, at(resolveDay('2026-11-19'), 'slot.2035').to], ['20:35', '20:45'], 'po planie CFA — mycie jak dotąd');
});
