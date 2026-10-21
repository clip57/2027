// Arkusze treningu (System kolana, Sauna), listy rozgrzewki i schłodzenia oraz notatki dnia — rysowane z danych ustrukturyzowanych
// (`training.json` → `sheetsData`, `warmupData`, `cooldownData`, `dayNotes`; D-105, `tools/extract/training_sheets.py`). Tekst oryginalny pozostaje w `sheets`/`warmup`/`cooldown`.
import { h } from '../ui/dom.js';

const LEVEL = { green: ['🟢', 'lv-g'], yellow: ['🟡', 'lv-y'], red: ['🔴', 'lv-r'] };
// Kolor poziomu zawsze występuje razem z jego nazwą (Zielone / Żółte / Czerwone) — nie jest jedynym nośnikiem znaczenia.

// System kolana: kryteria jako karty z trzema poziomami, potem „Co robić”, alarm i wskazówka.
function kneeBody(s) {
  return [
    h('p', { class: 'ks-legend' }, s.levels.map(l => h('span', { class: `lv-tag ${LEVEL[l.id][1]}` }, `${LEVEL[l.id][0]} ${l.label}`))),
    h('h3', { class: 'sh-h' }, 'Jak oceniać'),
    h('div', { class: 'ks-crit-list' }, s.criteria.map(c => h('section', { class: 'ks-crit' },
      h('h4', {}, c.name),
      h('dl', { class: 'ks-rows' }, s.levels.map(l => h('div', { class: `ks-row ${LEVEL[l.id][1]}` }, h('dt', {}, `${LEVEL[l.id][0]} ${l.label}`), h('dd', {}, c[l.id]))))))),
    h('h3', { class: 'sh-h' }, 'Co robić'),
    h('ul', { class: 'ks-actions' }, s.actions.map(a => {
      const l = s.levels.find(x => x.id === a.level);
      return h('li', { class: `ks-row ${LEVEL[a.level][1]}` }, h('strong', {}, `${LEVEL[a.level][0]} ${l.label}`), h('span', {}, a.text));
    })),
    h('div', { class: 'ks-alert', role: 'note' }, h('strong', {}, `⚠️ ${s.alert.title}`), h('ul', {}, s.alert.items.map(x => h('li', {}, x)))),
    h('p', { class: 'ks-tip' }, h('strong', {}, 'Wskazówka: '), s.tip)];
}

// Sauna: zasady w czterech kartach, kroki przed / w saunie / po, dni treningowe, czwartek z dwiema rundami, notatki.
function saunaBody(s) {
  return [
    h('dl', { class: 'sa-sum' }, s.summary.map(x => h('div', { class: 'sa-card' }, h('dt', {}, x.label), h('dd', {}, h('strong', {}, x.value), h('span', { class: 'muted' }, x.note))))),
    s.phases.map(ph => h('section', { class: 'sa-phase' }, h('h3', { class: 'sh-h' }, ph.name),
      h('ol', { class: 'sa-steps' }, ph.steps.map(st => h('li', { class: st.alert ? 'is-alert' : '' }, h('strong', {}, st.alert ? `⚠️ ${st.label}` : st.label), h('span', {}, st.text)))))),
    h('section', { class: 'sa-phase' }, h('h3', { class: 'sh-h' }, s.trainingDays.label), h('ul', { class: 'sa-list' }, s.trainingDays.lines.map(x => h('li', {}, x)))),
    h('section', { class: 'sa-phase' }, h('h3', { class: 'sh-h' }, s.thursday.label),
      h('ol', { class: 'sa-timeline' }, s.thursday.steps.map(x => h('li', {}, x))), h('p', { class: 'sa-total' }, s.thursday.total)),
    h('ul', { class: 'sa-list sa-notes' }, s.notes.map(x => h('li', {}, x)))];
}

export const sheetBody = s => (s.kind === 'traffic' ? kneeBody(s) : saunaBody(s));

// Numerowana lista ćwiczeń rozgrzewki / schłodzenia: nazwa, dawka, nazwa angielska.
export const phaseList = p => h('ol', { class: 'ph-list' }, p.items.map(i => h('li', {},
  h('span', { class: 'ph-name' }, i.name), i.dose && h('span', { class: 'ph-dose' }, i.dose), i.en && h('span', { class: 'ph-en muted' }, i.en))));

export const phaseLabel = (kind, p) => (kind === 'warmup' ? '🔥 Rozgrzewka' : p.title === 'Rozciąganie' ? '🧘 Rozciąganie' : '❄️ Schłodzenie') + ` · ${p.minutes} min`;

// Notatka sesji z opisu dnia: wtorek i sobota (wskazówka do sesji), środa (struktura roweru). Czwartek ma własny panel, piątek ma tylko nagłówek.
export function dayNoteCard(n, key) {
  if (!n || !n.label) return null;
  if (key === 'sr') {
    return h('section', { class: 'dn', 'aria-label': n.label }, h('h3', {}, n.label), h('p', { class: 'muted' }, `${n.meta.split(' · ')[0]} · ${n.device}`),
      h('ol', { class: 'dn-phases' }, n.phases.map(p => h('li', {}, h('strong', {}, `${p.name} · ${p.minutes} min`), h('span', {}, p.text)))));
  }
  return n.note ? h('section', { class: 'dn', 'aria-label': n.label }, h('h3', {}, n.label), h('p', {}, n.note)) : null;
}
