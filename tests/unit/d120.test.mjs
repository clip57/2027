// D-120 (23.11.2026, decyzje użytkownika): godziny bloków CFA i MPW dopasowane do planu dnia, symulacje MPW, dni bez treningu, „Praca”
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolveDay, dayPlan } from '../../src/core/resolver.js';
import { SRC, cfaByDay, mpwByDay } from '../../src/core/data.js';
import cfaJson from '../../src/data/cfa.json' with { type: 'json' };
import mpwJson from '../../src/data/mpw.json' with { type: 'json' };

const at = (d, from) => resolveDay(d).slots.find(s => s.from === from);
const line = d => resolveDay(d).slots.map(s => `${s.from}–${s.to} ${s.title}`);
const times = (d, plan = mpwByDay) => (plan[d] || []).map(b => `${b.blok} ${b.godz}`);

test('D-120: pliki planów bez zmian — przesunięcia tylko w `week.studyMoves`, od 23.11.2026; liczba bloków bez zmian', () => {
  assert.equal(SRC.cfa.D.bloki.length, cfaJson.D.bloki.length);
  assert.equal(SRC.mpw.D.bloki.length, mpwJson.D.bloki.length);
  assert.ok(cfaJson.D.bloki.every(b => !('godz_src' in b)) && mpwJson.D.bloki.every(b => !('godz_src' in b)));
  for (const [plan, moves] of [['cfa', SRC.week.studyMoves.cfa], ['mpw', SRC.week.studyMoves.mpw]]) {
    const raw = (plan === 'cfa' ? cfaJson : mpwJson).D.bloki;
    // D-121: bloki z 20–22.11 też przesunięte (pełna chronologia od Dnia zero 23.11) — żaden blok przed startem planu
    for (const nr of Object.keys(moves).filter(k => k !== 'decision')) assert.ok(moves[nr].slice(0, 10) >= '2026-11-23', `${plan} ${nr}: przed startem planu`);
    assert.ok(raw.some(b => b.data < '2026-11-23'), `${plan}: plik planu od 20.11 (bez zmian)`);
  }
  assert.deepEqual(times('2026-11-21'), [], 'D-121: dni sprzed startu planu bez bloków');
});

test('D-120: dni robocze — MPW A 15:30, B 16:40, C 22:00 (z CFA J: MPW C 21:00, J 22:00); blok dodatkowy 21:00, J 22:00; czwartki z zakupami — tylko J 22:00', () => {
  assert.deepEqual(times('2026-11-24'), ['A 15:30–16:23', 'B 16:40–17:33', 'C 22:00–22:53']);
  assert.deepEqual([...times('2027-01-05'), ...times('2027-01-05', cfaByDay)], ['A 15:30–16:23', 'B 16:40–17:33', 'C 21:00–21:53', 'J 22:00–22:53']);
  assert.deepEqual(times('2027-03-22', cfaByDay), ['H 15:30–16:23', 'I 16:40–17:33', 'Dodatkowy 21:00–21:53', 'J 22:00–22:53']);
  assert.deepEqual([...times('2027-01-07'), ...times('2027-01-07', cfaByDay)], ['A 16:00–16:53', 'B 17:00–17:53', 'C 18:00–18:53', 'J 22:00–22:53']);
  assert.deepEqual(line('2027-01-07').filter(l => l >= '20:50' && l < '23'), ['21:00–21:53 Relaks', '21:53–22:00 Przygotowywanie posiłków, melisy i wieczorna pielęgnacja', '22:00–22:53 CFA blok J', '22:53–23:00 Wieczorna toaleta']);
  assert.equal(at('2027-01-07', '21:00').meal, 'supper', 'czwartek: kolacja w czasie relaksu');
});

test('D-120: weekendy — o jeden slot wcześniej; praca dyplomowa 08:00–11:03; zjazd: sobota 15:30 i 16:40, reszta w niedzielę chronologicznie', () => {
  assert.deepEqual([...times('2026-12-12', cfaByDay), ...times('2026-12-12')], ['E 11:20–12:13', 'F 12:20–13:13', 'G 13:30–14:23', 'A 14:30–15:23', 'B 15:30–16:23', 'C 16:40–17:33']);
  assert.deepEqual(resolveDay('2026-12-12').slots.filter(s => s.block === 'praca').map(s => s.from), ['08:00', '09:10', '10:10']);
  assert.equal(resolveDay('2026-12-12').blocks.title, 'Pisanie pracy dyplomowej');
  assert.deepEqual(times('2026-11-28'), ['A 15:30–16:23', 'B 16:40–17:33']);
  assert.deepEqual(times('2026-11-29'), ['C 15:30–16:23', 'A 16:40–17:33', 'B 21:00–21:53', 'C 22:00–22:53']);
  assert.deepEqual(mpwByDay['2026-11-29'].map(b => b.nr), [mpwByDay['2026-11-28'][1].nr + 1, mpwByDay['2026-11-28'][1].nr + 2, mpwByDay['2026-11-28'][1].nr + 3, mpwByDay['2026-11-28'][1].nr + 4], 'ostatni blok soboty w niedzielę 15:30 — chronologicznie (D-121: materiał wg kolejności)');
  assert.deepEqual(times('2027-04-04', cfaByDay), ['Dodatkowy 15:30–16:23', 'H 16:40–17:33', 'I 21:00–21:53', 'Dodatkowy 22:00–22:53']);
  // niedziela zjazdowa: wieczór jak w dni z blokiem o 21:00 (relaks 19:45–20:05, prysznic 20:05–20:35, kolacja 20:50–21:00)
  assert.deepEqual(line('2026-11-29').filter(l => l >= '19:30' && l < '21:00'), ['19:30–19:45 Powrót do domu', '19:45–20:05 Relaks', '20:05–20:35 Prysznic całego ciała', '20:35–20:50 Przygotowywanie kolacji i zmywanie', '20:50–21:00 Kolacja']);
  assert.deepEqual(times('2027-05-08', cfaByDay)[0], 'B 08:00–08:53');
});

test('D-120: symulacje MPW i dni bez treningu (21.02, 27.02, 06/13.03, 17.03, 20.03)', () => {
  const free = d => { const p = dayPlan(d); return [p.dayType, p.session, p.diet, p.sauna]; };
  for (const d of ['2027-02-21', '2027-03-17', '2027-03-20']) assert.deepEqual(free(d), ['free', null, 'NT', 0], d);
  assert.deepEqual(times('2027-02-21'), ['A 16:40–17:40', 'B 17:40–18:40', 'C 18:40–19:40']);
  assert.ok(!resolveDay('2027-02-21').slots.some(s => /Basen/.test(s.title)));
  assert.deepEqual(at('2027-02-21', '19:52').items.filter(i => i.kind === 'meal').map(i => i.text), ['Białko (dieta NT) (19:52)']);
  assert.deepEqual(times('2027-02-27'), ['A 11:20–12:20', 'B 12:20–13:20', 'C 13:20–14:20']);
  assert.deepEqual(times('2027-02-27', cfaByDay), ['E 14:30–15:23', 'F 15:30–16:23', 'G 16:40–17:33']);
  assert.equal(at('2027-02-27', '14:20').meal, 'lunch');
  assert.deepEqual(at('2027-02-27', '14:20').doses.map(d => d.time), ['14:20', '14:20'], 'dawki lunchu z lunchem');
  assert.deepEqual(times('2027-03-06').slice(5), ['P6 17:00–17:53', 'P7 22:00–22:53', 'A 13:30–14:30', 'B 14:30–15:30', 'C 15:30–16:30']);
  assert.deepEqual(line('2027-03-06').filter(l => l >= '16:30' && l < '21:53'), ['16:30–16:45 Przygotowywanie obiadu', '16:45–17:00 Przerwa obiadowa', '17:00–17:53 MPW blok P6',
    '17:53–18:00 Zmywanie popołudniowe', '18:00–18:20 Transport na siłownię i przebieranie', '18:20–18:30 Rozgrzewka', '18:30–19:50 Trening siłowy: LOWER 2', '19:50–20:00 Prysznic',
    '20:00–20:20 Sauna', '20:20–20:30 Chłodzenie i przebieranie', '20:30–20:40 Powrót do domu', '20:40–20:45 Wieczorne mycie głowy i suszenie',
    '20:45–21:00 Przygotowywanie kolacji i zmywanie', '21:00–21:53 Relaks']);
  assert.deepEqual(at('2027-03-06', '20:30').doses.map(d => d.supp), ['kreatyna'], 'kreatyna z posiłkiem po treningu 20:30');
  assert.deepEqual(times('2027-03-07').slice(7), ['A 15:30–16:23', 'B 16:40–17:33', 'C 22:00–22:53']);
  assert.deepEqual(times('2027-03-17'), ['A 16:40–17:40', 'B 17:40–18:40', 'C 18:40–19:40']);
  assert.equal(at('2027-03-17', '19:52').title, 'Czas wolny · białko (dieta NT)');
  assert.deepEqual(times('2027-03-20').slice(7), ['A 15:30–16:23', 'B 16:40–17:33', 'C 17:40–18:33']);
  assert.deepEqual([at('2027-03-20', '17:33').to, at('2027-03-20', '18:33').title], ['17:40', 'Czas wolny']);
  for (const d of ['2027-02-21', '2027-03-17', '2027-03-20']) assert.equal(resolveDay(d).training, null, `${d}: brak sesji`);
});

test('D-120: „Praca” 08:00–15:23 w dni robocze 2027 (bez świąt i weekendów); 2026 — „Czas własny”', () => {
  const work = d => resolveDay(d).slots.filter(s => s.role === 'cfa' && s.title === 'Praca').length;
  assert.equal(work('2027-01-05'), 7);
  assert.equal(work('2027-03-17'), 7);
  for (const d of ['2026-12-23', '2027-01-01', '2027-01-06', '2027-01-09', '2027-03-29', '2027-12-24']) assert.equal(work(d), 0, d);
  assert.equal(work('2027-12-31'), 7);
});

test('D-120: kontrola planu dnia (tools/verify/day_check.mjs) — każdy dzień do 31.12.2027 bez błędów', () => {
  const out = execFileSync('node', ['tools/verify/day_check.mjs'], { cwd: new URL('../../', import.meta.url).pathname, encoding: 'utf8' });
  assert.match(out, /BŁĘDÓW: 0/);
  assert.ok(!/KOLACJA W TRAKCIE|kolacja .* w trakcie bloku/.test(out));
});
