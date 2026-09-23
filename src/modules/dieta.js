// Moduł Dieta (Etap 3): jadłospis wg fazy i wariantu dnia, wartości 1:1 z PDF (D-007).
import { h, add } from '../ui/dom.js';
import { segmented, statGrid, stat, section, macroChips } from '../ui/components.js';
import { dietSummary, phaseDiff } from '../core/calc/diet.js';
import { resolveDay, phaseFor } from '../core/resolver.js';
import { longDate } from '../core/dates.js';

const PHASES = [{ value: 0, label: 'Faza 0', hint: 'od 21.09' }, { value: 1, label: 'Faza 1', hint: 'od 12.10' }, { value: 2, label: 'Faza 2', hint: 'od 16.11' }];
// Etykieta z PDF bywa samą liczbą (gramy) — dodajemy jednostkę, nie zmieniając wartości.
const qty = label => (/^[\d,]+$/.test(label.trim()) ? `${label.trim()} g` : label);
const VARIANTS = [{ value: 'T', label: 'Dzień treningowy', hint: 'pn–śr, pt–nd' }, { value: 'NT', label: 'Dzień nietreningowy', hint: 'czwartek' }];

export function renderDieta(root, ctx) {
  const dayNow = resolveDay(ctx.today);
  const phase = Number(ctx.params.get('f') ?? (phaseFor(ctx.today) ?? 0));
  const variant = ctx.params.get('w') || dayNow.dietVariant;
  const go = (f, w) => { location.hash = `#/dieta?f=${f}&w=${w}`; };
  const s = dietSummary(phase, variant);
  const isToday = phase === (phaseFor(ctx.today) ?? 0) && variant === dayNow.dietVariant;

  add(root, h('h1', {}, 'Dieta'),
    h('div', { class: 'topline' }, h('span', { class: 'date' }, s.header),
      isToday && h('span', { class: 'chip' }, `obowiązuje dziś · ${longDate(ctx.today)}`)),
    h('div', { class: 'controls' },
      segmented('Faza', PHASES, phase, v => go(v, variant)),
      segmented('Rodzaj dnia', VARIANTS, variant, v => go(phase, v))),
    h('div', { class: 'hero' },
      h('div', { class: 'hero-kcal' }, h('strong', {}, String(s.total.kcal)), h('span', {}, 'kcal')),
      h('div', { class: 'hero-macros' }, [
        ['p', 'Białko', s.total.p, s.pct.p], ['c', 'Węglowodany', s.total.c, s.pct.c], ['f', 'Tłuszcz', s.total.f, s.pct.f],
      ].map(([k, label, g, pct]) => h('div', { class: `hm hm--${k}` },
        h('span', { class: 'hm-l' }, label),
        h('span', { class: 'hm-v' }, `${g} g`),
        h('span', { class: 'hm-bar' }, h('span', { class: 'hm-fill', style: { width: `${pct}%` } })),
        h('span', { class: 'hm-p' }, `${pct} %`))))));

  for (const m of s.meals) {
    add(root, h('details', { class: 'meal', 'data-meal': m.id, open: m.id !== 'drinks' },
      h('summary', {},
        h('span', { class: 'meal-n' }, m.name),
        h('span', { class: 'meal-k' }, `${m.total.kcal} kcal`),
        h('span', { class: 'meal-m' }, `B ${m.total.p} · W ${m.total.c} · T ${m.total.f} g`)),
      h('ul', { class: 'food' }, m.items.map(i => h('li', {},
        h('span', { class: 'f-n' }, i.name), h('span', { class: 'f-q' }, qty(i.label)), macroChips(i))))));
  }

  const other = [0, 1, 2].filter(p => p !== phase);
  add(root, section('h-diff', 'Co zmienia się między fazami',
    h('div', { class: 'scroll-x' }, h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Pozycja'), other.map(p => h('th', {}, `Faza ${phase} → ${p}`)))),
      h('tbody', {}, (() => {
        const rows = new Map();
        for (const p of other) for (const d of phaseDiff(variant, phase, p)) {
          if (!rows.has(d.name)) rows.set(d.name, {});
          rows.get(d.name)[p] = `${d.from} → ${d.to} g`;
        }
        return rows.size === 0 ? [h('tr', {}, h('td', { colspan: String(other.length + 1) }, 'Brak różnic'))]
          : [...rows.entries()].map(([name, v]) => h('tr', {}, h('td', {}, name), other.map(p => h('td', {}, v[p] || '—'))));
      })())))),
    section('h-opt', 'Zamienniki (opcjonalnie)',
      h('ul', { class: 'food' }, s.optional.map(o => h('li', {},
        h('span', { class: 'f-n' }, o.name), h('span', { class: 'f-q' }, qty(o.label)), macroChips(o))))),
    section('h-spice', 'Przyprawy', h('p', { class: 'chips' }, s.spices.map(x => h('span', { class: 'chip' }, x)))));
}
