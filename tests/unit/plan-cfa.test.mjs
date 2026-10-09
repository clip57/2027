// Spójność planu po zmianach D-086…D-099 (plan CFA „MASTER SCHEDULE FINAL” v14: 340 bloków — 25 dni × 10 (blok J 21:00–21:53) i 10 dni (pt, sob) × 9 od 08.10, soboty z blokiem E;
// Dzień zero 29.09, Faza 0 od 30.09, plan do 28.03.2027; zakupy w czwartki): harmonogram CFA sam ze sobą (statystyki, strony, readingi,
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
// D-100: PLAN0 — pierwszy dzień kalendarza (08.10, bez diety i treningu), DIET0 — start diety, TRAIN0 — start treningów i realny początek planu; CFA_START — pierwszy dzień planu CFA v14 (D-099)
const PLAN0 = '2026-10-08', DIET0 = '2026-10-10', TRAIN0 = '2026-10-10', NODIET2 = '2026-10-09', CFA_START = '2026-10-08', END = '2026-11-11', PLAN_END = '2027-03-28';
const byDay = B.reduce((m, b) => ((m[b.data] ||= []).push(b), m), {});
const count = (list, key) => list.reduce((m, b) => ((m[b[key]] = (m[b[key]] || 0) + 1), m), {});
const pages = b => { const [, a, z, n] = b.do_przeczytania.match(/^s\. (\d+)–(\d+) \((\d+) s\.\)$/).map(Number); return { a, z, n }; };
const cur = B.filter(b => b.kategoria === 'CFA Curriculum');
const volOf = b => b.zrodlo.match(/\((\w+)\)$/)[1];

test('CFA v14: 340 bloków 1–340, 35 dni 08.10–11.11 bez przerw, nazwy dni zgodne z kalendarzem (D-099)', () => {
  assert.equal(B.length, 340);
  assert.deepEqual(B.map(b => b.nr), [...Array(340)].map((_, i) => i + 1));
  assert.deepEqual(Object.keys(byDay), [...range(CFA_START, END)]);
  for (const b of B) assert.equal(b.dzien, dayName(b.data), `nr ${b.nr}`);
  assert.equal(SRC.cfa.exam, '2026-11-12');
  assert.ok(B.every((b, i) => i === 0 || `${B[i - 1].data} ${B[i - 1].godz}` <= `${b.data} ${b.godz}`), 'numeracja w kolejności dat i godzin');
});

// Piątki i soboty: 9 bloków (A–I); pozostałe dni: 10 (A–J, blok J 21:00–21:53 — D-099). weekday: 5 = piątek, 6 = sobota (jak w resolverze)
const noJ = d => weekday(d) === 5 || weekday(d) === 6;
test('CFA: 10 bloków A–J w dni poza pt i sob, 9 (A–I) w piątki i soboty (blok E także w soboty — D-097, D-099); godziny liter = sloty szablonu, J 21:00–21:53; mock S1×3, S2×3, G, H, I (+J)', () => {
  const slots = Object.fromEntries(SRC.dayTemplate.slots.filter(s => s.role === 'cfa').map(s => [s.key, `${s.from}–${s.to}`]));
  assert.deepEqual(Object.keys(slots), [...'ABCDEFGHI']);
  for (const [d, list] of Object.entries(byDay)) {
    const letters = list.map(b => b.blok).join();
    const j = noJ(d) ? '' : ',J';
    if (D.mockCFA.includes(d)) assert.equal(letters, `S1,S1,S1,S2,S2,S2,G,H,I${j}`, d);
    else assert.equal(letters, `A,B,C,D,E,F,G,H,I${j}`, d);
    for (const b of list) if (!b.blok.startsWith('S') && b.blok !== 'J') assert.equal(b.godz, slots[b.blok], `nr ${b.nr}`);
  }
  assert.ok(B.filter(b => b.blok === 'J').every(b => b.godz === '21:00–21:53'));
  assert.equal(B.filter(b => b.blok === 'J').length, 25);
  assert.ok(B.filter(b => b.blok === 'S1').every(b => b.godz === '08:00–10:15'));
  assert.ok(B.filter(b => b.blok === 'S2').every(b => b.godz === '10:45–13:00'));
});

test('CFA: statystyki planu zgodne z blokami (bloki, dni, godziny, kategorie, tryby, recall)', () => {
  const S = D.stat;
  assert.deepEqual([S.bloki, S.dni, S.cfa, S.start, S.end, S.uklad], [340, 35, 340, CFA_START, END, '25×10 + 10×9']);
  const sizes = Object.values(byDay).map(l => l.length);
  assert.equal(sizes.length, 35);
  assert.deepEqual([sizes.filter(x => x === 10).length, sizes.filter(x => x === 9).length, sizes.length], [25, 10, 35]);
  assert.equal(S.godziny, Math.round(B.length * 53 / 60 * 100) / 100);
  assert.deepEqual(count(B, 'kategoria'), S.kat);
  assert.deepEqual(count(B, 'tryb'), S.tryb);
  // Recall: 25 sesji o 22:00 (do 11.11, bez pt i sob) + 6 sesji A–F dnia 12.11 poza pulą bloków — razem 31 (v14)
  const recallDays = Object.keys(byDay).filter(d => !noJ(d));
  assert.deepEqual([S.recallEvening, S.recallFinal, S.recall], [recallDays.length, D.recallSessions.length, 31]);
  assert.equal(S.recallH, Math.round(S.recall * 53 / 60 * 100) / 100);
  assert.ok(D.recallSessions.every(r => r.data === SRC.cfa.exam && r.tryb === 'ACTIVE RECALL'));
  assert.deepEqual(D.recallSessions.map(r => r.blok), [...'ABCDEF']);
});

test('CFA: pierwsze przejście do fpEnd (05.11), fazy planu f1/f2, praktyka = mocki, analiza i mixed practice 27–28.10 (v14)', () => {
  assert.equal(D.fpEnd, '2026-11-06');
  assert.equal(D.fpEnd, B.filter(b => b.tryb === 'FIRST PASS').at(-1).data);
  const f1 = B.filter(b => b.data <= D.fpEnd), f2 = B.filter(b => b.data > D.fpEnd);
  assert.deepEqual([f1.length, f2.length], [D.faza.f1.bl, D.faza.f2.bl]);
  assert.deepEqual(count(f1, 'kategoria'), D.faza.f1.kat);
  assert.deepEqual(count(f2, 'kategoria'), D.faza.f2.kat);
  assert.equal(f2.filter(b => b.tryb === 'FIRST PASS').length, 0, 'po fpEnd już bez pierwszego przejścia');
  assert.deepEqual([D.faza.f1.od, D.faza.f2.do], [CFA_START, END]);
  assert.deepEqual(B.filter(b => b.tryb === 'ACTIVE RECALL'), []);
  // Mixed practice (5 bloków): 27.10 I, J i 28.10 A–C
  const mp = B.filter(b => b.tryb === 'PRACTICE');
  assert.deepEqual(mp.map(b => `${b.data} ${b.blok}`), ['2026-10-27 I', '2026-10-27 J', '2026-10-28 A', '2026-10-28 B', '2026-10-28 C']);
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
    // Limit stron bloku wg zakresu stron
    for (const b of list) {
      const [, , limit] = b.zadania.match(/^(\d+) s\.\/53 min \(limit (\d+)/).map(Number);
      assert.ok(pages(b).n <= limit, `nr ${b.nr}`);
    }
    total += t.strony;
  }
  assert.equal(total, 3269);
  assert.equal(cur.length, 264);
});

test('CFA: Schweser — 93 readingi dokładnie raz, każdy po zakończeniu Curriculum swojego działu', () => {
  const sch = B.filter(b => b.kategoria === 'Schweser');
  // Zapis „READING a–b” (zakres) albo „READING a + b” (dwa readingi z różnych działów w jednym bloku, v13)
  const parse = b => {
    const m = b.do_przeczytania.match(/^READING (\d+)(?:–(\d+)| \+ (\d+))?$/);
    assert.ok(m, `nr ${b.nr}: ${b.do_przeczytania}`);
    const a = Number(m[1]);
    return m[3] ? [a, Number(m[3])] : Array.from({ length: Number(m[2] || a) - a + 1 }, (_, i) => a + i);
  };
  const readings = sch.flatMap(parse);
  assert.deepEqual(readings.slice().sort((x, y) => x - y), Array.from({ length: 93 }, (_, i) => i + 1));
  assert.deepEqual(D.schweser.map(s => s.bloki), [1, 2, 3, 4].map(n => sch.filter(b => b.zrodlo.endsWith(`Book ${n}`)).length));
  const byTitle = Object.fromEntries(D.cfa.map(t => [t.tytul, t.kod]));
  const lastCur = Object.fromEntries(D.cfa.map(t => [t.kod, Math.max(...cur.filter(b => volOf(b) === t.kod).map(b => b.nr))]));
  for (const b of sch) {
    // temat: „Dział — konsolidacja…” albo „Dział A + Dział B — konsolidacja…” (blok łączony)
    for (const tytul of b.temat.split(' — ')[0].split(' + ')) {
      const kod = byTitle[tytul];
      assert.ok(kod, `nr ${b.nr}: dział „${tytul}”`);
      assert.ok(b.nr > lastCur[kod], `nr ${b.nr}: Schweser ${kod} przed końcem Curriculum`);
    }
  }
  assert.deepEqual(sch.filter(b => b.do_przeczytania.includes(' + ')).map(b => b.nr), [303, 304, 311, 313, 331]);
});

test('CFA: 3 mocki (6 bloków sesji + 2 bloki analizy tego dnia + blok I, bez analizy nazajutrz), pokrycie Curriculum w dniu mocka (D-093, D-098)', () => {
  assert.deepEqual(D.mockCFA, ['2026-10-30', '2026-11-03', '2026-11-07']);
  assert.deepEqual([...new Set(B.filter(b => b.tryb === 'MOCK').map(b => b.data))], D.mockCFA);
  D.mockCFA.forEach(d => {
    assert.equal(byDay[d].filter(b => b.tryb === 'MOCK').length, 6, d);
    assert.equal(byDay[d].filter(b => b.tryb === 'ANALIZA BŁĘDÓW').length, 2, d);
    assert.deepEqual(byDay[d].filter(b => b.tryb === 'ANALIZA BŁĘDÓW').map(b => b.blok), ['G', 'H'], d);
    assert.ok(!['MOCK', 'ANALIZA BŁĘDÓW', 'PRACTICE'].includes(byDay[d].at(-1).tryb), `${d}: blok I to nauka`);
    const next = Object.keys(byDay)[Object.keys(byDay).indexOf(d) + 1];
    if (next) assert.ok(!byDay[next].some(b => b.tryb === 'ANALIZA BŁĘDÓW'), next);
  });
  assert.equal(B.filter(b => b.tryb === 'ANALIZA BŁĘDÓW').length, 6);
  assert.deepEqual(Object.keys(D.mockCov), D.mockCFA);
  // v13: pokrycie w pliku źródłowym = udział stron Curriculum z bloków sprzed dnia mocka w całym Curriculum (3269 s.)
  const totalPages = cur.reduce((a, b) => a + pages(b).n, 0);
  for (const d of D.mockCFA) assert.equal(D.mockCov[d], Math.round(cur.filter(b => b.data < d).reduce((a, b) => a + pages(b).n, 0) / totalPages * 1000) / 10, d);
});

test('Kalendarz od 08.10.2026; dieta, trening i realny początek planu od 10.10; Faza 1 od 19.10, Faza 2 od 23.11; koniec planu 28.03.2027 (D-017, D-088, D-100)', () => {
  assert.deepEqual([SRC.phases.start, SRC.phases.realStart, SRC.phases.dietStart, SRC.phases.trainStart, SRC.phases.zero, SRC.phases.end], [PLAN0, TRAIN0, DIET0, TRAIN0, undefined, PLAN_END]);
  assert.deepEqual(SRC.phases.phases, [{ phase: 0, from: PLAN0 }, { phase: 1, from: '2026-10-19' }, { phase: 2, from: '2026-11-23' }]);
  assert.equal(D.stat.start, PLAN0, 'plan CFA bez zmian: start 08.10');
  assert.equal(CFA_START, PLAN0);
  // Dni do 07.10 włącznie (w tym dawny Dzień zero 29.09) usunięte z kalendarza: poza planem, bez diety, treningu, dawek, bloków, zużycia
  for (const d of range('2026-09-25', '2026-10-07')) {
    const x = resolveDay(d);
    assert.deepEqual([x.outside, x.zero, x.training, x.doses.length, x.cfa.blocks.length, x.cfa.recall], [true, false, null, 0, 0, false], d);
    assert.deepEqual(consumptionForDay(d), {}, d);
  }
  assert.deepEqual([resolveDay('2027-03-29').outside, resolveDay('2027-03-29').after], [true, true]);
  assert.equal(resolveDay(PLAN_END).outside, false);
  // 08.10 — pierwszy dzień kalendarza: bez diety i treningu, ale z blokami CFA (10), suplementami i zakupami; przed realnym startem planu
  const a = resolveDay(PLAN0);
  assert.deepEqual([a.outside, a.phase, a.noDiet, a.preStart, a.kcal, a.meals.length, a.sessionLabel, a.sauna, a.training, a.cfa.blocks.length, a.cfa.recall],
    [false, 0, true, true, null, 0, 'Bez treningu', 0, null, 10, true]);
  assert.ok(a.doses.length > 0 && a.slots.some(x => x.shop));
  assert.ok(!a.slots.some(x => x.items.some(i => i.kind === 'meal')) && a.slots.every(x => x.kcal == null), '08.10: brak posiłków i kcal w planie dnia');
  // 09.10 — też bez diety i treningu; 10.10 — start diety, treningu i realny początek planu
  const b = resolveDay(NODIET2), c = resolveDay(TRAIN0);
  assert.deepEqual([b.noDiet, b.preStart, b.kcal, b.meals.length, b.sessionLabel, b.training], [true, true, null, 0, 'Bez treningu', null]);
  assert.deepEqual([c.noDiet, c.preStart, c.dietVariant, c.kcal > 0, c.sessionLabel, c.session, c.phase], [false, false, 'T', true, 'UPPER 1 + sauna', 'pon', 0]);
  assert.equal(DIET0, TRAIN0);
  assert.ok(c.training.length > 0);
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
  await s.record('cfa.done', { block: 432, done: true, plan: 13 });
  assert.ok(s.state.cfaDone.has(432));
  await assert.rejects(s.record('cfa.done', { block: 433, done: true, plan: 13 }));
  assert.deepEqual(cfaProgressEvents({ wykonane: [1, 417, 432, 433, 0] }).map(e => e.d.block), [1, 417, 432]);
});

test('D-099: bloki 1–192 w v14 jak w v13 (te same numery, źródło, strony, temat, tryb) — odhaczenia v13 zachowują sens; od 193 inny przebieg', () => {
  // Odcisk treści bloków (źródło, strony, temat, tryb): bloki 1–192 w v13 i v14 identyczne; v12 miał inne bloki już od nr 1 (D-098)
  const k = b => [b.zrodlo, b.do_przeczytania, b.temat, b.tryb].join('|');
  const fp = n => createHash('sha256').update(B.slice(0, n).map(k).join('\n')).digest('hex').slice(0, 16);
  assert.equal(fp(192), '4074b224fed2dee1');          // v13: bloki 1–192 (05.10–…) — ten sam odcisk
  assert.notEqual(fp(193), 'fa1c1d714dc4476c');       // v13 + blok 193: w v14 blok 193 to już inne mixed practice
  assert.deepEqual([B[0].zrodlo, B[0].do_przeczytania, B[0].data], ['Curriculum 2026 Vol 1 (QM)', 's. 3–14 (12 s.)', CFA_START]);
});

test('D-098: start od zera — odhaczenia z v12 (bez pola plan) nie liczą się w v13, ale zostają w bazie; nowe i importowane niosą plan', async () => {
  assert.equal(CFA_PLAN_VERSION, 13);
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

test('Suplementy czasowe 08.10.2026–28.03.2027 (172 dni planu); zapas 180 / 360 / 180 kaps. starcza z nadwyżką 8 / 16 / 8 (D-015, D-100)', async () => {
  for (const id of ['chondroityna', 'boswellia', 'glukozamina']) {
    const doses = SRC.supplements.doses.filter(d => d.supp === id);
    assert.ok(doses.length > 0 && doses.every(d => d.validity?.from === PLAN0 && d.validity?.until === PLAN_END), id);
  }
  assert.match(SRC.supplements.decisions['D-015'], /08\.10\.2026 do 28\.03\.2027/);
  assert.equal([...range(PLAN0, PLAN_END)].length, 172);
  for (const c of SRC.seeds.counts) {
    const need = [...range('2026-09-23', '2027-04-30')].reduce((a, d) => a + (consumptionForDay(d)[c.prod] || 0), 0);
    assert.equal(need, c.qty * 172 / 180, `${c.prod}: potrzeba ${need}, zapas ${c.qty}`);
    assert.equal(consumptionForDay('2026-10-07')[c.prod], undefined, `${c.prod}: do 07.10 poza planem`);
    assert.ok(consumptionForDay(PLAN0)[c.prod] > 0, `${c.prod}: od 08.10`);
    assert.equal(consumptionForDay('2027-03-29')[c.prod], undefined, `${c.prod}: po końcu planu`);
  }
});

test('Rekompozycja: fazy opisane datami (Faza 0 od 10.10, Faza 1 od 19.10, Faza 2 od 23.11 — D-086 P-2, D-090, D-100)', () => {
  const rekomp = fs.readFileSync(new URL('../../src/data/rekomp.json', import.meta.url), 'utf8');
  assert.ok(!/tygodnie (1–3|4–8|9\+)|3 tygodni bez objawów|Ukończone 3 tygodnie/.test(rekomp));
  for (const t of ['Faza 0 (10.10–18.10)', 'Faza 1 (19.10–22.11)', 'Faza 2 (od 23.11)', 'Sukces = ukończenie Fazy 0 bez objawów', 'Faza 1 od 19.10.2026, Faza 2 od 23.11.2026'])
    assert.ok(rekomp.includes(t), t);
  assert.deepEqual(JSON.parse(rekomp).sections[7].blocks[1].rows.map(r => r[1]), ['10.10–18.10', '19.10–22.11', 'od 23.11']);
  for (const old of ['27.09–11.10', '12.10–15.11', 'od 16.11', '25.09–11.10', '26.09–11.10', 'Faza 1 od 12.10.2026']) assert.ok(!rekomp.includes(old), old);
  // daty w tekście zgodne z phases.json
  assert.deepEqual(SRC.phases.phases.map(p => p.from), [PLAN0, '2026-10-19', '2026-11-23']);
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
  for (const d of range(PLAN0, PLAN_END)) {
    const t = templateFor(d);
    // w dni z blokiem J szablon ma „dziurę” 21:00–21:53 — wypełnia ją dodatkowy slot bloku J (D-099)
    t.forEach((s, i) => assert.equal(hasJ(d) && s.id === 'slot.2100' ? '21:53' : s.to, t[(i + 1) % t.length].from, `${d} ${s.id}`));
    const shop = t.filter(s => s.shop);
    if (weekday(d) === 6) assert.equal(t, SRC.dayTemplate.slots, `${d}: sobota — zwykły szablon`);
    if (weekday(d) !== 4) { assert.equal(shop.length, 0, d); continue; }   // pierwszy czwartek (08.10, dzień planu bez diety i treningu) ma zakupy
    if (d < '2027-01-07') {
      assert.deepEqual(shop.map(s => `${s.from}–${s.to}`), [hasJ(d) ? '19:05–20:25' : '19:05–20:35'], d);   // w dni z blokiem J slot krótszy o 10 min (D-099)
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
  const r = resolveDay('2026-11-07');   // sobota z mockiem: sesja 2 do 13:00 w slocie E
  assert.equal(r.slots.find(s => s.id === 'slot.1220').title, 'Mock CFA — sesja 2');
  assert.ok(!r.slots.some(s => s.title === 'Zakupy'));
  assert.equal(resolveDay('2026-10-10').slots.find(s => s.id === 'slot.1220').title, 'CFA blok E', 'sobota: blok E');
});

test('Wyjątki dat (D-096, D-097, D-100): start treningów 10.10 (UPPER 1 w sobotę, 2 × sauna w poniedziałek 12.10), 08–09.10 bez treningu, 07–11.11 bez treningu z dietą NT, święta, czwartki od 07.01', () => {
  const row = d => { const r = resolveDay(d); return [r.dayType, r.sessionLabel, r.dietVariant, r.sauna, r.training ? r.training.length > 0 : null]; };
  assert.deepEqual(row('2026-10-08'), ['free', 'Bez treningu', 'NT', 0, null]);
  assert.deepEqual(row('2026-10-09'), ['free', 'Bez treningu', 'NT', 0, null]);   // dieta NT tylko jako wartość techniczna — 09.10 bez diety (noDiet)
  assert.deepEqual(row('2026-10-10'), ['strength_sauna', 'UPPER 1 + sauna', 'T', 1, true]);
  assert.deepEqual(row('2026-10-11'), ['swim', 'Basen', 'T', 0, null]);
  assert.deepEqual(row('2026-10-12'), ['rest_sauna2', 'Bez treningu, 2 × sauna', 'NT', 2, null]);
  assert.deepEqual([row('2026-10-13')[1], row('2026-10-14')[1], row('2026-10-15')[1], row('2026-10-16')[1], row('2026-10-17')[1]],
    ['LOWER 1', 'Rower + ABS + sauna', 'Bez treningu, 2 × sauna', 'UPPER 2', 'LOWER 2 + sauna'], 'pozostałe dni jak dotąd');
  assert.equal(resolveDay('2026-10-10').training.map(e => e.name).join(), SRC.training.days.pon.map(e => e.name).join(), '10.10 — ćwiczenia UPPER 1');
  assert.equal(dayPlan('2026-10-10').variant ?? null, null, 'sobota bez wariantu');
  assert.equal(dayPlan('2026-10-08').variant, 'czwartek', '08.10 — zakupy zostają (sauna w slotach: Wolne)');
  const s8 = resolveDay('2026-10-08').slots;
  assert.deepEqual([s8.find(x => x.id === 'slot.1755c').title, s8.find(x => x.id === 'slot.1905c').title], ['Wolne', 'Zakupy']);
  // Faza 1 od 19.10 i Faza 2 od 23.11 (diety i treningu); tydzień później niż dotąd
  assert.deepEqual(['2026-10-08', '2026-10-18', '2026-10-19', '2026-11-22', '2026-11-23', '2027-03-28'].map(phaseFor), [0, 0, 1, 1, 2, 2]);
  // 07–11.11: bez treningu (także sauny i basenu), dieta NT jak w czwartek; CFA, recall i pozostałe elementy dnia bez zmian
  for (const d of ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']) {
    assert.deepEqual(row(d), ['free', 'Bez treningu', 'NT', 0, null], d);
    assert.equal(resolveDay(d).kcal, plan('NT', 1).total.kcal, d);
    assert.equal(dayPlan(d).variant ?? null, null, d);
    assert.equal(templateFor(d).length, 34, `${d}: zwykły szablon (bez basenu 08.11)`);
    assert.equal(resolveDay(d).cfa.blocks.length, byDay[d].length, d);
  }
  assert.deepEqual(row('2026-11-12').slice(1, 3), ['Bez treningu, 2 × sauna', 'NT'], '12.11 (egzamin, czwartek) bez zmian');
  assert.deepEqual(row('2026-11-06')[1], 'UPPER 2');
  assert.deepEqual(row('2026-11-13')[1], 'UPPER 2');
  const thu = [...range('2027-01-07', PLAN_END)].filter(d => weekday(d) === 4);
  const dates = ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-12', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-12-26', '2026-12-27'];
  assert.deepEqual(Object.keys(SRC.week.exceptions), [...dates, ...thu, '2027-03-27', '2027-03-28'].sort());
  for (const d of thu) assert.equal(dayPlan(d).variant, 'czwartek_st', d);
});

test('Niedziela z basenem (D-094): basen 18:15–19:30, posiłek 19:30, relaks, prysznic całego ciała 20:15–20:45; święta bez wariantu', () => {
  const v = SRC.dayTemplate.variants.basen;
  assert.deepEqual(v.replaces, ['slot.1815', 'slot.1935', 'slot.1945', 'slot.2005', 'slot.2015', 'slot.2035']);
  assert.equal(SRC.week.days['7'].variant, 'basen');
  for (const d of range('2026-10-11', PLAN_END)) {
    if (weekday(d) !== 7) continue;
    if (SRC.week.exceptions[d]) { assert.equal(dayPlan(d).variant ?? null, null, `${d}: święta i 08.11 bez basenu (D-096, D-100)`); assert.equal(templateFor(d).length, 34, d); continue; }
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
  assert.deepEqual(kre('2026-10-11'), [['slot.1930n', '19:30']]);
  for (const d of ['2026-10-13', '2026-10-10']) assert.deepEqual(kre(d), [['slot.2015', '20:15']], d);
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
