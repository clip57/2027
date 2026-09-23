// Moduł Suplementacja (Etap 3): SUPLEMENTACJA_2027 jest jedynym źródłem (D-001);
// okres ważności preparatów czasowych z D-015, cynk nieśledzony z D-016.
import { h, fmt, add } from '../ui/dom.js';
import { segmented, section, statGrid, stat } from '../ui/components.js';
import { scheduleFor, supplementOverview } from '../core/calc/supplements.js';
import { addDays, longDate, weekday } from '../core/dates.js';
import { stockAt, forecast } from '../core/calc/inventory.js';
import { catalogById } from '../core/data.js';

const DAYS = ['pn', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];

export function renderSuplementy(root, ctx) {
  const date = ctx.params.get('d') || ctx.today;
  const go = d => { location.hash = `#/suplementy?d=${d}`; };
  const week = [...Array(7)].map((_, i) => addDays(ctx.today, i))
    .map(d => ({ value: d, label: DAYS[weekday(d) - 1], hint: d === ctx.today ? 'dziś' : null }));
  const groups = scheduleFor(date);
  const overview = supplementOverview(date);

  add(root, h('h1', {}, 'Suplementacja'),
    h('div', { class: 'topline' }, h('span', { class: 'date' }, longDate(date)),
      h('span', { class: 'chip' }, `${groups.reduce((n, g) => n + g.doses.length, 0)} dawek w ${groups.length} porach`)),
    h('div', { class: 'controls' }, segmented('Dzień', week, date, go)));

  for (const g of groups) {
    add(root, h('article', { class: 'tl-item' },
      h('div', { class: 'tl-mark' }, h('time', {}, g.time)),
      h('div', { class: 'tl-card' },
        h('h3', { class: 'tl-title' }, g.situation),
        h('ul', { class: 'dose-list' }, g.doses.map(d => h('li', {},
          h('div', { class: 'dose-head' }, h('span', { class: 'sn' }, d.name), h('span', { class: 'dose-badge' }, d.label)),
          h('p', { class: 'dose-form' }, d.form),
          (d.note || (d.thursday && weekday(date) === 4)) && h('p', { class: 'dose-note' },
            [d.note, d.thursday && weekday(date) === 4 ? d.thursday.note : null].filter(Boolean).join(' · '))))))));
  }

  const inv = ctx.store?.state?.inv;
  add(root, h('div', { class: 'tl-end' }),
    section('h-prep', 'Preparaty',
    h('div', { class: 'scroll-x' }, h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Preparat'), h('th', {}, 'Kiedy'), h('th', { class: 'num' }, 'Dawka dzienna'), h('th', {}, 'Zapas'))),
      h('tbody', {}, overview.map(s => {
        const st = inv && s.tracked ? stockAt(inv, s.id, ctx.today) : null;
        const fc = st != null ? forecast(s.id, st, ctx.today) : null;
        return h('tr', { class: s.active ? null : 'is-off' },
          h('td', {}, h('strong', {}, s.name), h('span', { class: 'muted block' }, s.form)),
          h('td', {}, s.times.join(', '), !s.everyDay && h('span', { class: 'muted block' }, s.weekdays.map(w => DAYS[w - 1]).join(', ')),
            s.validity && h('span', { class: 'muted block' }, `do ${s.validity.until}`)),
          h('td', { class: 'num' }, s.daily ? `${fmt(s.daily, 2)} ${catalogById[s.id]?.unit || ''}` : '—'),
          h('td', {}, !s.tracked ? 'nieśledzony' : st == null ? 'brak stanu' :
            `${fmt(st, 1)} ${catalogById[s.id]?.unit || ''}${fc?.lastCovered ? ` · do ${fc.lastCovered}` : ''}`));
      }))))));
}
