import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDay, phaseFor, templateFor, dayPlan } from '../../src/core/resolver.js';
import { SRC, mpwByDay } from '../../src/core/data.js';
import { range } from '../../src/core/dates.js';

// Od 21.09 — kilka dni przed startem planu (CFA i Faza 0 od 27.09.2026 — D-086, D-090) — do końca suplementów i dalej
const ALL = [...range('2026-09-21', '2027-03-31')];
const START = '2026-09-27';
const EXC = SRC.week.exceptions;
// D-096: soboty bez zakupów (zjazdy studiów, bloki P1–P7 planu MPW, święta) i niedziele świąteczne bez basenu
const noShop = d => SRC.week.blocks?.[d]?.kind === 'studia' || (mpwByDay[d] || []).some(b => b.blok.startsWith('P')) || EXC[d]?.variant === null;
const noPool = d => EXC[d]?.variant === null;

test('fazy kalendarzowe D-017 (F0 od 27.09.2026 — D-090; F1 i F2 bez zmian)', () => {
  assert.equal(phaseFor('2026-09-21'), null);
  assert.equal(phaseFor('2026-09-26'), null);
  assert.equal(phaseFor('2026-09-27'), 0);
  assert.equal(phaseFor('2026-10-11'), 0);
  assert.equal(phaseFor('2026-10-12'), 1);
  assert.equal(phaseFor('2026-11-15'), 1);
  assert.equal(phaseFor('2026-11-16'), 2);
});

test('każdy dzień 21.09.2026–31.03.2027: sloty z godzinami szablonu — 34, soboty 33, niedziele 32 (D-004, D-086, D-087, D-094)', () => {
  for (const d of ALL) {
    const r = resolveDay(d);
    const sat = r.weekday === 6 && !SRC.cfa.D.mockCFA.includes(d) && d >= START && !noShop(d);   // sobota poza planem (26.09) — zwykły szablon
    const sun = r.weekday === 7 && d > START && !noPool(d);   // niedziela z basenem (D-094); 27.09 — wyjątek (sauna), przed startem — zwykły szablon
    assert.equal(r.slots.length, sat ? 33 : sun ? 32 : 34, d);
    assert.equal(r.slots.map(s => `${s.from}-${s.to}`).join(), templateFor(d).map(s => `${s.from}-${s.to}`).join(), d);
  }
});

test('typy dni i dieta T/NT (D-018)', () => {
  const exp = { 1: ['strength_sauna', 'T'], 2: ['strength', 'T'], 3: ['cardio_sauna', 'T'], 4: ['rest_sauna2', 'NT'], 5: ['strength', 'T'], 6: ['strength_sauna', 'T'], 7: ['swim', 'T'] };
  for (const d of ALL) {
    const r = resolveDay(d);
    if (d < START) assert.deepEqual([r.outside, r.dayType, r.session, r.training], [true, 'free', null, null], d);   // D-088
    else if (EXC[d]?.dayType) assert.deepEqual([r.dayType, r.dietVariant], [EXC[d].dayType, EXC[d].diet || exp[r.weekday][1]], d);   // D-087
    else assert.deepEqual([r.dayType, r.dietVariant], exp[r.weekday], d);
  }
});

test('kcal dnia = RAZEM z właściwego PDF', () => {
  assert.equal(resolveDay('2026-10-05').kcal, 2629); // pn F0 T (28.09–04.10 — wyjątki D-096, osobny test)
  assert.equal(resolveDay('2026-09-27').kcal, 2332); // start planu: dzień sauny, NT (D-087, D-090)
  assert.equal(resolveDay('2026-10-08').kcal, 2332); // czw F0 NT
  assert.equal(resolveDay('2026-10-12').kcal, 2784); // pn F1 T
  assert.equal(resolveDay('2026-11-19').kcal, 2668); // czw F2 NT
  assert.equal(resolveDay('2026-11-16').kcal, 2965); // pn F2 T
});

test('slot sauny: czwartek i dni bez sauny = „Wolne” (D-018)', () => {
  const sauna = d => resolveDay(d).slots.find(s => s.id === 'slot.1945').title;
  assert.equal(sauna('2026-10-05'), 'Sauna');
  assert.equal(sauna('2026-10-06'), 'Wolne');
  assert.equal(sauna('2026-10-07'), 'Sauna');
  assert.equal(sauna('2026-10-08'), 'Wolne');
  assert.equal(sauna('2026-10-09'), 'Wolne');
  assert.equal(resolveDay('2026-10-04').slots.some(s => s.id === 'slot.1945'), false, 'niedziela: relaks zamiast okna sauny (D-094)');
  assert.equal(sauna('2026-09-21'), 'Wolne', 'poza planem (D-088)');
});

test('posiłek 20:15: czwartek „Posiłek po saunie”, 114 kcal; dni T 230 kcal', () => {
  const post = d => resolveDay(d).slots.find(s => s.id === 'slot.2015');
  assert.equal(post('2026-10-08').mealName, 'Posiłek po saunie');
  assert.equal(post('2026-10-08').kcal, 114);
  assert.equal(post('2026-10-05').kcal, 230);
});

test('suplementy: tauryna codziennie (D-014), cynk czw+nd, D-015 27.09.2026–21.03.2027 (D-087, D-090)', () => {
  for (const d of ALL) {
    const r = resolveDay(d);
    const s = r.doses.map(x => x.supp);
    if (d < START) { assert.deepEqual(s, [], `${d}: poza planem bez dawek (D-088)`); continue; }
    assert.ok(s.includes('tauryna'), d);
    assert.equal(s.includes('cynk'), r.weekday === 4 || r.weekday === 7, d);
    const on = d >= START && d <= '2027-03-21';
    for (const t of ['boswellia', 'glukozamina']) assert.equal(s.includes(t), on, `${t} ${d}`);
    assert.equal(s.filter(x => x === 'chondroityna').length, on ? 2 : 0, d);
    assert.equal(s.filter(x => x === 'witamina_c').length, 3, d);
  }
});

test('suplementy przypięte do slotów wg godziny', () => {
  const r = resolveDay('2026-09-28');
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

test('CFA: 9 bloków dziennie, soboty 8 (bez E, zakupy); mock w A–E, F wolne (D-019, D-036, D-086, D-087, D-090, D-093)', () => {
  const CFA0 = SRC.cfa.D.stat.start;   // plan CFA od 28.09 (D-093); start całego planu 27.09 — 27.09 bez bloków
  for (const d of ALL) {
    const r = resolveDay(d);
    const mock = SRC.cfa.D.mockCFA.includes(d), sat = r.weekday === 6 && !mock && d >= START && !noShop(d);
    const cfaSlots = r.slots.filter(s => s.role === 'cfa');
    assert.deepEqual(cfaSlots.map(s => s.from), ['08:00', '09:10', '10:10', '11:20', '12:20', '13:30', '14:30', '15:30', '16:40'].filter(t => !sat || t !== '12:20'), d);
    const n = cfaSlots.reduce((a, s) => a + s.cfa.length, 0);
    if (d >= CFA0 && d <= '2026-11-11') assert.equal(n, sat ? 8 : 9, d); else assert.equal(n, 0, d);
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
  for (const d of range(START, '2026-11-11')) {
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
  const a = resolveDay('2026-10-30'), b = resolveDay('2026-10-23');   // piątek z mockiem (D-093) i zwykły piątek
  const meals = r => r.slots.filter(s => s.role === 'meal').map(s => `${s.from}:${s.kcal}`).join();
  assert.equal(meals(a), meals(b));
  assert.deepEqual(a.doses.map(d => d.time + d.supp), b.doses.map(d => d.time + d.supp));
});

test('recall: brak w pt i sob, przed 28.09 i po 11.11; 33 sesje w planie (D-086, D-090, D-093)', () => {
  let n = 0;
  for (const d of ALL) {
    const r = resolveDay(d); if (r.cfa.recall) n++;
    if (r.weekday === 5 || r.weekday === 6 || d < SRC.cfa.D.stat.start || d > '2026-11-11') assert.equal(r.cfa.recall, false, d);
  }
  assert.equal(n, 33);
  assert.equal(n, SRC.cfa.D.stat.recall);
});

test('trening: liczba serii wg fazy', () => {
  const s = d => resolveDay(d).training.reduce((a, e) => a + e.seriesToday, 0);
  assert.equal(s('2026-10-05'), 10); // UPPER 1 F0
  assert.equal(s('2026-10-12'), 18); // UPPER 1 F1
  assert.equal(s('2026-11-16'), 26); // UPPER 1 F2
  assert.equal(resolveDay('2026-10-08').training, null);
});

// --- Poprawki po teście akceptacyjnym (D-038, D-039, D-040, D-001)
import { cfaSourceLine } from '../../src/core/resolver.js';
const SUPP_WORDS = /chondroityn|cynk|boswelli|d3|omega|askorbinian|witamina c|l-teanin|glukozamin|kolagen|tauryn|kreatyn|glicyn|magnez|melatonin/i;

test('D-001: żaden widoczny podpunkt slotu nie powtarza suplementów (wszystkie dni)', () => {
  for (const d of ALL) for (const s of resolveDay(d).slots)
    for (const i of s.items) assert.ok(!SUPP_WORDS.test(i.text), `${d} ${s.from}: „${i.text}”`);
});

test('D-038: pomiar wagi i ciśnienia', () => {
  const t = resolveDay('2026-09-29').slots[0].items.map(i => i.text);
  assert.ok(t.includes('Pomiar wagi i ciśnienia na czczo po toalecie.'));
  assert.ok(!t.includes('Pomiar wagi na czczo po toalecie.'));
});

test('D-040: nazwa treningu w nagłówku dnia', () => {
  const exp = ['UPPER 1 + sauna', 'LOWER 1', 'Rower + ABS + sauna', 'Bez treningu, 2 × sauna', 'UPPER 2', 'LOWER 2 + sauna', 'Basen'];
  [...range('2026-10-05', '2026-10-11')].forEach((d, i) => assert.equal(resolveDay(d).sessionLabel, exp[i], d));
  assert.deepEqual(['25', '26', '27'].map(d => resolveDay(`2026-09-${d}`).sessionLabel), ['Poza planem', 'Poza planem', 'Bez treningu, 2 × sauna']); // D-087, D-090
});

test('D-039: linia źródła bloku CFA', () => {
  const a = resolveDay('2026-09-28').slots.find(s => s.id === 'slot.0800').cfa[0];   // pierwszy blok planu CFA: 28.09, 08:00 (D-093)
  assert.equal(cfaSourceLine(a), 'Curriculum 2026 Vol 1 (QM), s. 3–13 (11 s.)');
});

test('podpunkty posiłków: nazwa i kcal z właściwej fazy i wariantu', () => {
  const lunch = d => resolveDay(d).slots.find(s => s.id === 'slot.1313').items.find(i => i.kind === 'meal');
  assert.equal(lunch('2026-10-05').kcal, 465);
  assert.ok(lunch('2026-10-12').kcal > 465, 'Faza 1: większa porcja makaronu');
  const post = resolveDay('2026-10-08').slots.find(s => s.id === 'slot.2015').items[0];
  assert.deepEqual([post.text, post.kcal], ['Posiłek po saunie (20:15)', 114]);
});

test('D-088/D-090: dni przed 27.09.2026 poza planem — ciągłość dat bez treningu, dawek, bloków i recall; 27.09 pierwszym dniem planu', () => {
  for (const d of range('2026-01-01', '2026-09-26')) {
    const r = resolveDay(d);
    assert.equal(r.outside, true, d);
    assert.deepEqual([r.training, r.doses.length, r.cfa.blocks.length, r.cfa.recall, r.sauna, r.sessionName], [null, 0, 0, false, 0, 'Poza planem'], d);
    assert.equal(r.slots.length, 34, d);                                   // szablon godzin bez zmian (ciągłość widoków)
    assert.ok(r.slots.filter(s => s.domain === 'train').every(s => s.title === 'Wolne'), d);
  }
  const s = resolveDay('2026-09-27');
  assert.deepEqual([s.outside, s.dietVariant, s.kcal, s.phase], [false, 'NT', 2332, 0]);
  assert.equal(phaseFor('2026-09-26'), null);
  assert.equal(SRC.phases.start, START);
});

test('D-096: tydzień 28.09–04.10.2026 — 28–29.09 bez treningu (NT), 30.09 UPPER 1 + sauna, 01.10 LOWER 1, 02.10 Rower + ABS, 03.10 2 × sauna (NT), 04.10 basen; od 05.10 plan tygodnia', () => {
  const row = d => { const r = resolveDay(d); return [r.dayType, r.sessionLabel, r.dietVariant, (r.training || []).length > 0, r.sauna]; };
  assert.deepEqual(row('2026-09-28'), ['free', 'Bez treningu', 'NT', false, 0]);
  assert.deepEqual(row('2026-09-29'), ['free', 'Bez treningu', 'NT', false, 0]);
  assert.deepEqual(row('2026-09-30'), ['strength_sauna', 'UPPER 1 + sauna', 'T', true, 1]);
  assert.deepEqual(row('2026-10-01'), ['strength', 'LOWER 1', 'T', true, 0]);
  assert.deepEqual(row('2026-10-02'), ['cardio_sauna', 'Rower + ABS + sauna', 'T', true, 1]);
  assert.deepEqual(row('2026-10-03'), ['rest_sauna2', 'Bez treningu, 2 × sauna', 'NT', false, 2]);
  assert.deepEqual(row('2026-10-04'), ['swim', 'Basen', 'T', false, 0]);
  assert.deepEqual(resolveDay('2026-09-30').training.map(e => e.id), resolveDay('2026-10-05').training.map(e => e.id), 'UPPER 1 jak w poniedziałek');
  assert.deepEqual(resolveDay('2026-10-01').training.map(e => e.id), resolveDay('2026-10-06').training.map(e => e.id), 'LOWER 1 jak we wtorek');
  const main = d => resolveDay(d).slots.find(s => s.id === 'slot.1815').title;
  assert.deepEqual(['2026-09-28', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'].map(main),
    ['Wolne', 'Trening siłowy: UPPER 1', 'Trening siłowy: LOWER 1', 'Rower 55 min + ABS', '2 rundy sauny wg protokołu']);
  assert.ok(resolveDay('2026-10-03').slots.some(s => s.id === 'slot.1213z'), '03.10: sobota z zakupami bez zmian');
  assert.equal(resolveDay('2026-09-28').cfa.recall, true, 'recall CFA bez zmian');
  // od 05.10 plan tygodnia bez zmian
  assert.deepEqual([...range('2026-10-05', '2026-10-11')].map(d => resolveDay(d).sessionName), ['UPPER 1', 'LOWER 1', 'Rower + ABS', 'Bez treningu, 2 × sauna', 'UPPER 2', 'LOWER 2', 'Basen']);
});

test('D-096: weekendy 8:00–15:23 w slotach A–G — studia (bez zakupów), rozmowa, praca magisterska; święta wolne; P1–P7 MPW; egzamin MPW', () => {
  const ag = d => resolveDay(d).slots.filter(s => s.role === 'cfa' && s.to <= '15:23');
  const titles = d => [...new Set(ag(d).map(s => s.title))];
  const STUDIA = 'Wycena przedsiębiorstwa i modelowanie finansowe - studia';
  for (const d of ['2026-11-14', '2026-11-15', '2026-12-05', '2026-12-06', '2027-01-09', '2027-01-10', '2027-02-06', '2027-02-07', '2027-02-20', '2027-02-21']) {
    assert.deepEqual(titles(d), [STUDIA], d);
    assert.equal(ag(d).length, 7, `${d}: 7 bloków 8:00–15:23`);
  }
  assert.ok(!resolveDay('2026-11-14').slots.some(s => s.id === 'slot.1213z'), 'sobota zjazdu bez zakupów');
  for (const d of ['2026-11-21', '2026-11-22', '2026-11-28', '2026-11-29']) assert.deepEqual(titles(d), ['Przygotowywanie do rozmowy kwalifikacyjnej'], d);
  const praca = Object.entries(SRC.week.blocks).filter(([, b]) => b.kind === 'praca').map(([d]) => d);
  assert.deepEqual(praca, ['2026-12-12', '2026-12-13', '2026-12-19', '2026-12-20', '2027-01-02', '2027-01-03', '2027-01-16', '2027-01-17', '2027-01-23', '2027-01-24',
    '2027-01-30', '2027-01-31', '2027-02-13', '2027-02-14', '2027-02-27', '2027-02-28']);
  for (const d of praca) assert.deepEqual(titles(d), ['Pisanie pracy magisterskiej'], d);
  assert.ok(resolveDay('2026-12-12').slots.some(s => s.id === 'slot.1213z'), 'sobota z pracą magisterską — zakupy jak w systemie CFA');
  assert.equal(ag('2026-12-12').length, 6, 'sobota: A–D, F, G (bez E)');
  for (const d of ['2026-12-26', '2026-12-27', '2027-03-27', '2027-03-28']) {
    const r = resolveDay(d);
    assert.deepEqual([r.dayType, r.training, r.dietVariant, r.sauna], ['free', null, 'NT', 0], d);
    assert.ok(r.slots.filter(s => s.role === 'cfa').every(s => s.title === 'Wolne'), d);
    assert.ok(!r.slots.some(s => s.id === 'slot.1213z' || s.id === 'slot.1815n'), `${d}: bez zakupów i basenu`);
  }
  for (const d of ['2027-03-06', '2027-03-07', '2027-03-13', '2027-03-14', '2027-03-20']) {
    assert.deepEqual(ag(d).map(s => s.title), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'].map(p => `MPW blok ${p}`), d);
    assert.deepEqual(ag(d).map(s => s.mpw.nr), mpwByDay[d].filter(b => b.blok.startsWith('P')).map(b => b.nr), d);
  }
  assert.deepEqual(titles('2027-03-21'), ['Egzamin MPW']);
  // w dni powszednie bloki MPW A–C nie trafiają do slotów (karta w „Dziś”, D-095)
  assert.ok(!resolveDay('2026-11-17').slots.some(s => s.mpw));
  // weekendy bez wpisów: przed 14.11 (plan CFA), 07–08.11
  assert.equal(SRC.week.blocks['2026-11-07'], undefined);
});
