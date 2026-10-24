// Dziennik szczegółów sesji (D-106): walidacja zdarzenia train.detail, scalanie zmian pól, tempo i podsumowanie, zapis i odczyt w magazynie, sesje z wpisem basenu/roweru.
import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { LOG, SECTIONS, NOTE_MAX, mainKind, validateDetail, fieldOk, withValue, hasContent, swimPace, paceText, summarize } from '../../src/core/trainlog.js';
import { classifyEvent, EVENT_TYPES } from '../../src/core/storage/validate.js';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { sessions, weekly, streakWeeks } from '../../src/core/calc/training.js';
import { diagnose } from '../../src/core/calc/diagnostics.js';
import { SRC } from '../../src/core/data.js';

const D = '2026-10-25';
const full = {
  date: D,
  swim: { main_min: 45, dist: 1500, pool: '25', strokes: ['kraul', 'grzbiet'], rpe: 3.5, hr_avg: 118, hr_max: 131, crit: ['oddech3', 'zdanie'], signals: ['pieczenie'], stretch: true },
  knee: { before: 1, during: 2.5, next_morning: 0, swelling: 'minimal', instability: 'none' },
  sauna: { rounds: 2, r1_min: 20, r2_min: 20, temp_c: 90, cool_min: 12, water_before_ml: 400, water_after_ml: 600, ended_at: '20:35', symptoms: ['zawroty'] },
  note: 'Lekko, bez problemów.',
};

test('specyfikacja pól: sekcje basen, rower, kolano, sauna; etykiety i podpowiedzi z protokołów; kolano zgodne z arkuszem „System kolana”', () => {
  assert.deepEqual(SECTIONS, ['swim', 'bike', 'knee', 'sauna']);
  assert.deepEqual(Object.keys(LOG.swim.fields), ['main_min', 'dist', 'pool', 'strokes', 'rpe', 'hr_avg', 'hr_max', 'crit', 'signals', 'stretch']);
  assert.equal(LOG.swim.fields.rpe.hint, 'cel RPE 3–4 w skali 0–10');
  assert.match(LOG.bike.fields.hr_avg.hint, /65–70% HRmax \(~125–135 bpm\)/);
  const knee = SRC.training.sheetsData[0];
  assert.deepEqual(LOG.knee.fields.swelling.options.map(o => o[1]), [knee.criteria[2].green, knee.criteria[2].yellow, knee.criteria[2].red], 'obrzęk: te same opisy co w arkuszu');
  assert.deepEqual(LOG.knee.fields.instability.options.map(o => o[1]), [knee.criteria[3].green, knee.criteria[3].yellow, knee.criteria[3].red], 'luz: te same opisy co w arkuszu');
  // kryteria rozpoznania i sygnały basenu — brzmienie z protokołu w Rekompozycji (wszystkie trzy / którykolwiek)
  const rk = readFileSync(new URL('../../src/data/rekomp.json', import.meta.url), 'utf8').toLowerCase();
  for (const frag of ['oddychać co 2. ruch ramion', 'ponad 30 s odpoczynku przy ścianie', 'tempo spada w drugiej połowie', 'pieczenie w barkach lub przedramionach', 'oddech co 3. ruch ramion', 'pełne zdanie bez łapania tchu']) assert.ok(rk.includes(frag), `protokół basenu w Rekompozycji: ${frag}`);
});

test('walidacja train.detail: poprawny dokument przechodzi, błędne pola, zakresy, typy i duplikaty są odrzucane', () => {
  assert.ok(validateDetail(full));
  assert.ok(validateDetail({ date: D }), 'pusty dokument (po wyczyszczeniu pól) jest poprawny');
  assert.ok(validateDetail({ date: D, knee: { before: 0 } }), 'ból 0 jest poprawną wartością');
  const bad = [
    null, [], { date: '2026-13-40' }, { date: D, foo: { a: 1 } }, { date: D, swim: {} }, { date: D, swim: { dist: -1 } }, { date: D, swim: { dist: 99999 } },
    { date: D, swim: { dist: '1500' } }, { date: D, swim: { dist: NaN } }, { date: D, swim: { pool: '33' } }, { date: D, swim: { strokes: [] } }, { date: D, swim: { strokes: ['kraul', 'kraul'] } },
    { date: D, swim: { strokes: ['delfin'] } }, { date: D, swim: { stretch: false } }, { date: D, swim: { nieznane: 1 } }, { date: D, knee: { before: 11 } }, { date: D, knee: { swelling: 'duży' } },
    { date: D, sauna: { ended_at: '25:00' } }, { date: D, sauna: { ended_at: '9:00' } }, { date: D, sauna: { rounds: 4 } }, { date: D, bike: { hr_avg: 20 } }, { date: D, note: '' }, { date: D, note: 'x'.repeat(NOTE_MAX + 1) },
  ];
  for (const b of bad) assert.equal(validateDetail(b), false, JSON.stringify(b)?.slice(0, 70));
  assert.ok(validateDetail({ date: D, note: 'x'.repeat(NOTE_MAX) }));
  assert.ok(EVENT_TYPES.includes('train.detail'));
});

test('zgodność w przód: magazyn przyjmuje dokument z nowszej wersji (nowe pole, szerszy zakres); odrzuca tylko błędną datę i treść spoza JSON', () => {
  const env = d => ({ v: 1, id: 'e1', hlc: '1760000000000:0001:dev1', dev: 'dev1', t: 'train.detail', d });
  assert.equal(classifyEvent(env(full)), 'ok');
  for (const d of [{ date: D, swim: { dist: -5 } }, { date: D, sauna: { rounds: 4 } }, { date: D, swim: { nowe_pole: 'x' } }, { date: D, rower2: { a: 1 } }, { date: D, knee: { swelling: 'nowy' } }])
    assert.equal(classifyEvent(env(d)), 'ok', `nie do kwarantanny: ${JSON.stringify(d)}`);
  for (const d of [{ date: '2026-13-40' }, { swim: { dist: 1 } }, { date: D, swim: { f: () => 1 } }])
    assert.match(classifyEvent(env(d)), /niepoprawna treść zdarzenia train.detail/);
});

test('fieldOk: formularz zapisuje tylko wartości zgodne z definicją; puste wartości (usunięcie pola) zawsze dozwolone', () => {
  assert.ok(fieldOk('swim', 'dist', 1500));
  assert.ok(fieldOk('swim', 'dist', null) && fieldOk('swim', 'strokes', []) && fieldOk('swim', 'stretch', false));
  assert.equal(fieldOk('swim', 'dist', 99999), false);
  assert.equal(fieldOk('swim', 'pool', '33'), false);
  assert.equal(fieldOk('swim', 'nieznane', 1), false);
  assert.equal(fieldOk('sauna', 'ended_at', '25:00'), false);
  assert.ok(fieldOk('note', null, 'tekst') && fieldOk('note', null, ''));
});

test('odczyt dokumentu z nowszej wersji: podsumowanie i tempo nie zawodzą na nieznanych wartościach', () => {
  const doc = { date: D, swim: { dist: '1500', main_min: 45, nowe: 1 }, knee: { swelling: 'nowy' }, sauna: { symptoms: 'zawroty' }, przyszla: { a: 1 } };
  assert.equal(swimPace(doc), null);
  assert.equal(summarize(doc), 'Basen 1500 m · 45 min — kolano – / – / – · obrzęk: nowy — Sauna');
  assert.deepEqual(withValue(doc, 'knee', 'before', 1).przyszla, { a: 1 }, 'zapis pola zachowuje sekcje z nowszej wersji');
});

test('withValue: ustawianie i usuwanie pól, zero zostaje, puste sekcje znikają, notatka przycinana', () => {
  let d = { date: D };
  d = withValue(d, 'knee', 'before', 0);
  assert.deepEqual(d, { date: D, knee: { before: 0 } }, 'ból 0 to wpis');
  d = withValue(d, 'swim', 'strokes', ['kraul']);
  d = withValue(d, 'swim', 'stretch', true);
  d = withValue(d, 'swim', 'stretch', false);
  assert.deepEqual(d.swim, { strokes: ['kraul'] });
  d = withValue(d, 'swim', 'strokes', []);
  assert.equal('swim' in d, false, 'pusta sekcja znika');
  d = withValue(d, 'note', null, '  Dobrze  ');
  assert.equal(d.note, 'Dobrze');
  d = withValue(d, 'note', null, '');
  assert.equal('note' in d, false);
  d = withValue(d, 'knee', 'before', null);
  assert.deepEqual(d, { date: D });
  assert.equal(hasContent(d), false);
  assert.ok(hasContent(full));
  assert.ok(validateDetail(withValue({ date: D }, 'sauna', 'ended_at', '19:40')));
  assert.equal(withValue({ date: D }, 'note', null, 'y'.repeat(NOTE_MAX + 50)).note.length, NOTE_MAX);
});

test('tempo pływania, podsumowanie dnia i rodzaj sesji z typu dnia', () => {
  assert.equal(swimPace(full), 180, '45 min = 2700 s na 15 × 100 m = 180 s na 100 m');
  assert.equal(paceText(180), '3:00 /100 m');
  assert.equal(paceText(null), null);
  assert.equal(swimPace({ swim: { dist: 1500 } }), null, 'bez czasu — bez tempa');
  assert.equal(summarize(full), 'Basen 1500 m · 45 min · RPE 3,5 · 3:00 /100 m · 118 bpm — kolano 1 / 2,5 / 0 · obrzęk: minimalny — Sauna 2 rundy · 90°C · objawy: 1 — notatka');
  assert.equal(summarize({ date: D, bike: { main_min: 45, hr_avg: 128, dist_km: 18.4, cadence: 85 } }), 'Rower 45 min · 128 bpm · 18,4 km · 85 obr./min');
  assert.equal(summarize(null), '');
  assert.deepEqual(['strength', 'strength_sauna', 'cardio_sauna', 'swim', 'rest_sauna2', 'free'].map(mainKind), ['strength', 'strength', 'bike', 'swim', null, null]);
  const planTypes = [...new Set(Object.values(SRC.week.days).map(x => x.dayType))].sort();
  assert.deepEqual(planTypes.map(t => [t, mainKind(t)]), [['cardio_sauna', 'bike'], ['rest_sauna2', null], ['strength', 'strength'], ['strength_sauna', 'strength'], ['swim', 'swim']], 'wszystkie typy dni z planu mają rodzaj sesji');
});

test('magazyn: zapis train.detail, ostatni zapis dnia wygrywa, odczyt po ponownym otwarciu, niepoprawna treść odrzucona', async () => {
  const adapter = new MemoryAdapter();
  let s = await new Store(adapter).open();
  await s.record('train.detail', { date: D, swim: { dist: 1000 } });
  assert.deepEqual(s.state.trainDetails[D], { date: D, swim: { dist: 1000 } });
  await s.record('train.detail', { date: D, swim: { dist: 1250, rpe: 3 }, note: 'drugi zapis' });
  assert.deepEqual(s.state.trainDetails[D], { date: D, swim: { dist: 1250, rpe: 3 }, note: 'drugi zapis' }, 'dokument dnia zastępuje poprzedni');
  await s.record('train.detail', { date: '2026-10-26', knee: { before: 1 } });
  await assert.rejects(s.record('train.detail', { date: '2026-02-30', swim: { dist: 1 } }));
  assert.equal(s.state.trainDetails[D].swim.dist, 1250, 'odrzucony zapis nie zmienia stanu');
  s = await new Store(adapter).open();
  assert.deepEqual(Object.keys(s.state.trainDetails).sort(), [D, '2026-10-26']);
  assert.equal(s.state.trainDetails[D].note, 'drugi zapis');
  assert.equal(s.allEvents().filter(e => e.t === 'train.detail').length, 3, 'wszystkie zapisy zostają w dzienniku zdarzeń (eksport, synchronizacja)');
});

test('sesje: dzień z wpisem basenu lub roweru liczy się jako sesja także bez serii i czasu; kolano i sauna same nie; wpisy sprzed startu treningów pomijane', () => {
  const det = { '2026-10-25': { date: '2026-10-25', swim: { dist: 1200, main_min: 40 } }, '2026-10-21': { date: '2026-10-21', bike: { main_min: 45 } },
    '2026-10-20': { date: '2026-10-20', knee: { before: 2 } }, '2026-10-22': { date: '2026-10-22', sauna: { rounds: 2 } }, '2026-10-10': { date: '2026-10-10', swim: { dist: 500 } } };
  const all = sessions({}, {}, det);
  assert.deepEqual(all.map(x => x.date), ['2026-10-21', '2026-10-25']);
  assert.equal(all[1].detail.swim.dist, 1200);
  assert.deepEqual(sessions({}, {}, {}), []);
  const wk = weekly({}, {}, 4, '2026-10-26', det);
  assert.equal(wk.at(-2).sessions, 2, 'tydzień 19–25.10: rower i basen');
  // B8 (audyt 23.10.2026): seria tygodni liczy te same sesje co „Treningi” i wykres tygodniowy
  assert.equal(streakWeeks({}, {}, '2026-10-26', det), 1, 'tydzień 19–25.10 z basenem i rowerem — seria 1 tydzień');
  assert.equal(streakWeeks({}, {}, '2026-10-26'), 0, 'bez wpisów dziennika — brak sesji');
  assert.equal(streakWeeks({}, {}, '2026-10-26', { '2026-10-20': { date: '2026-10-20', knee: { before: 2 } } }), 0, 'samo kolano nie jest sesją');
});

test('diagnostyka: wpisy dziennika sesji sprzed startu planu zliczane razem z czasami treningu', async () => {
  const s = await new Store(new MemoryAdapter()).open();
  await s.record('train.session', { date: '2026-10-01', minutes: 30 });
  await s.record('train.detail', { date: '2026-10-02', swim: { dist: 100 } });
  await s.record('train.detail', { date: '2026-10-25', swim: { dist: 900 } });
  const d = diagnose(s.state, { today: '2026-10-26' });
  assert.equal(d.find(x => x.id === 'pre-start').title, 'Wpisy treningowe sprzed startu planu: 2');
});
