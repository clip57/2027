// Spójność planu po zmianach D-086 i D-087 (plan CFA „MASTER SCHEDULE FINAL” v5: 421 bloków — 41 dni × 9, 6 sobót × 8,
// 25.09 × 4; Faza 0 od 26.09; soboty z zakupami 12:13–13:13; wyjątki 25–27.09): harmonogram CFA sam ze sobą (statystyki,
// strony, readingi, mocki), z szablonem dnia (także wariantem sobotnim), z fazami, wyjątkami dat i suplementacją.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SRC } from '../../src/core/data.js';
import { weekday, dayName, range } from '../../src/core/dates.js';
import { CFA_BLOCKS } from '../../src/core/storage/validate.js';
import { cfaProgressEvents } from '../../src/core/migrate/cfa.js';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { resolveDay, templateFor, dayPlan } from '../../src/core/resolver.js';
import { consumptionForDay } from '../../src/core/calc/consumption.js';

const D = SRC.cfa.D, B = D.bloki;
const START = '2026-09-25', END = '2026-11-11';
const byDay = B.reduce((m, b) => ((m[b.data] ||= []).push(b), m), {});
const count = (list, key) => list.reduce((m, b) => ((m[b[key]] = (m[b[key]] || 0) + 1), m), {});
const pages = b => { const [, a, z, n] = b.do_przeczytania.match(/^s\. (\d+)–(\d+) \((\d+) s\.\)$/).map(Number); return { a, z, n }; };
const cur = B.filter(b => b.kategoria === 'CFA Curriculum');
const volOf = b => b.zrodlo.match(/\((\w+)\)$/)[1];

test('CFA: 421 bloków 1–421, 48 dni 25.09–11.11 bez przerw, nazwy dni zgodne z kalendarzem', () => {
  assert.equal(B.length, 421);
  assert.deepEqual(B.map(b => b.nr), [...Array(421)].map((_, i) => i + 1));
  assert.deepEqual(Object.keys(byDay), [...range(START, END)]);
  for (const b of B) assert.equal(b.dzien, dayName(b.data), `nr ${b.nr}`);
  assert.equal(SRC.cfa.exam, '2026-11-12');
  assert.ok(B.every((b, i) => i === 0 || `${B[i - 1].data} ${B[i - 1].godz}` <= `${b.data} ${b.godz}`), 'numeracja w kolejności dat i godzin');
});

test('CFA: 9 bloków dziennie, soboty 8 (bez E), 25.09 — 4 (F–I); godziny liter = sloty szablonu; mock S1×3, S2×3, G, H, I', () => {
  const slots = Object.fromEntries(SRC.dayTemplate.slots.filter(s => s.role === 'cfa').map(s => [s.key, `${s.from}–${s.to}`]));
  assert.deepEqual(Object.keys(slots), [...'ABCDEFGHI']);
  for (const [d, list] of Object.entries(byDay)) {
    const letters = list.map(b => b.blok).join();
    if (D.mockCFA.includes(d)) assert.equal(letters, 'S1,S1,S1,S2,S2,S2,G,H,I', d);
    else if (d === START) assert.equal(letters, 'F,G,H,I', d);
    else if (weekday(d) === 6) assert.equal(letters, 'A,B,C,D,F,G,H,I', d);
    else assert.equal(letters, 'A,B,C,D,E,F,G,H,I', d);
    for (const b of list) if (!b.blok.startsWith('S')) assert.equal(b.godz, slots[b.blok], `nr ${b.nr}`);
  }
  assert.ok(B.filter(b => b.blok === 'S1').every(b => b.godz === '08:00–10:15'));
  assert.ok(B.filter(b => b.blok === 'S2').every(b => b.godz === '10:45–13:00'));
});

test('CFA: statystyki planu zgodne z blokami (bloki, dni, godziny, kategorie, tryby, recall)', () => {
  const S = D.stat;
  assert.deepEqual([S.bloki, S.dni, S.cfa, S.start, S.end, S.uklad], [421, 48, 421, START, END, '41×9 + 6×8 + 1×4']);
  const sizes = Object.values(byDay).map(l => l.length);
  assert.deepEqual([9, 8, 4].map(n => sizes.filter(x => x === n).length), [41, 6, 1]);
  assert.equal(S.godziny, Math.round(B.length * 53 / 60 * 100) / 100);
  assert.deepEqual(count(B, 'kategoria'), S.kat);
  assert.deepEqual(count(B, 'tryb'), S.tryb);
  const recallDays = Object.keys(byDay).filter(d => weekday(d) !== 5 && weekday(d) !== 6);
  assert.equal(S.recall, recallDays.length);
  assert.equal(S.recallH, Math.round(recallDays.length * 53 / 60 * 100) / 100);
});

test('CFA: pierwsze przejście do fpEnd (05.11), fazy planu f1/f2, praktyka mieszana 5 bloków', () => {
  assert.equal(D.fpEnd, '2026-11-05');
  assert.equal(D.fpEnd, B.filter(b => b.tryb === 'FIRST PASS').at(-1).data);
  const f1 = B.filter(b => b.data <= D.fpEnd), f2 = B.filter(b => b.data > D.fpEnd);
  assert.deepEqual([f1.length, f2.length], [D.faza.f1.bl, D.faza.f2.bl]);
  assert.deepEqual(count(f1, 'kategoria'), D.faza.f1.kat);
  assert.deepEqual(count(f2, 'kategoria'), D.faza.f2.kat);
  assert.equal(f2.filter(b => b.tryb === 'FIRST PASS').length, D.faza.f2.fp);
  assert.deepEqual([D.faza.f1.od, D.faza.f2.do], [START, END]);
  assert.equal(B.filter(b => b.tryb === 'PRACTICE').length, 5);
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
    for (const b of list) {
      const [, n, limit] = b.zadania.match(/^(\d+) s\.\/53 min \(limit (\d+)/).map(Number);
      assert.ok(n === pages(b).n && n <= limit, `nr ${b.nr}`);
    }
    total += t.strony;
  }
  assert.equal(total, 3269);
  assert.equal(cur.length, 290);
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

test('CFA: 4 mocki (6 bloków sesji + 3 analizy tego dnia + 3 nazajutrz), pokrycie Curriculum w dniu mocka', () => {
  assert.deepEqual(D.mockCFA, ['2026-10-26', '2026-10-30', '2026-11-03', '2026-11-07']);
  assert.deepEqual([...new Set(B.filter(b => b.tryb === 'MOCK').map(b => b.data))], D.mockCFA);
  D.mockCFA.forEach((d, i) => {
    assert.equal(byDay[d].filter(b => b.tryb === 'MOCK').length, 6, d);
    assert.equal(byDay[d].filter(b => b.tryb === 'ANALIZA BŁĘDÓW').length, 3, d);
    const next = Object.keys(byDay)[Object.keys(byDay).indexOf(d) + 1];
    assert.deepEqual(byDay[next].slice(0, 3).map(b => [b.blok, b.temat]), ['A', 'B', 'C'].map(l => [l, `MOCK CFA nr ${i + 1} — analiza pogłębiona`]), next);
  });
  assert.deepEqual(Object.keys(D.mockCov), D.mockCFA);
  for (const d of D.mockCFA) assert.equal(D.mockCov[d], Math.round(cur.filter(b => b.data < d).length / cur.length * 1000) / 10, d);
});

test('Start planu i CFA 25.09.2026, Faza 0 od 26.09.2026; Fazy 1 i 2 bez zmian (D-017, D-087, D-088)', () => {
  assert.equal(SRC.phases.start, START);
  assert.deepEqual(SRC.phases.phases, [{ phase: 0, from: '2026-09-26' }, { phase: 1, from: '2026-10-12' }, { phase: 2, from: '2026-11-16' }]);
  assert.equal(D.stat.start, START);
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

test('Suplementy czasowe 25.09.2026–21.03.2027 w danych i tekstach planu; zapas z 22.09 wystarcza (D-015, D-087)', async () => {
  for (const id of ['chondroityna', 'boswellia', 'glukozamina']) {
    const doses = SRC.supplements.doses.filter(d => d.supp === id);
    assert.ok(doses.length > 0 && doses.every(d => d.validity?.from === START && d.validity?.until === '2027-03-21'), id);
  }
  assert.match(SRC.supplements.decisions['D-015'], /25\.09\.2026 do 21\.03\.2027/);
  const rekomp = fs.readFileSync(new URL('../../src/data/rekomp.json', import.meta.url), 'utf8');
  assert.equal((rekomp.match(/21\.03\.2027/g) || []).length, 3);
  assert.ok(!rekomp.includes('25.03.2027'));
  // Stan z D-015 (22.09): 180 / 180 / 360 — przyjmowanie 25.09–21.03 (178 dni) mieści się w zapasie
  for (const c of SRC.seeds.counts) {
    const need = [...range('2026-09-23', '2027-03-31')].reduce((a, d) => a + (consumptionForDay(d)[c.prod] || 0), 0);
    assert.ok(need <= c.qty, `${c.prod}: potrzeba ${need}, zapas ${c.qty}`);
    assert.equal(consumptionForDay('2026-09-24')[c.prod], undefined, `${c.prod}: przed 25.09 bez zużycia`);
  }
});

test('Rekompozycja: fazy opisane datami (Faza 0 od 26.09 — D-086 P-2, D-087)', () => {
  const rekomp = fs.readFileSync(new URL('../../src/data/rekomp.json', import.meta.url), 'utf8');
  assert.ok(!/tygodnie (1–3|4–8|9\+)|3 tygodni bez objawów|Ukończone 3 tygodnie/.test(rekomp));
  for (const t of ['Faza 0 (26.09–11.10)', 'Faza 1 (12.10–15.11)', 'Faza 2 (od 16.11)', 'Sukces = ukończenie Fazy 0 bez objawów'])
    assert.ok(rekomp.includes(t), t);
  assert.deepEqual(JSON.parse(rekomp).sections[7].blocks[1].rows.map(r => r[1]), ['26.09–11.10', '12.10–15.11', 'od 16.11']);
  assert.ok(!rekomp.includes('25.09–11.10'));
});

test('Dzień mocka: sesje zastępują sloty A–E (E = kontynuacja sesji 2 do 13:00), F wolne (D-019, D-036, D-086)', () => {
  assert.deepEqual(SRC.week.mock.replace, { A: 'S1', B: 'S1', C: 'S2', D: 'S2', E: 'S2' });
  const slots = Object.fromEntries(SRC.dayTemplate.slots.filter(s => s.role === 'cfa').map(s => [s.key, s]));
  assert.ok(slots.E.from < '13:00' && slots.F.from >= '13:00', 'sesja 2 (10:45–13:00) kończy się w slocie E');
});

test('Soboty (D-087): 12:13–13:13 „Zakupy” zamiast przerwy i bloku E; lunch 13:13–13:30 bez zmian; sobota z mockiem bez zakupów', () => {
  const v = SRC.dayTemplate.variants.zakupy;
  assert.deepEqual(v.replaces, ['slot.1213', 'slot.1220']);
  assert.equal(SRC.week.days['6'].variant, 'zakupy');
  for (const d of range('2026-09-19', '2027-03-27')) {
    // przed startem planu (D-088) i w dni inne niż sobota — zwykły szablon
    if (weekday(d) !== 6 || d < SRC.phases.start) { assert.equal(templateFor(d), SRC.dayTemplate.slots, d); continue; }
    const t = templateFor(d), mock = D.mockCFA.includes(d);
    t.forEach((s, i) => assert.equal(s.to, t[(i + 1) % t.length].from, `${d} ${s.id}`));
    if (mock) { assert.equal(t, SRC.dayTemplate.slots, `${d}: dzień mocka — układ zwykły`); continue; }
    assert.equal(t.length, 33, d);
    const z = t.find(s => s.from === '12:13');
    assert.deepEqual([z.title_src, z.to, z.domain], ['Zakupy', '13:13', 'prep'], d);
    assert.deepEqual(z.items.map(i => i.text), ['Zakupy według listy „Do kupienia” w module Zapasy', 'Druga kawa (12:20)']);
    assert.ok(!t.some(s => s.role === 'cfa' && s.key === 'E'), d);
    const lunch = t.find(s => s.from === '13:13');
    assert.deepEqual([lunch.to, lunch.key], ['13:30', 'lunch'], d);
  }
  const r = resolveDay('2026-11-07');   // sobota z mockiem: sesja 2 do 13:00 w slocie E
  assert.equal(r.slots.find(s => s.id === 'slot.1220').title, 'Mock CFA — sesja 2');
  assert.ok(!r.slots.some(s => s.title === 'Zakupy'));
});

test('Wyjątki dat (D-087): 25.09 bez treningu (okno wolne, 4 bloki od 13:30), 26.09 LOWER 2 kalibracyjny, 27.09 sauna i dieta NT', () => {
  const a = resolveDay('2026-09-25');
  assert.deepEqual([a.dayType, a.session, a.training, a.sessionLabel, a.phase], ['free', null, null, 'Bez treningu', null]);
  assert.ok(a.slots.filter(s => s.domain === 'train').every(s => s.title === 'Wolne' && s.items.length === 0));
  assert.deepEqual(a.slots.filter(s => s.role === 'cfa' && s.cfa.length).map(s => s.from), ['13:30', '14:30', '15:30', '16:40']);
  assert.ok(a.slots.filter(s => s.role === 'cfa' && s.from < '13:30').every(s => s.title === 'Wolne'));
  assert.equal(a.dietVariant, dayPlan('2026-09-25').diet);
  const b = resolveDay('2026-09-26');
  assert.deepEqual([b.sessionName, b.sessionLabel, b.phase, b.training.length > 0], ['LOWER 2', 'LOWER 2 + sauna', 0, true]);
  assert.match(b.slots.find(s => s.id === 'slot.1815').desc, /kalibracyjny/);
  const c = resolveDay('2026-09-27');
  assert.deepEqual([c.dayType, c.session, c.sauna, c.dietVariant, c.kcal, c.cfa.recall], ['rest_sauna2', null, 2, 'NT', 2332, true]);
  assert.equal(c.slots.find(s => s.id === 'slot.2015').mealName, 'Posiłek po saunie');
  assert.equal(consumptionForDay('2026-09-27').banan, undefined, 'dieta NT: bez banana');
  assert.ok(c.doses.some(d => d.supp === 'cynk'), 'cynk w niedzielę bez zmian');
  // Kolejne tygodnie bez wyjątków
  assert.deepEqual([resolveDay('2026-10-02').dayType, resolveDay('2026-10-04').dayType, resolveDay('2026-10-04').dietVariant], ['strength', 'swim', 'T']);
  assert.deepEqual(Object.keys(SRC.week.exceptions), ['2026-09-25', '2026-09-26', '2026-09-27']);
});
