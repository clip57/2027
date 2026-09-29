// Spójność planu po zmianach D-086…D-097 (plan CFA „MASTER SCHEDULE FINAL” v12: 387 bloków — 43 dni × 9 od 30.09, soboty z blokiem E;
// Dzień zero 29.09, Faza 0 od 30.09, plan do 28.03.2027; zakupy w czwartki): harmonogram CFA sam ze sobą (statystyki, strony, readingi,
// mocki), z szablonem dnia (warianty: niedziela „basen”, czwartek „czwartek” / „czwartek_st”), z fazami, wyjątkami dat i suplementacją.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { SRC, mpwByDay } from '../../src/core/data.js';
import { weekday, dayName, range } from '../../src/core/dates.js';
import { CFA_BLOCKS } from '../../src/core/storage/validate.js';
import { cfaProgressEvents } from '../../src/core/migrate/cfa.js';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { resolveDay, templateFor, dayPlan } from '../../src/core/resolver.js';
import { consumptionForDay } from '../../src/core/calc/consumption.js';

const D = SRC.cfa.D, B = D.bloki;
// ZERO — Dzień zero, start całego planu (D-097); START — dzień 1: Faza 0, dieta, trening, suplementy i plan CFA v12
const ZERO = '2026-09-29', START = '2026-09-30', CFA_START = '2026-09-30', END = '2026-11-11', PLAN_END = '2027-03-28';
const byDay = B.reduce((m, b) => ((m[b.data] ||= []).push(b), m), {});
const count = (list, key) => list.reduce((m, b) => ((m[b[key]] = (m[b[key]] || 0) + 1), m), {});
const pages = b => { const [, a, z, n] = b.do_przeczytania.match(/^s\. (\d+)–(\d+) \((\d+) s\.\)$/).map(Number); return { a, z, n }; };
const cur = B.filter(b => b.kategoria === 'CFA Curriculum');
const volOf = b => b.zrodlo.match(/\((\w+)\)$/)[1];

test('CFA v12: 387 bloków 1–387, 43 dni 30.09–11.11 bez przerw, nazwy dni zgodne z kalendarzem (D-097)', () => {
  assert.equal(B.length, 387);
  assert.deepEqual(B.map(b => b.nr), [...Array(387)].map((_, i) => i + 1));
  assert.deepEqual(Object.keys(byDay), [...range(CFA_START, END)]);
  for (const b of B) assert.equal(b.dzien, dayName(b.data), `nr ${b.nr}`);
  assert.equal(SRC.cfa.exam, '2026-11-12');
  assert.ok(B.every((b, i) => i === 0 || `${B[i - 1].data} ${B[i - 1].godz}` <= `${b.data} ${b.godz}`), 'numeracja w kolejności dat i godzin');
});

test('CFA: 9 bloków dziennie, także w soboty (blok E zamiast zakupów — D-097); godziny liter = sloty szablonu; mock S1×3, S2×3, G, H, I', () => {
  const slots = Object.fromEntries(SRC.dayTemplate.slots.filter(s => s.role === 'cfa').map(s => [s.key, `${s.from}–${s.to}`]));
  assert.deepEqual(Object.keys(slots), [...'ABCDEFGHI']);
  for (const [d, list] of Object.entries(byDay)) {
    const letters = list.map(b => b.blok).join();
    if (D.mockCFA.includes(d)) assert.equal(letters, 'S1,S1,S1,S2,S2,S2,G,H,I', d);
    else assert.equal(letters, 'A,B,C,D,E,F,G,H,I', d);
    for (const b of list) if (!b.blok.startsWith('S')) assert.equal(b.godz, slots[b.blok], `nr ${b.nr}`);
  }
  assert.ok(B.filter(b => b.blok === 'S1').every(b => b.godz === '08:00–10:15'));
  assert.ok(B.filter(b => b.blok === 'S2').every(b => b.godz === '10:45–13:00'));
});

test('CFA: statystyki planu zgodne z blokami (bloki, dni, godziny, kategorie, tryby, recall)', () => {
  const S = D.stat;
  assert.deepEqual([S.bloki, S.dni, S.cfa, S.start, S.end, S.uklad], [387, 43, 387, CFA_START, END, '43×9']);
  const sizes = Object.values(byDay).map(l => l.length);
  assert.ok(sizes.every(x => x === 9));
  assert.equal(sizes.length, 43);
  assert.equal(S.godziny, Math.round(B.length * 53 / 60 * 100) / 100);
  assert.deepEqual(count(B, 'kategoria'), S.kat);
  assert.deepEqual(count(B, 'tryb'), S.tryb);
  const recallDays = Object.keys(byDay).filter(d => weekday(d) !== 5 && weekday(d) !== 6);
  assert.equal(S.recall, recallDays.length);
  assert.equal(S.recallH, Math.round(recallDays.length * 53 / 60 * 100) / 100);
});

test('CFA: pierwsze przejście do fpEnd (05.11), fazy planu f1/f2, praktyka = mocki, analiza i mixed practice 26–27.10 (v12)', () => {
  assert.equal(D.fpEnd, '2026-11-05');
  assert.equal(D.fpEnd, B.filter(b => b.tryb === 'FIRST PASS').at(-1).data);
  const f1 = B.filter(b => b.data <= D.fpEnd), f2 = B.filter(b => b.data > D.fpEnd);
  assert.deepEqual([f1.length, f2.length], [D.faza.f1.bl, D.faza.f2.bl]);
  assert.deepEqual(count(f1, 'kategoria'), D.faza.f1.kat);
  assert.deepEqual(count(f2, 'kategoria'), D.faza.f2.kat);
  assert.equal(f2.filter(b => b.tryb === 'FIRST PASS').length, D.faza.f2.fp);
  assert.deepEqual([D.faza.f1.od, D.faza.f2.do], [CFA_START, END]);
  assert.deepEqual(B.filter(b => b.tryb === 'ACTIVE RECALL'), []);
  // Mixed practice (9 bloków): 26.10 A–H i 27.10 A
  const mp = B.filter(b => b.tryb === 'PRACTICE');
  assert.deepEqual(mp.map(b => `${b.data} ${b.blok}`), [...'ABCDEFGH'].map(l => `2026-10-26 ${l}`).concat(['2026-10-27 A']));
  assert.ok(mp.every(b => b.kategoria === 'Practice CFA' && b.temat.startsWith('Mixed practice')));
  assert.equal(D.stat.kat['Practice CFA'], B.filter(b => ['MOCK', 'ANALIZA BŁĘDÓW', 'PRACTICE'].includes(b.tryb)).length);
  assert.equal(Object.values(D.prac).reduce((a, n) => a + n, 0), D.stat.kat['Practice CFA']);
});

test('CFA: Curriculum — 10 działów, strony każdego tomu ciągłe (bez luk i powtórzeń), limit stron bloku', () => {
  let total = 0;
  for (const t of D.cfa) {
    const list = cur.filter(b => volOf(b) === t.kod);
    assert.equal(list.length, t.bloki, t.kod);
    const p = list.map(pages);
    assert.equal(p[0].a, t.od, t.kod);
    assert.equal(p.at(-1).z, t.do, t.kod);
    p.forEach((x, i) => { assert.equal(x.z - x.a + 1, x.n, `${t.kod} ${list[i].nr}`); if (i) assert.equal(x.a, p[i - 1].z + 1, `${t.kod} ${list[i].nr}`); });
    assert.equal(p.reduce((a, x) => a + x.n, 0), t.strony, t.kod);
    assert.deepEqual([list[0].data, list.at(-1).data], [t.start, t.koniecd], t.kod);
    // Limit stron bloku wg zakresu stron (v12: w 47 blokach FI tekst zadań podaje „10 s.” przy zakresie 11 s. — rozbieżność pliku źródłowego)
    for (const b of list) {
      const [, , limit] = b.zadania.match(/^(\d+) s\.\/53 min \(limit (\d+)/).map(Number);
      assert.ok(pages(b).n <= limit, `nr ${b.nr}`);
    }
    total += t.strony;
  }
  assert.equal(total, 3269);
  assert.equal(cur.length, 285);
});

test('CFA: Schweser — 93 readingi dokładnie raz, każdy po zakończeniu Curriculum swojego działu', () => {
  const sch = B.filter(b => b.kategoria === 'Schweser');
  const readings = sch.flatMap(b => {
    const m = b.do_przeczytania.match(/^READING (\d+)(?:–(\d+))?$/), a = Number(m[1]), z = Number(m[2] || m[1]);
    return Array.from({ length: z - a + 1 }, (_, i) => a + i);
  });
  assert.deepEqual(readings.slice().sort((x, y) => x - y), Array.from({ length: 93 }, (_, i) => i + 1));
  assert.deepEqual(D.schweser.map(s => s.bloki), [1, 2, 3, 4].map(n => sch.filter(b => b.zrodlo.endsWith(`Book ${n}`)).length));
  const byTitle = Object.fromEntries(D.cfa.map(t => [t.tytul, t.kod]));
  const lastCur = Object.fromEntries(D.cfa.map(t => [t.kod, Math.max(...cur.filter(b => volOf(b) === t.kod).map(b => b.nr))]));
  for (const b of sch) {
    const kod = byTitle[b.temat.split(' — ')[0]];
    assert.ok(kod, `nr ${b.nr}: dział „${b.temat}”`);
    assert.ok(b.nr > lastCur[kod], `nr ${b.nr}: Schweser ${kod} przed końcem Curriculum`);
  }
});

test('CFA: 3 mocki (6 bloków sesji + 3 analizy tego dnia, v12 bez analizy nazajutrz), pokrycie Curriculum w dniu mocka (D-093, D-097)', () => {
  assert.deepEqual(D.mockCFA, ['2026-10-30', '2026-11-03', '2026-11-07']);
  assert.deepEqual([...new Set(B.filter(b => b.tryb === 'MOCK').map(b => b.data))], D.mockCFA);
  D.mockCFA.forEach(d => {
    assert.equal(byDay[d].filter(b => b.tryb === 'MOCK').length, 6, d);
    assert.equal(byDay[d].filter(b => b.tryb === 'ANALIZA BŁĘDÓW').length, 3, d);
    const next = Object.keys(byDay)[Object.keys(byDay).indexOf(d) + 1];
    assert.ok(!byDay[next].some(b => b.tryb === 'ANALIZA BŁĘDÓW'), next);
  });
  assert.equal(B.filter(b => b.tryb === 'ANALIZA BŁĘDÓW').length, 9);
  assert.deepEqual(Object.keys(D.mockCov), D.mockCFA);
  // v12: pokrycie w pliku źródłowym liczone względem 290 bloków Curriculum z wersji v9 (w v12 jest ich 285) — wartości źródła bez zmian
  for (const d of D.mockCFA) assert.equal(D.mockCov[d], Math.round(cur.filter(b => b.data < d).length / 290 * 1000) / 10, d);
});

test('Dzień zero 29.09.2026, Faza 0 i plan CFA od 30.09, koniec planu 28.03.2027; Fazy 1 i 2 bez zmian (D-017, D-088, D-097)', () => {
  assert.deepEqual([SRC.phases.start, SRC.phases.zero, SRC.phases.end], [ZERO, ZERO, PLAN_END]);
  assert.deepEqual(SRC.phases.phases, [{ phase: 0, from: START }, { phase: 1, from: '2026-10-12' }, { phase: 2, from: '2026-11-16' }]);
  assert.equal(D.stat.start, CFA_START);
  // Dzień zero: bez diety, treningu, nauki, suplementów i zużycia; 28.09 i 29.03 — poza planem
  const z = resolveDay(ZERO);
  assert.deepEqual([z.zero, z.outside, z.training, z.doses.length, z.cfa.blocks.length, z.cfa.recall], [true, true, null, 0, 0, false]);
  assert.deepEqual(consumptionForDay(ZERO), {});
  assert.deepEqual([resolveDay('2026-09-28').outside, resolveDay('2026-09-28').zero, resolveDay('2027-03-29').outside, resolveDay('2027-03-29').after], [true, false, true, true]);
  assert.equal(resolveDay(PLAN_END).outside, false);
  const n = resolveDay(CFA_START);
  assert.deepEqual([n.outside, n.phase, n.cfa.inPlan, n.cfa.blocks.length, n.cfa.recall, n.sessionLabel], [false, 0, true, 9, true, 'UPPER 1 + sauna']);
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
  await s.record('cfa.done', { block: 432, done: true });
  assert.ok(s.state.cfaDone.has(432));
  await assert.rejects(s.record('cfa.done', { block: 433, done: true }));
  assert.deepEqual(cfaProgressEvents({ wykonane: [1, 417, 432, 433, 0] }).map(e => e.d.block), [1, 417, 432]);
});

test('D-090, D-093, D-097: bloki 1–35 jak w v5 i kolejnych wersjach — wcześniejsze odhaczenia (numer bloku) zachowują sens', () => {
  // Odcisk treści bloków (źródło, strony, temat, tryb): 1–35 — ten sam w planach v4 (432), v5 (421), v7 (409), v9 (400) i v12 (387)
  const k = b => [b.zrodlo, b.do_przeczytania, b.temat, b.tryb].join('|');
  assert.equal(createHash('sha256').update(B.slice(0, 35).map(k).join('\n')).digest('hex').slice(0, 16), '81a6b0c6449677de');
  assert.deepEqual([B[0].zrodlo, B[0].do_przeczytania], ['Curriculum 2026 Vol 1 (QM)', 's. 3–13 (11 s.)']);
});

test('Suplementy czasowe 30.09.2026–28.03.2027 (180 dni); zapas 180 / 360 / 180 kaps. wystarcza dokładnie (D-015, D-097)', async () => {
  for (const id of ['chondroityna', 'boswellia', 'glukozamina']) {
    const doses = SRC.supplements.doses.filter(d => d.supp === id);
    assert.ok(doses.length > 0 && doses.every(d => d.validity?.from === START && d.validity?.until === PLAN_END), id);
  }
  assert.match(SRC.supplements.decisions['D-015'], /30\.09\.2026 do 28\.03\.2027/);
  assert.equal([...range(START, PLAN_END)].length, 180);
  for (const c of SRC.seeds.counts) {
    const need = [...range('2026-09-23', '2027-04-30')].reduce((a, d) => a + (consumptionForDay(d)[c.prod] || 0), 0);
    assert.equal(need, c.qty, `${c.prod}: potrzeba ${need}, zapas ${c.qty}`);
    assert.equal(consumptionForDay(ZERO)[c.prod], undefined, `${c.prod}: Dzień zero bez suplementów`);
    assert.ok(consumptionForDay(START)[c.prod] > 0, `${c.prod}: od 30.09`);
    assert.equal(consumptionForDay('2027-03-29')[c.prod], undefined, `${c.prod}: po końcu planu`);
  }
});

test('Rekompozycja: fazy opisane datami (Faza 0 od 27.09 — D-086 P-2, D-090)', () => {
  const rekomp = fs.readFileSync(new URL('../../src/data/rekomp.json', import.meta.url), 'utf8');
  assert.ok(!/tygodnie (1–3|4–8|9\+)|3 tygodni bez objawów|Ukończone 3 tygodnie/.test(rekomp));
  for (const t of ['Faza 0 (27.09–11.10)', 'Faza 1 (12.10–15.11)', 'Faza 2 (od 16.11)', 'Sukces = ukończenie Fazy 0 bez objawów'])
    assert.ok(rekomp.includes(t), t);
  assert.deepEqual(JSON.parse(rekomp).sections[7].blocks[1].rows.map(r => r[1]), ['27.09–11.10', '12.10–15.11', 'od 16.11']);
  assert.ok(!rekomp.includes('25.09–11.10') && !rekomp.includes('26.09–11.10'));
});

test('Dzień mocka: sesje zastępują sloty A–E (E = kontynuacja sesji 2 do 13:00), F wolne (D-019, D-036, D-086)', () => {
  assert.deepEqual(SRC.week.mock.replace, { A: 'S1', B: 'S1', C: 'S2', D: 'S2', E: 'S2' });
  const slots = Object.fromEntries(SRC.dayTemplate.slots.filter(s => s.role === 'cfa').map(s => [s.key, s]));
  assert.ok(slots.E.from < '13:00' && slots.F.from >= '13:00', 'sesja 2 (10:45–13:00) kończy się w slocie E');
});

test('Soboty bez zakupów (D-097): zwykły szablon z blokiem E; zakupy w czwartki — do 06.01 19:05–20:35 po saunie, od 07.01 15:30–16:00', () => {
  assert.equal(SRC.dayTemplate.variants.zakupy, undefined);
  assert.equal(SRC.week.days['6'].variant, undefined);
  assert.equal(SRC.week.days['4'].variant, 'czwartek');
  for (const d of range(ZERO, PLAN_END)) {
    const t = templateFor(d);
    t.forEach((s, i) => assert.equal(s.to, t[(i + 1) % t.length].from, `${d} ${s.id}`));
    const shop = t.filter(s => s.shop);
    if (weekday(d) === 6) assert.equal(t, SRC.dayTemplate.slots, `${d}: sobota — zwykły szablon`);
    if (weekday(d) !== 4 || d === ZERO || d === '2026-10-01') { assert.equal(shop.length, 0, d); continue; }
    if (d < '2027-01-07') {
      assert.deepEqual(shop.map(s => `${s.from}–${s.to}`), ['19:05–20:35'], d);
      assert.deepEqual(t.filter(s => s.from >= '17:45' && s.from < '20:35').map(s => `${s.from} ${s.title_src}`),
        ['17:45 Transport na siłownię', '17:55 Sauna', '19:05 Zakupy'], d);
      assert.deepEqual(shop[0].items.filter(i => i.kind === 'meal').map(i => [i.meal, i.time]), [['post', '20:15']], `${d}: posiłek po saunie 20:15 bez zmian`);
    } else {
      assert.deepEqual(shop.map(s => `${s.from}–${s.to}`), ['15:30–16:00'], d);
      assert.deepEqual(t.filter(s => s.from >= '15:30' && s.from < '20:35').map(s => `${s.from}–${s.to} ${s.title_src}`),
        ['15:30–16:00 Zakupy', '16:00–16:53 Blok MPW A', '16:53–17:00 Przerwa obiadowa', '17:00–17:53 Blok MPW B', '17:53–18:00 Przerwa kognitywna',
          '18:00–18:53 Blok MPW C', '18:53–19:05 Transport na siłownię', '19:05–20:15 Sauna', '20:15–20:35 Powrót do domu'], d);
    }
  }
  const r = resolveDay('2026-11-07');   // sobota z mockiem: sesja 2 do 13:00 w slocie E
  assert.equal(r.slots.find(s => s.id === 'slot.1220').title, 'Mock CFA — sesja 2');
  assert.ok(!r.slots.some(s => s.title === 'Zakupy'));
  assert.equal(resolveDay('2026-10-10').slots.find(s => s.id === 'slot.1220').title, 'CFA blok E', 'sobota: blok E');
});

test('Wyjątki dat (D-096, D-097): tydzień 30.09–03.10 (bez zakupów), święta, czwartki od 07.01; 28.09 poza planem, 29.09 Dzień zero', () => {
  for (const d of ['2026-09-25', '2026-09-28']) {
    const r = resolveDay(d);
    assert.deepEqual([r.outside, r.zero, r.training, r.doses.length, r.cfa.blocks.length, r.cfa.recall], [true, false, null, 0, 0, false], d);
  }
  assert.deepEqual([resolveDay('2026-10-09').dayType, resolveDay('2026-10-04').dayType, resolveDay('2026-10-04').dietVariant], ['strength', 'swim', 'T']);
  const thu = [...range('2027-01-07', PLAN_END)].filter(d => weekday(d) === 4);
  assert.deepEqual(Object.keys(SRC.week.exceptions), ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-12-26', '2026-12-27',
    ...thu, '2027-03-27', '2027-03-28'].sort());
  for (const d of thu) assert.equal(dayPlan(d).variant, 'czwartek_st', d);
  assert.equal(dayPlan('2026-10-01').variant, null, '01.10 — LOWER 1, bez sauny i zakupów');
  assert.ok(!resolveDay('2026-10-03').slots.some(s => s.shop), '03.10 — 2 × sauna, bez zakupów (tydzień bez zakupów)');
});

test('Niedziela z basenem (D-094): basen 18:15–19:30, posiłek 19:30, relaks, prysznic całego ciała 20:15–20:45; święta bez wariantu', () => {
  const v = SRC.dayTemplate.variants.basen;
  assert.deepEqual(v.replaces, ['slot.1815', 'slot.1935', 'slot.1945', 'slot.2005', 'slot.2015', 'slot.2035']);
  assert.equal(SRC.week.days['7'].variant, 'basen');
  for (const d of range('2026-10-04', PLAN_END)) {
    if (weekday(d) !== 7) continue;
    if (SRC.week.exceptions[d]) { assert.equal(templateFor(d), SRC.dayTemplate.slots, `${d}: święta bez basenu (D-096)`); continue; }
    const t = templateFor(d);
    t.forEach((s, i) => assert.equal(s.to, t[(i + 1) % t.length].from, `${d} ${s.id}`));
    assert.equal(t.length, 32, d);
    const r = resolveDay(d), at = from => r.slots.find(s => s.from === from);
    assert.deepEqual([at('18:15').to, at('18:15').title], ['19:30', 'Basen 55 min'], d);
    assert.deepEqual([at('19:30').to, at('19:30').meal, at('19:30').items.map(i => i.text)], ['19:45', 'post', ['Posiłek potreningowy (19:30)']], d);
    assert.deepEqual([at('19:45').to, at('19:45').title], ['20:15', 'Relaks'], d);
    assert.deepEqual([at('20:15').to, at('20:15').title], ['20:45', 'Prysznic całego ciała'], d);
    assert.ok(!r.slots.some(s => s.title === 'Wieczorne mycie głowy i suszenie' || s.title === 'Prysznic'), d);
    assert.equal(at('20:45').id, 'slot.2045', `${d}: od 20:45 bez zmian`);
  }
  // Kreatyna z posiłkiem potreningowym: w niedzielę 19:30 (D-094), w czwartek 20:15 w slocie zakupów (D-097), w pozostałe dni 20:15
  const kre = d => resolveDay(d).slots.filter(x => x.doses.some(y => y.supp === 'kreatyna')).map(x => [x.id, x.doses.find(y => y.supp === 'kreatyna').time]);
  assert.deepEqual(kre('2026-10-04'), [['slot.1930n', '19:30']]);
  for (const d of ['2026-10-05', '2026-10-10']) assert.deepEqual(kre(d), [['slot.2015', '20:15']], d);
  assert.deepEqual(kre('2026-10-08'), [['slot.1905c', '20:15']]);
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
