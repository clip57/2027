// Spójność planu po zmianie D-086 (plan CFA „MASTER SCHEDULE FINAL”, 9 bloków dziennie, start 25.09.2026):
// harmonogram CFA sam ze sobą (statystyki, strony, readingi, mocki), z szablonem dnia, z fazami i z suplementacją.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SRC } from '../../src/core/data.js';
import { weekday, dayName, range } from '../../src/core/dates.js';
import { CFA_BLOCKS } from '../../src/core/storage/validate.js';
import { cfaProgressEvents } from '../../src/core/migrate/cfa.js';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';

const D = SRC.cfa.D, B = D.bloki;
const START = '2026-09-25', END = '2026-11-11';
const byDay = B.reduce((m, b) => ((m[b.data] ||= []).push(b), m), {});
const count = (list, key) => list.reduce((m, b) => ((m[b[key]] = (m[b[key]] || 0) + 1), m), {});
const pages = b => { const [, a, z, n] = b.do_przeczytania.match(/^s\. (\d+)–(\d+) \((\d+) s\.\)$/).map(Number); return { a, z, n }; };
const cur = B.filter(b => b.kategoria === 'CFA Curriculum');
const volOf = b => b.zrodlo.match(/\((\w+)\)$/)[1];

test('CFA: 432 bloki 1–432, 48 dni 25.09–11.11 bez przerw, nazwy dni zgodne z kalendarzem', () => {
  assert.equal(B.length, 432);
  assert.deepEqual(B.map(b => b.nr), [...Array(432)].map((_, i) => i + 1));
  assert.deepEqual(Object.keys(byDay), [...range(START, END)]);
  for (const b of B) assert.equal(b.dzien, dayName(b.data), `nr ${b.nr}`);
  assert.equal(SRC.cfa.exam, '2026-11-12');
  assert.ok(B.every((b, i) => i === 0 || `${B[i - 1].data} ${B[i - 1].godz}` <= `${b.data} ${b.godz}`), 'numeracja w kolejności dat i godzin');
});

test('CFA: 9 bloków dziennie; godziny liter = sloty szablonu dnia; dzień mocka S1×3, S2×3, G, H, I', () => {
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
  assert.deepEqual([S.bloki, S.dni, S.cfa, S.start, S.end], [432, 48, 432, START, END]);
  assert.equal(S.godziny, Math.round(B.length * 53 / 60 * 100) / 100);
  assert.deepEqual(count(B, 'kategoria'), S.kat);
  assert.deepEqual(count(B, 'tryb'), S.tryb);
  const recallDays = Object.keys(byDay).filter(d => weekday(d) !== 5 && weekday(d) !== 6);
  assert.equal(S.recall, recallDays.length);
  assert.equal(S.recallH, Math.round(recallDays.length * 53 / 60 * 100) / 100);
});

test('CFA: pierwsze przejście do fpEnd, fazy planu f1/f2, praktyka mieszana 16 bloków', () => {
  assert.equal(D.fpEnd, B.filter(b => b.tryb === 'FIRST PASS').at(-1).data);
  const f1 = B.filter(b => b.data <= D.fpEnd), f2 = B.filter(b => b.data > D.fpEnd);
  assert.deepEqual([f1.length, f2.length], [D.faza.f1.bl, D.faza.f2.bl]);
  assert.deepEqual(count(f1, 'kategoria'), D.faza.f1.kat);
  assert.deepEqual(count(f2, 'kategoria'), D.faza.f2.kat);
  assert.equal(f2.filter(b => b.tryb === 'FIRST PASS').length, D.faza.f2.fp);
  assert.deepEqual([D.faza.f1.od, D.faza.f2.do], [START, END]);
  assert.equal(B.filter(b => b.tryb === 'PRACTICE').length, 16);
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

test('Start planu 25.09.2026 wspólny dla CFA i Fazy 0; Fazy 1 i 2 bez zmian (D-017, D-086)', () => {
  assert.equal(SRC.phases.start, START);
  assert.deepEqual(SRC.phases.phases, [{ phase: 0, from: START }, { phase: 1, from: '2026-10-12' }, { phase: 2, from: '2026-11-16' }]);
  assert.equal(D.stat.start, SRC.phases.start);
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

test('Numer bloku CFA: walidacja zdarzeń i import postępu obejmują dokładnie 1–432', async () => {
  assert.equal(CFA_BLOCKS, B.length);
  const s = await new Store(new MemoryAdapter()).open();
  await s.record('cfa.done', { block: 432, done: true });
  assert.ok(s.state.cfaDone.has(432));
  await assert.rejects(s.record('cfa.done', { block: 433, done: true }));
  assert.deepEqual(cfaProgressEvents({ wykonane: [1, 417, 432, 433, 0] }).map(e => e.d.block), [1, 417, 432]);
});

test('Suplementy czasowe 25.09.2026–25.03.2027 w danych i tekstach planu (D-015, D-086)', () => {
  for (const id of ['chondroityna', 'boswellia', 'glukozamina']) {
    const doses = SRC.supplements.doses.filter(d => d.supp === id);
    assert.ok(doses.length > 0 && doses.every(d => d.validity?.from === START && d.validity?.until === '2027-03-25'), id);
  }
  assert.match(SRC.supplements.decisions['D-015'], /25\.03\.2027/);
  const rekomp = fs.readFileSync(new URL('../../src/data/rekomp.json', import.meta.url), 'utf8');
  assert.equal((rekomp.match(/25\.03\.2027/g) || []).length, 3);
  assert.ok(!rekomp.includes('21.03.2027'));
});

test('Rekompozycja: fazy opisane datami (Faza 0 trwa 17 dni od 25.09 — D-086, P-2)', () => {
  const rekomp = fs.readFileSync(new URL('../../src/data/rekomp.json', import.meta.url), 'utf8');
  assert.ok(!/tygodnie (1–3|4–8|9\+)|3 tygodni bez objawów|Ukończone 3 tygodnie/.test(rekomp));
  for (const t of ['Faza 0 (25.09–11.10)', 'Faza 1 (12.10–15.11)', 'Faza 2 (od 16.11)', 'Sukces = ukończenie Fazy 0 bez objawów'])
    assert.ok(rekomp.includes(t), t);
  assert.deepEqual(JSON.parse(rekomp).sections[7].blocks[1].rows.map(r => r[1]), ['25.09–11.10', '12.10–15.11', 'od 16.11']);
});

test('Dzień mocka: sesje zastępują sloty A–E (E = kontynuacja sesji 2 do 13:00), F wolne (D-019, D-036, D-086)', () => {
  assert.deepEqual(SRC.week.mock.replace, { A: 'S1', B: 'S1', C: 'S2', D: 'S2', E: 'S2' });
  const slots = Object.fromEntries(SRC.dayTemplate.slots.filter(s => s.role === 'cfa').map(s => [s.key, s]));
  assert.ok(slots.E.from < '13:00' && slots.F.from >= '13:00', 'sesja 2 (10:45–13:00) kończy się w slocie E');
});
