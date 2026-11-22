import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDay, phaseFor, templateFor, dayPlan, mTrainDay } from '../../src/core/resolver.js';
import { SRC, mpwByDay } from '../../src/core/data.js';
import { range } from '../../src/core/dates.js';

// Od 21.09 — kilkanaście dni przed początkiem planu (18.10.2026, D-102, D-103c) — do kilku dni po końcu planu (31.12.2027, D-117) (D-088)
const ALL = [...range('2026-09-21', '2028-01-05')];
const PLAN0 = '2026-10-18', END = '2027-12-31';
const EXC = SRC.week.exceptions;
// Liczba slotów wg wariantu dnia: zwykły 34, niedziela „basen” 32, czwartek „czwartek” 30 (sauna i zakupy), „czwartek_k” 31 (wariant nieużywany od D-103b — dawniej 15.10), „czwartek_zl” 29 (22/29.10: bez sauny, zakupy 17:45–18:40,
// D-103), „czwartek_bz” 30 (24.12 bez zakupów, D-103), 07.01–18.03 „czwartek_st” 32 (D-094, D-097, D-116); plan CFA 2027 bez bloków K/L/M (D-116)
const SLOTS = { basen: 32, czwartek: 30, czwartek_k: 31, czwartek_zl: 29, czwartek_bz: 30, czwartek_st: 32 };
// dni bez treningu z blokiem dodatkowym 17:40–18:33 w oknie treningowym (Wielkanoc 27–28.03, D-116): okno „Wolne” pomniejszone o blok — liczba slotów zależy od dnia
const KL = ['2027-03-27', '2027-03-28'];

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

test('każdy dzień 21.09.2026–05.07.2027: sloty z godzinami szablonu — 34, niedziele 32, czwartki 30 / 07.01–18.03 32 (D-004, D-086, D-094, D-097, D-103, D-116)', () => {
  for (const d of ALL) {
    const r = resolveDay(d), v = dayPlan(d).variant;
    if (r.outside) assert.equal(v, null, d);
    assert.equal(mTrainDay(d), false, `${d}: plan CFA 2027 bez bloku M`);
    if (!KL.includes(d)) assert.equal(r.slots.filter(s => !s.extra).length, SLOTS[v] || 34, d);   // bez dodatkowych slotów bloków (D-099)
    if (!r.outside) assert.equal(v || null, { 4: EXC[d] && 'variant' in EXC[d] ? EXC[d].variant : 'czwartek', 7: EXC[d] && 'variant' in EXC[d] ? EXC[d].variant : 'basen' }[r.weekday] || null, d);
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

test('slot sauny: czwartek i dni bez sauny = „Wolne”; plan CFA 2027 bez bloku M — sauna wg tygodnia bazowego także w historii 18.10–02.11 (D-018, D-101, D-116)', () => {
  const sauna = d => resolveDay(d).slots.find(s => s.id === 'slot.1945')?.title ?? null;
  assert.equal(sauna('2026-10-19'), 'Sauna', 'poniedziałek 19.10: UPPER 1 + sauna (blok M planu V44 nie istnieje — D-116)');
  assert.equal(sauna('2026-10-20'), 'Wolne', 'wtorek — bez sauny');
  assert.equal(sauna('2026-10-21'), 'Sauna');
  assert.equal(sauna('2026-10-12'), 'Wolne', '12–15.10 — bez treningu i sauny (D-101)');
  assert.equal(resolveDay('2026-10-22').slots.some(s => s.id === 'slot.1755c'), false, 'czwartek 22.10 bez sauny (D-103): zakupy 17:45–18:40');
  assert.equal(resolveDay('2026-10-22').slots.find(s => s.id === 'slot.1745z').title, 'Zakupy');
  assert.equal(resolveDay('2026-10-15').slots.some(s => s.id === 'slot.1755c'), false, '15.10 — usunięty z kalendarza (D-103b): zwykły szablon poza planem');
  assert.equal(resolveDay('2026-11-05').slots.some(s => s.id === 'slot.1755c'), false, '05.11 — bez treningu i bez wariantu czwartkowego (D-101)');
  assert.equal(sauna('2026-10-15'), 'Wolne', '15.10 poza planem (D-103b) — szablon podstawowy, okno treningowe „Wolne”');
  for (const d of ['2026-10-16', '2026-10-17']) assert.equal(sauna(d), 'Wolne', `${d} — poza planem (D-103c): szablon podstawowy`);
  assert.equal(sauna('2026-10-24'), 'Sauna', 'sobota 24.10: LOWER 2 + sauna');
  assert.equal(sauna('2026-11-07'), 'Wolne', '07.11 — bez treningu');
  assert.equal(sauna('2026-10-23'), 'Wolne', '23.10 — bez treningu');
  assert.equal(resolveDay('2026-11-12').slots.some(s => s.id === 'slot.1945'), false, '12.11 — nominalny czwartek (sauna 17:55–19:05)');
  assert.equal(resolveDay('2026-11-12').slots.find(s => s.id === 'slot.1755c').title, '2 rundy sauny wg protokołu', '12.11 — nominalnie, bez wyjątku (D-101)');
  assert.equal(resolveDay('2026-12-24').slots.find(s => s.id === 'slot.1755c').title, '2 rundy sauny wg protokołu', '24.12 — sauna zostaje, bez zakupów (D-103)');
  assert.equal(sauna('2026-11-13'), 'Wolne', '13.11 — UPPER 2 bez sauny (nominalnie)');
  assert.equal(sauna('2026-11-14'), 'Sauna', '14.11 — LOWER 2 + sauna');
  assert.equal(sauna('2026-11-16'), 'Sauna', '16.11 — UPPER 1 + sauna');
  assert.equal(sauna('2027-03-22'), 'Sauna', '22.03 — UPPER 1 + sauna (blok dodatkowy 17:40–18:33 nakłada się na trening — decyzja D1 otwarta)');
  assert.equal(resolveDay('2026-10-18').slots.some(s => s.id === 'slot.1945'), false, 'niedziela: relaks zamiast okna sauny (D-094)');
  assert.equal(resolveDay('2026-11-15').slots.some(s => s.id === 'slot.1945'), false, '15.11 — basen bez sauny (D-101)');
  assert.equal(sauna('2026-09-21'), 'Wolne', 'poza planem (D-088)');
  assert.equal(sauna('2027-07-05'), 'Sauna', '05.07.2027 — poniedziałek w planie (D-117)');
  assert.equal(sauna('2028-01-03'), 'Wolne', 'poza planem po 31.12.2027 (D-117)');
});

test('posiłek potreningowy: 20:15 (plan CFA 2027 bez bloku M — D-116); czwartek „Posiłek po saunie”, 114 kcal (w slocie zakupów do 06.01 i od 25.03, 07.01–18.03 po saunie); dni T 230 kcal', () => {
  const post = d => resolveDay(d).slots.find(s => s.id === 'slot.2015');
  const thu2 = resolveDay('2026-11-19').slots.find(s => s.id === 'slot.1905c').items.find(i => i.kind === 'meal');   // pozostałe czwartki: w slocie zakupów
  assert.deepEqual([thu2.text, thu2.kcal], ['Posiłek po saunie (20:15)', 114]);
  const thu3 = resolveDay('2026-10-22').slots.find(s => s.id === 'slot.2015z').items.find(i => i.kind === 'meal');   // 22/29.10 (D-103): posiłek 20:15 w slocie 20:15–20:35, bez sauny
  assert.deepEqual([thu3.text, thu3.kcal], ['Posiłek po saunie (20:15)', 114]);
  assert.equal(post('2027-01-07').mealName, 'Posiłek po saunie');
  assert.equal(post('2027-01-07').kcal, 114);
  assert.equal(post('2026-11-17').kcal, 230);
  assert.equal(post('2026-10-20').kcal, 230, '20.10 — po D-116 bez bloku M: posiłek 20:15');
  assert.ok(!ALL.some(d => resolveDay(d).slots.some(s => s.id === 'slot.1915m')), 'układ dnia z blokiem M nie występuje');
  const thu4 = resolveDay('2027-04-01').slots.find(s => s.id === 'slot.1905c').items.find(i => i.kind === 'meal');   // od 01.04 czwartek jak do 06.01 (D-116)
  assert.deepEqual([thu4.text, thu4.kcal], ['Posiłek po saunie (20:15)', 114]);
});

test('suplementy: tauryna codziennie (D-014), cynk czw+nd, D-015 18.10.2026–31.12.2027 (D-117); poza planem bez dawek (D-088, D-102, D-103c)', () => {
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

test('CFA 2027 (D-116): bloki B–I w slotach szablonu, J i „blok dodatkowy” jako dodatkowe sloty wg planu (D-099); zjazd studiów ma pierwszeństwo (kolizja w opisie); czwartki 07.01–18.03 — sloty MPW', () => {
  const CFA0 = SRC.cfa.D.stat.start, CFA_END = SRC.cfa.D.stat.end;
  const AG = ['08:00', '09:10', '10:10', '11:20', '12:20', '13:30', '14:30'];
  const LETTER = { '08:00': 'A', '09:10': 'B', '10:10': 'C', '11:20': 'D', '12:20': 'E', '13:30': 'F', '14:30': 'G', '15:30': 'H', '16:40': 'I' };
  for (const d of ALL) {
    const r = resolveDay(d), fixed = ['studia', 'egzamin'].includes(r.blocks?.kind);
    const cfaSlots = r.slots.filter(s => s.role === 'cfa' && !s.extra), extraSlots = r.slots.filter(s => s.extra);
    assert.deepEqual(cfaSlots.map(s => s.from), dayPlan(d).variant === 'czwartek_st' ? [...AG, '16:00', '17:00', '18:00'] : [...AG, '15:30', '16:40'], d);
    const n = [...cfaSlots, ...extraSlots].reduce((a, s) => a + s.cfa.length, 0), plan = SRC.cfa.D.bloki.filter(b => b.data === d);
    const lost = fixed ? plan.filter(b => b.godz < '15:23').length : 0;   // bloki w godzinach zjazdu — w opisie slotu (kolizja)
    assert.equal(n, plan.length - lost, d);
    if (d < CFA0 || d > CFA_END) assert.equal(n, 0, d);
    const extraLetters = [...new Set(r.cfa.blocks.filter(b => !/^[A-I]$/.test(b.blok)).sort((a, b) => a.godz.localeCompare(b.godz)).map(b => b.blok))];
    assert.deepEqual(extraSlots.map(s => s.title), extraLetters.map(l => (l === 'Dodatkowy' ? 'CFA — blok dodatkowy' : `CFA blok ${l}`)), d);
    if (d < CFA0 && !r.mpw.inPlan && !r.blocks) assert.ok(cfaSlots.every(s => s.title === 'Czas własny' && s.own), d);   // U1 (audyt 23.10.2026)
    for (const s of cfaSlots) if (s.cfa.length) assert.equal(s.title, `CFA blok ${LETTER[s.from]}`, `${d} ${s.from}`);
    if (fixed) for (const s of cfaSlots.filter(x => x.to <= '15:23')) {
      const hit = plan.find(b => b.godz === `${s.from}–${s.to}`);
      if (hit) assert.match(s.desc, new RegExp(`kolizja z planem CFA: blok ${hit.blok}`), `${d} ${s.from}`);
    }
  }
  assert.ok(!SRC.cfa.D.mockSessions && ALL.every(d => !resolveDay(d).cfa.isMock), 'bez sesji mocka S1/S2 w planie dnia');
});

test('CFA: każdy blok w slocie o godzinach z planu (D-086); wyjątek — bloki w godzinach zjazdu studiów (D-116: 08–09.05, opis kolizji)', () => {
  let placed = 0, clash = 0;   // D-117: bez zjazdu IX — żadnej kolizji ze zjazdem w okresie planu CFA
  for (const d of range(SRC.cfa.D.stat.start, SRC.cfa.D.stat.end)) {
    const r = resolveDay(d);
    for (const s of r.slots.filter(x => x.role === 'cfa')) for (const b of s.cfa) { placed++; assert.equal(b.godz, `${s.from}–${s.to}`, `${d} ${b.nr}`); }
    if (r.blocks?.kind === 'studia') clash += SRC.cfa.D.bloki.filter(b => b.data === d && b.godz < '15:23').length;
    assert.deepEqual(r.cfa.blocks.map(b => b.nr), SRC.cfa.D.bloki.filter(b => b.data === d).map(b => b.nr), d);
  }
  assert.equal(clash, 0, 'D-117: 08–09.05 bez zjazdu IX — bloki B–G w slotach');
  assert.equal(placed + clash, SRC.cfa.D.bloki.length, 'wszystkie bloki planu w planie dnia albo w opisie kolizji');
});

test('posiłki i suplementy w dniu mocka bez zmian godzin (D-019)', () => {
  const a = resolveDay('2027-05-06'), b = resolveDay('2027-04-29');   // czwartki: mock CFA 2027 (D-116) i zwykły czwartek
  const meals = r => r.slots.filter(s => s.role === 'meal').map(s => `${s.from}:${s.kcal}`).join();
  assert.equal(meals(a), meals(b));
  assert.deepEqual(a.doses.map(d => d.time + d.supp), b.doses.map(d => d.time + d.supp));
});

test('recall: plan CFA 2027 bez sesji 22:00 (D-116) — żaden dzień bez recall', () => {
  assert.deepEqual(SRC.cfa.D.nightRecall, []);
  for (const d of ALL) assert.equal(resolveDay(d).cfa.recall, false, d);
  assert.equal(SRC.cfa.D.stat.recallEvening, 0);
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
  const exp = ['Poza planem', 'Poza planem', 'Poza planem', 'Poza planem', 'Poza planem', 'Basen', 'UPPER 1 + sauna'];   // 13–17.10 przed początkiem planu (D-103c), początek planu i pierwszy trening 18.10 (D-116: bez bloku M — z sauną)
  [...range('2026-10-13', '2026-10-19')].forEach((d, i) => assert.equal(resolveDay(d).sessionLabel, exp[i], d));
  assert.deepEqual(['2026-09-29', '2026-10-05', '2026-10-08', '2026-10-10', '2026-10-11', '2026-10-12', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'].map(d => resolveDay(d).sessionLabel),
    ['Poza planem', 'Poza planem', 'Poza planem', 'Poza planem', 'Poza planem', 'Poza planem', 'Bez treningu, 2 × sauna', 'UPPER 2', 'LOWER 2 + sauna', 'Basen']); // D-102: 12.10 poza planem, 12–15.11 nominalnie
});

test('D-039: linia źródła bloku CFA (plan 2027: plik Curriculum i zakres stron)', () => {
  const a = resolveDay('2026-11-20').slots.find(s => s.id === 'slot.1220').cfa[0];   // pierwszy blok planu CFA 2027: 20.11, 12:20 (D-116)
  assert.equal(cfaSourceLine(a), 'CFA Level I 2027 Vol 1. Quantitative Methods.pdf, PDF 13–24 · druk 3–14');
  const p = resolveDay('2027-01-04').slots.find(s => s.id === 'slot.cfa.J').cfa[0];
  assert.equal(cfaSourceLine(p), 'CFA Level I 2027 Vol 5. Equities.pdf, PDF 181–192 · druk 171–182');
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

test('D-088/D-102/D-103c/D-116: dni przed 18.10.2026 (historia, 15–17.10 usunięte) i po 31.12.2027 poza planem — ciągłość dat bez treningu, dawek, bloków i zużycia; 18.10 początkiem planu (pierwszy trening)', () => {
  for (const d of [...range('2026-01-01', '2026-10-17'), ...range('2028-01-01', '2028-01-31')]) {
    const r = resolveDay(d);
    assert.equal(r.outside, true, d);
    assert.deepEqual([r.training, r.doses.length, r.cfa.blocks.length, r.cfa.recall, r.sauna, r.sessionName, r.noDiet], [null, 0, 0, false, 0, 'Poza planem', false], d);
    assert.equal(r.slots.length >= 34, true, d);                           // szablon godzin bez zmian (ciągłość widoków)
    assert.ok(r.slots.filter(s => s.domain === 'train').every(s => s.title === 'Wolne'), d);
  }
  const s = resolveDay(PLAN0);
  assert.deepEqual([s.outside, s.dietVariant, s.noDiet, s.kcal > 0, s.phase, s.preStart, s.sessionLabel, s.cfa.inPlan], [false, 'T', false, true, 0, false, 'Basen', false]);   // 18.10 — początek planu (pierwszy trening: basen); plan CFA 2027 od 20.11
  assert.equal(resolveDay('2028-01-01').after, true);
  assert.equal(resolveDay('2027-07-01').outside, false, 'D-117: plan do 31.12.2027');
  assert.equal(resolveDay('2027-03-29').outside, false, 'D-116: plan do 30.06');
  assert.equal(SRC.phases.start, PLAN0);
  assert.equal(resolveDay('2026-09-29').zero, false, 'Dzień zero 29.09 usunięty z kalendarza (D-100)');
  assert.deepEqual(['2026-11-19', '2026-11-20', '2027-05-12', '2027-05-13'].map(d => resolveDay(d).cfa.inPlan), [false, true, true, false], 'plan CFA 2027: 20.11–12.05');
});

test('D-102, D-103, D-103c: pierwszy tydzień planu 18–24.10.2026 — początek planu i treningów w niedzielę 18.10 (basen), 15–17.10 poza planem; D-116 — bez bloków CFA i recall', () => {
  const row = d => { const r = resolveDay(d); return [r.dayType, r.sessionLabel, r.dietVariant, (r.training || []).length > 0, r.sauna, r.noDiet]; };
  for (const d of ['2026-10-15', '2026-10-16', '2026-10-17']) assert.deepEqual(row(d).slice(0, 2), ['free', 'Poza planem'], `${d} usunięty z kalendarza (D-103b, D-103c)`);
  assert.deepEqual(row('2026-10-18'), ['swim', 'Basen', 'T', false, 0, false]);
  assert.deepEqual(row('2026-10-19'), ['strength_sauna', 'UPPER 1 + sauna', 'T', true, 1, false]);
  assert.deepEqual(row('2026-10-22'), ['free', 'Bez treningu', 'NT', false, 0, false]);
  const main = d => resolveDay(d).slots.find(s => s.id.startsWith('slot.1815')).title;
  assert.deepEqual(['2026-10-14', '2026-10-17', '2026-10-18', '2026-10-19'].map(main), ['Wolne', 'Wolne', 'Basen 55 min', 'Trening siłowy: UPPER 1']);
  assert.ok(!['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'].some(d => resolveDay(d).slots.some(s => s.shop)));
  assert.ok(resolveDay('2026-10-22').slots.some(s => s.shop), '22.10 (czwartek) — pierwsze zakupy planu 17:45–18:40');
  for (const d of range('2026-10-13', '2026-10-25')) assert.deepEqual([resolveDay(d).cfa.blocks.length, resolveDay(d).cfa.recall], [0, false], d);
});

// Dodatkowe sloty bloków wypełniają „dziury” w szablonie: slot może kończyć się tam, gdzie zaczyna się następny, albo tuż przed blokami, które ten odstęp zajmują (D-099, D-116)
const extraBlocks = d => SRC.cfa.D.bloki.filter(b => b.data === d && !/^[A-I]$/.test(b.blok)).map(b => b.godz.split('–'));
const filled = (d, from, to) => { const ex = extraBlocks(d); let at = from; for (let moved = true; moved && at < to;) { moved = false; for (const [f, e] of ex) if (f <= at && e > at) { at = e; moved = true; } } return at >= to; };

test('D-099, D-116: blok J 21:00–21:53 i blok dodatkowy 17:40–18:33 — dodatkowe sloty; wieczór w dni z J: kolacja 20:50–21:00 (z chondroityną), blok J, przygotowanie 21:53–22:00; bez J — wieczór jak dotąd', () => {
  const ev = r => r.slots.filter(s => s.from >= '20:35' && s.from < '22:00').map(s => `${s.from}–${s.to} ${s.title}`);
  const mon = resolveDay('2027-01-04');   // pierwszy dzień z blokiem J
  assert.deepEqual(ev(mon), ['20:35–20:50 Przygotowywanie kolacji i zmywanie', '20:50–21:00 Kolacja', '21:00–21:53 CFA blok J', '21:53–22:00 Przygotowywanie posiłków, melisy i wieczorna pielęgnacja']);
  const sup = mon.slots.find(s => s.id === 'slot.2100');
  assert.deepEqual([sup.items.find(i => i.kind === 'meal').text, sup.items.find(i => i.kind === 'meal').kcal > 0, sup.doses.map(d => `${d.time} ${d.supp}`)], ['Kolacja (20:50)', true, ['20:50 chondroityna']]);
  const j = mon.slots.find(s => s.id === 'slot.cfa.J');
  assert.deepEqual([j.from, j.to, j.role, j.extra, j.title, j.cfa.length, j.cfa[0].blok, j.doses.length], ['21:00', '21:53', 'cfa', true, 'CFA blok J', 1, 'J', 0]);
  // wszystkie dni z J (88): sloty szablonu bez luk i nakładania, kolacja 20:50–21:00, blok J między kolacją a przygotowaniem posiłków
  const days = [...new Set(SRC.cfa.D.bloki.filter(b => b.blok === 'J').map(b => b.data))];
  assert.equal(days.length, 88);
  const letters = d => [...new Set(SRC.cfa.D.bloki.filter(b => b.data === d && !/^[A-I]$/.test(b.blok)).map(b => b.blok))];
  for (const d of days) {
    const r = resolveDay(d), base = r.slots.filter(s => !s.extra);
    base.forEach((s, i) => { const next = base[(i + 1) % base.length].from; assert.ok(s.to === next || filled(d, s.to, next), `${d} ${s.id}: ${s.to} → ${next}`); });
    assert.deepEqual([r.slots.find(s => s.id === 'slot.2100').from, r.slots.find(s => s.id === 'slot.2100').to, r.slots.find(s => s.id === 'slot.2145').from], ['20:50', '21:00', '21:53'], d);
    assert.equal(r.slots.filter(s => s.extra).length, letters(d).length, d);
    assert.ok(r.slots.some(s => s.id === 'slot.cfa.J'), d);
    assert.equal(r.doses.every(x => x.time !== '21:00'), true, `${d}: chondroityna z kolacją 20:50`);
  }
  // dni bez J — wieczór jak dotąd (21:00–21:45 kolacja, 21:45–22:00 przygotowanie)
  for (const d of ['2026-10-15', '2026-10-16', '2026-10-23', '2026-10-25', '2026-10-07', '2026-11-12', '2026-11-17', '2026-11-20', '2027-06-30', '2027-12-31']) {
    const r = resolveDay(d);
    assert.equal(r.slots.some(s => s.id === 'slot.cfa.J'), false, d);
    assert.deepEqual([r.slots.find(s => s.id === 'slot.2100').from, r.slots.find(s => s.id === 'slot.2100').to, r.slots.find(s => s.id === 'slot.2145').from], ['21:00', '21:45', '21:45'], d);
    if (!r.outside) assert.ok(r.doses.some(x => x.supp === 'chondroityna' && x.time === '21:00'), d);
  }
  // blok dodatkowy 17:40–18:33 — osobny slot między zmywaniem (17:33) a oknem treningowym (kolejność chronologiczna)
  const ext = d => resolveDay(d).slots.filter(s => s.extra).map(s => `${s.id.replace('slot.cfa.', '')} ${s.from}–${s.to}`).join();
  assert.equal(ext('2027-03-22'), 'Dodatkowy 17:40–18:33,J 21:00–21:53');
  assert.equal(ext('2026-11-20'), '');
  const m = resolveDay('2027-03-22').slots.map(s => s.id), order = ['slot.1733', 'slot.cfa.Dodatkowy', 'slot.1815'].map(id => m.indexOf(id));
  assert.ok(order[0] >= 0 && order[0] < order[1] && order[1] < order[2], 'blok dodatkowy 17:40 między zmywaniem a oknem treningowym');
  for (const k of ['K', 'L', 'M']) assert.ok(!SRC.cfa.D.bloki.some(b => b.blok === k), `plan CFA 2027 bez bloku ${k}`);
});

test('D-116: bez bloków K/L/M — mycie głowy wg szablonu (20:35–20:45; w dni z J 20:25–20:35), także w historii 22.10–11.11', () => {
  const at = (r, id) => r.slots.find(s => s.id === id);
  for (const d of ['2026-10-13', '2026-11-03', '2026-11-10', '2026-11-19']) assert.deepEqual([at(resolveDay(d), 'slot.2035').from, at(resolveDay(d), 'slot.2035').to], ['20:35', '20:45'], d);
  assert.deepEqual([at(resolveDay('2027-01-04'), 'slot.2035').from, at(resolveDay('2027-01-04'), 'slot.2035').to], ['20:25', '20:35'], 'dzień z J (D-099)');
  for (const d of ['2026-11-01', '2026-11-02', ...range('2026-11-03', '2026-11-11')]) assert.ok(!resolveDay(d).slots.some(s => /^slot\.cfa\./.test(s.id)), `${d}: bez dodatkowych slotów bloków`);
});

test('U1 (audyt 23.10.2026): poza planem CFA sloty nauki bez bloku to „Czas własny”, a sloty w czasie bloków MPW A–C — „Nauka MPW” z godzinami bloków', () => {
  const CFA_END = SRC.cfa.D.stat.end;
  let own = 0, mpw = 0;
  for (const d of range('2026-11-12', END)) {
    const r = resolveDay(d), slots = r.slots.filter(s => s.role === 'cfa');
    assert.ok(slots.every(s => s.title !== 'Brak bloku CFA' && s.desc !== 'Poza okresem planu nauki'), d);
    const ac = (mpwByDay[d] || []).filter(b => !b.blok.startsWith('P'));
    for (const s of slots) {
      if (s.own) { own++; assert.deepEqual([s.title, s.desc, s.cfa.length], ['Czas własny', '', 0], `${d} ${s.from}`); }
      if (s.title === 'Nauka MPW') {
        mpw++;
        const inSlot = ac.filter(b => b.godz.slice(0, 5) < s.to && b.godz.slice(6) > s.from);
        assert.ok(inSlot.length > 0 && inSlot.every(b => s.desc.includes(`${b.blok} ${b.godz}`)), `${d} ${s.from}: ${s.desc}`);
        assert.ok(!s.own);
      }
      // slot bez bloku nauki nie może nakładać się na blok MPW A–C pod nazwą „Czas własny”
      if (s.own) assert.ok(!ac.some(b => b.godz.slice(0, 5) < s.to && b.godz.slice(6) > s.from), `${d} ${s.from}`);
    }
    // każdy blok MPW A–C dnia jest w slocie bloku (czwartki od 07.01 — D-097) albo w opisie slotu „Nauka MPW”
    for (const b of ac) assert.ok(slots.some(s => s.mpw === b || (s.title === 'Nauka MPW' && s.desc.includes(`${b.blok} ${b.godz}`))), `${d} ${b.blok}`);
    const recall = r.slots.find(s => s.role === 'recall');
    if (d > CFA_END) assert.deepEqual([recall.title, recall.desc, recall.own], ['Wieczór wolny', '', true], d);
  }
  assert.ok(own > 600 && mpw > 200, `czas własny ${own}, nauka MPW ${mpw}`);
  // D-116: sloty bez bloku (ani CFA, ani MPW, ani zdarzenia) to „Czas własny” także w okresie planu CFA
  assert.ok(resolveDay('2026-11-11').slots.filter(s => s.role === 'cfa').every(s => s.own));
  assert.ok(resolveDay('2026-11-24').slots.filter(s => s.role === 'cfa' && s.from < '12:20').every(s => s.own));
});
