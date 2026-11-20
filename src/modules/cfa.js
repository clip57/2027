// Moduł CFA (Etap 5): harmonogram planu CFA (D-116: plan CFA Level I 2027, 451 bloków, 20.11.2026–12.05.2027 — zastępuje V44 z D-103), trwały postęp
// (cfa.done) i error log (cfa.err.*), eksport i import CSV zgodny z v3. Widok wspólny z planem MPW (D-095) — study.js.
import { h, fmt, add } from '../ui/dom.js';
import { planTasks, loadPlanTasks } from '../core/plan-tasks.js';
import { section } from '../ui/components.js';
import { SRC, cfaByDay } from '../core/data.js';
import { longDate, shortDate, dayShort } from '../core/dates.js';
import { recallDays, recallKey, recallDone, recallStats } from '../core/calc/recall.js';
import { renderStudy, modeStats } from './study.js';
import { CFA_PLAN_VERSION } from '../core/storage/validate.js';

const D = SRC.cfa.D;
// D-103: plan V44 ma tryby CZYTANIE (jak FIRST PASS) i DOPRECYZOWANIE (jak CONSOLIDATION); D-116: plan 2027 — LEKTURA, PIERWSZE PODEJŚCIE (bank pytań),
// POWTÓRKA, SYMULACJA (mock), ANALIZA (korekta mocka)
const MODE_CLASS = { 'FIRST PASS': 'm-fp', CZYTANIE: 'm-fp', LEKTURA: 'm-fp', CONSOLIDATION: 'm-co', DOPRECYZOWANIE: 'm-co', 'POWTÓRKA': 'm-co', MOCK: 'm-mo', SYMULACJA: 'm-mo',
  'ANALIZA BŁĘDÓW': 'm-an', ANALIZA: 'm-an', PRACTICE: 'm-pr', 'PIERWSZE PODEJŚCIE': 'm-pr', 'ACTIVE RECALL': 'm-ar' };
const FIRST_PASS = new Set(['CZYTANIE', 'LEKTURA']);   // pierwsze przejście działu (pole `topic`)
const HAS_RECALL = (D.nightRecall?.length ?? 1) > 0;   // D-116: plan 2027 bez sesji recall 22:00
const EXAM_TXT = SRC.cfa.exam ? longDate(SRC.cfa.exam) : (SRC.cfa.examNote || 'termin do uzupełnienia');

// Widok „Plan”: działy (pierwsze przejście), mocki, statystyki
// D-103: w planie V44 pierwsze przejście to bloki CZYTANIE (SchweserNotes i Curriculum) przypisane do działu polem `topic`; starsze plany: Curriculum z kodem działu w źródle
function plan(root, { done, pace, late, rs }) {
  const topicDone = t => D.bloki.filter(b => (b.topic !== undefined ? FIRST_PASS.has(b.tryb) && b.topic === t.kod
    : b.kategoria === 'CFA Curriculum' && b.zrodlo.includes(`(${t.kod})`))).map(b => b.nr);
  add(root, section('h-topics', 'Działy — pierwsze przejście',
    h('div', { class: 'topic-list' }, D.cfa.map(t => {
      const nrs = topicDone(t), k = nrs.filter(n => done.has(n)).length;
      return h('div', { class: 'topic' },
        h('div', { class: 'topic-h' }, h('strong', {}, `${t.kod}`), h('span', {}, t.tytul), t.waga && h('span', { class: 'muted' }, t.waga)),
        h('span', { class: 'prog-bar' }, h('span', { class: 'prog-fill', style: { width: `${nrs.length ? (k / nrs.length) * 100 : 0}%`, background: 'var(--cfa)' } })),
        h('p', { class: 'muted small' }, `${k}/${nrs.length} bloków · ${t.strony} s. · ${shortDate(t.start)}–${shortDate(t.koniecd)}`));
    }))),
  section('h-mocks', 'Mocki', h('ul', { class: 'tech-list' }, D.mockCFA.map((d, i) => h('li', {},
    h('a', { href: `#/cfa?v=dzien&d=${d}` }, `Mock ${i + 1}: ${dayShort(d)} ${shortDate(d)}`),
    ` — ${(cfaByDay[d] || []).filter(b => done.has(b.nr)).length}/${(cfaByDay[d] || []).length} bloków`)))),
  section('h-stat', 'Statystyki planu', h('dl', { class: 'kv' },
    h('dt', {}, 'Bloki'), h('dd', {}, `${D.stat.bloki} (${D.stat.dni} dni: ${D.stat.uklad || `${D.stat.dni} × ${D.stat.bloki / D.stat.dni}`})`),
    h('dt', {}, 'Godziny netto'), h('dd', {}, !D.stat.recall ? `${fmt(D.stat.godziny, 2)} h` : /** @type {any} */ (D.stat).recallH != null ? `${fmt(D.stat.godziny, 2)} h + recall ${fmt(/** @type {any} */ (D.stat).recallH, 2)} h (${D.stat.recall} sesji)`
      : `${fmt(D.stat.godziny)} h łącznie z recall (${D.stat.recall} sesji: ${D.stat.recallEvening} wieczornych + ${D.stat.recallFinal} końcowych) — D-101`),
    h('dt', {}, 'Tempo (do wczoraj)'), h('dd', {}, `${pace.doneDue} z ${pace.due} zaplanowanych · zaległe ${late} · z wyprzedzeniem ${pace.ahead}`),
    rs && [h('dt', {}, 'Recall 22:00'), h('dd', {}, `wykonane ${rs.done} z ${rs.total} sesji · do wczoraj ${rs.doneDue} z ${rs.due}`)],
    h('dt', {}, 'Egzamin'), h('dd', {}, EXAM_TXT),
    modeStats(D, done))));
}

export const CFA_PLAN = {
  id: 'cfa', name: 'CFA', D, byDay: cfaByDay, exam: SRC.cfa.exam, eyebrow: `CFA Level I · egzamin ${EXAM_TXT}`,
  types: { done: 'cfa.done', errPut: 'cfa.err.put', errDel: 'cfa.err.del' }, fields: { done: 'cfaDone', errors: 'cfaErrors' },
  doneExtra: { plan: CFA_PLAN_VERSION },   // D-098: odhaczenia znakowane wersją planu
  modeClass: MODE_CLASS,
  // Recall 22:00 (I11): odhaczenie jako ustawienie `cfa.recall:<data>` (istniejący typ `setting`)
  recall: HAS_RECALL ? { days: recallDays, key: recallKey, done: recallDone, stats: recallStats } : null,
  mock: { word: 'Mock', day: () => 'dzień mocka' },
  log: { placeholder: 'np. FI — duration, LM 3', csv: 'error-log.csv', importV3: true },
  // D-116: punkty KNF / priorytet (bloki lektury) i zadania bloków (wczytywane osobno jak w MPW — U6)
  meta: b => [b.knf && h('span', { class: 'muted' }, `LOS ${b.knf}`), b.priorytet && h('span', { class: `mw-prio mw-p-${b.priorytet.toLowerCase().replace(/[^a-z]+/g, '-')}` }, b.priorytet)],
  tasks: true, taskOf: b => planTasks('cfa')?.[b.nr] || null, tasksReady: () => !!planTasks('cfa'),
  plan,
};

/** @param {HTMLElement} root @param {import('../core/types').Ctx} ctx */
export async function renderCFA(root, ctx) {
  if (!planTasks('cfa')) await loadPlanTasks('cfa').catch(e => console.warn('Zadania bloków CFA:', e?.message || e));
  return renderStudy(root, ctx, CFA_PLAN);
}
