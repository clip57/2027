// Moduł Suplementacja (Etap 3, Faza 5): SUPLEMENTACJA_2027 jest jedynym źródłem (D-001);
// okres ważności preparatów czasowych z D-015, cynk nieśledzony z D-016.
// Faza 5 (D-075): minione / następna pora dnia, zapas suplementów z modułu Zapasy (pasek, „Kupione”).
import { h, fmt, add, clear } from '../ui/dom.js';
import { segmented } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { scheduleFor, supplementOverview } from '../core/calc/supplements.js';
import { addDays, longDate, weekday, dayShort, shortDate } from '../core/dates.js';
import { stockAt, forecast, statusInfo, runway, nextShopping } from '../core/calc/inventory.js';
import { catalogById } from '../core/data.js';
import { dayPlan, inPlan, PLAN_START } from '../core/resolver.js';

const DAYS = ['pn', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];

export function renderSuplementy(root, ctx) {
  const date = ctx.params.get('d') || ctx.today;
  // Dieta NT (czwartek i wyjątki dat — D-087): uwaga o kreatynie bez banana
  const nt = dayPlan(date).diet === 'NT';
  const ntNote = n => (weekday(date) === 4 ? n : n.replace('w czwartek', 'dziś'));
  const go = d => { location.hash = `#/suplementy?d=${d}`; };
  const week = [...Array(7)].map((_, i) => addDays(ctx.today, i))
    .map(d => ({ value: d, label: DAYS[weekday(d) - 1], hint: d === ctx.today ? 'dziś' : shortDate(d) }));
  const groups = scheduleFor(date);
  const overview = supplementOverview(date);
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isToday = date === ctx.today;
  const nextTime = isToday ? groups.find(g => g.time >= hhmm)?.time : null;
  const msg = h('div', { role: 'status', 'aria-live': 'polite' });

  // Zapas preparatów (ten sam dziennik co moduł Zapasy): stan, prognoza, status v31 (suplementy: < 10 / < 20 dni)
  const store = ctx.store, inv = store?.state?.inv;
  const shop = nextShopping(ctx.today, now.getHours(), store?.state?.settings?.shopWeekday ?? 6);
  const stockOf = s => {
    if (!inv || !s.tracked || !catalogById[s.id]) return null;
    const st = stockAt(inv, s.id, ctx.today);
    if (st == null) return { st: null };
    const fc = forecast(s.id, st, ctx.today);
    return { st, fc, info: statusInfo(catalogById[s.id], st, fc), rw: runway(catalogById[s.id], fc, shop.inDays) };
  };
  const stocks = Object.fromEntries(overview.map(s => [s.id, stockOf(s)]));
  const low = overview.filter(s => s.active && ['CRITICAL', 'WARNING'].includes(stocks[s.id]?.info?.code))
    .sort((a, b) => (stocks[a.id].fc?.days ?? 0) - (stocks[b.id].fc?.days ?? 0));
  const buy = async s => {
    const it = catalogById[s.id];
    try { await store.record('inv.move', { prod: s.id, qty: it.packSize || 1, date: ctx.today, kind: 'purchase' });
      ctx.flash(`${s.name}: +${fmt(it.packSize || 1)} ${it.unit} (kupione)`, 'info'); ctx.rerender(); }
    catch (e) { clear(msg).append(h('div', { class: 'banner err' }, e.message)); }
  };

  add(root, h('header', { class: 'sp-head' }, h('h1', {}, 'Suplementacja'),
    h('div', { class: 'topline' }, h('span', { class: 'date' }, longDate(date)),
      h('span', { class: 'chip' }, `${groups.reduce((n, g) => n + g.doses.length, 0)} dawek w ${groups.length} porach`),
      nextTime && h('span', { class: 'chip sp-now' }, icon('clock', { size: 14 }), `następna pora: ${nextTime}`),
      low.length > 0 && h('a', { class: 'chip sp-low-link', href: '#sp-stock-h' }, icon('package', { size: 14 }), `do uzupełnienia: ${low.length}`))),
    msg,
    h('div', { class: 'controls sp-days' }, segmented('Dzień', week, date, go)));

  // Oś dnia: dla dzisiejszego dnia pory minione przygaszone, następna wyróżniona (godzina z SUPLEMENTACJI)
  if (!inPlan(date)) add(root, h('p', { class: 'panel sp-outside' }, `Poza planem — suplementacja zaczyna się ${longDate(PLAN_START)}.`));
  for (const g of groups) {
    const past = isToday && g.time < hhmm, next = g.time === nextTime;
    add(root, h('article', { class: `tl-item${past ? ' is-past' : ''}${next ? ' is-next' : ''}` },
      h('div', { class: 'tl-mark' }, h('time', {}, g.time)),
      h('div', { class: 'tl-card' },
        h('h3', { class: 'tl-title' }, g.situation, next && h('span', { class: 'now-tag' }, 'następna'), past && h('span', { class: 'sr-only' }, ' (minęła)')),
        h('ul', { class: 'dose-list' }, g.doses.map(d => h('li', {},
          h('div', { class: 'dose-head' }, h('span', { class: 'sn' }, d.name), h('span', { class: 'dose-badge' }, d.label)),
          h('p', { class: 'dose-form' }, d.form),
          (d.note || (d.thursday && nt)) && h('p', { class: 'dose-note' },
            [d.note, d.thursday && nt ? ntNote(d.thursday.note) : null].filter(Boolean).join(' · '))))))));
  }

  // Karta zapasu suplementów — tylko pozycje z pilnym / średnim stanem, zakup jednym dotknięciem (inv.move purchase)
  if (inv) add(root, h('div', { class: 'tl-end' }), h('section', { class: `sp-stock${low.length ? ' has-low' : ''}`, 'aria-labelledby': 'sp-stock-h' },
    h('h2', { id: 'sp-stock-h' }, icon('package', { size: 18 }), 'Zapas suplementów'),
    low.length === 0
      ? h('p', { class: 'muted' }, Object.values(stocks).some(x => x?.st != null) ? 'Każdy aktywny suplement ma zapas na co najmniej 20 dni.' : 'Brak stanów — ustaw je w module Zapasy.')
      : h('ul', { class: 'sp-low' }, low.map(s => {
        const x = stocks[s.id], it = catalogById[s.id];
        return h('li', {},
          h('span', { class: `dot-s s-${x.info.code}`, 'aria-hidden': 'true' }),
          h('span', { class: 'sp-low-n' }, s.name, h('span', { class: 'muted' }, x.st <= 0 ? 'brak' : `${fmt(x.st, 1)} ${it.unit} · do ${x.fc?.lastCovered ? `${dayShort(x.fc.lastCovered)} ${shortDate(x.fc.lastCovered)}` : 'dziś'}`)),
          h('button', { class: 'zp-buy-b', 'aria-label': `Kupione: ${s.name}, +${fmt(it.packSize || 1)} ${it.unit}`, onclick: () => buy(s) },
            icon('check', { size: 16 }), h('span', {}, `+${fmt(it.packSize || 1)} ${it.unit}`)));
      })),
    h('a', { class: 'btn', href: '#/zapasy?c=Suplementy' }, icon('package', { size: 18 }), 'Suplementy w Zapasach')));

  else add(root, h('div', { class: 'tl-end' }));
  add(root,
    h('section', { class: 'panel', 'aria-labelledby': 'h-prep' }, h('h2', { id: 'h-prep' }, 'Preparaty'),
      h('div', { class: 'scroll-x' }, h('table', { class: 'data sp-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Preparat'), h('th', {}, 'Kiedy'), h('th', { class: 'num' }, 'Dawka dzienna'), h('th', {}, 'Zapas'))),
        h('tbody', {}, overview.map(s => {
          const x = stocks[s.id];
          return h('tr', { class: s.active ? null : 'is-off' },
            h('td', {}, h('strong', {}, s.name), h('span', { class: 'muted block' }, s.form)),
            h('td', {}, s.times.join(', '), !s.everyDay && h('span', { class: 'muted block' }, s.weekdays.map(w => DAYS[w - 1]).join(', ')),
              s.validity && h('span', { class: 'muted block' }, `${s.validity.from ? `od ${s.validity.from} ` : ''}do ${s.validity.until}`)),
            h('td', { class: 'num' }, s.daily ? `${fmt(s.daily, 2)} ${catalogById[s.id]?.unit || ''}` : '—'),
            h('td', {}, !s.tracked ? 'nieśledzony' : x?.st == null ? 'brak stanu' :
              [`${fmt(x.st, 1)} ${catalogById[s.id]?.unit || ''}${x.fc?.lastCovered ? ` · do ${x.fc.lastCovered}` : ''}`,
                x.rw && h('span', { class: `zp-run st-${x.info.code}`, role: 'img', 'aria-label': `Zapas na ${fmt(x.rw.days, 1)} dnia` },
                  h('span', { class: 'zp-run-f', style: { width: `${x.rw.pct}%` } }))]));
        }))))));
}
