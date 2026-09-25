// Moduł Dieta (Etap 3, Faza 5): jadłospis wg fazy i wariantu dnia, wartości 1:1 z PDF (D-007).
// Faza 5 (D-071): następny posiłek z godzin planu dnia, nawigacja po posiłkach, stan składników z modułu Zapasy.
import { h, add, fmt } from '../ui/dom.js';
import { segmented } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { dietSummary, phaseDiff, mealTimes, nextMeal } from '../core/calc/diet.js';
import { stockAt, forecast, statusInfo } from '../core/calc/inventory.js';
import { resolveDay, phaseFor } from '../core/resolver.js';
import { catalogById } from '../core/data.js';
import { longDate, shortDate, dayShort } from '../core/dates.js';

const PHASES = [{ value: 0, label: 'Faza 0', hint: 'od 25.09' }, { value: 1, label: 'Faza 1', hint: 'od 12.10' }, { value: 2, label: 'Faza 2', hint: 'od 16.11' }];
// Etykieta z PDF bywa samą liczbą (gramy) — dodajemy jednostkę, nie zmieniając wartości.
const qty = label => (/^[\d,]+$/.test(label.trim()) ? `${label.trim()} g` : label);
const VARIANTS = [{ value: 'T', label: 'Dzień treningowy', hint: 'pn–śr, pt–nd' }, { value: 'NT', label: 'Dzień nietreningowy', hint: 'czwartek' }];

// Makroskładniki jako jedna zwarta linia (zamiast czterech plakietek na każdą pozycję).
const macroLine = (m, unit = 'g') => h('span', { class: 'dt-mac' },
  h('span', { class: 'dt-k' }, `${fmt(m.kcal, 1)} kcal`),
  h('span', { class: 'm-p' }, `B ${fmt(m.p, 1)}`), h('span', { class: 'm-c' }, `W ${fmt(m.c, 1)}`), h('span', { class: 'm-f' }, `T ${fmt(m.f, 1)}${unit}`));

// Udział makroskładników w kcal posiłku (4/4/9) — pasek wyłącznie z danych planu.
function macroBar(t) {
  const k = [t.p * 4, t.c * 4, t.f * 9], sum = k.reduce((a, b) => a + b, 0) || 1;
  return h('span', { class: 'dt-bar', role: 'presentation' },
    ['p-col', 'c-col', 'f-col'].map((c, i) => h('span', { style: { width: `${(k[i] / sum) * 100}%`, background: `var(--${c})` } })));
}

export function renderDieta(root, ctx) {
  const dayNow = resolveDay(ctx.today);
  const phase = Number(ctx.params.get('f') ?? (phaseFor(ctx.today) ?? 0));
  const variant = ctx.params.get('w') || dayNow.dietVariant;
  const go = (f, w) => { location.hash = `#/dieta?f=${f}&w=${w}`; };
  const s = dietSummary(phase, variant);
  const isToday = phase === (phaseFor(ctx.today) ?? 0) && variant === dayNow.dietVariant;
  const times = mealTimes(dayNow.slots);
  const d = new Date();
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const next = isToday ? nextMeal(s.meals, times, hhmm) : null;
  // Posiłki w kolejności godzin z planu dnia (jak przebiega dzień); bez godziny (napoje) — na końcu. Wartości bez zmian.
  const meals = s.meals.slice().sort((a, b) => (times[a.id] || '99') < (times[b.id] || '99') ? -1 : (times[a.id] || '99') > (times[b.id] || '99') ? 1 : 0);

  // Stan składników z Zapasów (ten sam dziennik zdarzeń) — pokazywany tylko, gdy stan jest znany i pilny/średni.
  const st = ctx.store?.state;
  const stockCache = new Map();
  const stockOf = prod => {
    if (!st || !prod || !catalogById[prod]) return null;
    if (!stockCache.has(prod)) {
      const q = stockAt(st.inv, prod, ctx.today);
      stockCache.set(prod, q == null ? null : { q, fc: forecast(prod, q, ctx.today), info: statusInfo(catalogById[prod], q, forecast(prod, q, ctx.today)) });
    }
    return stockCache.get(prod);
  };
  const alertOf = prod => { const x = stockOf(prod); return x && (x.info.code === 'CRITICAL' || x.info.code === 'WARNING') ? x : null; };
  const critOf = prod => { const x = alertOf(prod); return x?.info.code === 'CRITICAL' ? x : null; };   // przy produkcie — tylko pilne
  const stockText = x => (x.q <= 0 ? 'brak w zapasach' : x.fc?.lastCovered ? `zapas do ${dayShort(x.fc.lastCovered)} ${shortDate(x.fc.lastCovered)}` : 'zapas < 1 dnia');
  const alerts = [...new Map(s.meals.flatMap(m => m.items).filter(i => alertOf(i.prod)).map(i => [i.prod, { prod: i.prod, name: catalogById[i.prod].name, x: alertOf(i.prod) }])).values()]
    .sort((a, b) => (a.x.fc?.days ?? 0) - (b.x.fc?.days ?? 0));

  add(root,
    h('header', { class: 'dt-head' },
      h('h1', {}, 'Dieta'),
      h('div', { class: 'topline' }, h('span', { class: 'date' }, s.header),
        isToday ? h('span', { class: 'chip' }, `obowiązuje dziś · ${longDate(ctx.today)}`)
          : h('a', { class: 'chip dt-today', href: '#/dieta' }, icon('calendar', { size: 14 }), 'Pokaż plan na dziś'))),
    h('div', { class: 'controls dt-controls' },
      segmented('Faza', PHASES, phase, v => go(v, variant)),
      segmented('Rodzaj dnia', VARIANTS, variant, v => go(phase, v))));

  const aside = h('aside', { class: 'dt-aside', 'aria-label': 'Podsumowanie planu' },
    h('div', { class: 'hero' },
      h('div', { class: 'hero-kcal' }, h('strong', {}, String(s.total.kcal)), h('span', {}, 'kcal')),
      h('div', { class: 'hero-macros' }, [
        ['p', 'Białko', s.total.p, s.pct.p], ['c', 'Węglowodany', s.total.c, s.pct.c], ['f', 'Tłuszcz', s.total.f, s.pct.f],
      ].map(([k, label, g, pct]) => h('div', { class: `hm hm--${k}` },
        h('span', { class: 'hm-l' }, label),
        h('span', { class: 'hm-v' }, `${g} g`),
        h('span', { class: 'hm-bar' }, h('span', { class: 'hm-fill', style: { width: `${pct}%` } })),
        h('span', { class: 'hm-p' }, `${pct} %`))))),
    // Następny posiłek dnia (tylko plan obowiązujący dziś) — godzina z planu dnia, link do karty posiłku
    isToday && h('section', { class: 'dt-card dt-next', 'aria-labelledby': 'dt-next-h' },
      h('p', { class: 'eyebrow', id: 'dt-next-h' }, next ? 'Następny posiłek' : 'Posiłki na dziś'),
      next ? [h('p', { class: 'dt-next-t' }, h('time', {}, next.time), ` ${next.name}`),
        h('p', { class: 'muted' }, `${next.total.kcal} kcal · B ${fmt(next.total.p, 1)} · W ${fmt(next.total.c, 1)} · T ${fmt(next.total.f, 1)} g`),
        h('a', { class: 'btn', href: `#dt-${next.id}` }, icon('chevron-down', { size: 18 }), 'Pokaż skład')]
        : h('p', { class: 'muted' }, 'Wszystkie posiłki z godziną są już za Tobą.')),
    // Składniki planu z pilnym lub średnim stanem w Zapasach (wymaga znanych stanów)
    st && h('section', { class: `dt-card dt-stock${alerts.length ? ' has-alerts' : ''}`, 'aria-labelledby': 'dt-stock-h' },
      h('p', { class: 'eyebrow', id: 'dt-stock-h' }, 'Składniki w zapasach'),
      alerts.length === 0
        ? h('p', { class: 'muted' }, Object.keys(st.inv.counts).length ? 'Wszystkie składniki tego planu mają wystarczający zapas.' : 'Brak stanów — ustaw je w module Zapasy.')
        : [h('ul', { class: 'dt-alerts' }, alerts.slice(0, 3).map(a => h('li', {},
          h('span', { class: `dot-s s-${a.x.info.code}`, 'aria-hidden': 'true' }), h('span', {}, a.name), h('span', { class: 'muted' }, stockText(a.x))))),
        alerts.length > 3 && h('p', { class: 'muted' }, `i ${alerts.length - 3} więcej`),
        h('a', { class: 'btn', href: `#/zapasy?s=CRITICAL` }, icon('package', { size: 18 }), 'Uzupełnij w Zapasach')]));

  const main = h('div', { class: 'dt-main' },
    // Nawigacja po posiłkach: godzina i kcal, przewinięcie w obrębie modułu (D-066)
    h('nav', { class: 'dt-nav', 'aria-label': 'Posiłki' }, meals.map(m => h('a', { class: `dt-nav-a${next?.id === m.id ? ' is-next' : ''}`, href: `#dt-${m.id}` },
      h('span', { class: 'dt-nav-n' }, m.name), h('span', { class: 'dt-nav-m' }, [times[m.id], `${m.total.kcal} kcal`].filter(Boolean).join(' · '))))),
    meals.map(m => h('details', { class: `meal${next?.id === m.id ? ' is-next' : ''}`, 'data-meal': m.id, id: `dt-${m.id}`, open: m.id !== 'drinks' },
      h('summary', {},
        h('span', { class: 'meal-n' }, m.name, times[m.id] && h('time', { class: 'dt-time' }, times[m.id])),
        h('span', { class: 'meal-k' }, `${m.total.kcal} kcal`),
        h('span', { class: 'meal-m' }, `B ${m.total.p} · W ${m.total.c} · T ${m.total.f} g`),
        macroBar(m.total)),
      h('ul', { class: 'food' }, m.items.map(i => {
        const a = critOf(i.prod);
        return h('li', {},
          h('span', { class: 'f-n' }, i.name, a && h('span', { class: `dt-stock-b s-${a.info.code}` }, icon('triangle-alert', { size: 13 }), stockText(a))),
          h('span', { class: 'f-q' }, qty(i.label)), macroLine(i));
      })))),
    // Rzadziej potrzebne informacje — zwinięte
    h('details', { class: 'panel fold dt-extra' }, h('summary', {}, h('h2', {}, 'Co zmienia się między fazami')),
      h('div', { class: 'scroll-x' }, h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Pozycja'), [0, 1, 2].filter(p => p !== phase).map(p => h('th', {}, `Faza ${phase} → ${p}`)))),
        h('tbody', {}, (() => {
          const other = [0, 1, 2].filter(p => p !== phase), rows = new Map();
          for (const p of other) for (const x of phaseDiff(variant, phase, p)) {
            if (!rows.has(x.name)) rows.set(x.name, {});
            rows.get(x.name)[p] = `${x.from} → ${x.to} g`;
          }
          return rows.size === 0 ? [h('tr', {}, h('td', { colspan: String(other.length + 1) }, 'Brak różnic'))]
            : [...rows.entries()].map(([name, v]) => h('tr', {}, h('td', {}, name), other.map(p => h('td', {}, v[p] || '—'))));
        })())))),
    h('details', { class: 'panel fold dt-extra' }, h('summary', {}, h('h2', {}, 'Zamienniki (opcjonalnie)')),
      h('ul', { class: 'food' }, s.optional.map(o => h('li', {}, h('span', { class: 'f-n' }, o.name), h('span', { class: 'f-q' }, qty(o.label)), macroLine(o))))),
    h('details', { class: 'panel fold dt-extra' }, h('summary', {}, h('h2', {}, 'Przyprawy')), h('p', { class: 'chips' }, s.spices.map(x => h('span', { class: 'chip' }, x)))));

  add(root, h('div', { class: 'dt-grid' }, aside, main));
}
