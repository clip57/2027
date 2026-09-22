// Podgląd danych dnia (Etap 2): wynik resolvera bez docelowego projektu wizualnego (ten powstanie w Etapie 3).
import { h } from '../ui/dom.js';
import { resolveDay } from '../core/resolver.js';
import { addDays, longDate } from '../core/dates.js';
import { SRC } from '../core/data.js';

const DAYTYPE = { strength_sauna: 'Siła + sauna', strength: 'Siła', cardio_sauna: 'Cardio + sauna', rest_sauna2: 'Bez treningu, 2 × sauna', swim: 'Basen' };
const suppName = id => SRC.supplements.supplements[id]?.name || id;

export function renderDzis(root, ctx) {
  const date = ctx.params.get('d') || ctx.today;
  const r = resolveDay(date);
  const nav = (n, label) => h('a', { class: 'btn', href: `#/dzis?d=${addDays(date, n)}` }, label);
  root.append(
    h('h1', {}, date === ctx.today ? 'Dziś' : r.dayName[0].toUpperCase() + r.dayName.slice(1)),
    h('div', { class: 'topline' },
      h('span', { class: 'date' }, `${r.dayName}, ${longDate(date)}`),
      h('span', { class: 'chip' }, r.phase == null ? 'przed startem planu' : `Faza ${r.phase}`),
      h('span', { class: 'chip' }, DAYTYPE[r.dayType]),
      h('span', { class: 'chip' }, `${r.kcal} kcal (${r.dietVariant})`),
      r.cfa.isMock && h('span', { class: 'chip' }, 'Mock CFA')),
    h('div', { class: 'row', style: { marginBottom: '1rem' } }, nav(-1, 'Poprzedni dzień'), date !== ctx.today && h('a', { class: 'btn', href: '#/dzis' }, 'Dziś'), nav(1, 'Następny dzień')),
    h('div', { class: 'banner warn' }, 'Podgląd danych z resolvera. Docelowy widok dnia powstanie w Etapie 3.'),
    h('div', { class: 'panel' }, r.slots.map(s => h('div', { class: 'slot', 'data-domain': s.domain },
      h('time', {}, s.from),
      h('div', {},
        h('div', { class: 't' }, s.role === 'meal' ? `${s.mealName} · ${s.kcal} kcal` : s.title),
        s.desc && h('div', { class: 'd' }, s.desc),
        s.doses.length > 0 && h('div', { class: 'd' }, 'Suplementy: ' + s.doses.map(d => `${d.time} ${suppName(d.supp)} ${d.label}`).join(' · ')))))),
  );
}
