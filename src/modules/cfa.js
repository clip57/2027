// Moduł CFA (Etap 5): harmonogram z planu CFA „MASTER SCHEDULE FINAL” (v9 — D-093; zastępuje v3 z D-006), trwały postęp
// (cfa.done) i error log (cfa.err.*), eksport i import CSV zgodny z v3. Widok wspólny z planem MPW (D-095) — study.js.
import { h, fmt, add } from '../ui/dom.js';
import { section } from '../ui/components.js';
import { SRC, cfaByDay } from '../core/data.js';
import { longDate, shortDate, dayShort } from '../core/dates.js';
import { recallDays, recallKey, recallDone, recallStats } from '../core/calc/recall.js';
import { renderStudy, modeStats } from './study.js';
import { CFA_PLAN_VERSION } from '../core/storage/validate.js';

const D = SRC.cfa.D;
const MODE_CLASS = { 'FIRST PASS': 'm-fp', CONSOLIDATION: 'm-co', MOCK: 'm-mo', 'ANALIZA BŁĘDÓW': 'm-an', PRACTICE: 'm-pr', 'ACTIVE RECALL': 'm-ar' };

// Widok „Plan”: działy (pierwsze przejście), mocki, statystyki
function plan(root, { done, pace, late, rs }) {
  const topicDone = t => D.bloki.filter(b => b.kategoria === 'CFA Curriculum' && b.zrodlo.includes(`(${t.kod})`)).map(b => b.nr);
  add(root, section('h-topics', 'Działy — pierwsze przejście',
    h('div', { class: 'topic-list' }, D.cfa.map(t => {
      const nrs = topicDone(t), k = nrs.filter(n => done.has(n)).length;
      return h('div', { class: 'topic' },
        h('div', { class: 'topic-h' }, h('strong', {}, `${t.kod}`), h('span', {}, t.tytul), h('span', { class: 'muted' }, t.waga)),
        h('span', { class: 'prog-bar' }, h('span', { class: 'prog-fill', style: { width: `${nrs.length ? (k / nrs.length) * 100 : 0}%`, background: 'var(--cfa)' } })),
        h('p', { class: 'muted small' }, `${k}/${nrs.length} bloków · ${t.strony} s. · ${shortDate(t.start)}–${shortDate(t.koniecd)}`));
    }))),
  section('h-mocks', 'Mocki', h('ul', { class: 'tech-list' }, D.mockCFA.map((d, i) => h('li', {},
    h('a', { href: `#/cfa?v=dzien&d=${d}` }, `Mock ${i + 1}: ${dayShort(d)} ${shortDate(d)}`),
    ` — ${(cfaByDay[d] || []).filter(b => done.has(b.nr)).length}/${(cfaByDay[d] || []).length} bloków`)))),
  section('h-stat', 'Statystyki planu', h('dl', { class: 'kv' },
    h('dt', {}, 'Bloki'), h('dd', {}, `${D.stat.bloki} (${D.stat.dni} dni: ${D.stat.uklad || `${D.stat.dni} × ${D.stat.bloki / D.stat.dni}`})`),
    h('dt', {}, 'Godziny netto'), h('dd', {}, `${fmt(D.stat.godziny, 2)} h + recall ${fmt(D.stat.recallH, 2)} h (${D.stat.recall} sesji)`),
    h('dt', {}, 'Tempo (do wczoraj)'), h('dd', {}, `${pace.doneDue} z ${pace.due} zaplanowanych · zaległe ${late} · z wyprzedzeniem ${pace.ahead}`),
    h('dt', {}, 'Recall 22:00'), h('dd', {}, `wykonane ${rs.done} z ${rs.total} sesji · do wczoraj ${rs.doneDue} z ${rs.due}`),
    modeStats(D, done))));
}

export const CFA_PLAN = {
  id: 'cfa', name: 'CFA', D, byDay: cfaByDay, exam: SRC.cfa.exam, eyebrow: `CFA Level I · egzamin ${longDate(SRC.cfa.exam)}`,
  types: { done: 'cfa.done', errPut: 'cfa.err.put', errDel: 'cfa.err.del' }, fields: { done: 'cfaDone', errors: 'cfaErrors' },
  doneExtra: { plan: CFA_PLAN_VERSION },   // D-098: odhaczenia znakowane wersją planu
  modeClass: MODE_CLASS,
  // Recall 22:00 (I11): odhaczenie jako ustawienie `cfa.recall:<data>` (istniejący typ `setting`)
  recall: { days: recallDays, key: recallKey, done: recallDone, stats: recallStats },
  mock: { word: 'Mock', day: () => 'dzień mocka' },
  log: { placeholder: 'np. FI — duration, LM 3', csv: 'error-log.csv', importV3: true },
  plan,
};

export const renderCFA = (root, ctx) => renderStudy(root, ctx, CFA_PLAN);
