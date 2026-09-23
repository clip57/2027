import test from 'node:test';
import assert from 'node:assert/strict';
import muscles from '../../src/data/muscles.json' with { type: 'json' };
import { SRC } from '../../src/core/data.js';

const VOCAB = ['abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes', 'hamstrings',
  'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps'];

test('mięśnie: każde ćwiczenie z planu ma przypisanie ze źródła w domenie publicznej', () => {
  assert.match(muscles.license, /Unlicense/);
  const names = new Set(Object.values(SRC.training.days).flat().map(e => e.name));
  for (const n of names) {
    const m = muscles.exercises[n];
    assert.ok(m, `brak mapowania: ${n}`);
    assert.ok(m.primary.length > 0, `brak mięśni głównych: ${n}`);
    for (const x of [...m.primary, ...m.secondary]) assert.ok(VOCAB.includes(x), `${n}: nieznana grupa ${x}`);
    assert.ok(!m.secondary.some(x => m.primary.includes(x)), `${n}: grupa jednocześnie główna i pomocnicza`);
    assert.ok(['exact', 'closest'].includes(m.match));
  }
});

test('mięśnie: kontrola merytoryczna kluczowych ćwiczeń', () => {
  const E = muscles.exercises;
  assert.deepEqual(E['Wyciskanie sztangi leżąc'].primary, ['chest']);
  assert.ok(E['Podciąganie z asystą'].secondary.includes('biceps'), 'podciąganie angażuje biceps');
  assert.deepEqual(E['Martwy ciąg rumuński'].primary, ['hamstrings']);
  assert.deepEqual(E['Hip thrust'].primary, ['glutes']);
  assert.deepEqual(E['Prostowanie nóg'].primary, ['quadriceps']);
  assert.equal(Object.values(E).filter(m => m.match === 'closest').length, 4);
});
