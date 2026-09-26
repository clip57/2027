// Pakiet prywatny (D-035, D-091): zgodność z danymi aplikacji i wersją planu; aktualizacja istniejącego pakietu skryptem
// tools/extract/private_pack_lib.py. Wyłącznie teksty zastępcze „[DANE TESTOWE]” — bez danych osobowych i medycznych.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { packStatus, markersIn } from '../../src/core/private.js';
import { diagnose } from '../../src/core/calc/diagnostics.js';
import { Store } from '../../src/core/storage/store.js';
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';
import { SRC } from '../../src/core/data.js';
import { PLAN_START } from '../../src/core/resolver.js';

const rekomp = JSON.parse(fs.readFileSync(new URL('../../src/data/rekomp.json', import.meta.url), 'utf8'));
const MARKERS = { 'rek-priv': markersIn(rekomp), 'mp-why': markersIn(SRC.mealprep) };
const T = s => `[DANE TESTOWE] ${s}`;
const pack = ({ plan = true, drop = null } = {}) => ({ format: '2027-private', schema: 1, created: '2026-09-22', decision: 'D-035',
  ...(plan ? { plan: { start: PLAN_START, decision: 'D-090' } } : {}),
  sections: [
    { id: 'rek-s1', title: T('s1'), blocks: [{ type: 'p', text: T('Faza 0 (26.09–11.10) — tabela') }, { type: 'table', rows: [['Tygodnie', 'Okres'], ['Faza 0', '26.09–11.10']] }] },
    { id: 'rek-s21', title: T('s21'), blocks: [{ type: 'p', text: T('kontrola w tygodniu 8 (15.11)') }] },
    { id: 'mp-why', title: T('mp'), blocks: MARKERS['mp-why'].map(n => ({ type: 'p', text: T(`mp ${n}`), marker: n })) },
    { id: 'rek-priv', title: T('rek'), blocks: MARKERS['rek-priv'].filter(n => n !== drop).map(n => ({ type: 'p', text: T(`rek ${n}`), marker: n })) },
  ] });

test('packStatus: brak pakietu, pakiet aktualny, pakiet sprzed D-090, brak fragmentu', () => {
  assert.deepEqual(packStatus(null, { start: PLAN_START, markers: MARKERS }), { imported: false });
  assert.equal(MARKERS['rek-priv'].length, 30);
  const ok = packStatus(pack(), { start: PLAN_START, markers: MARKERS });
  assert.deepEqual([ok.ok, ok.current, ok.planStart], [true, true, PLAN_START]);
  const old = packStatus(pack({ plan: false }), { start: PLAN_START, markers: MARKERS });
  assert.deepEqual([old.ok, old.current, old.created], [true, false, '2026-09-22']);
  const miss = packStatus(pack({ drop: 7 }), { start: PLAN_START, markers: MARKERS });
  assert.deepEqual([miss.ok, miss.missing], [false, { 'rek-priv': [7] }]);
});

test('Diagnostyka: stan pakietu prywatnego (info / ok / ostrzeżenie)', async () => {
  const lvl = async p => {
    const s = await new Store(new MemoryAdapter()).open();
    if (p) await s.record('private.pack', { pack: p });
    return diagnose(s.state, { today: '2026-10-05' }).find(x => x.id === 'private');
  };
  assert.equal((await lvl(null)).level, 'info');
  assert.equal((await lvl(pack())).level, 'ok');
  const old = await lvl(pack({ plan: false }));
  assert.deepEqual([old.level, /2026-09-22/.test(old.title)], ['info', true]);
  const bad = await lvl(pack({ drop: 3 }));
  assert.equal(bad.level, 'warn');
  assert.match(bad.detail, /rek-priv: brak fragmentów 3/);
});

const py = spawnSync('python3', ['--version']);
test('private_pack_lib.py: aktualizacja istniejącego pakietu — daty planu, metadane, kontrola znaczników, zapis poza repozytorium',
  { skip: py.status !== 0 && 'brak python3' }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2027-pack-'));
    const run = (inp, out) => spawnSync('python3', ['tools/extract/private_pack_lib.py', inp, out], { encoding: 'utf8' });
    const src = path.join(dir, 'stary.json'), out = path.join(dir, 'nowy.json');
    fs.writeFileSync(src, JSON.stringify(pack({ plan: false })));
    const r = run(src, out);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const p = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(p.plan.start, PLAN_START);
    assert.equal(p.plan.cfa.bloki, SRC.cfa.D.stat.bloki);
    assert.equal(p.sections[0].blocks[0].text, T('Faza 0 (27.09–11.10) — tabela'));
    assert.deepEqual(p.sections[0].blocks[1].rows, [['Tygodnie', 'Okres'], ['Faza 0', '27.09–11.10']], 'bez ogólnej reguły „Tygodnie”');
    assert.match(r.stdout, /Do przejrzenia/);
    assert.match(r.stdout, /tygodniu 8/);
    assert.deepEqual(packStatus(p, { start: PLAN_START, markers: MARKERS }).current, true);
    assert.equal(JSON.parse(fs.readFileSync(src, 'utf8')).plan, undefined, 'oryginał bez zmian');
    // pakiet niepasujący do danych aplikacji — błąd, bez zapisu
    fs.writeFileSync(src, JSON.stringify(pack({ drop: 5 })));
    const bad = run(src, path.join(dir, 'zly.json'));
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /rek-priv: brak fragmentów dla znaczników \[5\]/);
    assert.equal(fs.existsSync(path.join(dir, 'zly.json')), false);
    // zapis w repozytorium — odmowa (D-035)
    const repo = run(src, 'tests/zly-pakiet.json');
    assert.notEqual(repo.status, 0);
    assert.match(repo.stderr, /Odmowa/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
