// Moduł MPW (D-095, plan v8 — D-096): plan nauki do egzaminu na Maklera Papierów Wartościowych (16.11.2026–20.03.2027, egzamin 21.03.2027 11:00)
// w tej samej formie co CFA — wspólny widok study.js, postęp `mpw.done`, error log `mpw.err.*`. Do końca planu CFA (11.11)
// moduł jest w „Więcej”; od 12.11 zajmuje miejsce CFA na pasku zakładek (registry.js).
import { h, fmt, add, plural } from '../ui/dom.js';
import { section } from '../ui/components.js';
import { SRC, mpwByDay, mpwBloki } from '../core/data.js';
import { longDate, shortDate, dayShort } from '../core/dates.js';
import { renderStudy, modeStats } from './study.js';
import { mpwSources, mpwFreeDays } from '../core/calc/mpw.js';

const D = { ...SRC.mpw.D, bloki: mpwBloki };   // godziny wg decyzji (D-097: czwartki od 07.01 +30 min)
// Tryby planu v8 (D-096) i wcześniejszych wersji (D-095) — nieznany tryb bez koloru (BUFOR)
const MODE_CLASS = { 'PRAWO – FIRST PASS': 'm-fp', 'LITERATURA – FIRST PASS': 'm-fp', 'PRAWO – 2. PRZEJŚCIE': 'm-co', 'AUDYT PRAWNY': 'm-co',
  'POWTÓRKA CAŁOŚCI': 'm-co',
  'POWTÓRKA SKUMULOWANA': 'm-co', 'ACTIVE RECALL': 'm-ar', SYMULACJA: 'm-mo', 'ANALIZA BŁĘDÓW': 'm-an', 'STRATEGIA +2/0/−1': 'm-an',
  'TEST TEMATYCZNY KNF': 'm-pr', 'DRILL OBLICZENIOWY': 'm-pr', 'TRENING EGZAMINACYJNY': 'm-pr', 'BAZA PYTAŃ WATS': 'm-pr' };
const simLabel = d => `symulacja KNF (test z ${D.simTest[d]})`;
const blocksOf = (done, list) => `${list.filter(b => done.has(b.nr)).length}/${list.length}`;

// Widok „Plan”: źródła pierwszego przejścia (postęp dokładny — wg źródła bloku), obszary KNF, symulacje, fazy, statystyki
function plan(root, { done, pace, late }) {
  const free = mpwFreeDays();
  const long = Object.keys(mpwByDay).filter(d => mpwByDay[d].some(b => b.blok.startsWith('P')));   // dni z powtórką całości P1–P7 (v8)
  add(root, section('h-sources', 'Źródła — pierwsze przejście',
    h('div', { class: 'topic-list' }, mpwSources().map(s => {
      const k = s.nrs.filter(n => done.has(n)).length;
      return h('div', { class: 'topic' },
        h('div', { class: 'topic-h' }, h('strong', {}, s.kategoria === 'Prawo MPW' ? 'Prawo' : 'Literatura'), h('span', {}, s.zrodlo)),
        h('span', { class: 'prog-bar' }, h('span', { class: 'prog-fill', style: { width: `${(k / s.nrs.length) * 100}%`, background: 'var(--cfa)' } })),
        h('p', { class: 'muted small' }, `${k}/${s.nrs.length} bloków · ${shortDate(s.start)}–${shortDate(s.end)}`));
    }))),
  section('h-knf', 'Obszary KNF — kolejność pierwszego przejścia',
    h('ol', { class: 'tech-list mw-areas' }, D.cfa.map(t => h('li', {},
      h('strong', {}, t.tytul), ` — ${t.waga} · ${t.bloki} ${plural(t.bloki, 'blok', 'bloki', 'bloków')} · ${shortDate(t.start)}–${shortDate(t.koniecd)}`)))),
  section('h-mocks', 'Symulacje egzaminu (180 min, 15:30–18:30)', h('ul', { class: 'tech-list' }, D.mockCFA.map((d, i) => h('li', {},
    h('a', { href: `#/mpw?v=dzien&d=${d}` }, `Symulacja ${i + 1}: ${dayShort(d)} ${shortDate(d)}`),
    ` — test KNF z ${D.simTest[d]} · ${blocksOf(done, mpwByDay[d] || [])} bloków`)))),
  section('h-phases', 'Fazy', h('dl', { class: 'kv' },
    Object.entries(D.faza).map(([k, f], i) => [h('dt', {}, `Faza ${i + 1}`),
      h('dd', {}, `${shortDate(f.od)}–${longDate(f.do)} · ${f.dni} dni · ${f.bl} bloków · wykonane ${blocksOf(done, D.bloki.filter(b => b.data >= f.od && b.data <= f.do))}${k === 'f1' ? ` · koniec pierwszego przejścia ${longDate(D.fpEnd)}` : ''}`)]))),
  section('h-stat', 'Statystyki planu', h('dl', { class: 'kv' },
    h('dt', {}, 'Bloki'), h('dd', {}, `${D.stat.bloki} (${D.stat.dni} dni: ${D.stat.uklad}; A 15:30, B 16:30, C 17:30${long.length ? `; ${long.map(shortDate).join(', ')} także P1–P7 8:00–15:23` : ''})`),
    h('dt', {}, 'Godziny netto'), h('dd', {}, `${fmt(D.stat.godziny, 2)} h`),
    h('dt', {}, 'Dni wolne'), h('dd', {}, free.map(r => (r[0] === r[1] ? shortDate(r[0]) : `${shortDate(r[0])}–${shortDate(r[1])}`)).join(', ') || 'brak'),
    h('dt', {}, 'Egzamin'), h('dd', {}, `${dayShort(SRC.mpw.exam)} ${longDate(SRC.mpw.exam)}, godz. ${SRC.mpw.examTime}`),
    h('dt', {}, 'Tempo (do wczoraj)'), h('dd', {}, `${pace.doneDue} z ${pace.due} zaplanowanych · zaległe ${late} · z wyprzedzeniem ${pace.ahead}`),
    Object.entries(D.stat.kat).map(([k, n]) => [h('dt', {}, k), h('dd', {}, `${n} ${plural(n, 'blok', 'bloki', 'bloków')} · wykonane ${D.bloki.filter(b => b.kategoria === k && done.has(b.nr)).length}`)]),
    modeStats(D, done))));
}

export const MPW_PLAN = {
  id: 'mpw', name: 'MPW', D, byDay: mpwByDay, exam: SRC.mpw.exam,
  eyebrow: `MPW (egzamin KNF) · ${longDate(SRC.mpw.exam)}, ${SRC.mpw.examTime}`,
  types: { done: 'mpw.done', errPut: 'mpw.err.put', errDel: 'mpw.err.del' }, fields: { done: 'mpwDone', errors: 'mpwErrors' },
  modeClass: MODE_CLASS, recall: null,
  mock: { word: 'Symulacja', day: simLabel },
  // Punkty zakresu KNF i priorytet bloku (z planu)
  meta: b => [b.knf && h('span', { class: 'muted' }, `KNF ${b.knf}`), b.priorytet && h('span', { class: `mw-prio mw-p-${b.priorytet.toLowerCase().replace(/[^a-z]+/g, '-')}` }, b.priorytet)],
  tasks: true, searchHint: 'temat, źródło, artykuły, punkt KNF, data',
  log: { placeholder: 'np. KSH — art. 301, próg 5%', csv: 'error-log-mpw.csv', importV3: false },
  plan,
};

export const renderMPW = (root, ctx) => renderStudy(root, ctx, MPW_PLAN);
