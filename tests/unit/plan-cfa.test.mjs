// Spójność planu po zmianach D-086…D-103 (plan CFA V44: 313 bloków, 27 dni od 16.10 — A–I, J 21:00–21:53 i M 19:40–20:33 poza 16.10/23.10/25.10, K i L 23.10 i 03–11.11,
// L także 22.10 i 29.10; kalendarz od 15.10, treningi od 17.10, plan do 28.03.2027; zakupy w czwartki): harmonogram CFA sam ze sobą (statystyki, strony, readingi,
// mocki), z szablonem dnia (warianty: niedziela „basen”, czwartek „czwartek” / „czwartek_zl” / „czwartek_bz” / „czwartek_st”), z fazami, wyjątkami dat i suplementacją.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { SRC, mpwByDay, plan } from '../../src/core/data.js';
import { weekday, dayName, range } from '../../src/core/dates.js';
import { CFA_BLOCKS, CFA_PLAN_VERSION } from '../../src/core/storage/validate.js';
import { cfaProgressEvents } from '../../src/core/migrate/cfa.js';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { resolveDay, templateFor, dayPlan, hasJ, phaseFor, mTrainDay } from '../../src/core/resolver.js';
import { consumptionForDay } from '../../src/core/calc/consumption.js';

const D = SRC.cfa.D, B = D.bloki;
// PLAN0 — początek CAŁEGO planu: kalendarza, diety, suplementów, zakupów i treningów (18.10, D-103c; 15–17.10 usunięte); wyjątkowo bez treningu 01.11 i 02.11 (D-103b); CFA_START — pierwszy dzień planu CFA V44 (16.10; plan CFA ma własny zakres)
const PLAN0 = '2026-10-18', DIET0 = '2026-10-18', TRAIN0 = '2026-10-18', CFA_START = '2026-10-16', END = '2026-11-11', PLAN_END = '2027-03-28';
const NO_JM = ['2026-10-16', '2026-10-23', '2026-10-25'], L_EXTRA = ['2026-10-22', '2026-10-29'], KL = ['2026-10-23', ...range('2026-11-03', END)];
const M_TRAIN = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-24', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-30', '2026-10-31'];   // D-103b: bez 17.10, 01.11 i 02.11
const NO_TRAIN_M = ['2026-11-01', '2026-11-02'];   // dni wyjątkowo bez treningu z blokiem M i bez K/L (D-103b)
const TRIMMED = [...KL, ...NO_TRAIN_M];   // dni bez treningu z blokami w oknie treningowym — liczba slotów szablonu zależy od dnia
const TIMES = { A: '08:00–08:53', B: '09:10–10:03', C: '10:10–11:03', D: '11:20–12:13', E: '12:20–13:13', F: '13:30–14:23', G: '14:30–15:23', H: '15:30–16:23', I: '16:40–17:33', K: '17:40–18:33', L: '18:40–19:33', M: '19:40–20:33', J: '21:00–21:53', S1: '08:00–10:15', S2: '10:45–13:00' };
const byDay = B.reduce((m, b) => ((m[b.data] ||= []).push(b), m), {});
const count = (list, key) => list.reduce((m, b) => ((m[b[key]] = (m[b[key]] || 0) + 1), m), {});
const reading = B.filter(b => b.tryb === 'CZYTANIE');

test('CFA V44: 313 bloków 1–313, 27 dni 16.10–11.11 bez przerw, nazwy dni zgodne z kalendarzem (D-103)', () => {
  assert.equal(B.length, 313);
  assert.deepEqual(B.map(b => b.nr), [...Array(313)].map((_, i) => i + 1));
  assert.deepEqual(Object.keys(byDay), [...range(CFA_START, END)]);
  for (const b of B) assert.equal(b.dzien, dayName(b.data), `nr ${b.nr}`);
  assert.equal(SRC.cfa.exam, '2026-11-12');
  assert.deepEqual([D.exam.date, D.exam.time, D.exam.recallEnd], ['2026-11-12', '15:00', '13:13']);
  assert.equal(D.version, 'CFA_20261016_SCHWESER2026_V44_FINAL');
  assert.ok(B.every((b, i) => i === 0 || `${B[i - 1].data} ${B[i - 1].godz}` <= `${b.data} ${b.godz}`), 'numeracja w kolejności dat i godzin');
  assert.ok(B.every(b => b.planStatus === 'obowiazkowy'), 'wszystkie bloki obowiązkowe');
});

test('CFA V44: bloki A–I codziennie, J i M poza 16.10/23.10/25.10, K i L 23.10 i 03–11.11, L także 22.10 i 29.10; godziny liter stałe, A–I = sloty szablonu; mock S1×3, S2×3, G, H, I (+K, L, M, J)', () => {
  const slots = Object.fromEntries(SRC.dayTemplate.slots.filter(s => s.role === 'cfa').map(s => [s.key, `${s.from}–${s.to}`]));
  assert.deepEqual(Object.keys(slots), [...'ABCDEFGHI']);
  for (const [d, list] of Object.entries(byDay)) {
    const head = D.mockCFA.includes(d) ? 'S1,S1,S1,S2,S2,S2,G,H,I' : 'A,B,C,D,E,F,G,H,I';
    const tail = [...(KL.includes(d) ? ['K'] : []), ...(KL.includes(d) || L_EXTRA.includes(d) ? ['L'] : []), ...(NO_JM.includes(d) ? [] : ['M', 'J'])].join();
    assert.equal(list.map(b => b.blok).join(), tail ? `${head},${tail}` : head, d);
    for (const b of list) assert.equal(b.godz, TIMES[b.blok], `nr ${b.nr}`);
    for (const b of list) if (slots[b.blok]) assert.equal(b.godz, slots[b.blok], `nr ${b.nr}: slot szablonu`);
  }
  assert.deepEqual(D.noNightDates, ['2026-10-23', '2026-10-25']);
  assert.deepEqual(D.nightDates, Object.keys(byDay).filter(d => !D.noNightDates.includes(d)), 'recall 22:00 codziennie poza 23.10 i 25.10');
  assert.deepEqual(['J', 'K', 'L', 'M'].map(l => B.filter(b => b.blok === l).length), [24, 10, 12, 24]);
  assert.deepEqual(Object.values(count(Object.values(byDay).map(l => ({ n: l.length })), 'n')), [2, 14, 2, 9], 'układ 2×9 + 14×11 + 2×12 + 9×13');
  assert.equal(hasJ('2026-10-16'), false);
  assert.equal(hasJ('2026-10-17'), true);
});

test('CFA V44: statystyki planu zgodne z blokami (bloki, dni, godziny, kategorie, tryby, recall)', () => {
  const S = D.stat;
  assert.deepEqual([S.bloki, S.dni, S.cfa, S.start, S.end, S.uklad], [313, 27, 313, CFA_START, END, '2×9 + 14×11 + 2×12 + 9×13']);
  assert.deepEqual(S.kat, count(B, 'kategoria'));
  assert.deepEqual(S.kat, { SchweserNotes: 118, 'Practice CFA': 157, 'CFA Curriculum': 38 });
  assert.deepEqual(S.tryb, count(B, 'tryb'));
  assert.deepEqual(S.tryb, { CZYTANIE: 151, PRACTICE: 127, DOPRECYZOWANIE: 5, MOCK: 18, 'ANALIZA BŁĘDÓW': 12 });
  // Godziny: bloki poza sesjami mocków + wszystkie sesje recall, 53 min; sesje mocków 6 × 135 min; razem zaokrąglone do pełnych godzin
  const nonMock = B.filter(b => b.tryb !== 'MOCK').length;
  assert.equal((nonMock + S.recall) * 53, S.minutyNaukiZRecallemBezMockow);
  assert.equal(S.minutyMockow, 6 * 135);
  assert.equal(S.minutyNaukiZRecallemBezMockow + S.minutyMockow, S.minutyRazemZMockami);
  assert.equal(Math.round(S.minutyRazemZMockami / 60), S.godziny);
  assert.equal(S.godziny, 301);
  // Recall: 25 sesji o 22:00 (codziennie poza 23.10 i 25.10) + 5 sesji A–E dnia 12.11 poza pulą bloków — razem 30
  assert.deepEqual([S.recallEvening, S.recallFinal, S.recall], [D.nightDates.length, D.recallSessions.length, 30]);
  assert.deepEqual(D.nightRecall.map(r => r.data), D.nightDates);
  assert.ok(D.recallSessions.every(r => r.data === SRC.cfa.exam && r.tryb === 'ACTIVE RECALL'));
  assert.deepEqual(D.recallSessions.map(r => r.blok), [...'ABCDE']);
});

test('CFA V44: czytanie do fpEnd (02.11, ostatni blok D), SchweserNotes + Curriculum (Ethics), doprecyzowanie, practice 127 bloków (16.10–11.11) = 1958 pozycji banku', () => {
  assert.deepEqual([D.fpEnd, D.fpLastSlot, D.fpLastTime], ['2026-11-02', 'D', '12:13']);
  assert.deepEqual([reading.at(-1).data, reading.at(-1).blok], ['2026-11-02', 'D']);
  assert.equal(reading.length, 151);
  assert.deepEqual(count(reading, 'kategoria'), { SchweserNotes: 118, 'CFA Curriculum': 33 });
  assert.ok(reading.filter(b => b.kategoria === 'CFA Curriculum').every(b => b.topic === 'ETH'), 'Curriculum tylko w Ethics (Schweser pomija pełne Ethics)');
  assert.deepEqual(B.filter(b => b.tryb === 'DOPRECYZOWANIE').map(b => `${b.data.slice(5)}${b.blok}`), ['10-22A', '10-23I', '10-25F', '11-07C', '11-09C']);
  assert.ok(B.filter(b => b.kategoria === 'Practice CFA').every(b => ['PRACTICE', 'MOCK', 'ANALIZA BŁĘDÓW'].includes(b.tryb)));
  const pr = B.filter(b => b.tryb === 'PRACTICE'), ps = D.practiceSummary;
  assert.deepEqual([pr.length, pr[0].data, pr.at(-1).data], [127, CFA_START, END], 'practice od pierwszego do ostatniego dnia planu');
  assert.deepEqual(count(pr, 'practiceType'), { tematyczne: ps.dedicated, mieszane: ps.mixed, naprawa: ps.repair });
  assert.deepEqual([ps.dedicated, ps.mixed, ps.repair], [75, 30, 22]);
  assert.equal(pr.reduce((a, b) => a + b.bankNewCount, 0), D.questionBank.total, 'każda z 1958 pozycji banku dokładnie raz');
  // Analiza błędów: G, H dnia mocka 1, G, H, I, K dnia mocka 2 (+ A, B nazajutrz), G, H dnia mocka 3 (+ A, B nazajutrz — 11.11)
  assert.deepEqual(B.filter(b => b.tryb === 'ANALIZA BŁĘDÓW').map(b => `${b.data.slice(5)}${b.blok}`),
    ['11-04G', '11-04H', '11-05G', '11-05H', '11-05I', '11-05K', '11-06A', '11-06B', '11-10G', '11-10H', '11-11A', '11-11B']);
});

test('CFA V44: 10 działów — bloki CZYTANIE wg pola topic, strony (rdzeń + dodatki), limit stron bloku, spójność z statystykami planu', () => {
  assert.equal(D.cfa.length, 10);
  assert.deepEqual(D.cfa.map(t => t.kod), ['QM', 'FSA', 'CI', 'FI', 'EQ', 'PM', 'EC', 'DER', 'AI', 'ETH']);
  let core = 0;
  for (const t of D.cfa) {
    const bl = reading.filter(b => b.topic === t.kod);
    assert.equal(bl.length, t.bloki, t.kod);
    assert.equal(t.bloki, t.blocks, t.kod);
    assert.equal(bl.reduce((q, b) => q + b.corePageCount, 0), t.strony, `${t.kod}: strony rdzenia`);
    assert.ok(bl[0].data >= t.start && bl.at(-1).data <= t.koniecd, `${t.kod}: zakres dat działu`);
    core += t.strony;
  }
  for (const b of reading) {
    assert.equal(b.pageEnd - b.pageStart + 1 <= b.pageCount, true, `nr ${b.nr}: strony bloku`);
    assert.ok(b.pageCount <= (b.pageLimit ?? 10), `nr ${b.nr}: limit stron ${b.pageLimit}`);
  }
  assert.equal(core, D.stat.bodyPages);
  assert.equal(reading.reduce((q, b) => q + b.pageCount, 0), D.stat.primaryPages);
  assert.deepEqual([D.stat.notesPages, D.stat.ethicsPages, D.stat.supplementPages], [995, 285, D.stat.primaryPages - D.stat.bodyPages]);
});

test('CFA V44: 3 mocki 04.11, 05.11 i 10.11 (6 bloków sesji + analiza błędów), pokrycie materiału 100% przed każdym mockiem (D-093, D-103)', () => {
  assert.deepEqual(D.mockCFA, ['2026-11-04', '2026-11-05', '2026-11-10']);
  assert.deepEqual([...new Set(B.filter(b => b.tryb === 'MOCK').map(b => b.data))], D.mockCFA);
  D.mockCFA.forEach(d => {
    assert.equal(byDay[d].filter(b => b.tryb === 'MOCK').length, 6, d);
    assert.deepEqual(byDay[d].filter(b => b.blok.startsWith('S')).map(b => b.blok), ['S1', 'S1', 'S1', 'S2', 'S2', 'S2'], d);
    assert.equal(byDay[d].find(b => b.blok === 'G').tryb, 'ANALIZA BŁĘDÓW', `${d}: analiza w bloku G`);
    assert.ok(reading.every(b => b.data < d), `${d}: czytanie zakończone przed mockiem`);
  });
  assert.deepEqual(Object.keys(D.mockCov), D.mockCFA);
  assert.deepEqual(Object.values(D.mockCov), [100, 100, 100]);
  for (const d of D.mockCFA) assert.deepEqual([D.mockDetail[d].completeTopics.length, D.mockDetail[d].unfinished.length, D.mockDetail[d].pct], [10, 0, 100], d);
});

test('Początek całego planu (kalendarz, dieta, suplementy, zakupy, treningi): 18.10.2026 (niedziela, basen); 15–17.10 poza planem, plan CFA V44 od 16.10 ma własny zakres; wyjątkowo bez treningu 01.11 i 02.11; Faza 0 do 11.11, Faza 1 12.11–10.12, Faza 2 od 11.12; koniec planu 28.03.2027 (D-017, D-088, D-102, D-103, D-103b, D-103c)', () => {
  assert.deepEqual([SRC.phases.start, SRC.phases.realStart, SRC.phases.dietStart, SRC.phases.trainStart, SRC.phases.zero, SRC.phases.end], [PLAN0, PLAN0, PLAN0, TRAIN0, undefined, PLAN_END]);
  assert.deepEqual(SRC.phases.phases, [{ phase: 0, from: PLAN0 }, { phase: 1, from: '2026-11-12' }, { phase: 2, from: '2026-12-11' }]);
  assert.equal(D.stat.start, CFA_START);
  // Dni do 17.10 włącznie: historia — poza planem, bez diety, treningu, dawek, zużycia; bloki i recall CFA tylko od 16.10 (własny zakres planu CFA)
  for (const d of range('2026-09-25', '2026-10-17')) {
    const x = resolveDay(d), own = d >= CFA_START;
    assert.deepEqual([x.outside, x.zero, x.noDiet, x.training, x.doses.length, x.cfa.blocks.length > 0, x.cfa.recall, x.sessionLabel], [true, false, false, null, 0, own, own, 'Poza planem'], d);
    assert.deepEqual(consumptionForDay(d), {}, d);
  }
  assert.deepEqual([resolveDay('2027-03-29').outside, resolveDay('2027-03-29').after], [true, true]);
  assert.equal(resolveDay(PLAN_END).outside, false);
  // 18.10 — początek planu i pierwszy trening (basen), dzień z blokami M i J (11 bloków), recall 22:00
  const a = resolveDay(PLAN0);
  assert.deepEqual([a.outside, a.phase, a.noDiet, a.preStart, a.dietVariant, a.kcal > 0, a.sessionLabel, a.dayType, a.cfa.inPlan, a.cfa.blocks.length, a.cfa.recall],
    [false, 0, false, false, 'T', true, 'Basen', 'swim', true, 11, true]);
  assert.ok(a.doses.length > 0);
  // 01.11 i 02.11 — wyjątkowo bez treningu (D-103b): dzień nietreningowy, dieta NT, blok M i J po południu i wieczorem (11 bloków)
  for (const d of NO_TRAIN_M) {
    const c = resolveDay(d);
    assert.deepEqual([c.sessionLabel, c.dietVariant, c.training, c.sauna, c.cfa.blocks.length, c.dayType], ['Bez treningu', 'NT', null, 0, 11, 'free'], d);
  }
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

test('Numer bloku CFA: plan mieści się w limicie walidacji (1–432, limitu nie zmniejszamy); zapis i import', async () => {
  assert.equal(CFA_BLOCKS, 432);
  assert.ok(B.length <= CFA_BLOCKS);
  const s = await new Store(new MemoryAdapter()).open();
  await s.record('cfa.done', { block: 432, done: true, plan: CFA_PLAN_VERSION });
  assert.ok(s.state.cfaDone.has(432));
  await assert.rejects(s.record('cfa.done', { block: 433, done: true, plan: CFA_PLAN_VERSION }));
  // R2: import pliku postępu bieżącego planu — tylko numery z zakresu planu (1–313); numery 314–432 nie istnieją w V44
  assert.deepEqual(cfaProgressEvents({ wersja: D.version, wykonane: [1, 313, 314, 417, 432, 433, 0] }).map(e => e.d.block), [1, 313]);
});

test('D-103: plan CFA V44 — nowa numeracja (blok 1 = 16.10 A: SchweserNotes Book 1 QM, PDF 14–21), odhaczenia sprzed V44 nie liczą się', () => {
  assert.deepEqual([B[0].nr, B[0].data, B[0].blok, B[0].zrodlo, B[0].do_przeczytania, B[0].godz], [1, '2026-10-16', 'A', 'SchweserNotes 2026 Book 1 — QM', 'PDF 14–21 (8 s.); łącznie 8 s.', '08:00–08:53']);
  assert.equal(CFA_PLAN_VERSION, 15, 'znacznik generacji numeracji: V44 = 15 (V3 = 14)');
  assert.equal(B.filter(b => b.data < CFA_START).length, 0, 'dni przed 16.10 bez bloków');
});

test('D-098, D-103: start od zera — odhaczenia z v12 (bez pola plan) i z V3 (plan 14) nie liczą się w V44, ale zostają w bazie; nowe i importowane niosą plan', async () => {
  assert.equal(CFA_PLAN_VERSION, 15);
  const s = await new Store(new MemoryAdapter()).open();
  await s.record('cfa.done', { block: 5, done: true });                              // zapis z v12 — bez znacznika planu
  await s.record('cfa.done', { block: 7, done: true, plan: 14 });                    // odhaczenie z planu V3 (D-101) — numeracja nieaktualna
  await s.record('cfa.done', { block: 6, done: true, plan: CFA_PLAN_VERSION });
  assert.deepEqual([...s.state.cfaDone], [6]);
  await s.record('cfa.done', { block: 5, done: true, plan: CFA_PLAN_VERSION });      // blok 5 z V44 odhaczony od nowa
  assert.deepEqual([...s.state.cfaDone].sort((a, b) => a - b), [5, 6]);
  await s.record('cfa.done', { block: 5, done: false, plan: CFA_PLAN_VERSION });     // cofnięcie
  assert.deepEqual([...s.state.cfaDone], [6]);
  assert.equal(s.allEvents().filter(e => e.t === 'cfa.done').length, 5, 'wszystkie zdarzenia (także z v12 i V3) zostają w bazie i eksporcie');
  assert.equal(s.allEvents().filter(e => e.t === 'cfa.done' && e.d.plan == null).length, 1);
  // Import postep-nauki.json (wykonane: numery bloków) — świadoma decyzja użytkownika, więc zapisy są z bieżącego planu
  const imp = cfaProgressEvents({ wykonane: [1, 2], zapis: '2026-10-20T10:00:00.000Z' });   // R2: plik bez wersji zapisany po powstaniu V44
  assert.ok(imp.every(e => e.d.plan === CFA_PLAN_VERSION));
  await s.appendMany(imp, 'import pliku');
  assert.deepEqual([...s.state.cfaDone].sort((a, b) => a - b), [1, 2, 6]);
  // Moduł CFA zapisuje odhaczenia ze znacznikiem planu (study.js dokłada P.doneExtra)
  assert.match(fs.readFileSync(new URL('../../src/modules/cfa.js', import.meta.url), 'utf8'), /doneExtra: \{ plan: CFA_PLAN_VERSION \}/);
});

test('Suplementy czasowe 18.10.2026–28.03.2027 (162 dni planu); zapas 180 / 360 / 180 kaps. starcza z nadwyżką 18 / 36 / 18 (D-015, D-102, D-103c)', async () => {
  for (const id of ['chondroityna', 'boswellia', 'glukozamina']) {
    const doses = SRC.supplements.doses.filter(d => d.supp === id);
    assert.ok(doses.length > 0 && doses.every(d => d.validity?.from === PLAN0 && d.validity?.until === PLAN_END), id);
  }
  assert.match(SRC.supplements.decisions['D-015'], /18\.10\.2026 do 28\.03\.2027/);
  assert.equal([...range(PLAN0, PLAN_END)].length, 162);
  for (const c of SRC.seeds.counts) {
    const need = [...range('2026-09-23', '2027-04-30')].reduce((a, d) => a + (consumptionForDay(d)[c.prod] || 0), 0);
    assert.equal(need, c.qty * 162 / 180, `${c.prod}: potrzeba ${need}, zapas ${c.qty}`);
    assert.equal(consumptionForDay('2026-10-17')[c.prod], undefined, `${c.prod}: do 17.10 poza planem`);
    assert.ok(consumptionForDay(PLAN0)[c.prod] > 0, `${c.prod}: od 18.10`);
    assert.equal(consumptionForDay('2027-03-29')[c.prod], undefined, `${c.prod}: po końcu planu`);
  }
});

test('Rekompozycja: fazy opisane datami (Faza 0 18.10–02.11, Faza 1 12.11–10.12, Faza 2 od 11.12 — D-086 P-2, D-090, D-101, D-103, D-103c) i liczby diety po zmianie skyru na 75 g (D-104)', () => {
  const rekomp = fs.readFileSync(new URL('../../src/data/rekomp.json', import.meta.url), 'utf8');
  assert.ok(!/tygodnie (1–3|4–8|9\+)|3 tygodni bez objawów|Ukończone 3 tygodnie/.test(rekomp));
  for (const t of ['Faza 0 (18.10–02.11)', 'Faza 1 (12.11–10.12)', 'Faza 2 (od 11.12)', 'Sukces = ukończenie Fazy 0 bez objawów', 'Faza 1 od 12.11.2026, Faza 2 od 11.12.2026'])
    assert.ok(rekomp.includes(t), t);
  assert.deepEqual(JSON.parse(rekomp).sections[7].blocks[1].rows.map(r => r[1]), ['18.10–02.11', '12.11–10.12', 'od 11.12']);
  for (const old of ['27.09–11.10', '12.10–15.11', 'od 16.11', '25.09–11.10', '26.09–11.10', 'Faza 1 od 12.10.2026', '12.10–18.10', '19.10–22.11', 'Faza 1 od 19.10.2026',
    '16.10–22.10', '17.10–02.11', '23.10–22.11', 'od 23.11', 'Faza 1 od 23.10.2026', 'Faza 2 od 23.11.2026']) assert.ok(!rekomp.includes(old), old);
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
  assert.deepEqual(SRC.phases.phases.map(p => p.from), [PLAN0, '2026-11-12', '2026-12-11']);
});

test('Dzień mocka: sesje zastępują sloty A–E (E = kontynuacja sesji 2 do 13:00), F wolne (D-019, D-036, D-086)', () => {
  assert.deepEqual(SRC.week.mock.replace, { A: 'S1', B: 'S1', C: 'S2', D: 'S2', E: 'S2' });
  const slots = Object.fromEntries(SRC.dayTemplate.slots.filter(s => s.role === 'cfa').map(s => [s.key, s]));
  assert.ok(slots.E.from < '13:00' && slots.F.from >= '13:00', 'sesja 2 (10:45–13:00) kończy się w slocie E');
});

// Dodatkowe sloty bloków (J, K, L, M…) wypełniają „dziury” w szablonie dnia: slot może kończyć się tam, gdzie zaczyna się następny, albo tuż przed blokami, które ten odstęp zajmują
const extraBlocks = d => (byDay[d] || []).filter(b => !/^([A-I]|S\d)$/.test(b.blok)).map(b => b.godz.split('–'));
const filled = (d, from, to) => { const ex = extraBlocks(d); let at = from; for (let moved = true; moved && at < to;) { moved = false; for (const [f, e] of ex) if (f <= at && e > at) { at = e; moved = true; } } return at >= to; };
const continuous = (d, t) => t.forEach((s, i) => { const next = t[(i + 1) % t.length].from; assert.ok(s.to === next || filled(d, s.to, next), `${d} ${s.id}: ${s.to} → ${next}`); });

test('Soboty bez zakupów (D-097): zwykły szablon z blokiem E; zakupy w czwartki — do 06.01 19:05–20:35 po saunie (22.10 i 29.10 — 17:45–18:40 bez sauny, D-103; 05.11, 24.12 i 31.12 bez zakupów — D-101, D-103, D-109), od 07.01 15:30–16:00; 15.10 usunięty z kalendarza (D-103b)', () => {
  assert.equal(SRC.dayTemplate.variants.zakupy, undefined);
  assert.equal(SRC.week.days['6'].variant, undefined);
  assert.equal(SRC.week.days['4'].variant, 'czwartek');
  const ZL = ['2026-10-22', '2026-10-29'], NO_SHOP = ['2026-11-05', '2026-12-24', '2026-12-31'];
  assert.ok(!Object.values(SRC.week.exceptions).some(e => e.variant === 'czwartek_k'), 'wariant czwartek_k (dawniej 15.10) nieużywany od D-103b');
  for (const d of range(PLAN0, PLAN_END)) {
    const t = templateFor(d);
    continuous(d, t);
    const shop = t.filter(s => s.shop);
    if (weekday(d) === 6) { assert.equal(dayPlan(d).variant ?? null, null, `${d}: sobota — zwykły szablon`); assert.equal(t.length, mTrainDay(d) ? 31 : TRIMMED.includes(d) ? t.length : 34, d); }
    if (weekday(d) !== 4 || NO_SHOP.includes(d)) { assert.equal(shop.length, 0, d); continue; }
    if (ZL.includes(d)) {
      // D-103: bez sauny — zakupy 17:45–18:40, blok L 18:40–19:33, mycie głowy 19:33–19:40, blok M 19:40–20:33, posiłek 20:15 bez zmian w osobnym slocie
      assert.equal(dayPlan(d).variant, 'czwartek_zl', d);
      assert.deepEqual(shop.map(s => `${s.from}–${s.to}`), ['17:45–18:40'], d);
      assert.deepEqual(t.filter(s => s.from >= '17:45' && s.from < '20:50').map(s => `${s.id} ${s.title_src}`),
        ['slot.1745z Zakupy', 'slot.2035 Wieczorne mycie głowy i suszenie', 'slot.2015z Powrót do domu', 'slot.2045 Przygotowywanie kolacji i zmywanie'], d);
      const post = t.find(s => s.id === 'slot.2015z'), mycie = t.find(s => s.id === 'slot.2035');
      assert.deepEqual([mycie.from, mycie.to], ['19:33', '19:40'], d);
      assert.deepEqual([post.from, post.to], ['20:15', '20:35'], d);
      assert.deepEqual(post.items.map(i => [i.meal, i.time]), [['post', '20:15']], `${d}: posiłek 20:15 bez zmian`);
      assert.deepEqual(shop[0].items.filter(i => i.kind === 'meal'), [], d);
      assert.ok(!t.some(s => /sauna/i.test(s.title_src)), `${d}: bez sauny`);
    } else if (d < '2027-01-07') {
      assert.deepEqual(shop.map(s => `${s.from}–${s.to}`), [hasJ(d) ? '19:05–20:25' : '19:05–20:35'], d);
      assert.deepEqual(t.filter(s => s.from >= '17:45' && s.from < '20:20').map(s => `${s.from} ${s.title_src}`),
        ['17:45 Transport na siłownię', '17:55 Sauna', '19:05 Zakupy'], d);
      assert.deepEqual(shop[0].items.filter(i => i.kind === 'meal').map(i => [i.meal, i.time]), [['post', '20:15']], `${d}: posiłek po saunie 20:15 bez zmian`);
    } else {
      assert.deepEqual(shop.map(s => `${s.from}–${s.to}`), ['15:30–16:00'], d);
      assert.deepEqual(t.filter(s => s.from >= '15:30' && s.from < '20:35').map(s => `${s.from}–${s.to} ${s.title_src}`),
        ['15:30–16:00 Zakupy', '16:00–16:53 Blok MPW A', '16:53–17:00 Przerwa obiadowa', '17:00–17:53 Blok MPW B', '17:53–18:00 Przerwa kognitywna',
          '18:00–18:53 Blok MPW C', '18:53–19:05 Transport na siłownię', '19:05–20:15 Sauna', '20:15–20:35 Powrót do domu'], d);
    }
  }
  // D-103: 24.12 bez zakupów — sauna i powrót do domu z posiłkiem 20:15 (wariant czwartek_bz)
  const bz = templateFor('2026-12-24');
  assert.equal(dayPlan('2026-12-24').variant, 'czwartek_bz');
  assert.deepEqual(bz.filter(s => s.from >= '17:45' && s.from < '20:20').map(s => `${s.from} ${s.title_src}`), ['17:45 Transport na siłownię', '17:55 Sauna', '19:05 Powrót do domu']);
  assert.deepEqual(bz.find(s => s.id === 'slot.1905b').items.map(i => [i.kind, i.meal, i.time]), [['meal', 'post', '20:15']]);
  assert.ok(!resolveDay('2026-12-24').slots.some(s => s.shop || s.title === 'Zakupy'));
  const r = resolveDay('2026-11-04');   // środa z mockiem: sesja 2 do 13:00 w slocie E
  assert.equal(r.slots.find(s => s.id === 'slot.1220').title, 'Mock CFA — sesja 2');
  assert.ok(!r.slots.some(s => s.title === 'Zakupy'));
  assert.equal(resolveDay('2026-10-17').slots.find(s => s.id === 'slot.1220').title, 'CFA blok E', 'sobota: blok E');
});

test('Wyjątki dat (D-096, D-097, D-101, D-102, D-103, D-103b, D-103c, D-109): plan od 18.10 (basen), bez sauny w dni z blokiem M, czwartki 22/29.10, 23.10, 01–02.11 i 03–11.11 bez treningu z dietą NT, 12–15.11 nominalnie, święta (25.12 wolny), 31.12 bez zakupów, 01.01 bez treningu, czwartki od 07.01', () => {
  const row = d => { const r = resolveDay(d); return [r.dayType, r.sessionLabel, r.dietVariant, r.sauna, r.training ? r.training.length > 0 : null]; };
  for (const d of ['2026-10-08', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']) assert.equal(resolveDay(d).sessionLabel, 'Poza planem', `${d}: dni przed startem planu 18.10 — historia (D-102, D-103c)`);
  // 16–17.10 usunięte z kalendarza (D-103c): poza planem, bez wyjątków dat; pierwszy dzień planu i trening 18.10 (basen)
  for (const d of ['2026-10-16', '2026-10-17']) { assert.equal(resolveDay(d).sessionLabel, 'Poza planem', d); assert.equal(SRC.week.exceptions[d], undefined, `${d}: bez wyjątku`); }
  assert.deepEqual(row('2026-10-18'), ['swim', 'Basen', 'T', 0, null]);
  assert.deepEqual(['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'].map(d => row(d)[1]),
    ['Basen', 'UPPER 1', 'LOWER 1', 'Rower + ABS', 'Bez treningu'], 'od 18.10 tydzień treningowy; w dni z blokiem M bez sauny (D-103)');
  assert.deepEqual(['2026-10-18', '2026-10-19', '2026-10-22'].map(d => row(d)[2]), ['T', 'T', 'NT']);
  assert.equal(resolveDay('2026-10-19').training.map(e => e.name).join(), SRC.training.days.pon.map(e => e.name).join(), '19.10 — ćwiczenia UPPER 1');
  // czwartki: 22.10 i 29.10 — bez sauny, zakupy 17:45–18:40 (D-103); wariant czwartek_k (15.10) nieużywany od D-103b
  assert.deepEqual(row('2026-10-22'), ['free', 'Bez treningu', 'NT', 0, null]);
  assert.deepEqual(row('2026-10-29'), ['free', 'Bez treningu', 'NT', 0, null]);
  assert.equal(dayPlan('2026-10-15').variant ?? null, null, '15.10 poza planem');
  for (const d of ['2026-10-22', '2026-10-29']) assert.equal(dayPlan(d).variant, 'czwartek_zl', d);
  const ev = d => resolveDay(d).slots.filter(s => s.from >= '19:05' && s.from < '22:00').map(s => `${s.from}–${s.to} ${s.title}`);
  for (const d of ['2026-10-22', '2026-10-29'])
    assert.deepEqual(ev(d), ['19:33–19:40 Wieczorne mycie głowy i suszenie', '19:40–20:33 CFA blok M', '20:15–20:35 Powrót do domu', '20:35–20:50 Przygotowywanie kolacji i zmywanie', '20:50–21:00 Kolacja', '21:00–21:53 CFA blok J', '21:53–22:00 Przygotowywanie posiłków, melisy i wieczorna pielęgnacja'], d);
  assert.deepEqual(resolveDay('2026-10-29').slots.filter(s => s.extra).map(s => s.id), ['slot.cfa.L', 'slot.cfa.M', 'slot.cfa.J']);
  assert.deepEqual(resolveDay('2026-10-29').slots.filter(s => s.extra).map(s => `${s.from}–${s.to}`), ['18:40–19:33', '19:40–20:33', '21:00–21:53']);
  // 23.10 (piątek z blokami K 17:40 i L 18:40 w oknie treningowym) — bez treningu, dieta NT (D-103, do potwierdzenia)
  assert.deepEqual(row('2026-10-23'), ['free', 'Bez treningu', 'NT', 0, null]);
assert.deepEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'].map(d => row(d)[1]),
    ['LOWER 2', 'Basen', 'UPPER 1', 'UPPER 2', 'LOWER 2', 'Bez treningu', 'Bez treningu'], 'bez sauny w dni z blokiem M; 25.10 (bez M) — basen jak zwykle; 01.11 i 02.11 wyjątkowo bez treningu (D-103b)');
  for (const d of ['2026-11-01', '2026-11-02']) { assert.deepEqual(row(d), ['free', 'Bez treningu', 'NT', 0, null], d); assert.equal(dayPlan(d).variant ?? null, null, `${d}: bez basenu`); assert.equal(resolveDay(d).phase, 0, d); }
  // Faza 0 do 11.11, Faza 1 od 12.11, Faza 2 od 11.12 (diety i treningu)
  assert.deepEqual(['2026-10-14', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-22', '2026-10-23', '2026-11-11', '2026-11-12', '2026-12-10', '2026-12-11', '2027-03-28'].map(phaseFor), [null, null, null, 0, 0, 0, 0, 1, 1, 2, 2]);
  // 03–11.11: bez treningu (także sauny i basenu), dieta NT Fazy 0 jak w czwartek; plan CFA ma w tych dniach bloki K, L, M po południu; 05.11 — bez zakupów
  for (const d of ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']) {
    assert.deepEqual(row(d), ['free', 'Bez treningu', 'NT', 0, null], d);
    assert.equal(resolveDay(d).phase, 0, `${d}: Faza 0`);
    assert.equal(resolveDay(d).kcal, plan('NT', 0).total.kcal, d);
    assert.equal(dayPlan(d).variant ?? null, null, d);
    assert.ok(!resolveDay(d).slots.some(s => s.shop), `${d}: bez zakupów`);
    assert.equal(resolveDay(d).cfa.blocks.length, 13, d);
  }
  // 12–15.11 — nominalny, planowy trening i dieta (bez wyjątków): czwartek 2 × sauna z zakupami, UPPER 2, LOWER 2 + sauna, Basen; od 12.11 Faza 1
  for (const d of ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']) assert.equal(SRC.week.exceptions[d], undefined, `${d}: bez wyjątku`);
  assert.deepEqual(row('2026-11-12'), ['rest_sauna2', 'Bez treningu, 2 × sauna', 'NT', 2, null]);
  assert.deepEqual(row('2026-11-13'), ['strength', 'UPPER 2', 'T', 0, true]);
  assert.deepEqual(row('2026-11-14'), ['strength_sauna', 'LOWER 2 + sauna', 'T', 1, true]);
  assert.deepEqual(row('2026-11-15'), ['swim', 'Basen', 'T', 0, null]);
  assert.equal(resolveDay('2026-11-12').phase, 1);
  assert.equal(dayPlan('2026-11-12').variant, 'czwartek', '12.11 — nominalny czwartek z zakupami');
  assert.ok(resolveDay('2026-11-12').slots.some(s => s.shop));
  assert.equal(dayPlan('2026-11-15').variant, 'basen');
  assert.deepEqual(row('2026-11-16')[1], 'UPPER 1 + sauna');
  assert.deepEqual(row('2026-11-19').slice(1, 3), ['Bez treningu, 2 × sauna', 'NT'], '19.11 — czwartek jak dotąd');
  // Święta (D-103): 24.12 czwartek bez zakupów, 25.12 dzień całkowicie wolny jak 26.12 i 27.12
  assert.deepEqual(row('2026-12-24'), ['rest_sauna2', 'Bez treningu, 2 × sauna', 'NT', 2, null]);
  for (const d of ['2026-12-25', '2026-12-26', '2026-12-27']) { assert.deepEqual(row(d), ['free', 'Bez treningu', 'NT', 0, null], d); assert.equal(resolveDay(d).blocks?.kind, 'wolne', `${d}: bez bloków`); assert.ok(!resolveDay(d).slots.some(s => s.shop), d); }
  assert.deepEqual({ ...SRC.week.blocks['2026-12-25'], decision: null }, { ...SRC.week.blocks['2026-12-26'], decision: null }, '25.12 jak 26.12 (bloki weekendowe: wolne)');
  // D-109 (D3 audytu): Sylwester bez zakupów (sauna jak w czwartek), zakupy 17.12 → 07.01; Nowy Rok bez treningu z dietą NT, bloki MPW bez zmian; 06.01 bez zmian
  assert.deepEqual(row('2026-12-31'), ['rest_sauna2', 'Bez treningu, 2 × sauna', 'NT', 2, null]);
  assert.equal(dayPlan('2026-12-31').variant, 'czwartek_bz');
  assert.ok(!resolveDay('2026-12-31').slots.some(s => s.shop), '31.12: bez zakupów');
  assert.ok(resolveDay('2026-12-17').slots.some(s => s.shop) && resolveDay('2027-01-07').slots.some(s => s.shop), 'zakupy 17.12 i 07.01');
  assert.ok([...range('2026-12-18', '2027-01-06')].every(d => !resolveDay(d).slots.some(s => s.shop)), 'bez zakupów 18.12–06.01');
  assert.deepEqual(row('2027-01-01'), ['free', 'Bez treningu', 'NT', 0, null]);
  assert.equal(resolveDay('2027-01-01').kcal, plan('NT', resolveDay('2027-01-01').phase).total.kcal, '01.01: dieta NT');
  assert.deepEqual(resolveDay('2027-01-01').mpw.blocks.map(b => b.blok), ['A', 'B', 'C'], '01.01: bloki MPW bez zmian');
  assert.ok(!resolveDay('2027-01-01').slots.some(s => /Trening|Rozgrzewka/.test(s.title)), '01.01: bez treningu');
  assert.equal(SRC.week.exceptions['2027-01-06'], undefined, '06.01 — rower i sauna bez zmian');
  assert.deepEqual(row('2027-01-06'), row('2027-01-13'), '06.01 jak zwykła środa');
  const thu = [...range('2027-01-07', PLAN_END)].filter(d => weekday(d) === 4);
  const dates = ['2026-10-22', '2026-10-23', '2026-10-29', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-12-24', '2026-12-25', '2026-12-26', '2026-12-27', '2026-12-31', '2027-01-01'];
  assert.deepEqual(Object.keys(SRC.week.exceptions), [...dates, ...thu, '2027-03-27', '2027-03-28'].sort());
  for (const d of thu) assert.equal(dayPlan(d).variant, 'czwartek_st', d);
});

test('D-103, D-103b: dni treningowe z blokiem M (10 dni 18.10–31.10; 17.10, 01.11 i 02.11 wyjątkowo bez treningu) — trening 18:15–19:15, powrót do domu z posiłkiem 19:15–19:25, prysznic i mycie głowy 19:25–19:40, blok M 19:40–20:33, bez sauny', () => {
  const found = [...range(CFA_START, END)].filter(mTrainDay);
  assert.deepEqual(found, M_TRAIN);
  for (const d of M_TRAIN) {
    const r = resolveDay(d), at = from => r.slots.find(s => s.from === from && !s.extra);
    const main = r.slots.find(s => s.id.startsWith('slot.1815'));
    assert.deepEqual([main.from, main.to], ['18:15', '19:15'], `${d}: trening skrócony do 19:15`);
    assert.deepEqual(r.slots.filter(s => s.from >= '19:15' && s.from < '21:53').map(s => `${s.from}–${s.to} ${s.title}`),
      ['19:15–19:25 Powrót do domu', '19:25–19:40 Prysznic i mycie głowy', '19:40–20:33 CFA blok M', '20:33–20:50 Przygotowywanie kolacji i zmywanie', '20:50–21:00 Kolacja', '21:00–21:53 CFA blok J'], d);
    assert.deepEqual(at('19:15').items.filter(i => i.kind === 'meal').map(i => i.text), ['Posiłek potreningowy (19:15)'], `${d}: posiłek potreningowy 19:15 zamiast 20:15`);
    assert.ok(at('19:15').items.some(i => /woda|wody z sodem/i.test(i.text)) || weekday(d) === 7, `${d}: woda z sodem przeniesiona do powrotu (poza basenem)`);
    assert.ok(!r.slots.some(s => /sauna|wychładzanie|Chłodzenie/i.test(s.title)), `${d}: bez sauny i chłodzenia`);
    assert.equal(r.sauna, 0, d);
    assert.ok(!/sauna/.test(r.sessionLabel), `${d}: etykieta bez „+ sauna”`);
    assert.equal(r.slots.filter(s => s.extra).map(s => s.id).join(), 'slot.cfa.M,slot.cfa.J', d);
    // Kreatyna z posiłkiem potreningowym: 19:15 (także w niedzielę zamiast 19:30)
    assert.deepEqual(r.slots.filter(x => x.doses.some(y => y.supp === 'kreatyna')).map(x => [x.id, x.doses.find(y => y.supp === 'kreatyna').time]), [['slot.1915m', '19:15']], d);
    continuous(d, templateFor(d));
  }
  assert.match(resolveDay('2026-10-19').note, /Bez sauny/, 'notatka dnia o braku sauny');
  assert.equal(resolveDay('2026-10-18').note, null, 'basen — bez notatki o saunie');
  // Nie dotyczy: dni bez bloku M (25.10, od 15.11), czwartki, dni z blokami K/L (bez treningu)
  for (const d of ['2026-10-16', '2026-10-22', '2026-10-23', '2026-10-25', '2026-11-03', '2026-11-13', '2026-11-14', ...NO_TRAIN_M]) assert.equal(mTrainDay(d), false, d);
  assert.deepEqual(resolveDay('2026-11-14').slots.filter(s => s.from >= '19:35' && s.from < '20:40').map(s => `${s.from}–${s.to} ${s.title}`),
    ['19:35–19:45 Prysznic', '19:45–20:05 Sauna', '20:05–20:15 Chłodzenie i przebieranie', '20:15–20:35 Powrót do domu', '20:35–20:45 Wieczorne mycie głowy i suszenie'], 'poza blokiem M układ bez zmian (sauna po treningu)');
});

test('D-103: dni bez treningu z blokami K/L/M (23.10 i 03–11.11) — okno treningowe „Wolne” nie pokrywa się z blokami; „teraz” zawsze wskazuje blok', () => {
  for (const d of ['2026-10-23', ...range('2026-11-03', END)]) {
    const r = resolveDay(d), blocks = r.slots.filter(s => s.extra && /^slot\.cfa\.[KLM]$/.test(s.id));
    assert.deepEqual(blocks.map(s => s.id.slice(-1)), d === '2026-10-23' ? ['K', 'L'] : ['K', 'L', 'M'], d);
    for (const w of r.slots.filter(s => s.domain === 'train' && s.title === 'Wolne'))
      for (const b of blocks) assert.ok(w.to <= b.from || w.from >= b.to, `${d}: „Wolne” ${w.from}–${w.to} ∩ ${b.id} ${b.from}–${b.to}`);
    // bieżący slot w środku każdego bloku (kopia currentSlot z dzis.js: wygrywa ostatni pasujący) to ten blok
    for (const b of blocks) { const mid = `${String(Math.floor((+b.from.slice(0, 2) * 60 + +b.from.slice(3) + 25) / 60)).padStart(2, '0')}:${String((+b.from.slice(3) + 25) % 60).padStart(2, '0')}`;
      let cur = null; for (const s of r.slots) if (s.from <= mid && (s.to > s.from ? mid < s.to : true)) cur = s;
      assert.equal(cur.id, b.id, `${d} ${mid}: „teraz” = ${b.id}`); }
  }
  assert.equal(templateFor('2026-11-07').filter(s => s.domain === 'train').every(s => s.to > s.from), true);
});

test('Niedziela z basenem (D-094): basen 18:15–19:30, posiłek 19:30, relaks, prysznic całego ciała 20:15–20:45; w dni z blokiem M (D-103) basen 18:15–19:15, posiłek 19:15, prysznic i mycie głowy 19:25–19:40; święta bez wariantu', () => {
  const v = SRC.dayTemplate.variants.basen;
  assert.deepEqual(v.replaces, ['slot.1815', 'slot.1935', 'slot.1945', 'slot.2005', 'slot.2015', 'slot.2035']);
  assert.equal(SRC.week.days['7'].variant, 'basen');
  for (const d of range(PLAN0, PLAN_END)) {   // pierwsza niedziela planu 18.10
    if (weekday(d) !== 7) continue;
    const exv = SRC.week.exceptions[d];
    if (exv && exv.variant !== 'basen') { assert.equal(dayPlan(d).variant ?? null, null, `${d}: święta, 01.11 i 08.11 bez basenu (D-096, D-101, D-103b)`); if (!TRIMMED.includes(d)) assert.equal(templateFor(d).length, 34, d); continue; }   // 15.11 — wyjątek, ale z basenem
    const t = templateFor(d);
    continuous(d, t);
    const r = resolveDay(d), at = from => r.slots.find(s => s.from === from && !s.extra);
    if (mTrainDay(d)) {   // 18.10 i 01.11
      assert.equal(t.length, 31, d);
      assert.deepEqual([at('18:15').to, at('18:15').title], ['19:15', 'Basen 55 min'], d);
      assert.deepEqual([at('19:15').to, at('19:15').meal, at('19:15').items.map(i => i.text)], ['19:25', 'post', ['Posiłek potreningowy (19:15)']], d);
      assert.deepEqual([at('19:25').to, at('19:25').title, at('19:25').items.map(i => i.text)], ['19:40', 'Prysznic i mycie głowy', ['Prysznic całego ciała i pielęgnacja ciała (moduł Pielęgnacja)']], d);
      assert.ok(!r.slots.some(s => s.title === 'Relaks' && s.from < '21:00'), `${d}: bez relaksu po basenie`);
      continue;
    }
    assert.equal(t.length, 32, d);
    assert.deepEqual([at('18:15').to, at('18:15').title], ['19:30', 'Basen 55 min'], d);
    // Dzień bez bloku J: 19:30–19:45 posiłek, 19:45–20:15 relaks, 20:15–20:45 prysznic, od 20:45 bez zmian; z blokiem J (D-099) wszystko po posiłku o 10 min wcześniej, a powrót 19:30–19:35
    const j = hasJ(d), [e1, e2, e3] = j ? ['19:35', '20:05', '20:35'] : ['19:45', '20:15', '20:45'];
    assert.deepEqual([at('19:30').to, at('19:30').meal, at('19:30').items.map(i => i.text)], [e1, 'post', ['Posiłek potreningowy (19:30)']], d);
    assert.deepEqual([at(e1).to, at(e1).title], [e2, 'Relaks'], d);
    assert.deepEqual([at(e2).to, at(e2).title], [e3, 'Prysznic całego ciała'], d);
    assert.ok(!r.slots.some(s => s.title === 'Wieczorne mycie głowy i suszenie' || s.title === 'Prysznic'), d);
    assert.equal(at(e3).id, 'slot.2045', `${d}: slot przygotowania kolacji po prysznicu`);
  }
  // Kreatyna z posiłkiem potreningowym: w niedzielę 19:30 (D-094), w dni z blokiem M 19:15 (D-103), w czwartek 20:15 w slocie zakupów (D-097), w pozostałe dni 20:15
  const kre = d => resolveDay(d).slots.filter(x => x.doses.some(y => y.supp === 'kreatyna')).map(x => [x.id, x.doses.find(y => y.supp === 'kreatyna').time]);
  assert.deepEqual(kre('2026-10-18'), [['slot.1915m', '19:15']]);
  assert.deepEqual(kre('2026-10-25'), [['slot.1930n', '19:30']], 'niedziela bez bloku M — 19:30');
  for (const d of ['2026-10-20', '2026-10-24']) assert.deepEqual(kre(d), [['slot.1915m', '19:15']], d);
  for (const d of NO_TRAIN_M) assert.deepEqual(kre(d), [['slot.2015', '20:15']], `${d}: wyjątkowo bez treningu (D-103b) — kreatyna z posiłkiem 20:15 (także w niedzielę 01.11)`);
  assert.deepEqual(kre('2026-11-14'), [['slot.2015', '20:15']], 'poza planem CFA — 20:15');
  assert.deepEqual(kre('2026-10-15'), [], '15.10 usunięty z kalendarza (D-103b) — bez dawek');
  assert.deepEqual(kre('2026-10-22'), [['slot.2015z', '20:15']], 'czwartek bez sauny (D-103): posiłek 20:15 w slocie 20:15–20:35');
  assert.deepEqual(kre('2026-11-19'), [['slot.1905c', '20:15']]);
  assert.deepEqual(kre('2026-12-24'), [['slot.1905b', '20:15']]);
  assert.deepEqual(kre('2027-01-07'), [['slot.2015', '20:15']]);
  assert.equal(SRC.supplements.doses.filter(x => x.supp === 'kreatyna').reduce((n, x) => n + x.weekdays.length, 0), 7, 'jedna dawka dziennie');
});

test('Czwartki od 07.01.2027 (D-097): bloki MPW 30 min później w slotach wariantu, suplementy przed sauną 17:45, obiad 16:53', () => {
  const r = resolveDay('2027-01-07');
  assert.deepEqual(r.mpw.blocks.map(b => [b.blok, b.godz, b.godz_src]), [['A', '16:00–16:53', '15:30–16:23'], ['B', '17:00–17:53', '16:30–17:23'], ['C', '18:00–18:53', '17:30–18:23']]);
  assert.deepEqual(r.slots.filter(s => s.mpw).map(s => `${s.from} ${s.title}`), ['16:00 MPW blok A', '17:00 MPW blok B', '18:00 MPW blok C']);
  assert.deepEqual(r.doses.filter(d => ['kolagen', 'tauryna', 'witamina_c'].includes(d.supp) && d.time > '17:00').map(d => d.time), ['17:45', '17:45', '17:45']);
  assert.equal(r.slots.find(s => s.meal === 'dinner').items[0].text, 'Obiad (16:53)');
  assert.ok(!resolveDay('2027-01-06').mpw.blocks.some(b => b.godz_src), 'środa bez przesunięcia');
  assert.deepEqual(resolveDay('2026-12-31').doses.filter(d => d.supp === 'kolagen').map(d => d.time), ['17:15']);
});
