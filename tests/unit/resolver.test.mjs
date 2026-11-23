import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDay, phaseFor, templateFor, dayPlan, mTrainDay, block21 } from '../../src/core/resolver.js';
import { SRC, mpwByDay } from '../../src/core/data.js';
import { range } from '../../src/core/dates.js';

// Od 21.09 — przed początkiem planu (D-121: Dzień zero 23.11.2026; dieta, dawki i treningi od 24.11) — do kilku dni po końcu planu (31.12.2027, D-117) (D-088)
const ALL = [...range('2026-09-21', '2028-01-05')];
const PLAN0 = '2026-11-23', START = '2026-11-24', END = '2027-12-31';
const EXC = SRC.week.exceptions;
// Liczba slotów wg wariantu dnia: zwykły 34, niedziela „basen” 32, czwartek „czwartek” 30 (sauna i zakupy), „czwartek_k” 31 (wariant nieużywany od D-103b — dawniej 15.10), „czwartek_zl” 29 (22/29.10: bez sauny, zakupy 17:45–18:40,
// D-103), „czwartek_bz” 30 (24.12 bez zakupów, D-103), 07.01–18.03 „czwartek_st” 32 (D-094, D-097, D-116); plan CFA 2027 bez bloków K/L/M (D-116)
const SLOTS = { basen: 32, czwartek: 30, czwartek_k: 31, czwartek_zl: 29, czwartek_bz: 30, czwartek_st: 32, d120_sym: 33, d120_2102: 30, d120_2702: 32, d120_1703: 30, d120_2003: 30 };   // D-120: dni symulacji MPW i bez treningu
// dni bez treningu z blokiem dodatkowym 17:40–18:33 w oknie treningowym (Wielkanoc 27–28.03, D-116): okno „Wolne” pomniejszone o blok — liczba slotów zależy od dnia
const KL = ['2027-03-27', '2027-03-28'];

test('fazy kalendarzowe D-017 (D-121: Dzień zero 23.11.2026 bez fazy; Faza 0 24.11–06.12, Faza 1 07.12–10.01, Faza 2 od 11.01.2027)', () => {
  assert.equal(phaseFor('2026-09-21'), null);
  for (const d of ['2026-10-18', '2026-11-22', PLAN0]) assert.equal(phaseFor(d), null, `${d}: przed Fazą 0 (D-121)`);
  assert.equal(phaseFor(START), 0);
  assert.equal(phaseFor('2026-12-06'), 0);
  assert.equal(phaseFor('2026-12-07'), 1);
  assert.equal(phaseFor('2027-01-10'), 1);
  assert.equal(phaseFor('2027-01-11'), 2);
  assert.equal(phaseFor(END), 2);
});

test('każdy dzień 21.09.2026–05.07.2027: sloty z godzinami szablonu — 34, niedziele 32, czwartki 30 / 07.01–18.03 32 (D-004, D-086, D-094, D-097, D-103, D-116)', () => {
  for (const d of ALL) {
    const r = resolveDay(d), v = dayPlan(d).variant;
    if (r.outside) assert.equal(v, null, d);
    assert.equal(mTrainDay(d), false, `${d}: plan CFA 2027 bez bloku M`);
    // D-120: slot „Wieczór wolny” zastąpiony blokiem nauki o 22:00 (slot dodatkowy) liczy się do szablonu
    const tpl = templateFor(d), gone = tpl.filter(t => t.role === 'recall' && r.slots.some(x => x.extra && x.from < t.to && x.to > t.from));
    if (!KL.includes(d)) assert.equal(r.slots.filter(s => !s.extra).length + gone.length, SLOTS[v] || 34, d);   // bez dodatkowych slotów bloków (D-099)
    if (!r.outside && !String(v).startsWith('d120_')) assert.equal(v || null, { 4: EXC[d] && 'variant' in EXC[d] ? EXC[d].variant : 'czwartek', 7: EXC[d] && 'variant' in EXC[d] ? EXC[d].variant : 'basen' }[r.weekday] || null, d);
    assert.equal(r.slots.filter(s => !s.extra).map(s => `${s.from}-${s.to}`).join(), tpl.filter(t => !gone.includes(t)).map(s => `${s.from}-${s.to}`).join(), d);
  }
});

test('typy dni i dieta T/NT (D-018)', () => {
  const exp = { 1: ['strength_sauna', 'T'], 2: ['strength', 'T'], 3: ['cardio_sauna', 'T'], 4: ['rest_sauna2', 'NT'], 5: ['strength', 'T'], 6: ['strength_sauna', 'T'], 7: ['swim', 'T'] };
  for (const d of ALL) {
    const r = resolveDay(d);
    if (d < PLAN0 || d > END) assert.deepEqual([r.outside, r.dayType, r.session, r.training], [true, 'free', null, null], d);   // D-088
    else if (d === PLAN0) assert.deepEqual([r.outside, r.zero, r.dayType, r.session, r.training, r.noDiet], [false, true, 'free', null, null, true], d);   // D-121: Dzień zero
    else if (EXC[d]?.dayType) assert.deepEqual([r.dayType, r.dietVariant], [EXC[d].dayType, EXC[d].diet || exp[r.weekday][1]], d);   // D-087
    else assert.deepEqual([r.dayType, r.dietVariant], exp[r.weekday], d);
  }
});

test('kcal dnia = RAZEM z właściwego PDF (skyr 75 g w śniadaniu i lunchu — D-104)', () => {
  assert.equal(resolveDay(PLAN0).kcal, null, '23.11 — Dzień zero: bez diety (D-121)');
  assert.equal(resolveDay(START).kcal, 2595); // wt 24.11: pierwszy dzień diety — F0 T
  assert.equal(resolveDay('2026-11-26').kcal, 2298); // czw F0 NT
  assert.equal(resolveDay('2026-11-29').kcal, 2595); // nd F0 T (basen)
  assert.equal(resolveDay('2026-12-05').kcal, 2595); // sob F0 T — ostatni trening Fazy 0
  assert.equal(resolveDay('2026-12-06').kcal, 2595); // nd F0 T (basen) — ostatni dzień Fazy 0
  assert.equal(resolveDay('2026-12-07').kcal, 2750); // pn F1 T — pierwszy dzień Fazy 1
  assert.equal(resolveDay('2026-12-10').kcal, 2453); // czw F1 NT
  assert.equal(resolveDay('2026-12-12').kcal, 2453, '12.12 — bez treningu (D-121): F1 NT');
  assert.equal(resolveDay('2026-12-24').kcal, 2453, '24.12 — bez treningu i sauny (D-121): F1 NT');
  assert.equal(resolveDay('2027-01-10').kcal, 2750); // nd F1 T — ostatni dzień Fazy 1
  assert.equal(resolveDay('2027-01-11').kcal, 2931); // pn F2 T — pierwszy dzień Fazy 2
  assert.equal(resolveDay('2027-01-14').kcal, 2634); // czw F2 NT
  for (const d of ['2026-10-18', '2026-11-20', '2026-11-22']) assert.equal(resolveDay(d).outside, true, `${d}: przed początkiem planu (D-121)`);
});

test('slot sauny: czwartek i dni bez sauny = „Wolne”; plan CFA 2027 bez bloku M — sauna wg tygodnia bazowego (D-018, D-116, D-121)', () => {
  const sauna = d => resolveDay(d).slots.find(s => s.id === 'slot.1945')?.title ?? null;
  assert.equal(sauna(PLAN0), 'Wolne', '23.11 — Dzień zero: bez treningu i sauny (D-121)');
  assert.equal(sauna('2026-11-30'), 'Sauna', 'poniedziałek 30.11: UPPER 1 + sauna');
  assert.equal(sauna(START), 'Wolne', 'wtorek — bez sauny');
  assert.equal(sauna('2026-11-25'), 'Sauna');
  assert.equal(sauna('2026-11-28'), 'Sauna', 'sobota 28.11: LOWER 2 + sauna');
  assert.equal(sauna('2026-12-12'), 'Wolne', '12.12 — bez treningu (D-121)');
  assert.equal(resolveDay('2026-11-26').slots.some(s => s.id === 'slot.1945'), false, '26.11 — nominalny czwartek (sauna 17:55–19:05)');
  assert.equal(resolveDay('2026-11-26').slots.find(s => s.id === 'slot.1755c').title, '2 rundy sauny wg protokołu');
  assert.equal(resolveDay('2026-12-24').slots.some(s => s.id === 'slot.1755c'), false, '24.12 — bez sauny (D-121)');
  assert.equal(sauna('2026-12-24'), 'Wolne', '24.12 — szablon podstawowy, okno treningowe „Wolne” (D-121)');
  assert.equal(resolveDay('2026-12-31').slots.find(s => s.id === 'slot.1755c').title, '2 rundy sauny wg protokołu', '31.12 — sauna zostaje, bez zakupów (D-109)');
  assert.equal(sauna('2026-11-27'), 'Wolne', '27.11 — UPPER 2 bez sauny (nominalnie)');
  assert.equal(sauna('2027-03-22'), 'Sauna', '22.03 — UPPER 1 + sauna');
  assert.equal(resolveDay('2026-11-29').slots.some(s => s.id === 'slot.1945'), false, 'niedziela: relaks zamiast okna sauny (D-094)');
  assert.equal(sauna('2026-09-21'), 'Wolne', 'poza planem (D-088)');
  assert.equal(sauna('2026-11-16'), 'Wolne', '16.11 — przed startem planu (D-121)');
  assert.equal(sauna('2027-07-05'), 'Sauna', '05.07.2027 — poniedziałek w planie (D-117)');
  assert.equal(sauna('2028-01-03'), 'Wolne', 'poza planem po 31.12.2027 (D-117)');
});

test('posiłek potreningowy: 20:15 (plan CFA 2027 bez bloku M — D-116); czwartek „Posiłek po saunie”, 114 kcal (w slocie zakupów do 06.01 i od 25.03, 07.01–18.03 po saunie); dni T 230 kcal', () => {
  const post = d => resolveDay(d).slots.find(s => s.id === 'slot.2015');
  const thu2 = resolveDay('2026-11-26').slots.find(s => s.id === 'slot.1905c').items.find(i => i.kind === 'meal');   // czwartki: w slocie zakupów
  assert.deepEqual([thu2.text, thu2.kcal], ['Posiłek po saunie (20:15)', 114]);
  const nt = post('2026-12-24').items.find(i => i.kind === 'meal');   // D-121: 24.12 bez sauny — dieta NT, „po treningu” to białko
  assert.deepEqual([nt.text, nt.kcal], ['Białko (dieta NT) (20:15)', 114], 'D-120: dieta NT w dzień bez sauny — „po treningu” to białko');
  assert.equal(post('2027-01-07').mealName, 'Posiłek po saunie');
  assert.equal(post('2027-01-07').kcal, 114);
  assert.equal(post('2026-12-01').kcal, 230, 'wtorek F0 T');
  assert.equal(post(START).kcal, 230, '24.11 — pierwszy dzień diety');
  assert.deepEqual(post(PLAN0).items.filter(i => i.kind === 'meal'), [], 'Dzień zero — bez posiłków planu (D-121)');
  assert.ok(!ALL.some(d => resolveDay(d).slots.some(s => s.id === 'slot.1915m')), 'układ dnia z blokiem M nie występuje');
  const thu4 = resolveDay('2027-04-01').slots.find(s => s.id === 'slot.1905c').items.find(i => i.kind === 'meal');   // od 01.04 czwartek jak do 06.01 (D-116)
  assert.deepEqual([thu4.text, thu4.kcal], ['Posiłek po saunie (20:15)', 114]);
});

test('suplementy: tauryna codziennie (D-014), cynk czw+nd, D-015 24.11.2026–30.04.2027 (D-121); poza planem i w Dniu zero bez dawek (D-088, D-121)', () => {
  for (const d of ALL) {
    const r = resolveDay(d);
    const s = r.doses.map(x => x.supp);
    if (d < START || d > END) { assert.deepEqual(s, [], `${d}: poza planem i w Dniu zero bez dawek (D-088, D-121)`); continue; }
    assert.ok(s.includes('tauryna'), d);
    assert.equal(s.includes('cynk'), r.weekday === 4 || r.weekday === 7, d);
    const on = d >= START && d <= '2027-04-30';   // D-121: chondroityna, boswellia, glukozamina 24.11.2026–30.04.2027
    for (const t of ['boswellia', 'glukozamina']) assert.equal(s.includes(t), on, `${t} ${d}`);
    assert.equal(s.filter(x => x === 'chondroityna').length, on ? 2 : 0, d);
    assert.equal(s.filter(x => x === 'witamina_c').length, 3, d);
  }
});

test('suplementy przypięte do slotów wg godziny', () => {
  const r = resolveDay('2026-11-30');   // poniedziałek F0: dawki przypięte do slotów wg godziny
  const at = id => r.slots.find(s => s.id === id || (id === 'slot.2200' && s.from === '22:00')).doses.map(d => d.supp).sort().join();   // 22:00 — slot bloku MPW C (D-120)
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
  const title = l => (l === 'Dodatkowy' ? 'CFA — blok dodatkowy' : `CFA blok ${l}`);
  for (const d of ALL) {
    const r = resolveDay(d), fixed = ['studia', 'egzamin'].includes(r.blocks?.kind), v = String(dayPlan(d).variant);
    const cfaSlots = r.slots.filter(s => s.role === 'cfa' && !s.extra), extraSlots = r.slots.filter(s => s.extra);
    if (!v.startsWith('d120_')) assert.deepEqual(cfaSlots.map(s => s.from), v === 'czwartek_st' ? [...AG, '16:00', '17:00', '18:00'] : [...AG, '15:30', '16:40'], d);
    const n = [...cfaSlots, ...extraSlots].reduce((a, s) => a + s.cfa.length, 0), plan = SRC.cfa.D.bloki.filter(b => b.data === d);
    const lost = fixed ? plan.filter(b => b.godz < '15:23').length : 0;   // bloki w godzinach zjazdu — w opisie slotu (kolizja)
    assert.equal(n, plan.length - lost, d);
    if (d < CFA0 || d > CFA_END) assert.equal(n, 0, d);
    // D-120: blok w slocie szablonu o swojej godzinie początku; bloki o godzinach spoza szablonu (21:00, 22:00) — sloty dodatkowe
    const tplFrom = new Set(cfaSlots.map(s => s.from));
    const expExtra = r.cfa.blocks.filter(b => !tplFrom.has(b.godz.slice(0, 5)) && !(fixed && b.godz < '15:23')).sort((a, b) => a.godz.localeCompare(b.godz)).map(b => title(b.blok));
    assert.deepEqual(extraSlots.filter(s => s.cfa.length).map(s => s.title), expExtra, d);
    if (d < CFA0 && !r.mpw.inPlan && !r.blocks) assert.ok(cfaSlots.every(s => s.title === 'Czas własny' && s.own), d);   // U1 (audyt 23.10.2026)
    for (const s of [...cfaSlots, ...extraSlots]) if (s.cfa.length) assert.deepEqual([s.title, s.cfa[0].godz.slice(0, 5)], [title(s.cfa[0].blok), s.from], `${d} ${s.from}`);
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
  const a = resolveDay('2027-05-06'), b = resolveDay('2027-05-13'), c = resolveDay('2027-04-29');   // czwartki: mock CFA 2027 (D-116), zwykłe czwartki (po i przed 30.04 — D-121)
  const meals = r => r.slots.filter(s => s.role === 'meal').map(s => `${s.from}:${s.kcal}`).join();
  assert.equal(meals(a), meals(c));
  assert.deepEqual(a.doses.map(d => d.time + d.supp), b.doses.map(d => d.time + d.supp));
});

test('recall: plan CFA 2027 bez sesji 22:00 (D-116) — żaden dzień bez recall', () => {
  assert.deepEqual(SRC.cfa.D.nightRecall, []);
  for (const d of ALL) assert.equal(resolveDay(d).cfa.recall, false, d);
  assert.equal(SRC.cfa.D.stat.recallEvening, 0);
});

test('trening: liczba serii wg fazy', () => {
  const s = d => resolveDay(d).training.reduce((a, e) => a + e.seriesToday, 0);
  assert.equal(s('2026-11-30'), 10); // UPPER 1 F0 (poniedziałek 30.11)
  assert.equal(s('2026-12-04') > 0, true); // UPPER 2 F0 — ostatni piątek Fazy 0
  assert.equal(s('2026-12-07'), 18); // UPPER 1 F1 (Faza 1 od 07.12 — D-121)
  assert.equal(s('2027-01-11'), 26); // UPPER 1 F2 (Faza 2 od 11.01 — D-121)
  for (const d of ['2026-10-19', '2026-11-16', '2026-11-22', '2026-11-23', '2026-12-12', '2026-12-24']) assert.equal(resolveDay(d).training, null, `${d}: bez treningu (przed startem, Dzień zero, D-121)`);
});

// --- Poprawki po teście akceptacyjnym (D-038, D-039, D-040, D-001)
import { cfaSourceLine, sourceText } from '../../src/core/resolver.js';
const SUPP_WORDS = /chondroityn|cynk|boswelli|d3|omega|askorbinian|witamina c|l-teanin|glukozamin|kolagen|tauryn|kreatyn|glicyn|magnez|melatonin/i;

test('D-001: żaden widoczny podpunkt slotu nie powtarza suplementów (wszystkie dni)', () => {
  for (const d of ALL) for (const s of resolveDay(d).slots)
    for (const i of s.items) assert.ok(!SUPP_WORDS.test(i.text), `${d} ${s.from}: „${i.text}”`);
});

test('D-038: pomiar wagi i ciśnienia', () => {
  const t = resolveDay('2026-11-24').slots[0].items.map(i => i.text);
  assert.ok(t.includes('Pomiar wagi i ciśnienia na czczo po toalecie.'));
  assert.ok(!t.includes('Pomiar wagi na czczo po toalecie.'));
});

test('D-040: nazwa treningu w nagłówku dnia', () => {
  const exp = ['Poza planem', 'Poza planem', 'Dzień zero', 'LOWER 1', 'Rower + ABS + sauna', 'Bez treningu, 2 × sauna', 'UPPER 2', 'LOWER 2 + sauna', 'Basen', 'UPPER 1 + sauna'];   // D-121: 21–22.11 przed początkiem planu, 23.11 Dzień zero
  [...range('2026-11-21', '2026-11-30')].forEach((d, i) => assert.equal(resolveDay(d).sessionLabel, exp[i], d));
  assert.deepEqual(['2026-09-29', '2026-10-18', '2026-12-12', '2026-12-24'].map(d => resolveDay(d).sessionLabel), ['Poza planem', 'Poza planem', 'Bez treningu', 'Bez treningu']);
});

test('D-039: linia źródła bloku CFA (plan 2027: plik Curriculum i zakres stron)', () => {
  const a = resolveDay('2026-11-23').slots.find(s => s.id === 'slot.1220').cfa[0];   // pierwszy blok planu CFA 2027: 23.11 (D-121; w pliku 20.11), 12:20
  assert.equal(cfaSourceLine(a), 'CFA Level I 2027 Vol 1. Quantitative Methods.pdf, PDF 13–24 · druk 3–14');
  const p = resolveDay('2027-01-04').slots.find(s => s.cfa?.some(b => b.blok === 'J')).cfa[0];
  assert.equal(cfaSourceLine(p), 'CFA Level I 2027 Vol 5. Equities.pdf, PDF 181–192 · druk 171–182');
});

test('podpunkty posiłków: nazwa i kcal z właściwej fazy i wariantu', () => {
  const lunch = d => resolveDay(d).slots.find(s => s.id === 'slot.1313').items.find(i => i.kind === 'meal');
  assert.equal(lunch('2026-11-24').kcal, 448, 'Faza 0: skyr 75 g (D-104) — 465 − 17 kcal');
  assert.equal(lunch('2026-12-01').kcal, 448, 'Faza 0 trwa do 06.12 (D-121)');
  assert.ok(lunch('2026-12-08').kcal > 448, 'Faza 1: większa porcja makaronu');
  assert.equal(lunch(PLAN0), undefined, 'Dzień zero — bez posiłków planu (D-121)');
  const bf = d => resolveDay(d).slots.find(s => s.id === 'slot.0853').items.find(i => i.kind === 'meal');
  assert.equal(bf('2026-11-24').kcal, 612, 'śniadanie Faza 0: skyr 75 g (D-104) — 629 − 17 kcal');
  const post = resolveDay('2026-11-26').slots.find(s => s.id === 'slot.1905c').items.find(i => i.kind === 'meal');   // czwartek: w slocie zakupów (D-097)
  assert.deepEqual([post.text, post.kcal], ['Posiłek po saunie (20:15)', 114]);
});

test('D-088/D-121: dni przed 23.11.2026 (historia — ukryta) i po 31.12.2027 poza planem — ciągłość dat bez treningu, dawek, bloków i zużycia; 23.11 Dzień zero początkiem planu', () => {
  for (const d of [...range('2026-01-01', '2026-11-22'), ...range('2028-01-01', '2028-01-31')]) {
    const r = resolveDay(d);
    assert.equal(r.outside, true, d);
    assert.deepEqual([r.training, r.doses.length, r.cfa.blocks.length, r.mpw.blocks.length, r.cfa.recall, r.sauna, r.sessionName, r.noDiet], [null, 0, 0, 0, false, 0, 'Poza planem', false], d);
    assert.equal(r.slots.length >= 34, true, d);                           // szablon godzin bez zmian (ciągłość widoków)
    assert.ok(r.slots.filter(s => s.domain === 'train').every(s => s.title === 'Wolne'), d);
  }
  const s = resolveDay(PLAN0);
  assert.deepEqual([s.outside, s.zero, s.noDiet, s.kcal, s.phase, s.sessionLabel, s.cfa.inPlan, s.cfa.blocks.length, s.mpw.blocks.length, s.doses.length], [false, true, true, null, null, 'Dzień zero', true, 3, 3, 0]);   // 23.11 — Dzień zero: nauka, bez diety i dawek (D-121)
  const f = resolveDay(START);
  assert.deepEqual([f.outside, f.zero, f.dietVariant, f.noDiet, f.kcal > 0, f.phase, f.preStart, f.sessionLabel], [false, false, 'T', false, true, 0, false, 'LOWER 1']);   // 24.11 — dieta, dawki i treningi
  assert.equal(resolveDay('2028-01-01').after, true);
  assert.equal(resolveDay('2027-07-01').outside, false, 'D-117: plan do 31.12.2027');
  assert.equal(resolveDay('2027-03-29').outside, false, 'D-116: plan do 30.06');
  assert.equal(SRC.phases.start, PLAN0);
  assert.equal(resolveDay('2026-09-29').zero, false, 'Dzień zero 29.09 usunięty z kalendarza (D-100)');
  assert.equal(SRC.phases.zero, PLAN0, 'D-121: Dzień zero 23.11.2026');
  assert.deepEqual(['2026-11-22', '2026-11-23', '2027-05-12', '2027-05-13'].map(d => resolveDay(d).cfa.inPlan), [false, true, true, false], 'plan CFA 2027 w aplikacji: 23.11–12.05 (D-121)');
});

test('D-121: pierwszy tydzień planu 23–29.11.2026 — Dzień zero 23.11 (bez treningu, diety i dawek; nauka), treningi od 24.11; dni wcześniejsze poza planem', () => {
  const row = d => { const r = resolveDay(d); return [r.dayType, r.sessionLabel, r.dietVariant, (r.training || []).length > 0, r.sauna, r.noDiet]; };
  for (const d of ['2026-11-20', '2026-11-21', '2026-11-22']) assert.deepEqual(row(d).slice(0, 2), ['free', 'Poza planem'], `${d} przed startem planu (D-121)`);
  assert.deepEqual(row(PLAN0), ['free', 'Dzień zero', 'NT', false, 0, true]);
  assert.deepEqual(row(START), ['strength', 'LOWER 1', 'T', true, 0, false]);
  assert.deepEqual(row('2026-11-26'), ['rest_sauna2', 'Bez treningu, 2 × sauna', 'NT', false, 2, false]);
  const main = d => resolveDay(d).slots.find(s => s.id.startsWith('slot.1815')).title;
  assert.deepEqual(['2026-11-22', PLAN0, START, '2026-11-29', '2026-11-30'].map(main), ['Wolne', 'Wolne', 'Trening siłowy: LOWER 1', 'Basen 55 min', 'Trening siłowy: UPPER 1']);
  assert.ok(!['2026-11-19', '2026-11-22', PLAN0, START].some(d => resolveDay(d).slots.some(s => s.shop)));
  assert.ok(resolveDay('2026-11-26').slots.some(s => s.shop), '26.11 (czwartek) — pierwsze zakupy planu 19:05–20:35');
  for (const d of range('2026-11-13', '2026-11-22')) assert.deepEqual([resolveDay(d).cfa.blocks.length, resolveDay(d).mpw.blocks.length], [0, 0], d);
  for (const d of range(PLAN0, '2026-11-29')) assert.ok(resolveDay(d).cfa.blocks.length + resolveDay(d).mpw.blocks.length > 0, `${d}: nauka od Dnia zero`);
});

// Dodatkowe sloty bloków wypełniają „dziury” w szablonie: slot może kończyć się tam, gdzie zaczyna się następny, albo tuż przed blokami, które ten odstęp zajmują (D-099, D-116)
// D-120: luki szablonu wypełniają bloki CFA i MPW o godzinach spoza szablonu (21:00, 22:00 …)
const extraBlocks = d => [...SRC.cfa.D.bloki.filter(b => b.data === d), ...(mpwByDay[d] || [])].map(b => b.godz.split('–'));
const filled = (d, from, to) => { const ex = extraBlocks(d); let at = from; for (let moved = true; moved && at < to;) { moved = false; for (const [f, e] of ex) if (f <= at && e > at) { at = e; moved = true; } } return at >= to; };

test('D-099, D-116: blok J 21:00–21:53 i blok dodatkowy 17:40–18:33 — dodatkowe sloty; wieczór w dni z J: kolacja 20:50–21:00 (z chondroityną), blok J, przygotowanie 21:53–22:00; bez J — wieczór jak dotąd', () => {
  // D-120: w dni z CFA J i MPW C — MPW C 21:00, CFA J 22:00 (w miejscu „Wieczoru wolnego”); wieczór wg bloku o 21:00 (kolacja 20:50–21:00, D-099)
  const ev = r => r.slots.filter(s => s.from >= '20:35' && s.from < '23:00').map(s => `${s.from}–${s.to} ${s.title}`);
  const mon = resolveDay('2027-01-04');   // pierwszy dzień z blokiem J
  assert.deepEqual(ev(mon), ['20:35–20:50 Przygotowywanie kolacji i zmywanie', '20:50–21:00 Kolacja', '21:00–21:53 Nauka MPW',
    '21:53–22:00 Przygotowywanie posiłków, melisy i wieczorna pielęgnacja', '22:00–22:53 CFA blok J', '22:53–23:00 Wieczorna toaleta']);
  const sup = mon.slots.find(s => s.id === 'slot.2100');
  assert.deepEqual([sup.items.find(i => i.kind === 'meal').text, sup.items.find(i => i.kind === 'meal').kcal > 0, sup.doses.map(d => `${d.time} ${d.supp}`)], ['Kolacja (20:50)', true, ['20:50 chondroityna']]);
  const j = mon.slots.find(s => s.cfa?.some(b => b.blok === 'J'));
  assert.deepEqual([j.id, j.from, j.to, j.role, j.extra, j.title, j.cfa.length, j.doses.length], ['slot.cfa.J.2200', '22:00', '22:53', 'cfa', true, 'CFA blok J', 1, 3]);
  // wszystkie dni z J (88): sloty bez luk i nakładania; J o 21:00 tylko bez MPW C, bloku dodatkowego i czwartku z zakupami
  const days = [...new Set(SRC.cfa.D.bloki.filter(b => b.blok === 'J').map(b => b.data))];
  assert.equal(days.length, 88);
  for (const d of days) {
    const r = resolveDay(d), base = r.slots.filter(s => !s.extra), jb = r.cfa.blocks.find(b => b.blok === 'J');
    base.forEach((s, i) => { const next = base[(i + 1) % base.length].from; assert.ok(s.to === next || filled(d, s.to, next), `${d} ${s.id}: ${s.to} → ${next}`); });
    const thu = dayPlan(d).variant === 'czwartek_st', moved = thu || r.cfa.blocks.some(b => b.blok === 'Dodatkowy') || r.mpw.blocks.some(b => b.blok === 'C');
    assert.equal(jb.godz.slice(0, 5), moved ? '22:00' : '21:00', d);
    const sp = r.slots.find(s => s.id === 'slot.2100'), tail = r.slots.find(s => s.id === 'slot.2145');
    assert.deepEqual([sp.from, sp.to, tail.from], block21(d) ? ['20:50', '21:00', '21:53'] : ['21:00', '21:53', '21:53'], d);   // czwartek: relaks z kolacją 21:00–21:53
    assert.equal(r.doses.some(x => x.time === '21:00'), !block21(d), `${d}: chondroityna z kolacją`);
  }
  // dni bez bloku o 21:00 i 22:00 — wieczór jak dotąd (21:00–21:45 kolacja, 21:45–22:00 przygotowanie)
  for (const d of ['2026-10-15', '2026-10-25', '2026-11-12', '2026-11-20', '2026-12-24', '2027-06-30', '2027-12-31']) {
    const r = resolveDay(d);
    assert.equal(r.slots.some(s => /^slot\.(cfa|mpw)\./.test(s.id)), false, d);
    assert.deepEqual([r.slots.find(s => s.id === 'slot.2100').from, r.slots.find(s => s.id === 'slot.2100').to, r.slots.find(s => s.id === 'slot.2145').from], ['21:00', '21:45', '21:45'], d);
    if (!r.outside && d <= '2027-04-30') assert.ok(r.doses.some(x => x.supp === 'chondroityna' && x.time === '21:00'), d);   // D-121: chondroityna do 30.04.2027
  }
  // D-120: blok dodatkowy 21:00–21:53 (ciągłość materiału), J 22:00 — okno treningowe wolne od bloków
  const ext = d => resolveDay(d).slots.filter(s => s.extra).map(s => `${(s.cfa[0] || s.mpw).blok} ${s.from}–${s.to}`).join();
  assert.equal(ext('2027-03-22'), 'Dodatkowy 21:00–21:53,J 22:00–22:53');
  assert.equal(ext('2026-11-20'), '', 'przed startem planu (D-121)');
  const m = resolveDay('2027-03-22').slots.map(s => s.id), order = ['slot.1815', 'slot.cfa.Dodatkowy.2100', 'slot.cfa.J.2200'].map(id => m.indexOf(id));
  assert.ok(order[0] >= 0 && order[0] < order[1] && order[1] < order[2], 'trening, potem blok dodatkowy 21:00 i J 22:00');
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
    const ac = (mpwByDay[d] || []).filter(b => !b.blok.startsWith('P') || !r.slots.some(s => s.mpw === b && !s.extra));   // D-120: P7 o 22:00 — slot „Nauka MPW”
    for (const s of slots) {
      if (s.own) { own++; assert.deepEqual([s.title, s.desc, s.cfa.length], [s.work ? 'Praca' : 'Czas własny', '', 0], `${d} ${s.from}`); }
      // D-120: „Praca” — dni robocze od 2027 poza świętami, 08:00–15:23
      if (s.work) assert.ok(d >= '2027-01-01' && new Date(`${d}T12:00`).getDay() % 6 !== 0 && !SRC.week.work.holidays.includes(d) && s.from >= '08:00' && s.to <= '15:23', `${d} ${s.from}`);
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

test('D-119: sourceText — tom, dział i strony drukowane zamiast nazwy pliku; inne źródła bez zmian', () => {
  assert.equal(sourceText({ zrodlo: 'CFA Level I 2027 Vol 1. Quantitative Methods.pdf', do_przeczytania: 'PDF 157–168 · druk 147–158' }), 'Vol 1 · Quantitative Methods · s. 147–158 (12 s.)');
  assert.equal(sourceText({ zrodlo: 'Kodeks cywilny', do_przeczytania: 'art. 56–81 · s. 14–23 (10 s.)' }), 'Kodeks cywilny · art. 56–81 · s. 14–23 (10 s.)');
  assert.equal(sourceText({ zrodlo: 'Dziennik błędów i rozwiązane mocki', do_przeczytania: '' }), 'Dziennik błędów i rozwiązane mocki');
});
