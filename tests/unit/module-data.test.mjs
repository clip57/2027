// T10 (audyt 10.11.2026): dane widoków doładowywane przy wejściu do modułu — rdzeń w pakiecie wystarcza modułom spoza widoku
// (⌘K, Zapasy, Diagnostyka), pełne dane przez `loadModuleData`; ten sam interfejs w Node i w przeglądarce (jak plan-tasks).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SPLIT_DATA, DATA_IDS } from '../../src/core/data-split.js';
import { moduleData, loadModuleData } from '../../src/core/module-data.js';
import { markersIn } from '../../src/core/private.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const raw = id => JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${id}.json`), 'utf8'));

test('T10: rdzeń danych widoków — spis sekcji i znaczniki Rekompozycji, nazwy produktów Bezpieczeństwa; poradnik w całości osobno', () => {
  assert.deepEqual(DATA_IDS, ['rekomp', 'guide', 'safety']);
  const rk = raw('rekomp'), core = SPLIT_DATA.rekomp(rk);
  assert.deepEqual(core.sections, rk.sections.map(s => ({ id: s.id, num: s.num, title: s.title })));
  assert.deepEqual(core.markers, markersIn(rk), 'Diagnostyka: znaczniki pakietu prywatnego z rdzenia = z pełnej treści');
  assert.ok(!JSON.stringify(core).includes('"blocks"'), 'bez treści sekcji w pakiecie');
  const sf = raw('safety'), sc = SPLIT_DATA.safety(sf);
  assert.deepEqual(sc.rows, sf.rows.map(r => ({ Produkt: r.Produkt, section: r.section })), '⌘K i Zapasy: nazwy i działy');
  assert.ok(JSON.stringify(sc).length < JSON.stringify(sf).length / 5);
  assert.deepEqual(SPLIT_DATA.guide(raw('guide')), { intro: [], sections: [] });
  for (const id of DATA_IDS) assert.equal(JSON.stringify(raw(id)), JSON.stringify(raw(id)), `${id}: plik źródłowy bez zmian`);
});

test('T10: pełne dane przez moduleData / loadModuleData (Node), ten sam interfejs w wersji przeglądarkowej', async () => {
  for (const id of DATA_IDS) {
    assert.deepEqual(await loadModuleData(id), raw(id));
    assert.deepEqual(moduleData(id), raw(id));
  }
  assert.equal(moduleData('nieznane'), null);
  const web = fs.readFileSync(path.join(ROOT, 'src/core/module-data.web.js'), 'utf8');
  assert.match(web, /export const moduleData = /);
  assert.match(web, /export function loadModuleData\(/);
  assert.match(web, /getElementById\(`data-\$\{id\}`\)/, '2027.html: dane wbudowane w stronę');
});

test('T10: pełne dane widoków czytane tylko przez module-data (bez bezpośredniego importu poza rdzeniem w kodzie widoków)', () => {
  const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const f of ['src/modules/rekompozycja.js', 'src/modules/bezpieczenstwo.js']) {
    assert.ok(!/data\/(rekomp|guide|safety)\.json/.test(src(f)), `${f}: dane przez loadModuleData`);
    assert.match(src(f), /await (Promise\.all\(\[)?loadModuleData\(/);
  }
  assert.ok(!/SRC\.safety\.(columns|product_links)/.test(src('src/modules/zapasy.js') + src('src/core/search.js')), 'poza widokiem tylko pola rdzenia');
});
