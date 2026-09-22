// Widok „Dziś” (Etap 2+): wynik resolvera czytelnie podzielony na sloty i podpunkty.
// Suplementy pochodzą wyłącznie z SUPLEMENTACJI (D-001) — tekst źródłowy PLAN_DNIA ich nie powtarza.
import { h } from '../ui/dom.js';
import { resolveDay, cfaSourceLine } from '../core/resolver.js';
import { addDays, longDate } from '../core/dates.js';
import { SRC } from '../core/data.js';

const suppName = id => SRC.supplements.supplements[id]?.name || id;

function cfaBlock(b, slot) {
  return h('div', { class: 'cfa-block' },
    h('p', { class: 'cfa-src' }, cfaSourceLine(b)),
    h('p', { class: 'cfa-topic' }, b.temat),
    h('p', { class: 'cfa-meta' }, h('span', { class: 'chip' }, b.tryb), b.godz !== `${slot.from}–${slot.to}` && h('span', { class: 'muted' }, b.godz)));
}

function slotView(s) {
  // Gdy posiłek jest jednocześnie tytułem slotu (Śniadanie 09:00), kcal trafia do tytułu, a podpunkt się nie powtarza.
  const lead = s.items.find(i => i.kind === 'meal' && i.text === s.title) || null;
  const title = s.title, titleKcal = lead?.kcal ?? null;
  const items = s.items.filter(i => i !== lead);
  return h('article', { class: 'slot', 'data-domain': s.domain, 'aria-labelledby': `t-${s.id}` },
    h('div', { class: 'slot-time' }, h('time', {}, s.from), h('span', { class: 'to' }, `–${s.to}`)),
    h('div', { class: 'slot-body' },
      h('h3', { class: 'slot-title', id: `t-${s.id}` }, title, titleKcal != null && h('span', { class: 'kcal' }, `${titleKcal} kcal`)),
      s.desc && h('p', { class: 'slot-note' }, s.desc),
      (s.cfa || []).map(b => cfaBlock(b, s)),
      items.length > 0 && h('ul', { class: 'slot-items' }, items.map(i => h('li', { class: i.kind === 'meal' ? 'is-meal' : null },
        i.text, i.kind === 'meal' && i.kcal != null && h('span', { class: 'kcal' }, `${i.kcal} kcal`)))),
      s.doses.length > 0 && h('div', { class: 'slot-supps' },
        h('p', { class: 'supps-h' }, 'Suplementy'),
        h('ul', {}, s.doses.map(d => h('li', {}, h('time', {}, d.time), h('span', { class: 'sn' }, suppName(d.supp)), h('span', { class: 'sd' }, d.label),
          d.note && h('span', { class: 'muted' }, ` · ${d.note}`)))))));
}

export function renderDzis(root, ctx) {
  const date = ctx.params.get('d') || ctx.today;
  const r = resolveDay(date);
  const nav = (n, label) => h('a', { class: 'btn', href: `#/dzis?d=${addDays(date, n)}` }, label);
  root.append(
    h('h1', {}, date === ctx.today ? 'Dziś' : r.dayName[0].toUpperCase() + r.dayName.slice(1)),
    h('div', { class: 'topline' },
      h('span', { class: 'date' }, `${r.dayName}, ${longDate(date)}`),
      h('span', { class: 'chip' }, r.phase == null ? 'przed startem planu' : `Faza ${r.phase}`),
      h('span', { class: 'chip' }, r.sessionLabel),
      h('span', { class: 'chip' }, `${r.kcal} kcal (${r.dietVariant})`),
      r.cfa.isMock && h('span', { class: 'chip' }, 'Mock CFA')),
    h('div', { class: 'row daynav' }, nav(-1, 'Poprzedni dzień'), date !== ctx.today && h('a', { class: 'btn', href: '#/dzis' }, 'Dziś'), nav(1, 'Następny dzień')),
    h('div', { class: 'banner warn' }, 'Podgląd danych z resolvera. Docelowy widok dnia powstanie w Etapie 3.'),
    h('div', { class: 'day' }, r.slots.map(slotView)),
  );
}
