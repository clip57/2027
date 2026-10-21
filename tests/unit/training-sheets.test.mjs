// Arkusze treningu (D-105): dane ustrukturyzowane (`training.json` → sheetsData, warmupData, cooldownData, dayNotes) muszą odtwarzać oryginalne, spłaszczone teksty z HTML-a co do znaku
// (po zdekodowaniu encji i normalizacji spacji) — gdyby `training.json` zregenerowano bez `tools/extract/training_sheets.py`, test to wykryje.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SRC } from '../../src/core/data.js';

const T = SRC.training;
const norm = s => s.replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&').replace(/\s+([.,;:])/g, '$1').replace(/\s+/g, ' ').trim();
const LV = { green: '🟢', yellow: '🟡', red: '🔴' };
const flatKnee = s => [`${s.icon} ${s.title} ✕`, s.levels.map(l => `${LV[l.id]} ${l.label}`).join(' '),
  ...s.criteria.map(c => `${c.name} ${c.green} ${c.yellow} ${c.red}`), ...s.actions.map(a => `${LV[a.level]} ${a.text}`),
  `${s.alert.title} ${s.alert.items.join(' · ')}.`, s.tip].join(' ');
const flatSauna = s => [`${s.icon} ${s.title} ✕`, ...s.summary.map(x => `${x.label} ${x.value} ${x.note}`), ...s.phases.flatMap(p => p.steps.map(st => `${st.label} ${st.text}`)),
  `${s.trainingDays.label} ${s.trainingDays.lines.join(' ')}`, `${s.thursday.label}: ${s.thursday.steps.join(' → ')}. ${s.thursday.total}`, s.notes.join(' ')].join(' ');
const flatPhase = (p, trening) => `${p.title} ${p.minutes} min ▾ ${p.items.map(i => `${i.n} ${i.name}${i.en ? ` (${i.en})` : ''}${i.dose ? ` ${i.dose}` : ''}`).join(' ')}${trening ? ' Trening' : ''}`;
const flatNote = (k, n) => k === 'sr' ? `${n.title} ${n.meta} ${n.device} ${n.phases.map(p => `${p.name} ${p.minutes} min ${p.text}`).join(' ')} ${n.heading}` : ['title', 'note', 'text'].filter(x => n[x]).map(x => n[x]).join(' ');

test('System kolana i Sauna: dane ustrukturyzowane odtwarzają oryginalny tekst arkusza, bez encji HTML i znaczników', () => {
  const orig = Object.fromEntries(T.sheets.filter(s => s.length > 5).map(s => [s.split('✕')[0].trim(), s]));
  const [knee, sauna] = T.sheetsData;
  assert.deepEqual([knee.id, sauna.id], ['kolano', 'sauna']);
  assert.equal(norm(flatKnee(knee)), norm(orig['🦵 System kolana']));
  assert.equal(norm(flatSauna(sauna)), norm(orig['♨️ Sauna']));
  const all = JSON.stringify(T.sheetsData);
  assert.ok(!/&gt;|&lt;|&amp;|✕/.test(all), 'bez encji HTML i znaczników spłaszczenia');
  // kolano: 5 kryteriów × 3 poziomy, 3 działania, alarm z 4 pozycjami; wszystkie pola niepuste
  assert.deepEqual(knee.levels.map(l => l.label), ['Zielone', 'Żółte', 'Czerwone']);
  assert.equal(knee.criteria.length, 5);
  for (const c of knee.criteria) for (const l of ['green', 'yellow', 'red']) assert.ok(c[l].length > 0, `${c.name}: ${l}`);
  assert.equal(knee.criteria[0].red, '>5/10 lub rośnie');
  assert.deepEqual(knee.actions.map(a => a.level), ['green', 'yellow', 'red']);
  assert.equal(knee.alert.items.length, 4);
  // sauna: 4 zasady, 3 fazy po 3+2+3 kroki, wyjście awaryjne oznaczone jako alarm, czwartek 7 kroków
  assert.deepEqual(sauna.summary.map(x => x.label), ['Kiedy', 'Czas', 'Temperatura', 'Koniec']);
  assert.deepEqual(sauna.phases.map(p => p.steps.length), [3, 2, 3]);
  assert.deepEqual(sauna.phases.flatMap(p => p.steps).filter(s => s.alert).map(s => s.label), ['Wyjście awaryjne']);
  assert.equal(sauna.thursday.steps.length, 7);
  assert.ok(sauna.trainingDays.lines.length === 3 && sauna.notes.length === 2);
});

test('Rozgrzewka i schłodzenie: numerowane ćwiczenia odtwarzają oryginał, a teksty następnego dnia (ogony) trafiają do notatek właściwego dnia', () => {
  const tails = {};
  for (const [kind, data] of [['warmup', T.warmupData], ['cooldown', T.cooldownData]]) {
    const withText = Object.keys(T[kind]).filter(d => T[kind][d]);
    assert.deepEqual(Object.keys(data).sort(), withText.sort(), `${kind}: dni z tekstem`);
    for (const [d, p] of Object.entries(data)) {
      assert.deepEqual(p.items.map(i => i.n), p.items.map((_, i) => i + 1), `${kind}/${d}: numeracja`);
      assert.ok(p.items.every(i => i.name && !/^\d/.test(i.name)), `${kind}/${d}: nazwy ćwiczeń`);
      const o = norm(T[kind][d]), f = norm(flatPhase(p, kind === 'warmup'));
      assert.ok(o.startsWith(f), `${kind}/${d}: lista odtwarza początek oryginału`);
      if (kind === 'cooldown' && o.length > f.length) tails[d] = o.slice(f.length).trim();
    }
  }
  assert.deepEqual(Object.keys(tails).sort(), ['pon', 'pt', 'sr', 'wt']);
  const next = { pon: ['wt'], wt: ['sr'], sr: ['czw', 'pt'], pt: ['sob'] };
  for (const [d, keys] of Object.entries(next)) assert.equal(norm(keys.map(k => flatNote(k, T.dayNotes[k])).join(' ')), tails[d], `ogon schłodzenia ${d} = notatki ${keys}`);
  assert.deepEqual(Object.keys(T.dayNotes).sort(), ['czw', 'pt', 'sob', 'sr', 'wt']);
  // rozgrzewka poniedziałku: 4 ćwiczenia z nazwą angielską i dawką
  assert.deepEqual(T.warmupData.pon.items.map(i => i.n), [1, 2, 3, 4]);
  assert.ok(T.warmupData.pon.items.every(i => i.en && i.dose));
  assert.equal(T.cooldownData.sr.title, 'Rozciąganie');
  assert.equal(T.cooldownData.sr.minutes, 5);
});
