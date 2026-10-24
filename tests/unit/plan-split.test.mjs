// U6 (audyt 23.10.2026): plany nauki w pakiecie aplikacji bez pól nieużywanych, zadania bloków MPW wczytywane osobno.
// Strażnik: usuwane pola nie mogą być używane w kodzie aplikacji (w przeglądarce ich nie ma, w Node — są, więc inne testy by tego nie wykryły).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DROP, LAZY, PLAN_IDS, corePlan, lazyPart } from '../../src/core/plan-split.js';
import { planTasks, loadPlanTasks } from '../../src/core/plan-tasks.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const raw = id => JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${id}.json`), 'utf8'));
const OWN = ['src/core/plan-split.js', 'src/core/plan-tasks.js', 'src/core/plan-tasks.web.js'];
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(path.join(ROOT, d))) {
    const p = path.join(d, f);
    if (fs.statSync(path.join(ROOT, p)).isDirectory()) { if (f !== 'data') walk(p); } else if (p.endsWith('.js') && !OWN.includes(p)) files.push(p);
  }
})('src');
const code = files.map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
// użycie pola: `.pole`, `['pole']`, `'pole'`, klucz `pole:` albo `{ pole }` / `, pole,` w destrukturyzacji
const uses = f => new RegExp(`\\.${f}\\b|\\[['"\`]${f}['"\`]\\]|['"\`]${f}['"\`]|\\b${f}\\s*:|[{,]\\s*${f}\\s*[,}=]`);

test('U6: pola usuwane z pakietu i zadania bloków nie są używane w kodzie aplikacji (poza plan-split / plan-tasks)', () => {
  assert.ok(files.length > 50);
  for (const id of PLAN_IDS) {
    for (const f of [...DROP[id].plan, ...DROP[id].block, ...(LAZY[id] ? [LAZY[id]] : [])]) {
      const hit = code.filter(([, t]) => uses(f).test(t)).map(([p]) => p);
      assert.deepEqual(hit, [], `${id}.${f} użyte w: ${hit.join(', ')} — usuń pole z DROP/LAZY albo czytaj je inaczej`);
    }
  }
});

test('U6: plan w pakiecie = pełny plan bez usuwanych pól (pozostałe pola i kolejność bloków bez zmian); dane źródłowe nienaruszone', () => {
  for (const id of PLAN_IDS) {
    const full = raw(id), before = JSON.stringify(full), core = corePlan(id, full);
    assert.equal(JSON.stringify(full), before, 'corePlan nie zmienia danych wejściowych');
    const gone = new Set([...DROP[id].block, ...(LAZY[id] ? [LAZY[id]] : [])]);
    assert.equal(core.D.bloki.length, full.D.bloki.length);
    full.D.bloki.forEach((b, i) => {
      const exp = Object.fromEntries(Object.entries(b).filter(([k]) => !gone.has(k)));
      assert.deepEqual(core.D.bloki[i], exp, `${id} nr ${b.nr}`);
    });
    for (const k of Object.keys(full.D)) if (k !== 'bloki') assert.equal(k in core.D, !DROP[id].plan.includes(k), `${id}.D.${k}`);
    for (const k of DROP[id].plan) assert.ok(k in full.D, `${id}.D.${k} — pole z listy DROP istnieje w planie (lista aktualna)`);
    for (const k of DROP[id].block) assert.ok(full.D.bloki.some(b => k in b), `${id}: pole bloku ${k} istnieje w planie (lista aktualna)`);
    assert.deepEqual([core.exam, core.schema], [full.exam, full.schema]);
    assert.ok(JSON.stringify(core).length < before.length * (id === 'cfa' ? 0.4 : 0.7), `${id}: pakiet mniejszy`);
  }
  // R2 korzysta z wersji planu i mapowania postępu poprzedniej wersji — muszą zostać w pakiecie
  const c = corePlan('cfa', raw('cfa')).D;
  assert.ok(c.version && c.previousVersion && c.progressRequirements && c.finalization && c.bloki.every(b => Number.isInteger(b.previousVersionBlock)));
});

test('U6: zadania bloków MPW — osobna część (wszystkie bloki z zadaniami), ten sam interfejs w Node i w przeglądarce', async () => {
  const full = raw('mpw'), part = lazyPart('mpw', full);
  assert.deepEqual([part.plan, part.field], ['mpw', 'zadania']);
  const withTasks = full.D.bloki.filter(b => b.zadania);
  assert.ok(withTasks.length > 300);
  assert.equal(Object.keys(part.values).length, withTasks.length);
  for (const b of withTasks) assert.equal(part.values[b.nr], b.zadania);
  assert.equal(lazyPart('cfa', raw('cfa')), null, 'CFA: zadania nie są wyświetlane — nie ma części osobnej');
  assert.deepEqual(await loadPlanTasks('mpw'), part.values);
  assert.deepEqual(planTasks('mpw'), part.values);
  assert.equal(planTasks('cfa'), null);
  // wersja przeglądarkowa: identyczne nazwy eksportów
  const web = fs.readFileSync(path.join(ROOT, 'src/core/plan-tasks.web.js'), 'utf8');
  assert.match(web, /export const planTasks = /);
  assert.match(web, /export function loadPlanTasks\(/);
});
