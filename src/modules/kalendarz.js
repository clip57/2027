// Moduł „Kalendarz” (D-097, D-101): miesiące planu (zakres z `phases.json`, obecnie 18.10.2026 – 28.03.2027) z podsumowaniem każdego dnia z resolvera
// (trening, nauka CFA / MPW, weekendowe bloki, zakupy, święta, egzaminy). Kliknięcie dnia otwiera plan dnia w „Dziś”.
// Tylko odczyt — bez nowych danych; na telefonie znaczniki kropkami, na komputerze krótkie opisy.
import { h, add, plural } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { resolveDay, PLAN_START, PLAN_END, PLAN_REAL_START } from '../core/resolver.js';
import { SRC } from '../core/data.js';
import { addDays, weekday, parse, longDate } from '../core/dates.js';

const MONTH = ym => parse(`${ym}-01`).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
const nextMonth = (ym, n) => { const d = parse(`${ym}-01`); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const FIRST = PLAN_START.slice(0, 7), LAST = PLAN_END.slice(0, 7);
const TRAIN_SHORT = n => n.replace('Bez treningu, 2 × sauna', '2 × sauna').replace('Rower + ABS', 'Rower + ABS');

// Opis dnia do komórki: znaczniki (rodzaj, krótki tekst) w kolejności ważności
export function dayMarks(date) {
  const r = resolveDay(date), out = [];
  if (r.zero) return { r, marks: [['zero', 'Dzień zero']] };
  if (r.outside) return { r, marks: [] };
  if (date === SRC.cfa.exam) out.push(['exam', 'Egzamin CFA']);
  if (r.blocks) out.push([r.blocks.kind === 'wolne' ? 'holiday' : r.blocks.kind === 'egzamin' ? 'exam' : 'block', r.blocks.kind === 'wolne' ? r.blocks.short : r.blocks.title === 'Egzamin MPW' ? 'Egzamin MPW' : r.blocks.short.replace(' 8:00–15:23', '')]);
  if (r.preStart) out.push(['pre', 'Przed startem planu']);   // D-100: dni planu przed realnym początkiem (`phases.realStart`; od D-103c brak takich dni)
  if (r.noDiet) out.push(['nodiet', 'Bez diety']);
  if (r.cfa.blocks.length) out.push(['cfa', r.cfa.isMock ? 'Mock CFA' : `CFA ${r.cfa.blocks.length}`]);
  if (r.mpw.blocks.length) out.push(['mpw', r.mpw.isSim ? 'Symulacja MPW' : `MPW ${r.mpw.blocks.length}`]);
  if (r.dayType !== 'free') out.push(['train', TRAIN_SHORT(r.sessionName)]);
  const shop = r.slots.find(s => s.shop);
  if (shop) out.push(['shop', `Zakupy ${shop.from}`]);
  return { r, marks: out };
}

const LEGEND = [['train', 'Trening / sauna / basen'], ['cfa', 'Nauka CFA'], ['mpw', 'Nauka MPW'], ['block', 'Weekend 8:00–15:23'],
  ['shop', 'Zakupy'], ['holiday', 'Święta — wolne'], ['exam', 'Egzamin'], ['pre', 'Przed startem planu'], ['nodiet', 'Bez diety']];

export function renderKalendarz(root, ctx) {
  const today = ctx.today;
  const clamp = ym => (ym < FIRST ? FIRST : ym > LAST ? LAST : ym);
  const ym = clamp(/^\d{4}-\d{2}$/.test(ctx.params.get('m') || '') ? ctx.params.get('m') : today.slice(0, 7));
  const first = `${ym}-01`, days = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
  const inPlanDays = [...Array(days)].map((_, i) => addDays(first, i)).filter(d => d >= PLAN_START && d <= PLAN_END).length;
  const link = m => `#/kalendarz?m=${m}`;
  // F-K1 (D-113): wybrany dzień (d) — podgląd pod siatką; domyślnie dziś, gdy jest w wyświetlanym miesiącu
  const dRaw = ctx.params.get('d'), sel = /^\d{4}-\d{2}-\d{2}$/.test(dRaw || '') && dRaw.startsWith(ym) ? dRaw : today.startsWith(ym) ? today : null;

  add(root,
    h('header', { class: 'dz-head kl-head' },
      h('div', {}, h('h1', {}, 'Kalendarz'),
        h('div', { class: 'topline' }, h('span', { class: 'date' }, `Plan ${longDate(PLAN_REAL_START)} – ${longDate(PLAN_END)}`),
          h('span', { class: 'chip' }, `${inPlanDays} ${plural(inPlanDays, 'dzień', 'dni', 'dni')} planu w miesiącu`))),
      h('div', { class: 'row daynav' },
        ym > FIRST && h('a', { class: 'btn dz-nav', href: link(nextMonth(ym, -1)), 'aria-label': 'Poprzedni miesiąc' }, icon('chevron-left', { size: 18 }), h('span', {}, 'Poprzedni')),
        ym !== clamp(today.slice(0, 7)) && h('a', { class: 'btn dz-nav', href: link(clamp(today.slice(0, 7))) }, 'Ten miesiąc'),
        ym < LAST && h('a', { class: 'btn dz-nav', href: link(nextMonth(ym, 1)), 'aria-label': 'Następny miesiąc' }, h('span', {}, 'Następny'), icon('chevron-right', { size: 18 })))));

  const cells = [...Array(weekday(first) - 1)].map(() => h('li', { class: 'kl-e', 'aria-hidden': 'true' }));
  for (let i = 0; i < days; i++) {
    const d = addDays(first, i), { r, marks } = dayMarks(d);
    const label = `${r.dayName}, ${longDate(d)}${d === today ? ' (dziś)' : ''}: ${r.outside && !r.zero ? 'poza planem' : marks.map(m => m[1]).join(', ') || 'bez zajęć'}`;
    cells.push(h('li', {}, h('a', {
      class: `kl-day${d === sel ? ' is-sel' : ''}${d === today ? ' is-today' : ''}${r.outside && !r.zero ? ' is-out' : ''}${marks.some(m => m[0] === 'holiday') ? ' is-holiday' : ''}${marks.some(m => m[0] === 'exam') ? ' is-exam' : ''}${r.zero ? ' is-zero' : ''}`,
      href: `#/kalendarz?m=${ym}&d=${d}`, 'aria-label': label, 'aria-current': d === sel ? 'date' : null },
      h('span', { class: 'kl-n' }, String(i + 1)),
      marks.length > 0 && h('span', { class: 'kl-dots', 'aria-hidden': 'true' }, marks.slice(0, 5).map(([k]) => h('span', { class: `kl-dot k-${k}` }))),
      marks.length > 0 && h('span', { class: 'kl-lines', 'aria-hidden': 'true' }, marks.slice(0, 4).map(([k, t]) => h('span', { class: `kl-l k-${k}` }, t))))));
  }
  add(root,
    h('section', { class: 'panel kl-month', 'aria-labelledby': 'kl-m-h' },
      h('h2', { id: 'kl-m-h' }, MONTH(ym)),
      h('ol', { class: 'kl-grid kl-wd', 'aria-hidden': 'true' }, ['pn', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'].map(x => h('li', {}, x))),
      h('ol', { class: 'kl-grid', 'aria-label': `Dni: ${MONTH(ym)}` }, cells)),
    sel && preview(sel, today),
    h('ul', { class: 'kl-legend', 'aria-label': 'Legenda' }, LEGEND.map(([k, t]) => h('li', {}, h('span', { class: `kl-dot k-${k}`, 'aria-hidden': 'true' }), t))),
    h('p', { class: 'muted kl-hint' }, 'Wybierz dzień, aby zobaczyć podgląd; „Otwórz w Dziś” pokazuje pełny plan dnia.'));
}

// Podgląd dnia (F-K1): znaczniki, trening, dieta, nauka i punkty planu — z resolvera, bez zapisu
function preview(d, today) {
  const { r, marks } = dayMarks(d);
  const slots = r.outside ? [] : r.slots.filter(x => !x.own);
  return h('section', { class: 'panel kl-preview', 'aria-labelledby': 'kl-p-h', 'aria-live': 'polite' },
    h('div', { class: 'kl-p-head' },
      h('div', {}, h('h2', { id: 'kl-p-h' }, `${r.dayName[0].toUpperCase()}${r.dayName.slice(1)}, ${longDate(d)}`),
        h('p', { class: 'muted' }, r.outside && !r.zero ? 'Poza planem' : d === today ? 'Dziś' : marks.map(m => m[1]).join(' · ') || 'Bez zajęć')),
      h('a', { class: 'btn primary kl-open', href: `#/dzis?d=${d}` }, h('span', {}, 'Otwórz w Dziś'), icon('arrow-right', { size: 18 }))),
    !r.outside && h('ul', { class: 'kl-p-facts' },
      h('li', {}, icon('dumbbell', { size: 16 }), r.sessionLabel),
      h('li', {}, icon('utensils', { size: 16 }), r.noDiet ? 'bez diety' : `${r.kcal} kcal (${r.dietVariant})`),
      r.cfa.blocks.length > 0 && h('li', {}, icon('graduation-cap', { size: 16 }), `CFA: ${r.cfa.blocks.length} ${plural(r.cfa.blocks.length, 'blok', 'bloki', 'bloków')}`),
      r.mpw.blocks.length > 0 && h('li', {}, icon('landmark', { size: 16 }), `MPW: ${r.mpw.blocks.length} ${plural(r.mpw.blocks.length, 'blok', 'bloki', 'bloków')}`)),
    slots.length > 0 && h('ol', { class: 'kl-p-slots' }, slots.slice(0, 10).map(x => h('li', {}, h('time', {}, x.from), h('span', {}, x.title)))),
    slots.length > 10 && h('p', { class: 'muted small' }, `i ${slots.length - 10} innych punktów planu`));
}
