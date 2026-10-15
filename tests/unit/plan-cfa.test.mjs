// Spójność planu po zmianach D-086…D-101 (plan CFA V3: 326 bloków, 30 dni od 13.10 — A–I, J 21:00–21:53 poza 15.10/23.10/25.10, K–M po południu 03–11.11 i M także 22.10 i 29.10;
// kalendarz od 12.10, plan do 28.03.2027; zakupy w czwartki): harmonogram CFA sam ze sobą (statystyki, strony, readingi,
// mocki), z szablonem dnia (warianty: niedziela „basen”, czwartek „czwartek” / „czwartek_st”), z fazami, wyjątkami dat i suplementacją.
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
import { resolveDay, templateFor, dayPlan, hasJ, phaseFor } from '../../src/core/resolver.js';
import { consumptionForDay } from '../../src/core/calc/consumption.js';

const D = SRC.cfa.D, B = D.bloki;
// D-102: PLAN0 — początek planu i pierwszy dzień liczenia wszystkiego poza CFA (15.10); TRAIN0 — regularny trening od 16.10; CFA_START — pierwszy dzień planu CFA V3 (13.10, własny zakres)
const PLAN0 = '2026-10-15', DIET0 = '2026-10-15', TRAIN0 = '2026-10-16', CFA_START = '2026-10-13', END = '2026-11-11', PLAN_END = '2027-03-28';
const NO_J = ['2026-10-15', '2026-10-23', '2026-10-25'], M_EXTRA = ['2026-10-22', '2026-10-29'], KLM = [...range('2026-11-03', END)];
const TIMES = { A: '08:00–08:53', B: '09:10–10:03', C: '10:10–11:03', D: '11:20–12:13', E: '12:20–13:13', F: '13:30–14:23', G: '14:30–15:23', H: '15:30–16:23', I: '16:40–17:33', K: '17:40–18:33', L: '18:40–19:33', M: '19:40–20:33', J: '21:00–21:53', S1: '08:00–10:15', S2: '10:45–13:00' };
const byDay = B.reduce((m, b) => ((m[b.data] ||= []).push(b), m), {});
const count = (list, key) => list.reduce((m, b) => ((m[b[key]] = (m[b[key]] || 0) + 1), m), {});
const pages = b => { const [, a, z, n] = b.do_przeczytania.match(/^s\. (\d+)–(\d+) \((\d+) s\.\)$/).map(Number); return { a, z, n }; };
const cur = B.filter(b => b.kategoria === 'CFA Curriculum');
const volOf = b => b.zrodlo.match(/\((\w+)\)$/)[1];

test('CFA V3: 326 bloków 1–326, 30 dni 13.10–11.11 bez przerw, nazwy dni zgodne z kalendarzem (D-101)', () => {
  assert.equal(B.length, 326);
  assert.deepEqual(B.map(b => b.nr), [...Array(326)].map((_, i) => i + 1));
  assert.deepEqual(Object.keys(byDay), [...range(CFA_START, END)]);
  for (const b of B) assert.equal(b.dzien, dayName(b.data), `nr ${b.nr}`);
  assert.equal(SRC.cfa.exam, '2026-11-12');
  assert.equal(D.version, 'CFA_20261013_326_CUR265_P31_A12_M0610_V3');
  assert.ok(B.every((b, i) => i === 0 || `${B[i - 1].data} ${B[i - 1].godz}` <= `${b.data} ${b.godz}`), 'numeracja w kolejności dat i godzin');
});

test('CFA V3: bloki A–I codziennie, J 21:00–21:53 poza 15.10/23.10/25.10, K–M 03–11.11, M także 22.10 i 29.10; godziny liter stałe, A–I = sloty szablonu; mock S1×3, S2×3, G, H, I (+K, L, M, J)', () => {
  const slots = Object.fromEntries(SRC.dayTemplate.slots.filter(s => s.role === 'cfa').map(s => [s.key, `${s.from}–${s.to}`]));
  assert.deepEqual(Object.keys(slots), [...'ABCDEFGHI']);
  for (const [d, list] of Object.entries(byDay)) {
    const head = D.mockCFA.includes(d) ? 'S1,S1,S1,S2,S2,S2,G,H,I' : 'A,B,C,D,E,F,G,H,I';
    const tail = [...(KLM.includes(d) ? ['K', 'L', 'M'] : M_EXTRA.includes(d) ? ['M'] : []), ...(NO_J.includes(d) ? [] : ['J'])].join();
    assert.equal(list.map(b => b.blok).join(), tail ? `${head},${tail}` : head, d);
    for (const b of list) assert.equal(b.godz, TIMES[b.blok], `nr ${b.nr}`);
    for (const b of list) if (slots[b.blok]) assert.equal(b.godz, slots[b.blok], `nr ${b.nr}: slot szablonu`);
  }
  assert.deepEqual(D.noNightDates, NO_J);
  assert.deepEqual(D.nightDates, Object.keys(byDay).filter(d => !NO_J.includes(d)), 'dni z blokiem J = dni z recall 22:00');
  assert.equal(B.filter(b => b.blok === 'J').length, 27);
  assert.deepEqual([B.filter(b => b.blok === 'K').length, B.filter(b => b.blok === 'L').length, B.filter(b => b.blok === 'M').length], [9, 9, 11]);
  assert.deepEqual(Object.values(count(Object.values(byDay).map(l => ({ n: l.length })), 'n')), [3, 16, 2, 9], 'układ 3×9 + 16×10 + 2×11 + 9×13');
});

test('CFA V3: statystyki planu zgodne z blokami (bloki, dni, godziny, kategorie, tryby, recall)', () => {
  const S = D.stat, sizes = Object.values(byDay).map(l => l.length);
  assert.deepEqual([S.bloki, S.dni, S.cfa, S.start, S.end, S.uklad], [326, 30, 326, CFA_START, END, '3×9 + 16×10 + 2×11 + 9×13']);
  assert.deepEqual([sizes.filter(x => x === 9).length, sizes.filter(x => x === 10).length, sizes.filter(x => x === 11).length, sizes.filter(x => x === 13).length], [3, 16, 2, 9]);
  assert.deepEqual(S.kat, count(B, 'kategoria'));
  assert.deepEqual(S.kat, { 'CFA Curriculum': 265, 'Practice CFA': 61 }, 'Schweser wycofany z planu V3');
  assert.deepEqual(S.tryb, count(B, 'tryb'));
  assert.deepEqual(S.tryb, { 'FIRST PASS': 265, PRACTICE: 31, MOCK: 18, 'ANALIZA BŁĘDÓW': 12 });
  // Godziny: bloki poza sesjami mocków + wszystkie sesje recall (z analizą błędów), 53 min, zaokrąglone do pełnych godzin
  const nonMock = B.filter(b => b.tryb !== 'MOCK').length;
  assert.equal((nonMock + S.recall) * 53, S.minutyNaukiZRecallemBezMockow);
  assert.equal(Math.round(S.minutyNaukiZRecallemBezMockow / 60), S.godziny);
  // Recall: 27 sesji o 22:00 w dniach z blokiem J + 5 sesji A–E dnia 12.11 poza pulą bloków — razem 32
  assert.deepEqual([S.recallEvening, S.recallFinal, S.recall], [D.nightDates.length, D.recallSessions.length, 32]);
  assert.deepEqual(D.nightRecall.map(r => r.data), D.nightDates);
  assert.ok(D.recallSessions.every(r => r.data === SRC.cfa.exam && r.tryb === 'ACTIVE RECALL'));
  assert.deepEqual(D.recallSessions.map(r => r.blok), [...'ABCDE']);
});

test('CFA V3: pierwsze przejście do fpEnd (09.11, ostatni blok I), praktyka = mocki, analiza i practice (31 bloków, pierwszy 15.10)', () => {
  assert.equal(D.fpEnd, '2026-11-09');
  const fp = B.filter(b => b.tryb === 'FIRST PASS');
  assert.deepEqual([fp.at(-1).data, fp.at(-1).blok, D.fpLastSlot], ['2026-11-09', 'I', 'I']);
  assert.equal(fp.length, cur.length);
  assert.ok(fp.every(b => b.kategoria === 'CFA Curriculum'));
  assert.ok(B.filter(b => b.kategoria === 'Practice CFA').every(b => ['PRACTICE', 'MOCK', 'ANALIZA BŁĘDÓW'].includes(b.tryb)));
  const pr = B.filter(b => b.tryb === 'PRACTICE'), ps = D.practiceSummary;
  assert.deepEqual([ps.total, pr.length, ps.firstDate, pr[0].data, ps.earlyBeforeFirstMock, pr.filter(b => b.data < D.mockCFA[0]).length], [31, 31, '2026-10-15', '2026-10-15', 11, 11]);
  assert.equal(pr.at(-1).data, END, 'practice do końca planu (11.11)');
  // Analiza błędów: G, H w dniu mocka i A, B nazajutrz (po ostatnim mocku — 11.11)
  assert.deepEqual(B.filter(b => b.tryb === 'ANALIZA BŁĘDÓW').map(b => `${b.data.slice(5)}${b.blok}`),
    ['11-06G', '11-06H', '11-07A', '11-07B', '11-08G', '11-08H', '11-09A', '11-09B', '11-10G', '11-10H', '11-11A', '11-11B']);
});

test('CFA V3: Curriculum — 10 działów, strony każdego tomu ciągłe (bez luk i powtórzeń), limit stron bloku (poza Standards — wolniejsze tempo)', () => {
  assert.equal(cur.length, 265);
  assert.equal(D.cfa.length, 10);
  let all = 0;
  for (const t of D.cfa) {
    const bl = cur.filter(b => volOf(b) === t.kod);
    assert.equal(bl.length, t.bloki, t.kod);
    assert.equal(bl[0].data >= t.start, true, `${t.kod}: start działu`);
    let next = t.od;
    for (const b of bl) {
      const { a, z, n } = pages(b);
      assert.equal(a, next, `${t.kod} nr ${b.nr}: ciągłość stron`);
      assert.equal(z - a + 1, n, `nr ${b.nr}: liczba stron`);
      const m = b.zadania.match(/^(\d+) s\.\/53 min(?: \(limit (\d+))?/);
      assert.equal(Number(m[1]), n, `nr ${b.nr}: strony w opisie zadań`);
      if (m[2]) assert.ok(n <= Number(m[2]), `nr ${b.nr}: limit ${m[2]}`);
      next = z + 1;
      all += n;
    }
    assert.equal(next - 1, t.koniec, `${t.kod}: koniec tomu`);
    assert.equal(bl.reduce((q, b) => q + pages(b).n, 0), t.strony, t.kod);
  }
  assert.equal(all, 3269);
  assert.deepEqual(D.ethicsExtra.newRanges, ['s. 55–61 (7 s.)', 's. 62–67 (6 s.)']);
  assert.deepEqual(cur.filter(b => volOf(b) === 'ETH' && /55–61|62–67/.test(b.do_przeczytania)).map(b => b.do_przeczytania), D.ethicsExtra.newRanges.map(r => `s. ${r.slice(3)}`));
});

test('CFA V3: 3 mocki (6 bloków sesji + 2 bloki analizy tego dnia, analiza A, B nazajutrz), pokrycie Curriculum w dniu mocka (D-093, D-101)', () => {
  assert.deepEqual(D.mockCFA, ['2026-11-06', '2026-11-08', '2026-11-10']);
  assert.deepEqual([...new Set(B.filter(b => b.tryb === 'MOCK').map(b => b.data))], D.mockCFA);
  D.mockCFA.forEach(d => {
    assert.equal(byDay[d].filter(b => b.tryb === 'MOCK').length, 6, d);
    assert.deepEqual(byDay[d].filter(b => b.tryb === 'ANALIZA BŁĘDÓW').map(b => b.blok), ['G', 'H'], d);
    const next = Object.keys(byDay)[Object.keys(byDay).indexOf(d) + 1];
    assert.deepEqual(byDay[next].filter(b => b.tryb === 'ANALIZA BŁĘDÓW').map(b => b.blok), ['A', 'B'], next);
  });
  assert.deepEqual(Object.keys(D.mockCov), D.mockCFA);
  const totalPages = cur.reduce((a, b) => a + pages(b).n, 0);
  for (const d of D.mockCFA) assert.equal(D.mockCov[d], Math.round(cur.filter(b => b.data < d).reduce((a, b) => a + pages(b).n, 0) / totalPages * 1000) / 10, d);
  assert.deepEqual(D.mockCFA.map(d => D.mockDetail[d].pages), D.mockCFA.map(d => cur.filter(b => b.data < d).reduce((a, b) => a + pages(b).n, 0)), 'strony przerobione do mocka');
});

test('Początek planu i pierwszy dzień liczenia wszystkiego poza CFA: 15.10.2026 (dzień nietreningowy), regularny trening i dieta od 16.10; Faza 0 do 22.10, Faza 1 od 23.10, Faza 2 od 23.11; plan CFA od 13.10 (własny zakres); koniec planu 28.03.2027 (D-017, D-088, D-102)', () => {
  assert.deepEqual([SRC.phases.start, SRC.phases.realStart, SRC.phases.dietStart, SRC.phases.trainStart, SRC.phases.zero, SRC.phases.end], [PLAN0, PLAN0, PLAN0, TRAIN0, undefined, PLAN_END]);
  assert.deepEqual(SRC.phases.phases, [{ phase: 0, from: PLAN0 }, { phase: 1, from: '2026-10-23' }, { phase: 2, from: '2026-11-23' }]);
  assert.equal(D.stat.start, CFA_START);
  // Dni do 12.10 włącznie: historia — poza planem, bez diety, treningu, dawek, bloków CFA (plan CFA od 13.10), zużycia
  for (const d of range('2026-09-25', '2026-10-12')) {
    const x = resolveDay(d);
    assert.deepEqual([x.outside, x.zero, x.noDiet, x.training, x.doses.length, x.cfa.blocks.length, x.cfa.recall, x.sessionLabel], [true, false, false, null, 0, 0, false, 'Poza planem'], d);
    assert.deepEqual(consumptionForDay(d), {}, d);
  }
  // 13–14.10: przed startem planu (historia), ale plan CFA liczy się od 13.10 — bloki i recall CFA bez zmian
  for (const d of ['2026-10-13', '2026-10-14']) {
    const x = resolveDay(d);
    assert.deepEqual([x.outside, x.training, x.doses.length, x.cfa.inPlan, x.cfa.blocks.length, x.cfa.recall, x.sessionLabel], [true, null, 0, true, 10, true, 'Poza planem'], d);
    assert.deepEqual(consumptionForDay(d), {}, d);
  }
  assert.deepEqual([resolveDay('2027-03-29').outside, resolveDay('2027-03-29').after], [true, true]);
  assert.equal(resolveDay(PLAN_END).outside, false);
  // 15.10 — początek planu: dzień nietreningowy z dietą NT i blokami CFA (9, bez J); 16.10 — początek regularnego treningu i diety
  const a = resolveDay(PLAN0);
  assert.deepEqual([a.outside, a.phase, a.noDiet, a.preStart, a.dietVariant, a.kcal > 0, a.sessionLabel, a.session, a.training, a.cfa.inPlan, a.cfa.blocks.length, a.cfa.recall],
    [false, 0, false, false, 'NT', true, 'Bez treningu', null, null, true, 9, false]);
  assert.ok(a.doses.length > 0);
  const c = resolveDay(TRAIN0);
  assert.deepEqual([c.sessionLabel, c.dietVariant, c.training.length > 0], ['UPPER 2', 'T', true]);
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
  await s.record('cfa.done', { block: 432, done: true, plan: 14 });
  assert.ok(s.state.cfaDone.has(432));
  await assert.rejects(s.record('cfa.done', { block: 433, done: true, plan: 14 }));
  assert.deepEqual(cfaProgressEvents({ wykonane: [1, 417, 432, 433, 0] }).map(e => e.d.block), [1, 417, 432]);
});

test('D-101: plan CFA V3 — nowa numeracja (blok 1 = 13.10 A: QM LM 1 s. 3–14), odhaczenia sprzed V3 nie liczą się', () => {
  assert.deepEqual([B[0].nr, B[0].data, B[0].blok, B[0].zrodlo, B[0].do_przeczytania, B[0].godz], [1, '2026-10-13', 'A', 'Curriculum 2026 Vol 1 (QM)', 's. 3–14 (12 s.)', '08:00–08:53']);
  assert.equal(CFA_PLAN_VERSION, 14, 'znacznik generacji numeracji: V3 = 14');
  assert.equal(B.filter(b => b.data < CFA_START).length, 0, 'dni przed 13.10 bez bloków (08–12.10 wykreślone)');
});

test('D-098: start od zera — odhaczenia z v12 (bez pola plan) nie liczą się w v13, ale zostają w bazie; nowe i importowane niosą plan', async () => {
  assert.equal(CFA_PLAN_VERSION, 14);
  const s = await new Store(new MemoryAdapter()).open();
  await s.record('cfa.done', { block: 5, done: true });                              // zapis z v12 — bez znacznika planu
  await s.record('cfa.done', { block: 6, done: true, plan: CFA_PLAN_VERSION });
  assert.deepEqual([...s.state.cfaDone], [6]);
  await s.record('cfa.done', { block: 5, done: true, plan: CFA_PLAN_VERSION });      // blok 5 z v13 odhaczony od nowa
  assert.deepEqual([...s.state.cfaDone].sort((a, b) => a - b), [5, 6]);
  await s.record('cfa.done', { block: 5, done: false, plan: CFA_PLAN_VERSION });     // cofnięcie
  assert.deepEqual([...s.state.cfaDone], [6]);
  assert.equal(s.allEvents().filter(e => e.t === 'cfa.done').length, 4, 'wszystkie zdarzenia (także z v12) zostają w bazie i eksporcie');
  assert.equal(s.allEvents().filter(e => e.t === 'cfa.done' && e.d.plan == null).length, 1);
  // Import postep-nauki.json (wykonane: numery bloków) — świadoma decyzja użytkownika, więc zapisy są z bieżącego planu
  const imp = cfaProgressEvents({ wykonane: [1, 2], zapis: '2026-10-06T10:00:00.000Z' });
  assert.ok(imp.every(e => e.d.plan === CFA_PLAN_VERSION));
  await s.appendMany(imp, 'import pliku');
  assert.deepEqual([...s.state.cfaDone].sort((a, b) => a - b), [1, 2, 6]);
  // Moduł CFA zapisuje odhaczenia ze znacznikiem planu (study.js dokłada P.doneExtra)
  assert.match(fs.readFileSync(new URL('../../src/modules/cfa.js', import.meta.url), 'utf8'), /doneExtra: \{ plan: CFA_PLAN_VERSION \}/);
});

test('Suplementy czasowe 15.10.2026–28.03.2027 (165 dni planu); zapas 180 / 360 / 180 kaps. starcza z nadwyżką 15 / 30 / 15 (D-015, D-102)', async () => {
  for (const id of ['chondroityna', 'boswellia', 'glukozamina']) {
    const doses = SRC.supplements.doses.filter(d => d.supp === id);
    assert.ok(doses.length > 0 && doses.every(d => d.validity?.from === PLAN0 && d.validity?.until === PLAN_END), id);
  }
  assert.match(SRC.supplements.decisions['D-015'], /15\.10\.2026 do 28\.03\.2027/);
  assert.equal([...range(PLAN0, PLAN_END)].length, 165);
  for (const c of SRC.seeds.counts) {
    const need = [...range('2026-09-23', '2027-04-30')].reduce((a, d) => a + (consumptionForDay(d)[c.prod] || 0), 0);
    assert.equal(need, c.qty * 165 / 180, `${c.prod}: potrzeba ${need}, zapas ${c.qty}`);
    assert.equal(consumptionForDay('2026-10-14')[c.prod], undefined, `${c.prod}: do 14.10 poza planem`);
    assert.ok(consumptionForDay(PLAN0)[c.prod] > 0, `${c.prod}: od 15.10`);
    assert.equal(consumptionForDay('2027-03-29')[c.prod], undefined, `${c.prod}: po końcu planu`);
  }
});

test('Rekompozycja: fazy opisane datami (Faza 0 16–22.10, Faza 1 od 23.10, Faza 2 od 23.11 — D-086 P-2, D-090, D-101)', () => {
  const rekomp = fs.readFileSync(new URL('../../src/data/rekomp.json', import.meta.url), 'utf8');
  assert.ok(!/tygodnie (1–3|4–8|9\+)|3 tygodni bez objawów|Ukończone 3 tygodnie/.test(rekomp));
  for (const t of ['Faza 0 (16.10–22.10)', 'Faza 1 (23.10–22.11)', 'Faza 2 (od 23.11)', 'Sukces = ukończenie Fazy 0 bez objawów', 'Faza 1 od 23.10.2026, Faza 2 od 23.11.2026'])
    assert.ok(rekomp.includes(t), t);
  assert.deepEqual(JSON.parse(rekomp).sections[7].blocks[1].rows.map(r => r[1]), ['16.10–22.10', '23.10–22.11', 'od 23.11']);
  for (const old of ['27.09–11.10', '12.10–15.11', 'od 16.11', '25.09–11.10', '26.09–11.10', 'Faza 1 od 12.10.2026', '12.10–18.10', '19.10–22.11', 'Faza 1 od 19.10.2026']) assert.ok(!rekomp.includes(old), old);
  // daty w tekście zgodne z phases.json
  assert.deepEqual(SRC.phases.phases.map(p => p.from), [PLAN0, '2026-10-23', '2026-11-23']);
});

test('Dzień mocka: sesje zastępują sloty A–E (E = kontynuacja sesji 2 do 13:00), F wolne (D-019, D-036, D-086)', () => {
  assert.deepEqual(SRC.week.mock.replace, { A: 'S1', B: 'S1', C: 'S2', D: 'S2', E: 'S2' });
  const slots = Object.fromEntries(SRC.dayTemplate.slots.filter(s => s.role === 'cfa').map(s => [s.key, s]));
  assert.ok(slots.E.from < '13:00' && slots.F.from >= '13:00', 'sesja 2 (10:45–13:00) kończy się w slocie E');
});

test('Soboty bez zakupów (D-097): zwykły szablon z blokiem E; zakupy w czwartki — do 06.01 19:05–20:35 po saunie (15.10, 22.10, 29.10 — 19:05–19:30; 05.11 bez zakupów, D-101), od 07.01 15:30–16:00', () => {
  assert.equal(SRC.dayTemplate.variants.zakupy, undefined);
  assert.equal(SRC.week.days['6'].variant, undefined);
  assert.equal(SRC.week.days['4'].variant, 'czwartek');
  const SHORT = ['2026-10-15', '2026-10-22', '2026-10-29'], NO_SHOP = ['2026-11-05'];
  for (const d of range(PLAN0, PLAN_END)) {
    const t = templateFor(d);
    // w dni z blokiem J szablon ma „dziurę” 21:00–21:53 — wypełnia ją dodatkowy slot bloku J (D-099)
    t.forEach((s, i) => assert.equal(hasJ(d) && s.id === 'slot.2100' ? '21:53' : s.to, t[(i + 1) % t.length].from, `${d} ${s.id}`));
    const shop = t.filter(s => s.shop);
    if (weekday(d) === 6) { assert.equal(dayPlan(d).variant ?? null, null, `${d}: sobota — zwykły szablon`); assert.equal(t.length, 34, d); }
    if (weekday(d) !== 4 || NO_SHOP.includes(d)) { assert.equal(shop.length, 0, d); continue; }
    if (SHORT.includes(d)) {
      // D-101: zakupy 19:05–19:30, mycie głowy 19:30–19:40 (blok M 19:40–20:33 w dni 22.10 i 29.10), posiłek po saunie 20:15 bez zmian w osobnym slocie
      assert.equal(dayPlan(d).variant, 'czwartek_k', d);
      assert.deepEqual(shop.map(s => `${s.from}–${s.to}`), ['19:05–19:30'], d);
      assert.deepEqual(t.filter(s => s.from >= '17:45' && s.from < '20:50').map(s => `${s.id} ${s.title_src}`),
        ['slot.1745c Transport na siłownię', 'slot.1755c Sauna', 'slot.1905c Zakupy', 'slot.2035 Wieczorne mycie głowy i suszenie', 'slot.1940c Posiłek po saunie', 'slot.2045 Przygotowywanie kolacji i zmywanie'], d);
      const post = t.find(s => s.id === 'slot.1940c'), mycie = t.find(s => s.id === 'slot.2035');
      assert.deepEqual([mycie.from, mycie.to], ['19:30', '19:40'], d);
      assert.deepEqual([post.from, post.to], hasJ(d) ? ['19:40', '20:35'] : ['19:40', '20:45'], d);
      assert.deepEqual(post.items.map(i => [i.meal, i.time]), [['post', '20:15']], `${d}: posiłek po saunie 20:15 bez zmian`);
      assert.deepEqual(shop[0].items.filter(i => i.kind === 'meal'), [], d);
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
  const r = resolveDay('2026-11-06');   // piątek z mockiem: sesja 2 do 13:00 w slocie E
  assert.equal(r.slots.find(s => s.id === 'slot.1220').title, 'Mock CFA — sesja 2');
  assert.ok(!r.slots.some(s => s.title === 'Zakupy'));
  assert.equal(resolveDay('2026-10-17').slots.find(s => s.id === 'slot.1220').title, 'CFA blok E', 'sobota: blok E');
});

test('Wyjątki dat (D-096, D-097, D-101, D-102): 15.10 bez treningu (dieta NT), regularny przebieg od 16.10, czwartki 15/22/29.10 (krótsze zakupy), 03–11.11 bez treningu z dietą NT (05.11 bez zakupów), 12–15.11 nominalnie, święta, czwartki od 07.01', () => {
  const row = d => { const r = resolveDay(d); return [r.dayType, r.sessionLabel, r.dietVariant, r.sauna, r.training ? r.training.length > 0 : null]; };
  for (const d of ['2026-10-08', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14']) assert.equal(resolveDay(d).sessionLabel, 'Poza planem', `${d}: dni przed startem planu 15.10 — historia (D-102)`);
  // 15.10: początek planu — dzień nietreningowy z dietą NT (czwartek bez sauny), regularny przebieg dopiero od 16.10
  assert.deepEqual(row('2026-10-15'), ['free', 'Bez treningu', 'NT', 0, null]);
  assert.deepEqual([row('2026-10-16')[1], row('2026-10-17')[1], row('2026-10-18')[1], row('2026-10-19')[1], row('2026-10-20')[1], row('2026-10-21')[1], row('2026-10-22')[1]],
    ['UPPER 2', 'LOWER 2 + sauna', 'Basen', 'UPPER 1 + sauna', 'LOWER 1', 'Rower + ABS + sauna', 'Bez treningu, 2 × sauna'], 'od 16.10 nominalny tydzień');
  assert.deepEqual(['2026-10-16', '2026-10-19', '2026-10-22'].map(d => row(d)[2]), ['T', 'T', 'NT']);
  assert.equal(resolveDay('2026-10-19').training.map(e => e.name).join(), SRC.training.days.pon.map(e => e.name).join(), '19.10 — ćwiczenia UPPER 1');
  // czwartki z krótszymi zakupami: 15.10 bez treningu i sauny (dni nietreningowe), 22.10 i 29.10 — 2 × sauna jak dotąd
  assert.deepEqual(row('2026-10-22'), ['rest_sauna2', 'Bez treningu, 2 × sauna', 'NT', 2, null]);
  assert.deepEqual(row('2026-10-29'), ['rest_sauna2', 'Bez treningu, 2 × sauna', 'NT', 2, null]);
  for (const d of ['2026-10-15', '2026-10-22', '2026-10-29']) assert.equal(dayPlan(d).variant, 'czwartek_k', d);
  const ev = d => resolveDay(d).slots.filter(s => s.from >= '19:05' && s.from < '22:00').map(s => `${s.from}–${s.to} ${s.title}`);
  assert.deepEqual(ev('2026-10-15'), ['19:05–19:30 Zakupy', '19:30–19:40 Wieczorne mycie głowy i suszenie', '19:40–20:45 Posiłek po saunie', '20:45–21:00 Przygotowywanie kolacji i zmywanie', '21:00–21:45 Relaks', '21:45–22:00 Przygotowywanie posiłków, melisy i wieczorna pielęgnacja'], '15.10 bez bloku J: kolacja w slocie Relaks 21:00–21:45 jak dotąd');
  assert.deepEqual(ev('2026-10-22'), ['19:05–19:30 Zakupy', '19:30–19:40 Wieczorne mycie głowy i suszenie', '19:40–20:33 CFA blok M', '19:40–20:35 Posiłek po saunie', '20:35–20:50 Przygotowywanie kolacji i zmywanie', '20:50–21:00 Kolacja', '21:00–21:53 CFA blok J', '21:53–22:00 Przygotowywanie posiłków, melisy i wieczorna pielęgnacja'], '22.10: posiłek po saunie 20:15 w trakcie bloku M (decyzja użytkownika)');
  assert.equal(resolveDay('2026-10-29').slots.filter(s => s.extra).map(s => s.id).join(), 'slot.cfa.M,slot.cfa.J');
  // Faza 0 do 22.10, Faza 1 od 23.10 i Faza 2 od 23.11 (diety i treningu)
  assert.deepEqual(['2026-10-14', '2026-10-15', '2026-10-22', '2026-10-23', '2026-11-22', '2026-11-23', '2027-03-28'].map(phaseFor), [null, 0, 0, 1, 1, 2, 2]);
  // 03–11.11: bez treningu (także sauny i basenu), dieta NT jak w czwartek; w dniach 03–11.11 plan CFA ma bloki K, L, M po południu; 05.11 — bez zakupów
  for (const d of ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']) {
    assert.deepEqual(row(d), ['free', 'Bez treningu', 'NT', 0, null], d);
    assert.equal(resolveDay(d).kcal, plan('NT', 1).total.kcal, d);
    assert.equal(dayPlan(d).variant ?? null, null, d);
    assert.equal(templateFor(d).length, 34, `${d}: zwykły szablon (bez basenu 08.11, bez zakupów 05.11)`);
    assert.ok(!resolveDay(d).slots.some(s => s.shop), `${d}: bez zakupów`);
    assert.equal(resolveDay(d).cfa.blocks.length, 13, d);
  }
  assert.deepEqual(row('2026-11-02')[1], 'UPPER 1 + sauna', '02.11 — ostatni dzień z treningiem przed przerwą');
  // 12–15.11 — nominalny, planowy trening i dieta (bez wyjątków): czwartek 2 × sauna z zakupami, UPPER 2, LOWER 2 + sauna, Basen
  for (const d of ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']) assert.equal(SRC.week.exceptions[d], undefined, `${d}: bez wyjątku`);
  assert.deepEqual(row('2026-11-12'), ['rest_sauna2', 'Bez treningu, 2 × sauna', 'NT', 2, null]);
  assert.deepEqual(row('2026-11-13'), ['strength', 'UPPER 2', 'T', 0, true]);
  assert.deepEqual(row('2026-11-14'), ['strength_sauna', 'LOWER 2 + sauna', 'T', 1, true]);
  assert.deepEqual(row('2026-11-15'), ['swim', 'Basen', 'T', 0, null]);
  assert.equal(dayPlan('2026-11-12').variant, 'czwartek', '12.11 — nominalny czwartek z zakupami');
  assert.ok(resolveDay('2026-11-12').slots.some(s => s.shop));
  assert.equal(dayPlan('2026-11-15').variant, 'basen');
  assert.deepEqual(row('2026-11-16')[1], 'UPPER 1 + sauna');
  assert.deepEqual(row('2026-11-19').slice(1, 3), ['Bez treningu, 2 × sauna', 'NT'], '19.11 — czwartek jak dotąd');
  const thu = [...range('2027-01-07', PLAN_END)].filter(d => weekday(d) === 4);
  const dates = ['2026-10-15', '2026-10-22', '2026-10-29', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-12-26', '2026-12-27'];
  assert.deepEqual(Object.keys(SRC.week.exceptions), [...dates, ...thu, '2027-03-27', '2027-03-28'].sort());
  for (const d of thu) assert.equal(dayPlan(d).variant, 'czwartek_st', d);
});

test('Niedziela z basenem (D-094): basen 18:15–19:30, posiłek 19:30, relaks, prysznic całego ciała 20:15–20:45; święta bez wariantu', () => {
  const v = SRC.dayTemplate.variants.basen;
  assert.deepEqual(v.replaces, ['slot.1815', 'slot.1935', 'slot.1945', 'slot.2005', 'slot.2015', 'slot.2035']);
  assert.equal(SRC.week.days['7'].variant, 'basen');
  for (const d of range(PLAN0, PLAN_END)) {   // pierwsza niedziela planu 18.10
    if (weekday(d) !== 7) continue;
    const exv = SRC.week.exceptions[d];
    if (exv && exv.variant !== 'basen') { assert.equal(dayPlan(d).variant ?? null, null, `${d}: święta i 08.11 bez basenu (D-096, D-101)`); assert.equal(templateFor(d).length, 34, d); continue; }   // 15.11 — wyjątek, ale z basenem
    const t = templateFor(d);
    // w dni z blokiem J szablon ma „dziurę” 21:00–21:53 — wypełnia ją dodatkowy slot bloku J (D-099)
    t.forEach((s, i) => assert.equal(hasJ(d) && s.id === 'slot.2100' ? '21:53' : s.to, t[(i + 1) % t.length].from, `${d} ${s.id}`));
    assert.equal(t.length, 32, d);
    const r = resolveDay(d), at = from => r.slots.find(s => s.from === from);
    assert.deepEqual([at('18:15').to, at('18:15').title], ['19:30', 'Basen 55 min'], d);
    // Dzień bez bloku J: 19:30–19:45 posiłek, 19:45–20:15 relaks, 20:15–20:45 prysznic, od 20:45 bez zmian; z blokiem J (D-099) wszystko po posiłku o 10 min wcześniej, a powrót 19:30–19:35
    const j = hasJ(d), [e1, e2, e3] = j ? ['19:35', '20:05', '20:35'] : ['19:45', '20:15', '20:45'];
    assert.deepEqual([at('19:30').to, at('19:30').meal, at('19:30').items.map(i => i.text)], [e1, 'post', ['Posiłek potreningowy (19:30)']], d);
    assert.deepEqual([at(e1).to, at(e1).title], [e2, 'Relaks'], d);
    assert.deepEqual([at(e2).to, at(e2).title], [e3, 'Prysznic całego ciała'], d);
    assert.ok(!r.slots.some(s => s.title === 'Wieczorne mycie głowy i suszenie' || s.title === 'Prysznic'), d);
    assert.equal(at(e3).id, 'slot.2045', `${d}: slot przygotowania kolacji po prysznicu`);
  }
  // Kreatyna z posiłkiem potreningowym: w niedzielę 19:30 (D-094), w czwartek 20:15 w slocie zakupów (D-097), w pozostałe dni 20:15
  const kre = d => resolveDay(d).slots.filter(x => x.doses.some(y => y.supp === 'kreatyna')).map(x => [x.id, x.doses.find(y => y.supp === 'kreatyna').time]);
  assert.deepEqual(kre('2026-10-18'), [['slot.1930n', '19:30']]);
  for (const d of ['2026-10-20', '2026-10-17']) assert.deepEqual(kre(d), [['slot.2015', '20:15']], d);
  assert.deepEqual(kre('2026-10-15'), [['slot.1940c', '20:15']], 'czwartek z krótkimi zakupami (D-101): posiłek w osobnym slocie');
  assert.deepEqual(kre('2026-11-19'), [['slot.1905c', '20:15']]);
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
