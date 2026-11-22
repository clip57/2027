// Moduł Suplementacja (Etap 3, Faza 5): SUPLEMENTACJA_2027 jest jedynym źródłem (D-001);
// okres ważności preparatów czasowych z D-015, cynk nieśledzony z D-016.
// Faza 5 (D-075): minione / następna pora dnia, zapas suplementów z modułu Zapasy (pasek, „Kupione”).
import { h, fmt, add, clear } from '../ui/dom.js';
import { checkBtn, checkSvg, markToggled } from '../ui/check.js';
import { segRing } from '../ui/rings.js';
import { segmented } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { scheduleFor, supplementOverview } from '../core/calc/supplements.js';
import { addDays, longDate, weekday, dayShort, shortDate, range } from '../core/dates.js';
import { stockAt, forecast, statusInfo, runway, nextShopping } from '../core/calc/inventory.js';
import { catalogById, SRC } from '../core/data.js';
import { doseKey, doseDone, settingEvents } from '../core/calc/checks.js';
import { dayPlan, inPlan, PLAN_START, PLAN_END, DAY_ZERO } from '../core/resolver.js';

const DAYS = ['pn', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];
// D2 (audyt 31.10.2026): daty jak w całej aplikacji („03.11.2026”, „pn 03.11”), nie ISO
const dmy = d => `${shortDate(d)}.${d.slice(0, 4)}`;

/** @param {HTMLElement} root @param {import('../core/types').Ctx} ctx */
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
  // B3: z upływem czasu „następna pora” i minione pory liczone od nowa (przerysowanie w tle, gdy się zmienią)
  if (isToday) ctx.tick?.(() => { const x = new Date(), t = `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
    if (groups.find(g => g.time >= t)?.time !== nextTime) ctx.soft?.(); });
  const msg = h('div', { role: 'status', 'aria-live': 'polite' });

  // Zapas preparatów (ten sam dziennik co moduł Zapasy): stan, prognoza, status v31 (suplementy: < 10 / < 20 dni)
  const store = ctx.store, inv = store?.state?.inv;
  const shop = nextShopping(ctx.today, now.getHours(), now.getMinutes());
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

  // F-D4 (D-113): odhaczanie przyjętych dawek — `setting` `supp.dose:<data>|<godz>|<preparat>` (wspólne dla urządzeń); tylko do dziś włącznie
  const settings = store?.state?.settings || {};
  const allDoses = groups.flatMap(g => g.doses);
  const canCheck = !!store && date <= ctx.today && allDoses.length > 0;
  const taken = allDoses.filter(d => doseDone(settings, date, d)).length;
  const mark = async (doses, value) => {
    try { await store.recordMany(settingEvents(doses.map(d => doseKey(date, d)), value)); ctx.rerender(); }
    catch (e) { clear(msg).append(h('div', { class: 'banner err' }, e.message)); }
  };
  const doseBtn = d => { const on = doseDone(settings, date, d);
    return checkBtn({ key: doseKey(date, d), on, cls: 'dose-ck', aria: `${d.name}, ${d.time}: ${on ? 'przyjęte' : 'do przyjęcia'}`,
      onclick: () => mark([d], !on) }); };

  // D-119 (Instrument+): stan pór — przyjęte / częściowo / nieprzyjęte po czasie (tylko dziś) / następna
  const doneIn = g => g.doses.filter(d => doseDone(settings, date, d)).length;
  const state = g => {
    const k = doneIn(g), all = canCheck && k === g.doses.length;
    return { k, all, past: isToday && g.time < hhmm, next: g.time === nextTime, miss: canCheck && !all && (isToday ? g.time < hhmm : date < ctx.today) };
  };
  const anchor = g => `sp-${g.time.replace(':', '')}`;
  const nextG = groups.find(g => g.time === nextTime);
  const missed = groups.filter(g => state(g).miss);
  const markGroup = (g, value) => { markToggled(...g.doses.map(d => doseKey(date, d))); return mark(g.doses, value); };
  const inMin = t => { const [a, b] = t.split(':').map(Number), x = new Date(), m = a * 60 + b - (x.getHours() * 60 + x.getMinutes());
    return m <= 0 ? 'teraz' : m < 60 ? `za ${m} min` : `za ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`; };
  const untilEl = nextG ? h('span', { class: 'sp-in' }, inMin(nextG.time)) : null;

  add(root, h('header', { class: 'sp-head' }, h('h1', {}, 'Suplementacja'),
    h('div', { class: 'topline' }, h('span', { class: 'date' }, longDate(date)),
      h('span', { class: 'chip' }, `${groups.reduce((n, g) => n + g.doses.length, 0)} dawek w ${groups.length} porach`),
      canCheck && h('span', { class: 'chip sp-taken' }, `przyjęte ${taken} / ${allDoses.length}`),
      nextTime && h('span', { class: 'chip sp-now' }, icon('clock', { size: 14 }), `następna pora: ${nextTime}`),
      // M5 (audyt 10.11): „do uzupełnienia” tylko w dniu planu (poza planem dawek nie ma)
      low.length > 0 && inPlan(date) && h('a', { class: 'chip sp-low-link', href: '#sp-stock-h' }, icon('package', { size: 14 }), `do uzupełnienia: ${low.length}`))),
    msg,
    h('div', { class: 'controls sp-days' }, segmented('Dzień', week, date, go)));

  // Oś dnia: dla dzisiejszego dnia pory minione przygaszone, następna wyróżniona (godzina z SUPLEMENTACJI)
  if (dayPlan(date).zero) add(root, h('p', { class: 'panel sp-outside' }, `Dzień zero — bez suplementów. Suplementacja od ${longDate(addDays(date, 1))}.`));
  else if (!inPlan(date)) add(root, h('p', { class: 'panel sp-outside' }, date > PLAN_END ? `Poza planem — plan zakończył się ${longDate(PLAN_END)}.`
    : `Poza planem — suplementacja zaczyna się ${longDate(DAY_ZERO ? addDays(PLAN_START, 1) : PLAN_START)}.`));

  // Przyrząd: pierścień pór (łuk = pora, wypełnienie = przyjęte dawki) + następna pora z główną akcją
  const hero = groups.length > 0 && h('section', { class: 'sp-hero', 'aria-labelledby': 'sp-hero-h' },
    h('h2', { class: 'sr-only', id: 'sp-hero-h' }, 'Pory dnia'),
    h('div', { class: 'sp-dial' },
      segRing(groups.map(g => { const x = state(g); return { v: canCheck ? x.k / g.doses.length : 0, tone: x.all ? 'done' : x.next ? 'next' : x.miss ? 'miss' : 'todo' }; }),
        { size: 148, stroke: 12, label: canCheck ? `Przyjęte ${taken} z ${allDoses.length} dawek` : `${allDoses.length} dawek w ${groups.length} porach`, animate: true }),
      h('div', { class: 'sp-dial-c', 'aria-hidden': 'true' },
        h('strong', {}, canCheck ? String(taken) : String(allDoses.length)), h('span', {}, canCheck ? `z ${allDoses.length} dawek` : 'dawek'))),
    h('div', { class: 'sp-hero-b' },
      nextG ? [h('p', { class: 'sp-k' }, 'Następna pora'),
        h('p', { class: 'sp-next' }, h('span', { class: 'sp-next-t' }, nextG.time), ' ', nextG.situation),
        h('p', { class: 'sp-sub' }, untilEl, ` · ${nextG.doses.length} ${nextG.doses.length === 1 ? 'dawka' : nextG.doses.length < 5 ? 'dawki' : 'dawek'}`),
        canCheck && !state(nextG).all && h('button', { class: 'btn primary sp-take', onclick: () => markGroup(nextG, true) }, icon('check', { size: 18 }),
          h('span', {}, `Przyjmij ${nextG.time}${nextG.doses.length > 1 ? ` (${nextG.doses.length})` : ''}`))]
        : h('p', { class: 'sp-next' }, !canCheck ? (date > ctx.today ? 'Plan dnia' : 'Brak dawek') : taken === allDoses.length ? 'Wszystkie dawki przyjęte' : isToday ? 'Pory na dziś minęły' : 'Podsumowanie dnia'),
      missed.length > 0 && h('p', { class: 'sp-miss' }, icon('clock', { size: 14 }), h('span', {}, 'Nieprzyjęte: '),
        missed.map((g, i) => [i ? ', ' : '', h('a', { href: `#${anchor(g)}`, onclick: e => { e.preventDefault(); document.getElementById(anchor(g))?.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }, g.time)])),
      h('ol', { class: 'sp-strip', 'aria-label': 'Pory dnia' }, groups.map(g => { const x = state(g);
        return h('li', {}, h('a', { class: `sp-pill${x.all ? ' is-done' : x.next ? ' is-next' : x.miss ? ' is-miss' : ''}`, href: `#${anchor(g)}`,
          'aria-label': `${g.time} ${g.situation}: ${canCheck ? `${x.k} z ${g.doses.length}` : `${g.doses.length} dawek`}`,
          onclick: e => { e.preventDefault(); document.getElementById(anchor(g))?.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }, g.time)); }))));
  if (isToday && untilEl) ctx.tick?.(() => { untilEl.textContent = inMin(nextG.time); });

  const poraCard = (g, x) => [
    h('div', { class: 'tl-head' },
      h('h3', { class: 'tl-title' }, g.situation, x.next && h('span', { class: 'now-tag' }, 'następna'), x.past && h('span', { class: 'sr-only' }, ' (minęła)'),
        x.miss && !x.next && h('span', { class: 'sp-tag-miss' }, 'nieprzyjęte')),
      canCheck && h('span', { class: 'tl-count' }, `${x.k}/${g.doses.length}`),
      canCheck && g.doses.length > 1 && h('button', { class: 'sp-all', onclick: () => markGroup(g, !x.all) },
        icon(x.all ? 'undo-2' : 'list-checks', { size: 16 }), h('span', {}, x.all ? `Odznacz porę ${g.time}` : `Przyjęte wszystkie o ${g.time}`))),
    h('ul', { class: 'dose-list' }, g.doses.map(d => h('li', { class: canCheck && doseDone(settings, date, d) ? 'is-taken' : null },
      h('div', { class: 'dose-head' }, suppGlyph(d.supp), h('span', { class: 'sn' }, d.name), h('span', { class: 'dose-badge' }, d.label), canCheck && doseBtn(d)),
      h('p', { class: 'dose-form' }, d.form),
      (d.note || (d.thursday && nt)) && h('p', { class: 'dose-note' },
        [d.note, d.thursday && nt ? ntNote(d.thursday.note) : null].filter(Boolean).join(' · ')))))];
  const pory = h('div', { class: 'sp-pory' }, groups.map(g => {
    const x = state(g);
    return h('article', { class: `tl-item${x.past ? ' is-past' : ''}${x.next ? ' is-next' : ''}${x.all ? ' is-all' : ''}${x.miss ? ' is-miss' : ''}`, id: anchor(g) },
      h('div', { class: 'tl-mark' }, h('time', {}, g.time)),
      // pora w całości przyjęta — zwinięta do jednej linii (odpowiedź na „czy już wziąłem?”); rozwinięcie pokazuje dawki i pozwala cofnąć
      x.all ? h('details', { class: 'tl-card sp-fold' },
        h('summary', {}, h('span', { class: 'sp-fold-ck', 'aria-hidden': 'true' }, checkSvg('ck-mini')), h('span', { class: 'sp-fold-t' }, g.situation),
          h('span', { class: 'muted' }, `${g.doses.length} ${g.doses.length === 1 ? 'dawka' : g.doses.length < 5 ? 'dawki' : 'dawek'} · przyjęte`)),
        poraCard(g, x))
        : h('div', { class: 'tl-card' }, poraCard(g, x)));
  }));
  const side = h('div', { class: 'sp-side' });
  add(root, h('div', { class: 'sp-cq' }, h('div', { class: `sp-grid${groups.length ? '' : ' is-empty'}` }, hero, pory, side)));
  add(side, regularity(ctx, settings));

  // Karta zapasu suplementów — tylko pozycje z pilnym / średnim stanem, zakup jednym dotknięciem (inv.move purchase)
  if (inv) add(side, h('div', { class: 'tl-end' }), h('section', { class: `sp-stock${low.length ? ' has-low' : ''}`, 'aria-labelledby': 'sp-stock-h' },
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

  else add(side, h('div', { class: 'tl-end' }));
  add(root,
    h('section', { class: 'panel', 'aria-labelledby': 'h-prep' }, h('h2', { id: 'h-prep' }, 'Preparaty'),
      h('div', { class: 'scroll-x' }, h('table', { class: 'data sp-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Preparat'), h('th', {}, 'Kiedy'), h('th', { class: 'num' }, 'Dawka dzienna'), h('th', {}, 'Zapas'))),
        h('tbody', {}, overview.map(s => {
          const x = stocks[s.id];
          return h('tr', { class: s.active ? null : 'is-off' },
            h('td', {}, h('strong', {}, s.name), h('span', { class: 'muted block' }, s.form)),
            h('td', {}, s.times.join(', '), !s.everyDay && h('span', { class: 'muted block' }, s.weekdays.map(w => DAYS[w - 1]).join(', ')),
              s.validity && h('span', { class: 'muted block' }, `${s.validity.from ? `od ${dmy(s.validity.from)} ` : ''}do ${dmy(s.validity.until)}`)),
            h('td', { class: 'num' }, s.daily ? `${fmt(s.daily, 2)} ${catalogById[s.id]?.unit || ''}` : '—'),
            h('td', {}, !s.tracked ? 'nieśledzony' : x?.st == null ? 'brak stanu' :
              [`${fmt(x.st, 1)} ${catalogById[s.id]?.unit || ''}${x.fc?.lastCovered ? ` · do ${dayShort(x.fc.lastCovered)} ${shortDate(x.fc.lastCovered)}` : x.st <= 0 ? ' · brak' : ''}`,
                x.rw && h('span', { class: `zp-run st-${x.info.code}`, role: 'img', 'aria-label': `Zapas na ${fmt(x.rw.days, 1)} dnia` },
                  h('span', { class: 'zp-run-f', style: { width: `${x.rw.pct}%` } }))]));
        }))))));
}

// D-119: znak preparatu (jak w Apple Zdrowie → Leki) — kształt z jednostki w katalogu (kaps. → kapsułka, g → miarka proszku, inne → tabletka)
// i stały kolor z palety tokenów --sp-1…8 (kolejność preparatów w planie). Bez nowych danych.
const SUPP_IDS = Object.keys(SRC.supplements.supplements);
const SVG_NS = 'http://www.w3.org/2000/svg';
export function suppGlyph(id) {
  const unit = catalogById[id]?.unit || '', n = (Math.max(0, SUPP_IDS.indexOf(id)) % 8) + 1;
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', class: 'sp-gl', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(k, v);
  svg.style.setProperty('--sc', `var(--sp-${n})`);
  const el = (tag, a) => { const e = document.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); svg.append(e); };
  if (unit.startsWith('kaps')) { el('rect', { x: '3', y: '8', width: '18', height: '8', rx: '4', class: 'sp-gl-b', transform: 'rotate(-35 12 12)' });
    el('path', { d: 'M12 8h5a4 4 0 0 1 0 8h-5z', class: 'sp-gl-a', transform: 'rotate(-35 12 12)' }); }
  else if (unit === 'g') { el('path', { d: 'M4 11h12a6 6 0 0 1-12 0z', class: 'sp-gl-a' }); el('path', { d: 'M16 12.5l5-4', class: 'sp-gl-h' });
    el('path', { d: 'M6 11c1-2.6 3-3.8 4-3.8s3 1.2 4 3.8z', class: 'sp-gl-b' }); }
  else { el('circle', { cx: '12', cy: '12', r: '7.5', class: 'sp-gl-a' }); el('path', { d: 'M7.5 12h9', class: 'sp-gl-h' }); }
  return svg;
}

// D-119: regularność z 28 dni — preparat × dzień, z zapisanych odhaczeń (`supp.dose:*`). Okno zaczyna się od pierwszego dnia z odhaczeniem
// (dni sprzed używania odhaczania nie są „pominięte”). Bez odhaczeń — tylko informacja, bez pustego wykresu.
function regularity(ctx, settings) {
  const first = Object.keys(settings).filter(k => k.startsWith('supp.dose:') && settings[k] === true).map(k => k.slice(10, 20)).sort()[0];
  const sec = (...b) => h('section', { class: 'sp-reg', 'aria-labelledby': 'sp-reg-h' }, h('h2', { id: 'sp-reg-h' }, icon('calendar-range', { size: 18 }), 'Regularność'), ...b);
  if (!first || first > ctx.today) return sec(h('p', { class: 'muted' }, 'Pojawi się po pierwszych odhaczeniach dawek — mapa ostatnich 28 dni z tego, co zapiszesz.'));
  const start = [first, addDays(ctx.today, -27), PLAN_START].sort().at(-1);
  const days = [...range(start, ctx.today)].filter(d => inPlan(d));
  const rows = new Map(); let due = 0, got = 0;
  days.forEach((d, i) => { for (const dose of scheduleFor(d).flatMap(g => g.doses)) {
    const r = rows.get(dose.supp) || rows.set(dose.supp, { id: dose.supp, name: dose.name, cells: new Map() }).get(dose.supp);
    const c = r.cells.get(i) || { n: 0, k: 0 }; c.n++; if (doseDone(settings, d, dose)) c.k++; r.cells.set(i, c);
    if (d < ctx.today) { due++; if (doseDone(settings, d, dose)) got++; } } });
  const W = days.length, cell = 9, gap = 2, list = [...rows.values()];
  const rowSvg = r => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    for (const [k, v] of Object.entries({ viewBox: `0 0 ${W * (cell + gap) - gap} ${cell}`, class: 'sp-reg-svg', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(k, v);
    svg.style.width = `${(W / 28) * 100}%`;   // skala jak przy pełnych 28 dniach (krótsze okno — węższy pasek, te same kratki)
    const paths = { full: '', part: '', miss: '', todo: '', none: '' };
    days.forEach((d, i) => { const c = r.cells.get(i);
      const t = !c ? 'none' : c.k === c.n ? 'full' : c.k > 0 ? 'part' : d === ctx.today ? 'todo' : 'miss';
      paths[t] += `M${i * (cell + gap)} 0h${cell}v${cell}h-${cell}z`; });
    for (const [t, d] of Object.entries(paths)) if (d) { const p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', `rg-c is-${t}`); svg.append(p); }
    return svg;
  };
  const pct = due ? Math.round(got / due * 100) : 0;
  return sec(
    due ? h('p', { class: 'sp-reg-sum' }, h('strong', {}, `${pct} %`), ` dawek przyjętych do wczoraj · ${W} ${W === 1 ? 'dzień' : 'dni'} od ${shortDate(start)}`)
      : h('p', { class: 'sp-reg-sum' }, 'Pierwszy dzień odhaczania — odsetek pojawi się od jutra.'),
    h('ul', { class: 'sp-reg-map', 'aria-label': `Regularność od ${shortDate(start)}: ${pct} % dawek przyjętych do wczoraj` },
      list.map(r => { const n = [...r.cells.values()].reduce((a, c) => a + c.n, 0), k = [...r.cells.values()].reduce((a, c) => a + c.k, 0);
        return h('li', { 'aria-label': `${r.name}: ${k} z ${n} dawek` }, h('span', { class: 'sp-reg-n', 'aria-hidden': 'true' }, suppGlyph(r.id), h('span', {}, r.name)), rowSvg(r)); })),
    h('p', { class: 'sp-reg-key muted' }, h('span', { class: 'k is-full' }), 'przyjęte', h('span', { class: 'k is-part' }), 'część', h('span', { class: 'k is-miss' }), 'nieodhaczone'));
}
