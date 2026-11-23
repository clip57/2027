// Spójność planu (D-116, 20.11.2026): plan CFA Level I 2027 (451 bloków, 20.11.2026–12.05.2027 — lektura Curriculum 2027, bank pytań, powtórki, 2 mocki)
// równolegle z planem MPW (do 20.03.2027), kalendarz 18.10.2026–31.12.2027 (D-117; Faza 0 do 11.11, Faza 1 12.11–10.12, Faza 2 od 11.12), zakupy w czwartki,
// święta, niedziela z basenem. Plan CFA sam ze sobą (numeracja, litery = sloty szablonu dnia, statystyki, działy, mocki), z planem MPW (bez nakładania się),
// z szablonem dnia (warianty: „basen”, „czwartek”, „czwartek_zl”, „czwartek_bz”, „czwartek_st”), z fazami, wyjątkami dat i suplementacją.
// Plany CFA V44 (D-103) i starsze nie są już w danych — ich testy zastąpione (raport D-116).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SRC, mpwByDay } from '../../src/core/data.js';
import { weekday, dayName, range } from '../../src/core/dates.js';
import { CFA_BLOCKS, CFA_PLAN_VERSION } from '../../src/core/storage/validate.js';
import { cfaProgressEvents } from '../../src/core/migrate/cfa.js';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { resolveDay, templateFor, dayPlan, hasJ, block21, phaseFor, mTrainDay } from '../../src/core/resolver.js';
import { consumptionForDay } from '../../src/core/calc/consumption.js';
import cfaJson from '../../src/data/cfa.json' with { type: 'json' };

const D = SRC.cfa.D, B = D.bloki;
// PLAN0 — początek CAŁEGO planu (D-121: Dzień zero 23.11.2026; dieta, suplementy i treningi od TRAIN0 = 24.11); PLAN_END — koniec kalendarza (D-117: 31.12.2027; wcześniej D-116: 30.06.2027); CFA_START / END — zakres planu CFA 2027
const PLAN0 = '2026-11-23', TRAIN0 = '2026-11-24', CFA_START = '2026-11-20', END = '2027-05-12', PLAN_END = '2027-12-31';
const TIMES = { B: '09:10–10:03', C: '10:10–11:03', D: '11:20–12:13', E: '12:20–13:13', F: '13:30–14:23', G: '14:30–15:23', H: '15:30–16:23', I: '16:40–17:33', Dodatkowy: '17:40–18:33', J: '21:00–21:53' };
const byDay = B.reduce((m, b) => ((m[b.data] ||= []).push(b), m), {});
const count = (list, key) => list.reduce((m, b) => ((m[b[key]] = (m[b[key]] || 0) + 1), m), {});
// D-121: plan z pliku (daty od 20.11) — testy struktury pliku; w aplikacji bloki przesunięte (`studyMoves`, od Dnia zero 23.11)
const RAW = cfaJson.D.bloki, rawByDay = RAW.reduce((m, b) => ((m[b.data] ||= []).push(b), m), {});
const reading = RAW.filter(b => b.tryb === 'LEKTURA');
const overlaps = (a, b) => { const [f1, t1] = a.split('–'), [f2, t2] = b.split('–'); return f1 < t2 && f2 < t1; };

test('CFA 2027 (D-116): 451 bloków 1–451, 151 dni 20.11.2026–12.05.2027, nazwy dni zgodne z kalendarzem, numeracja w kolejności dat i godzin', () => {
  assert.equal(B.length, 451);
  assert.deepEqual(B.map(b => b.nr), [...Array(451)].map((_, i) => i + 1));
  assert.deepEqual([Object.keys(rawByDay).length, Object.keys(rawByDay)[0], Object.keys(rawByDay).at(-1)], [151, CFA_START, END]);
  for (const b of B) assert.equal(b.dzien, dayName(b.data), `nr ${b.nr}`);
  assert.ok(RAW.every((b, i) => i === 0 || `${RAW[i - 1].data} ${RAW[i - 1].godz}` <= `${b.data} ${b.godz}`), 'numeracja w kolejności dat i godzin (plik)');
  assert.ok(B.every((b, i) => i === 0 || `${B[i - 1].data} ${B[i - 1].godz}` <= `${b.data} ${b.godz}`), 'D-121: po przesunięciach też chronologicznie');
  assert.deepEqual([Object.keys(byDay)[0], Object.keys(byDay).at(-1), D.stat.start], ['2026-11-23', END, '2026-11-23'], 'D-121: w aplikacji od Dnia zero 23.11');
  assert.ok(B.every(b => b.egzamin === 'CFA Level I'));
  assert.equal(D.version, 'CFA_L1_2027_451_20261120');
  assert.equal(D.previousVersion, null, 'nowy plan — bez mapowania postępu z V44');
  assert.equal(SRC.cfa.exam, '2027-05-13', 'D-117: egzamin CFA 13.05.2027 (dzień po ostatnim bloku planu)');
  assert.equal(SRC.cfa.examNote, undefined);
});

test('CFA 2027: litery bloków B–I = sloty szablonu dnia (te same godziny), J 21:00–21:53, „Dodatkowy” 17:40–18:33; bez nakładania się z planem MPW; bez sesji mocka S1/S2', () => {
  const slots = Object.fromEntries(SRC.dayTemplate.slots.filter(s => s.role === 'cfa').map(s => [s.key, `${s.from}–${s.to}`]));
  for (const b of B) {
    assert.equal(b.godz_src ?? b.godz, TIMES[b.blok], `nr ${b.nr}: litera ${b.blok}`);   // D-120: godzina z planu (w aplikacji wg decyzji)
    if (slots[b.blok]) assert.equal(b.godz_src ?? b.godz, slots[b.blok], `nr ${b.nr}: slot szablonu`);
  }
  assert.deepEqual(count(B, 'blok'), { E: 63, F: 63, G: 63, J: 88, H: 53, I: 53, Dodatkowy: 53, B: 5, C: 5, D: 5 });
  for (const [d, list] of Object.entries(byDay)) for (const c of list) for (const m of mpwByDay[d] || []) assert.ok(!overlaps(c.godz, m.godz), `${d}: CFA ${c.blok} × MPW ${m.blok}`);
  // H, I, „Dodatkowy” dopiero po planie MPW (w czasie planu MPW popołudnie 15:30–18:30 należy do MPW) — wyjątek: 19.02 (luka planu MPW)
  assert.deepEqual([...new Set(B.filter(b => ['H', 'I', 'Dodatkowy'].includes(b.blok) && b.data <= SRC.mpw.D.stat.end).map(b => b.data))], ['2027-02-19']);
  assert.equal(hasJ('2027-01-04'), true);
  assert.equal(hasJ('2026-11-23'), false);
  assert.ok(!B.some(b => /^S\d$/.test(b.blok)), 'bloki mocka mają zwykłe litery');
  assert.equal(D.mockSessions, false);
  assert.deepEqual(D.nightRecall, [], 'bez sesji recall 22:00');
});

test('CFA 2027: statystyki planu zgodne z blokami (bloki, dni, godziny netto 53 min, kategorie, tryby, bez recall)', () => {
  const S = D.stat;
  assert.deepEqual([S.bloki, S.dni, S.cfa, S.mpw, S.start_src, S.end], [451, 151, 451, 0, CFA_START, END]);
  assert.equal(S.godziny, Math.round(451 * 53 / 60 * 100) / 100);
  assert.deepEqual(S.kat, count(B, 'kategoria'));
  assert.deepEqual(S.tryb, count(B, 'tryb'));
  assert.deepEqual(S.tryb, { LEKTURA: 311, 'PIERWSZE PODEJŚCIE': 70, 'POWTÓRKA': 40, SYMULACJA: 18, ANALIZA: 12 });
  assert.deepEqual([S.recall, S.recallEvening, S.recallFinal], [0, 0, 0]);
  assert.match(S.uklad, /^151 dni · 1–10 bloków dziennie$/);
});

test('CFA 2027: 10 działów — bloki LEKTURA wg pola topic (= dzial_cfa), strony, zakres dat działu', () => {
  assert.deepEqual(D.cfa.map(t => t.kod), ['QM', 'FSA', 'FI', 'DER', 'CI', 'EQ', 'PM', 'EC', 'ETH', 'AI']);
  for (const t of D.cfa) {
    const bl = reading.filter(b => b.topic === t.kod);
    assert.ok(bl.length > 0, t.kod);
    assert.equal(bl.reduce((q, b) => q + Number(b.liczba_stron || 0), 0), t.strony, `${t.kod}: strony`);
    assert.deepEqual([bl[0].data, bl.at(-1).data], [t.start, t.koniecd], `${t.kod}: zakres dat`);
  }
  assert.ok(reading.every(b => b.topic === b.dzial_cfa), 'LEKTURA zawsze w jednym dziale');
  assert.equal(B.filter(b => b.topic).length, reading.length, 'pole topic tylko w blokach lektury');
});

test('CFA 2027: mocki 18.04, 01.05, 06.05 i 07.05 (sesje 1 i 2 po 9 bloków + analiza 12 bloków) — zwykły szablon dnia (bez S1/S2)', () => {
  assert.deepEqual(D.mockCFA, ['2027-04-18', '2027-05-01', '2027-05-06', '2027-05-07']);
  assert.deepEqual([...new Set(B.filter(b => b.tryb === 'SYMULACJA').map(b => b.data))], D.mockCFA);
  assert.deepEqual([B.filter(b => b.tryb === 'SYMULACJA').length, B.filter(b => b.tryb === 'ANALIZA').length], [18, 12]);
  assert.ok(B.filter(b => b.tryb === 'ANALIZA').every(b => D.mockCFA.some(m => b.data >= m)), 'analiza po mocku');
  for (const d of D.mockCFA) {
    assert.equal(resolveDay(d).cfa.isMock, false, `${d}: szablon dnia bez sesji S1/S2 (D-116)`);
    assert.deepEqual(templateFor(d).map(s => s.id), templateFor(d, false).map(s => s.id), d);
  }
});

test('Początek i koniec całego planu (D-121): Dzień zero 23.11.2026 – 31.12.2027; Faza 0 24.11–06.12, Faza 1 07.12–10.01, Faza 2 od 11.01.2027 do końca', () => {
  assert.deepEqual([SRC.phases.start, SRC.phases.zero, SRC.phases.realStart, SRC.phases.dietStart, SRC.phases.trainStart, SRC.phases.end], [PLAN0, PLAN0, TRAIN0, TRAIN0, TRAIN0, PLAN_END]);
  assert.deepEqual(SRC.phases.phases, [{ phase: 0, from: TRAIN0 }, { phase: 1, from: '2026-12-07' }, { phase: 2, from: '2027-01-11' }]);
  for (const d of range('2026-09-25', '2026-11-22')) {
    const x = resolveDay(d);
    assert.deepEqual([x.outside, x.zero, x.noDiet, x.training, x.doses.length, x.cfa.blocks.length, x.mpw.blocks.length, x.sessionLabel], [true, false, false, null, 0, 0, 0, 'Poza planem'], d);
    assert.deepEqual(consumptionForDay(d), {}, d);
  }
  assert.deepEqual([resolveDay('2028-01-01').outside, resolveDay('2028-01-01').after], [true, true]);
  assert.equal(resolveDay('2027-07-01').outside, false, '01.07.2027 w planie (D-117)');
  assert.equal(resolveDay(PLAN_END).outside, false);
  assert.equal(resolveDay('2027-03-29').outside, false, '29.03.2027 już w planie (D-116)');
  // po dotychczasowym końcu (28.03) — ten sam tydzień bazowy: Faza 2, trening wg dnia tygodnia, dieta T/NT, dawki
  assert.deepEqual(['2027-04-05', '2027-04-06', '2027-04-07', '2027-04-08', '2027-04-09', '2027-04-10', '2027-04-11'].map(d => resolveDay(d).sessionLabel),
    ['UPPER 1 + sauna', 'LOWER 1', 'Rower + ABS + sauna', 'Bez treningu, 2 × sauna', 'UPPER 2', 'LOWER 2 + sauna', 'Basen']);
  assert.ok(['2027-04-05', '2027-06-30', '2027-09-15', '2027-12-31'].every(d => resolveDay(d).phase === 2 && resolveDay(d).doses.length > 0 && resolveDay(d).kcal > 0));
  // Dzień zero: w planie, bez diety, dawek, treningu i zużycia; nauka CFA i MPW wg planu
  const z = resolveDay(PLAN0);
  assert.deepEqual([z.outside, z.zero, z.phase, z.noDiet, z.kcal, z.meals.length, z.doses.length, z.training, z.sessionLabel, z.dayType, z.cfa.inPlan, z.cfa.blocks.length, z.mpw.blocks.length],
    [false, true, null, true, null, 0, 0, null, 'Dzień zero', 'free', true, 3, 3]);
  assert.deepEqual(consumptionForDay(PLAN0), {});
  const a = resolveDay(TRAIN0);
  assert.deepEqual([a.outside, a.zero, a.phase, a.noDiet, a.preStart, a.dietVariant, a.kcal > 0, a.sessionLabel, a.doses.length > 0], [false, false, 0, false, false, 'T', true, 'LOWER 1', true]);
  assert.deepEqual([phaseFor('2026-12-06'), phaseFor('2026-12-07'), phaseFor('2027-01-10'), phaseFor('2027-01-11')], [0, 1, 1, 2]);
  for (const d of ['2026-12-12', '2026-12-24']) assert.deepEqual([resolveDay(d).sessionLabel, resolveDay(d).dietVariant, resolveDay(d).dayType, resolveDay(d).sauna], ['Bez treningu', 'NT', 'free', 0], `${d} (D-121)`);
});

test('Szablon dnia D-086: 34 sloty bez luk 07:00→07:00; przerwa 12:13–12:20, blok E 12:20–13:13, lunch 13:13–13:30', () => {
  const t = SRC.dayTemplate.slots;
  assert.equal(t.length, 34);
  t.forEach((s, i) => assert.equal(s.to, t[(i + 1) % t.length].from, `${s.id}: koniec ≠ początek następnego`));
  const at = from => t.find(s => s.from === from);
  assert.deepEqual([at('12:13').to, at('12:13').title_src, at('12:13').role], ['12:20', 'Przerwa kognitywna', 'static']);
  assert.deepEqual([at('12:20').to, at('12:20').role, at('12:20').key], ['13:13', 'cfa', 'E']);
  assert.deepEqual(at('12:20').items.map(i => i.text), ['Druga kawa (12:20)']);
  assert.deepEqual([at('13:13').to, at('13:13').role, at('13:13').key], ['13:30', 'meal', 'lunch']);
  assert.deepEqual(at('13:13').items.filter(i => i.kind === 'meal').map(i => [i.meal, i.time]), [['lunch', '13:20']]);
  assert.ok(!JSON.stringify(t).includes('Spacer'), 'spacer regeneracyjny usunięty');
  assert.ok(!t.some(s => s.title_src === 'Długa przerwa'));
  // Pora posiłku i kawy mieści się w swoim slocie
  for (const s of t) for (const i of s.items) {
    const hh = i.time || i.text.match(/\((\d\d:\d\d)\)/)?.[1];
    if (hh && s.to > s.from) assert.ok(hh >= s.from && hh < s.to, `${s.id}: ${i.text}`);
  }
  // Pozostałe godziny bez zmian (D-004): poza zakresem 12:13–13:30 te same sloty co przed D-086
  assert.deepEqual(t.filter(s => s.from < '12:13' || s.from >= '13:30').map(s => s.from),
    ['07:00', '07:15', '08:00', '08:53', '09:10', '10:03', '10:10', '11:03', '11:20', '13:30', '14:23', '14:30', '15:23', '15:30', '16:23', '16:40',
      '17:33', '17:45', '18:05', '18:15', '19:35', '19:45', '20:05', '20:15', '20:35', '20:45', '21:00', '21:45', '22:00', '22:53', '23:00']);
});

test('Numer bloku CFA: plan mieści się w limicie walidacji (1–451, limitu nie zmniejszamy); zapis i import', async () => {
  assert.equal(CFA_BLOCKS, 451);
  assert.ok(B.length <= CFA_BLOCKS);
  const s = await new Store(new MemoryAdapter()).open();
  await s.record('cfa.done', { block: 451, done: true, plan: CFA_PLAN_VERSION });
  assert.ok(s.state.cfaDone.has(451));
  await assert.rejects(s.record('cfa.done', { block: 452, done: true, plan: CFA_PLAN_VERSION }));
  assert.deepEqual(cfaProgressEvents({ wersja: D.version, wykonane: [1, 451, 452, 0] }).map(e => e.d.block), [1, 451]);
});

test('D-116: plan CFA 2027 — nowa numeracja (blok 1 = 20.11 E: Curriculum 2027 Vol 1 QM, PDF 13–24), odhaczenia z V44 nie liczą się', () => {
  assert.deepEqual([RAW[0].nr, RAW[0].data, RAW[0].blok, RAW[0].zrodlo, RAW[0].do_przeczytania, RAW[0].godz], [1, CFA_START, 'E', 'CFA Level I 2027 Vol 1. Quantitative Methods.pdf', 'PDF 13–24 · druk 3–14', '12:20–13:13']);
  assert.deepEqual([B[0].data, B[0].godz], [PLAN0, '12:20–13:13'], 'D-121: blok 1 w Dniu zero 23.11');
  assert.equal(CFA_PLAN_VERSION, 16, 'znacznik generacji numeracji: plan 2027 = 16 (V44 = 15, V3 = 14)');
  assert.equal(B.filter(b => b.data < PLAN0).length, 0, 'D-121: dni przed 23.11 bez bloków');
});

test('D-098, D-103, D-116: start od zera — odhaczenia z v12 (bez pola plan), V3 (14) i V44 (15) nie liczą się w planie 2027, ale zostają w bazie; nowe i importowane niosą plan', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  await s.record('cfa.done', { block: 5, done: true });                              // v12 — bez znacznika planu
  await s.record('cfa.done', { block: 7, done: true, plan: 14 });                    // V3 (D-101)
  await s.record('cfa.done', { block: 8, done: true, plan: 15 });                    // V44 (D-103) — numeracja nieaktualna
  await s.record('cfa.done', { block: 6, done: true, plan: CFA_PLAN_VERSION });
  assert.deepEqual([...s.state.cfaDone], [6]);
  await s.record('cfa.done', { block: 5, done: true, plan: CFA_PLAN_VERSION });
  assert.deepEqual([...s.state.cfaDone].sort((a, b) => a - b), [5, 6]);
  await s.record('cfa.done', { block: 5, done: false, plan: CFA_PLAN_VERSION });
  assert.deepEqual([...s.state.cfaDone], [6]);
  assert.equal(s.allEvents().filter(e => e.t === 'cfa.done').length, 6, 'wszystkie zdarzenia zostają w bazie i eksporcie');
  const imp = cfaProgressEvents({ wykonane: [1, 2], zapis: '2026-11-22T10:00:00.000Z' });   // R2: plik bez wersji zapisany po powstaniu planu 2027
  assert.ok(imp.every(e => e.d.plan === CFA_PLAN_VERSION));
  await s.appendMany(imp, 'import pliku');
  assert.deepEqual([...s.state.cfaDone].sort((a, b) => a - b), [1, 2, 6]);
  assert.throws(() => cfaProgressEvents({ wersja: 'CFA_20261016_SCHWESER2026_V44_FINAL', wykonane: [1] }), /import zablokowany/, 'postęp z V44 — inny plan');
  assert.match(fs.readFileSync(new URL('../../src/modules/cfa.js', import.meta.url), 'utf8'), /doneExtra: \{ plan: CFA_PLAN_VERSION \}/);
});

test('Suplementy czasowe 24.11.2026–30.04.2027 (D-121: 158 dni); zapotrzebowanie wg planu', async () => {
  for (const id of ['chondroityna', 'boswellia', 'glukozamina']) {
    const doses = SRC.supplements.doses.filter(d => d.supp === id);
    assert.ok(doses.length > 0 && doses.every(d => d.validity?.from === TRAIN0 && d.validity?.until === '2027-04-30'), id);
  }
  const days = [...range(TRAIN0, '2027-04-30')].length;
  assert.equal(days, 158);
  for (const c of SRC.seeds.counts) {
    const need = [...range('2026-09-23', '2028-01-31')].reduce((a, d) => a + (consumptionForDay(d)[c.prod] || 0), 0);
    assert.equal(need, c.qty * days / 180, `${c.prod}: potrzeba ${need}`);
    assert.equal(consumptionForDay(PLAN0)[c.prod], undefined, `${c.prod}: Dzień zero bez suplementów`);
    assert.ok(consumptionForDay(TRAIN0)[c.prod] > 0 && consumptionForDay('2027-04-30')[c.prod] > 0, `${c.prod}: od 24.11.2026 do 30.04.2027`);
    assert.equal(consumptionForDay('2027-05-01')[c.prod], undefined, `${c.prod}: od 01.05.2027 bez`);
  }
});

test('Rekompozycja: fazy opisane datami (D-121: Faza 0 24.11–06.12, Faza 1 07.12–10.01, Faza 2 od 11.01; wcześniej D-086 P-2, D-090, D-101, D-103, D-103c) i liczby diety po zmianie skyru na 75 g (D-104)', () => {
  const rekomp = fs.readFileSync(new URL('../../src/data/rekomp.json', import.meta.url), 'utf8');
  assert.ok(!/tygodnie (1–3|4–8|9\+)|3 tygodni bez objawów|Ukończone 3 tygodnie/.test(rekomp));
  for (const t of ['Faza 0 (24.11–06.12)', 'Faza 1 (07.12–10.01)', 'Faza 2 (od 11.01)', 'Sukces = ukończenie Fazy 0 bez objawów', 'Faza 1 od 07.12.2026, Faza 2 od 11.01.2027'])
    assert.ok(rekomp.includes(t), t);
  assert.deepEqual(JSON.parse(rekomp).sections[7].blocks[1].rows.map(r => r[1]), ['24.11–06.12', '07.12–10.01', 'od 11.01']);
  for (const old of ['27.09–11.10', '12.10–15.11', 'od 16.11', '25.09–11.10', '26.09–11.10', 'Faza 1 od 12.10.2026', '12.10–18.10', '19.10–22.11', 'Faza 1 od 19.10.2026',
    '16.10–22.10', '17.10–02.11', '23.10–22.11', 'od 23.11', 'Faza 1 od 23.10.2026', 'Faza 2 od 23.11.2026', '18.10–02.11', '12.11–10.12', 'od 11.12', 'Faza 1 od 12.11.2026']) assert.ok(!rekomp.includes(old), old);
  // D-104: skyr 75 g — tabele składu i zestawienia energii w Rekompozycji zgodne z diet.json (jedno źródło liczb)
  const rk = JSON.parse(rekomp), pl1 = v => v.toFixed(1).replace('.', ','), tot = (variant, phase) => SRC.diet.plans.find(p => p.variant === variant && p.phase === phase).total;
  for (const [ph, ti, ni, ei] of [[0, 3, 6, 2], [1, 10, 13, 4], [2, 17, 20, 6]]) {
    const T = tot('T', ph), N = tot('NT', ph), cells = t => [String(t.kcal), pl1(t.p), pl1(t.c), pl1(t.f)];
    const rows = rk.sections[3].blocks[ti].rows;
    assert.deepEqual(rows.find(r => r[0].startsWith('RAZEM DZIEŃ TRENINGOWY')).slice(1, 5), cells(T), `Faza ${ph}: RAZEM dzień treningowy`);
    assert.deepEqual(rk.sections[3].blocks[ni].rows.find(r => r[0].startsWith('RAZEM DZIEŃ NIETRENINGOWY')).slice(1, 5), cells(N), `Faza ${ph}: RAZEM dzień nietreningowy`);
    assert.deepEqual(rows.filter(r => r[0] === 'Skyr naturalny'), [['Skyr naturalny', '75 g', '—', '50', '9,0', '2,9', '0', '0'], ['Skyr naturalny', '75 g', '—', '50', '9,0', '2,9', '0', '0']], `Faza ${ph}: skyr 75 g`);
    const en = rk.sections[2].blocks[ei].rows.find(r => r[0] === 'Energia');
    assert.deepEqual(en.slice(1, 3), [`${T.kcal} kcal`, `${N.kcal} kcal`], `Faza ${ph}: energia`);
    assert.equal(en[3], `${Math.round((6 * T.kcal + N.kcal) / 7)} kcal`, `Faza ${ph}: średnia tygodniowa`);
    assert.equal(rk.sections[2].blocks[ei].rows.find(r => r[0] === 'Tygodniowa podaż')[1], `${6 * T.kcal + N.kcal} kcal`);
  }
  for (const old of ['2629', '2332', '2784', '2487', '2965', '2668', '2587', '2742', '2923', '100 g skyru', '100 g produktu chłodzonego']) assert.ok(!rekomp.includes(old), `stara wartość ${old}`);
  // daty w tekście zgodne z phases.json
  assert.deepEqual(SRC.phases.phases.map(p => p.from), [TRAIN0, '2026-12-07', '2027-01-11']);
});
test('Dzień mocka: sesje zastępują sloty A–E (E = kontynuacja sesji 2 do 13:00), F wolne (D-019, D-036, D-086)', () => {
  assert.deepEqual(SRC.week.mock.replace, { A: 'S1', B: 'S1', C: 'S2', D: 'S2', E: 'S2' });
  const slots = Object.fromEntries(SRC.dayTemplate.slots.filter(s => s.role === 'cfa').map(s => [s.key, s]));
  assert.ok(slots.E.from < '13:00' && slots.F.from >= '13:00', 'sesja 2 (10:45–13:00) kończy się w slocie E');
});

// Dodatkowe sloty bloków (J, K, L, M…) wypełniają „dziury” w szablonie dnia: slot może kończyć się tam, gdzie zaczyna się następny, albo tuż przed blokami, które ten odstęp zajmują
// D-120: luki wypełniają bloki CFA i MPW o godzinach spoza szablonu (21:00, 22:00, 17:40 …)
const extraBlocks = d => [...(byDay[d] || []), ...(mpwByDay[d] || [])].map(b => b.godz.split('–'));
const filled = (d, from, to) => { const ex = extraBlocks(d); let at = from; for (let moved = true; moved && at < to;) { moved = false; for (const [f, e] of ex) if (f <= at && e > at) { at = e; moved = true; } } return at >= to; };
const continuous = (d, t) => t.forEach((s, i) => { const next = t[(i + 1) % t.length].from; assert.ok(s.to === next || filled(d, s.to, next), `${d} ${s.id}: ${s.to} → ${next}`); });


test('Soboty bez zakupów (D-097): zwykły szablon; zakupy w czwartki — do 06.01 19:05 po saunie (24.12 i 31.12 bez zakupów — D-121, D-109), 07.01–18.03 15:30–16:00 (czwartek_st), od 25.03 znów 19:05 po saunie (D-116)', () => {
  assert.equal(SRC.dayTemplate.variants.zakupy, undefined);
  assert.equal(SRC.week.days['6'].variant, undefined);
  assert.equal(SRC.week.days['4'].variant, 'czwartek');
  const ZL = [], NO_SHOP = ['2026-12-24', '2026-12-31'];   // D-121: wyjątki sprzed 23.11 (22.10, 29.10, 05.11) usunięte; 24.12 — dzień bez treningu i sauny
  for (const d of range(PLAN0, PLAN_END)) {
    const t = templateFor(d);
    continuous(d, t);
    const shop = t.filter(s => s.shop);
    if (weekday(d) === 6 && !String(dayPlan(d).variant).startsWith('d120_')) assert.equal(dayPlan(d).variant ?? null, null, `${d}: sobota — zwykły szablon (poza dniami D-120)`);
    if (weekday(d) !== 4 || NO_SHOP.includes(d)) { assert.equal(shop.length, 0, d); continue; }
    if (ZL.includes(d)) {
      assert.equal(dayPlan(d).variant, 'czwartek_zl', d);
      assert.deepEqual(shop.map(s => `${s.from}–${s.to}`), ['17:45–18:40'], d);
    } else if (d < '2027-01-07' || d > '2027-03-18') {
      assert.equal(dayPlan(d).variant, 'czwartek', d);
      assert.deepEqual(shop.map(s => `${s.from}–${s.to}`), [hasJ(d) ? '19:05–20:25' : '19:05–20:35'], d);
      assert.deepEqual(t.filter(s => s.from >= '17:45' && s.from < '20:20').map(s => `${s.from} ${s.title_src}`), ['17:45 Transport na siłownię', '17:55 Sauna', '19:05 Zakupy'], d);
    } else {
      assert.equal(dayPlan(d).variant, 'czwartek_st', d);
      assert.deepEqual(shop.map(s => `${s.from}–${s.to}`), ['15:30–16:00'], d);
    }
  }
  const bz = templateFor('2026-12-31');
  assert.equal(dayPlan('2026-12-31').variant, 'czwartek_bz');
  assert.deepEqual(bz.filter(s => s.from >= '17:45' && s.from < '20:20').map(s => `${s.from} ${s.title_src}`), ['17:45 Transport na siłownię', '17:55 Sauna', '19:05 Powrót do domu']);
  assert.equal(dayPlan('2026-12-24').variant, null, 'D-121: 24.12 — dzień bez treningu i sauny (szablon podstawowy)');
  assert.ok(!resolveDay('2026-12-24').slots.some(s => s.shop || s.title === 'Zakupy' || /sauny/.test(s.title)));
});

test('Wyjątki dat (D-096…D-109, D-116): dni bez treningu z dietą NT, święta z blokami nauki, 31.12 bez zakupów, 01.01 bez treningu, czwartki 07.01–18.03 (ostatni czwartek planu MPW); po 28.03 bez wyjątków (tydzień bazowy)', () => {
  const row = d => { const r = resolveDay(d); return [r.dayType, r.sessionLabel, r.dietVariant, r.sauna, r.training ? r.training.length > 0 : null]; };
  assert.deepEqual(row('2026-11-29'), ['swim', 'Basen', 'T', 0, null]);
  for (const d of ['2026-12-12', '2026-12-24']) assert.deepEqual(row(d), ['free', 'Bez treningu', 'NT', 0, null], `${d} (D-121)`);
  assert.deepEqual(['2026-11-22', '2026-11-23', '2026-11-24', '2026-12-06', '2026-12-07', '2027-01-10', '2027-01-11', '2027-03-28', '2027-06-30', '2027-12-31'].map(phaseFor), [null, null, 0, 0, 1, 1, 2, 2, 2, 2]);
  assert.deepEqual(row('2026-11-26').slice(1, 3), ['Bez treningu, 2 × sauna', 'NT']);
  // Święta: bez treningu (dieta NT); D-116 — w 25–27.12 bloki MPW 15:30–18:23, w 27–28.03 bloki CFA (sloty nauki w miejscu „Wolne”)
  for (const d of ['2026-12-25', '2026-12-26', '2026-12-27']) {
    assert.deepEqual(row(d), ['free', 'Bez treningu', 'NT', 0, null], d);
    const r = resolveDay(d);
    assert.equal(r.blocks?.kind, 'wolne', d);
    assert.deepEqual(r.mpw.blocks.map(b => b.blok), ['A', 'B', 'C'], `${d}: bloki MPW (D-116)`);
    assert.ok(r.slots.some(s => s.title === 'Nauka MPW' && s.from === '15:30'), `${d}: slot 15:30 — nauka MPW, nie „Wolne”`);
    assert.ok(!r.slots.some(s => s.shop), d);
  }
  for (const d of ['2027-03-27', '2027-03-28']) {
    assert.deepEqual(row(d), ['free', 'Bez treningu', 'NT', 0, null], d);
    const r = resolveDay(d);
    assert.deepEqual(r.slots.filter(s => s.cfa?.length).map(s => s.title), ['CFA blok E', 'CFA blok F', 'CFA blok G', 'CFA blok H', 'CFA blok I', 'CFA — blok dodatkowy'], d);
    assert.equal(r.slots.find(s => s.from === '08:00').title, 'Wolne', `${d}: rano wolne`);
  }
  assert.deepEqual(row('2026-12-31'), ['rest_sauna2', 'Bez treningu, 2 × sauna', 'NT', 2, null]);
  assert.equal(dayPlan('2026-12-31').variant, 'czwartek_bz');
  assert.deepEqual(row('2027-01-01'), ['free', 'Bez treningu', 'NT', 0, null]);
  assert.deepEqual(resolveDay('2027-01-01').mpw.blocks.map(b => b.blok), ['A', 'B', 'C']);
  const thu = [...range('2027-01-07', '2027-03-18')].filter(d => weekday(d) === 4);
  const dates = ['2026-12-12', '2026-12-24', '2026-12-25', '2026-12-26', '2026-12-27', '2026-12-31', '2027-01-01'];   // D-121: wyjątki sprzed 23.11 usunięte
  const d120 = ['2027-02-21', '2027-02-27', '2027-03-06', '2027-03-13', '2027-03-17', '2027-03-20'];   // D-120: symulacje MPW i dni bez treningu
  assert.deepEqual(Object.keys(SRC.week.exceptions).sort(), [...dates, ...thu, ...d120, '2027-03-27', '2027-03-28'].sort());
  for (const d of thu) assert.equal(dayPlan(d).variant, 'czwartek_st', d);
  assert.ok([...range('2027-03-29', PLAN_END)].every(d => !SRC.week.exceptions[d]), 'od 29.03 tydzień bazowy');
});

test('D-116, D-117: studia podyplomowe — zjazdy II–V, VII, VIII i X wg harmonogramu (D-121: zjazd I sprzed startu planu ukryty) (8:00–15:23), bez zjazdu VI (20–21.03), IX (08–09.05 — bloki CFA) i dawnego 05–06.12; egzamin 05.06, obrony 21–22.06', () => {
  const st = Object.entries(SRC.week.blocks).filter(([, b]) => b.kind === 'studia').map(([d, b]) => [d, b.desc.replace('Studia podyplomowe — ', '')]);
  assert.deepEqual(st, [['2026-11-28', 'zjazd II (online)'], ['2026-11-29', 'zjazd II (online)'],
    ['2027-01-09', 'zjazd III (online)'], ['2027-01-10', 'zjazd III (online)'], ['2027-02-06', 'zjazd IV'], ['2027-02-07', 'zjazd IV'], ['2027-02-20', 'zjazd V'], ['2027-02-21', 'zjazd V'],
    ['2027-04-03', 'zjazd VII'], ['2027-04-04', 'zjazd VII'], ['2027-04-24', 'zjazd VIII (online)'], ['2027-04-25', 'zjazd VIII (online)'],
    ['2027-05-29', 'zjazd X'], ['2027-05-30', 'zjazd X'], ['2027-06-05', 'egzamin końcowy (online)'], ['2027-06-21', 'obrony prac (online, 21 lub 22.06 wg przydziału)'], ['2027-06-22', 'obrony prac (online, 21 lub 22.06 wg przydziału)']]);
  assert.ok(Object.values(SRC.week.blocks).filter(b => b.kind === 'studia').every(b => b.title === 'Wycena przedsiębiorstwa i modelowanie finansowe - studia'));
  assert.equal(SRC.week.blocks['2026-12-05'], undefined);
  assert.equal(SRC.week.blocks['2027-03-20'], undefined, '20.03 — powtórka MPW, bez zjazdu VI');
  assert.equal(SRC.week.blocks['2027-03-21'].kind, 'egzamin');
  assert.ok(Object.keys(SRC.week.blocks).every(d => d >= PLAN0), 'D-121: bloki weekendów sprzed 23.11 (zjazd I 14–15.11, rozmowa 21–22.11) usunięte');
  // D-117: bez zjazdu IX — 08.05 wszystkie bloki CFA w swoich slotach
  const r = resolveDay('2027-05-08');
  assert.equal(r.slots.filter(s => s.block === 'studia').length, 0);
  assert.deepEqual(r.slots.filter(s => s.cfa?.length).map(s => s.title), ['CFA blok B', 'CFA blok C', 'CFA blok D', 'CFA blok E', 'CFA blok F', 'CFA blok G', 'CFA blok H', 'CFA blok I', 'CFA — blok dodatkowy']);
  // zjazd ma pierwszeństwo przed blokiem CFA (opis kolizji) — mechanizm sprawdzony na zjeździe VII (03.04: bez bloków CFA w godzinach zjazdu)
  assert.ok(resolveDay('2027-04-03').slots.filter(s => s.block === 'studia').length === 7);
  // D-120: praca dyplomowa 08:00–11:03 (12.12), potem CFA E–G od 11:20 i MPW A 14:30 (weekend — o jeden slot wcześniej)
  const w = resolveDay('2026-12-12');
  assert.deepEqual(w.slots.filter(s => s.role === 'cfa' && s.from < '15:23').map(s => s.title),
    ['Pisanie pracy dyplomowej', 'Pisanie pracy dyplomowej', 'Pisanie pracy dyplomowej', 'CFA blok E', 'CFA blok F', 'CFA blok G', 'Nauka MPW']);
  assert.equal(w.blocks.short, 'Praca dyplomowa 8:00–11:03');
});

test('D-116: dni z blokiem J (21:00–21:53) — kolacja 20:50–21:00, blok J, przygotowanie posiłków 21:53–22:00 (D-099); „blok dodatkowy” 17:40–18:33 jako osobny slot; w dni bez treningu okno „Wolne” przycięte wokół bloków', () => {
  // D-120: blok dodatkowy 21:00–21:53 (w miejscu J — ciągłość materiału), J 22:00–22:53 zamiast „Wieczoru wolnego”; okno treningowe bez kolizji
  const r = resolveDay('2027-04-05');
  assert.deepEqual(r.slots.filter(s => s.from >= '20:45' && s.from < '23:00').map(s => `${s.from}–${s.to} ${s.title}`).slice(-5),
    ['20:50–21:00 Kolacja', '21:00–21:53 CFA — blok dodatkowy', '21:53–22:00 Przygotowywanie posiłków, melisy i wieczorna pielęgnacja', '22:00–22:53 CFA blok J', '22:53–23:00 Wieczorna toaleta']);
  assert.deepEqual(r.slots.filter(s => s.extra).map(s => `${s.id} ${s.from}–${s.to} ${s.title}`), ['slot.cfa.Dodatkowy.2100 21:00–21:53 CFA — blok dodatkowy', 'slot.cfa.J.2200 22:00–22:53 CFA blok J']);
  assert.deepEqual(r.slots.find(s => s.from === '22:00').items.map(i => i.text), ['Melisa (22:00)'], 'zadanie „melisa” przechodzi do slotu bloku');
  assert.deepEqual(r.slots.find(s => s.from === '22:00').doses.map(d => d.supp), ['glicyna', 'magnez_glicynian', 'melatonina']);
  assert.equal(resolveDay('2027-05-17').slots.find(s => s.title === 'Wieczór wolny').desc, '', 'plan bez recall — bez opisu „brak sesji”');
  for (const d of ['2027-03-27', '2027-03-28']) {
    const x = resolveDay(d), blocks = x.slots.filter(s => s.cfa?.length);
    for (const wl of x.slots.filter(s => s.domain === 'train' && s.title === 'Wolne')) for (const b of blocks) assert.ok(wl.to <= b.from || wl.from >= b.to, `${d}: „Wolne” ${wl.from}–${wl.to} ∩ ${b.title}`);
  }
  assert.ok(![...range(PLAN0, PLAN_END)].some(mTrainDay), 'plan 2027 bez bloku M — układ D-103 nie występuje');
});

test('Niedziela z basenem (D-094): basen 18:15–19:30, posiłek 19:30, relaks, prysznic całego ciała; z blokiem J o 10 min wcześniej; święta bez wariantu; kreatyna z posiłkiem potreningowym', () => {
  const v = SRC.dayTemplate.variants.basen;
  assert.deepEqual(v.replaces, ['slot.1815', 'slot.1935', 'slot.1945', 'slot.2005', 'slot.2015', 'slot.2035']);
  assert.equal(SRC.week.days['7'].variant, 'basen');
  for (const d of range(PLAN0, PLAN_END)) {
    if (weekday(d) !== 7) continue;
    const exv = SRC.week.exceptions[d];
    if (exv && exv.variant !== 'basen') { assert.ok((dayPlan(d).variant ?? null) === null || dayPlan(d).variant.startsWith('d120_'), d); continue; }   // święta; D-120: 21.02 bez basenu
    const t = templateFor(d);
    continuous(d, t);
    const r = resolveDay(d), at = from => r.slots.find(s => s.from === from && !s.extra);
    assert.deepEqual([at('18:15').to, at('18:15').title], ['19:30', 'Basen 55 min'], d);
    // D-120: blok o 21:00 (niedziela zjazdowa) — 10 min oddaje relaks (posiłek po basenie 19:30–19:45 bez zmian), kolacja 20:50
    const j = block21(d), [e1, e2, e3] = j ? ['19:45', '20:05', '20:35'] : ['19:45', '20:15', '20:45'];
    assert.deepEqual([at('19:30').to, at('19:30').meal, at('19:30').items.map(i => i.text)], ['19:45', 'post', ['Posiłek potreningowy (19:30)']], d);
    assert.deepEqual([at(e1).to, at(e1).title], [e2, 'Relaks'], d);
    assert.deepEqual([at(e2).to, at(e2).title], [e3, 'Prysznic całego ciała'], d);
    assert.equal(at(e3).id, 'slot.2045', d);
  }
  const kre = d => resolveDay(d).slots.filter(x => x.doses.some(y => y.supp === 'kreatyna')).map(x => [x.id, x.doses.find(y => y.supp === 'kreatyna').time]);
  for (const d of ['2026-12-06', '2026-12-13', '2027-04-04']) assert.deepEqual(kre(d), [['slot.1930n', '19:30']], d);
  for (const d of ['2026-11-24', '2026-11-30', '2027-04-05', '2026-12-12', '2026-12-24', '2027-03-27']) assert.deepEqual(kre(d), [['slot.2015', '20:15']], d);
  assert.deepEqual(kre('2026-11-23'), [], 'Dzień zero — bez dawek (D-121)');
  assert.deepEqual(kre('2026-11-26'), [['slot.1905c', '20:15']]);
  assert.deepEqual(kre('2026-12-31'), [['slot.1905b', '20:15']]);
  assert.deepEqual(kre('2027-01-07'), [['slot.2015', '20:15']]);
  assert.equal(SRC.supplements.doses.filter(x => x.supp === 'kreatyna').reduce((n, x) => n + x.weekdays.length, 0), 7);
});

test('Czwartki od 07.01.2027 (D-097): bloki MPW 30 min później w slotach wariantu, suplementy przed sauną 17:45, obiad 16:53', () => {
  const r = resolveDay('2027-01-07');
  assert.deepEqual(r.mpw.blocks.map(b => [b.blok, b.godz, b.godz_src]), [['A', '16:00–16:53', '15:30–16:23'], ['B', '17:00–17:53', '16:30–17:23'], ['C', '18:00–18:53', '17:30–18:23']]);
  assert.deepEqual(r.slots.filter(s => s.mpw).map(s => `${s.from} ${s.title}`), ['16:00 MPW blok A', '17:00 MPW blok B', '18:00 MPW blok C']);
  assert.deepEqual(r.doses.filter(d => ['kolagen', 'tauryna', 'witamina_c'].includes(d.supp) && d.time > '17:00').map(d => d.time), ['17:45', '17:45', '17:45']);
  assert.equal(r.slots.find(s => s.meal === 'dinner').items[0].text, 'Obiad (16:53)');
  assert.deepEqual(resolveDay('2027-01-06').mpw.blocks.map(b => b.godz.slice(0, 5)), ['15:30', '16:40', '21:00'], 'środa bez przesunięcia czwartkowego (D-120: B 16:40, C 21:00 — dzień z CFA J)');
  assert.deepEqual(resolveDay('2026-12-31').doses.filter(d => d.supp === 'kolagen').map(d => d.time), ['17:15']);
});
