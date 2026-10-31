// Widok „Dziś” (Etap 2+): wynik resolvera czytelnie podzielony na sloty i podpunkty.
// Suplementy pochodzą wyłącznie z SUPLEMENTACJI (D-001) — tekst źródłowy PLAN_DNIA ich nie powtarza.
import { h, add, fmt, plural } from '../ui/dom.js';
import { progressRing, metric, statusBadge } from '../ui/components.js';
import { sparkline, donut } from '../ui/charts.js';
import { region, swap } from '../ui/patch.js';
import { icon } from '../ui/icons.js';
import { recallDone } from '../core/calc/recall.js';
import { attention } from '../core/calc/attention.js';
import { weekSummary, mondayOf } from '../core/calc/week.js';
import { cloudStatus } from '../core/sync/cloud-local.js';
import { resolveDay, cfaSourceLine, PLAN_START, PLAN_END, PLAN_REAL_START, DIET_START, TRAIN_START } from '../core/resolver.js';
import { addDays, longDate, shortDate, dayShort, weekday } from '../core/dates.js';
import { SRC, plan } from '../core/data.js';
import { stockAt, forecast, statusInfo, shoppingList, nextShopping, allItems } from '../core/calc/inventory.js';
import { sessions, weekStart } from '../core/calc/training.js';
import { careModel, stepsFor, progress, slotProgress, placeSlotProgress, slotDefs } from '../core/calc/care.js';
import { mpwDaySpan } from '../core/calc/mpw.js';
import { byId, isTab } from './registry.js';

const suppName = id => SRC.supplements.supplements[id]?.name || id;
// Czas nauki MPW dnia z godzin bloków (B6): „159 min · od 16:00” w czwartki od 07.01, „symulacja 180 min · 15:30–18:30”, z P1–P7 — od 8:00
const mpwHint = bl => { const s = mpwDaySpan(bl);
  return s.sim ? [s.rest && `${s.rest.min} min od ${s.rest.from}`, `symulacja ${s.sim.min} min · ${s.sim.from}–${s.sim.to}`].filter(Boolean).join(' · ')
    : `${s.all.min} min · od ${s.all.from}`; };

function cfaBlock(b, slot) {
  return h('div', { class: 'cfa-block' },
    h('p', { class: 'cfa-src' }, cfaSourceLine(b)),
    h('p', { class: 'cfa-topic' }, b.temat),
    h('p', { class: 'cfa-meta' }, h('span', { class: 'chip' }, b.tryb), b.godz !== `${slot.from}–${slot.to}` && h('span', { class: 'muted' }, b.godz)));
}

// Upływ czasu w punkcie planu (D-110): ułamek od–do (także przez północ, np. sen 23:00–07:00) i minuty do końca
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
export function slotClock(s, hhmm) {
  const f = toMin(s.from); let t = toMin(s.to), c = toMin(hhmm);
  if (t <= f) t += 1440;
  if (c < f) c += 1440;
  return { frac: Math.min(1, Math.max(0, (c - f) / (t - f))), left: Math.max(0, t - c) };
}
const minLabel = m => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`);

// Bieżący slot wyznaczany z zegara (tylko dla dzisiejszego dnia).
export function currentSlot(slots, hhmm) {
  let cur = null;
  for (const s of slots) if (s.from <= hhmm && (s.to > s.from ? hhmm < s.to : true)) cur = s;
  if (!cur && hhmm < slots[0].from) return { current: null, next: slots[0] };
  const i = cur ? slots.indexOf(cur) : -1;
  return { current: cur, next: slots[i + 1] || null };
}

function slotView(s, now, care) {
  // Gdy posiłek jest jednocześnie tytułem slotu (Śniadanie 09:00), kcal trafia do tytułu, a podpunkt się nie powtarza.
  const lead = s.items.find(i => i.kind === 'meal' && i.text === s.title) || null;
  const title = s.title, titleKcal = lead?.kcal ?? null;
  const items = s.items.filter(i => i !== lead);
  const isNow = now && now.current === s;
  // U1: „Czas własny” (slot nauki bez bloku poza planem CFA) — lżej, bez koloru domeny. D-110: bieżący punkt — linia osi czasu wypełniona do upływu czasu (--el)
  return h('article', { class: `slot${isNow ? ' is-now' : ''}${s.own ? ' is-own' : ''}`, 'data-domain': s.domain, 'aria-labelledby': `t-${s.id}`, id: s.id,
    style: isNow && now.hhmm ? { '--el': slotClock(s, now.hhmm).frac.toFixed(3) } : null },
    h('div', { class: 'slot-time' }, h('time', {}, s.from), h('span', { class: 'to' }, `–${s.to}`)),
    h('div', { class: 'slot-body' },
      h('h3', { class: 'slot-title', id: `t-${s.id}` }, title, titleKcal != null && h('span', { class: 'kcal' }, `${titleKcal} kcal`),
        isNow && h('span', { class: 'now-tag' }, 'teraz')),
      s.desc && h('p', { class: 'slot-note' }, s.desc),
      (s.cfa || []).map(b => cfaBlock(b, s)),
      items.length > 0 && h('ul', { class: 'slot-items' }, items.map(i => h('li', { class: i.kind === 'meal' ? 'is-meal' : null },
        i.text, i.kind === 'meal' && i.kcal != null && h('span', { class: 'kcal' }, `${i.kcal} kcal`)))),
      // Pielęgnacja (D-094): tylko postęp kroków przypiętych do slotu i odnośnik — treść kroków w module (bez dublowania, jak D-041)
      care?.[s.id] && h('a', { class: 'slot-care', href: `#/pielegnacja?d=${care.date}`, 'aria-label': `Pielęgnacja: ${care[s.id].done} z ${care[s.id].total} kroków — otwórz moduł` },
        icon('sparkles', { size: 14 }), h('span', {}, `Pielęgnacja ${care[s.id].done} / ${care[s.id].total}`)),
      s.doses.length > 0 && h('div', { class: 'slot-supps' },
        h('p', { class: 'supps-h' }, 'Suplementy'),
        h('ul', {}, s.doses.map(d => h('li', {}, h('time', {}, d.time), h('span', { class: 'sn' }, suppName(d.supp)), h('span', { class: 'sd' }, d.label),
          d.note && h('span', { class: 'muted' }, ` · ${d.note}`)))))));
}

// ---- Dane dashboardu — wyłącznie z resolvera i dziennika zdarzeń (bez metryk fikcyjnych) ----
function dayData(r, date, store, today) {
  const st = store?.state;
  const planned = (r.training || []).reduce((a, e) => a + e.seriesToday, 0);
  const done = (r.training || []).reduce((a, e) => a + [...Array(e.seriesToday)].filter((_, i) => st?.train?.[`${date}|${e.id}|${i + 1}`]?.done).length, 0);
  const cfaToday = r.cfa.blocks.filter(b => st?.cfaDone?.has(b.nr)).length;
  const cfaAll = st?.cfaDone?.size || 0;
  const mpwToday = r.mpw.blocks.filter(b => st?.mpwDone?.has(b.nr)).length;
  const mpwAll = st?.mpwDone?.size || 0;
  const prepTotal = SRC.mealprep.cards.reduce((n, c) => n + c.blocks.filter(b => b.items).reduce((k, b) => k + b.items.length, 0), 0);
  const prepDone = st ? Object.entries(st.prep || {}).filter(([k, v]) => k.startsWith(`${date}|`) && v).length : 0;
  let inv = null;
  if (st) {
    const items = [...allItems(), ...(st.catalogUser || [])];
    const rows = items.map(it => { const s = stockAt(st.inv, it.id, today); return { it, st: s, info: statusInfo(it, s, forecast(it.id, s, today)) }; });
    inv = { critical: rows.filter(x => x.info.code === 'CRITICAL'), warning: rows.filter(x => x.info.code === 'WARNING').length, ok: rows.filter(x => x.info.code === 'OK').length,
      known: rows.filter(x => x.st != null).length,
      shop: nextShopping(today, new Date().getHours(), new Date().getMinutes()), toBuy: shoppingList(st.inv, today, items).length };
  }
  // D-113: mini-wykresy z dziennika — serie wykonane w 14 dniach do `date`; bloki nauki wykonane w 10 ostatnich dniach planu (≤ `date`)
  const setsByDay = {};
  for (const [k, v] of Object.entries(st?.train || {})) if (v?.done) { const d = k.slice(0, 10); setsByDay[d] = (setsByDay[d] || 0) + 1; }
  const trainSpark = [...Array(14)].map((_, i) => { const d = addDays(date, i - 13); return d < PLAN_START ? null : setsByDay[d] || 0; });
  const studySpark = (D, doneSet) => {
    const days = [...new Set(D.bloki.map(b => b.data))].filter(d => d <= date).sort().slice(-10);
    return { days, done: days.map(d => D.bloki.filter(b => b.data === d && doneSet?.has(b.nr)).length), max: Math.max(1, ...days.map(d => D.bloki.filter(b => b.data === d).length)) };
  };
  return { planned, done, cfaToday, cfaAll, mpwToday, mpwAll, prepTotal, prepDone, inv, trainSpark,
    cfaSpark: studySpark(SRC.cfa.D, st?.cfaDone), mpwSpark: studySpark(SRC.mpw.D, st?.mpwDone) };
}

// D-113: podział stanów Zapasów (pilne / średnie / OK) jako pasek proporcji — z tych samych obliczeń co moduł Zapasy
const statusStrip = inv => { const c = inv.critical.length, n = Math.max(1, c + inv.warning + inv.ok);
  return h('span', { class: 'mt-strip', role: 'img', 'aria-label': `Pilne ${c}, średnie ${inv.warning}, OK ${inv.ok}` },
    [['CRITICAL', c], ['WARNING', inv.warning], ['OK', inv.ok]].filter(([, v]) => v).map(([k, v]) => h('span', { class: `s-${k}`, style: { flexGrow: String(v / n) } }))); };

// D-113: udział energii z makroskładników (4/4/9 kcal) — pierścień i legenda; wartości z planu diety dnia
const macroMix = t => { const k = [t.p * 4, t.c * 4, t.f * 9], sum = k.reduce((a, b) => a + b, 0) || 1, pc = k.map(v => Math.round((v / sum) * 100));
  return h('span', { class: 'dz-mix' }, donut([{ value: k[0], cls: 'dn-p' }, { value: k[1], cls: 'dn-c' }, { value: k[2], cls: 'dn-f' }],
    { label: `Udział energii: białko ${pc[0]} %, węglowodany ${pc[1]} %, tłuszcz ${pc[2]} %`, size: 34, stroke: 6 }),
    h('span', { class: 'dz-mix-l', 'aria-hidden': 'true' }, [['m-p', 'B', pc[0]], ['m-c', 'W', pc[1]], ['m-f', 'T', pc[2]]].map(([c, l, v]) => h('span', { class: c }, `${l} ${v}%`)))); };

const card = (title, ic, href, ...body) => h('section', { class: 'dz-card' },
  h('div', { class: 'dz-card-h' }, h('span', { class: 'dz-ic' }, icon(ic, { size: 18 })), h('h2', {}, title),
    href && h('a', { class: 'dz-more', href, 'aria-label': `${title} — otwórz moduł` }, icon('chevron-right', { size: 18 }))), ...body);

// Nauka MPW (D-095): bloki dnia z planu MPW w osobnej karcie — godziny planu dnia bez zmian (decyzja użytkownika 29.09.2026).
// Odhaczanie jak w module MPW (`mpw.done`); szczegóły i zadania bloków w module.
function mpwCard(r, ctx) {
  const st = ctx.store?.state, bl = r.mpw.blocks, done = st?.mpwDone || new Set();
  const k = bl.filter(b => done.has(b.nr)).length;
  const toggle = async (b, value) => {
    try { await ctx.store.record('mpw.done', { block: b.nr, done: value }); ctx.rerender(); } catch (e) { ctx.flash(e.message || String(e)); }
  };
  return h('section', { class: 'panel dz-mpw', 'aria-labelledby': 'dz-mpw-h' },
    h('div', { class: 'dz-mpw-h' },
      h('h2', { id: 'dz-mpw-h' }, icon('landmark', { size: 20 }), r.mpw.isSim ? (bl.length > 3 ? 'Nauka MPW i symulacja egzaminu' : 'Symulacja egzaminu MPW') : 'Nauka MPW'),
      h('span', { class: 'muted' }, `${bl[0].godz.slice(0, 5)}–${bl[bl.length - 1].godz.slice(-5)} · ${k} / ${bl.length} bloków`),
      h('a', { class: 'dz-more', href: `#/mpw?v=dzien&d=${r.date}`, 'aria-label': 'Nauka MPW — otwórz moduł' }, icon('chevron-right', { size: 18 }))),
    h('div', { class: 'cfa-list' }, bl.map(b => h('div', { class: `cfa-row${done.has(b.nr) ? ' is-done' : ''}` },
      h('button', { class: 'set-toggle', 'aria-pressed': String(done.has(b.nr)), disabled: !ctx.store || null,
        'aria-label': `Blok MPW ${b.nr} ${done.has(b.nr) ? 'wykonany' : 'do wykonania'}`, onclick: () => toggle(b, !done.has(b.nr)) }, done.has(b.nr) ? '✓' : b.blok),
      h('div', { class: 'cfa-body' },
        h('p', { class: 'cfa-src' }, cfaSourceLine(b)),
        h('p', { class: 'cfa-topic' }, b.temat),
        h('p', { class: 'cfa-meta' }, h('span', { class: 'chip' }, b.tryb), h('span', { class: 'muted' }, b.godz)))))),
    h('p', { class: 'dz-foot' }, 'Bloki według planu MPW — poza szablonem godzin planu dnia.'));
}

// Siatka aktywności: ostatnie 6 tygodni × 7 dni; kropka = dzień z zapisanym treningiem (seria lub czas)
function activityGrid(store, today) {
  const days = new Set(sessions(store?.state?.train || {}, store?.state?.trainSessions || {}, store?.state?.trainDetails || {}).map(s => s.date));
  const start = addDays(weekStart(today), -35);
  const cols = [...Array(6)].map((_, w) => [...Array(7)].map((_, d) => addDays(start, w * 7 + d)));
  const n = [...days].filter(d => d >= start && d <= today).length;
  return h('div', { class: 'dz-act' },
    h('div', { class: 'dz-grid-dots', role: 'img', 'aria-label': `Treningi w ostatnich 6 tygodniach: ${n}` },
      ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'].map((l, i) => [h('span', { class: 'dz-dl', 'aria-hidden': 'true' }, l),
        cols.map(c => h('span', { class: `dz-dot${days.has(c[i]) ? ' is-on' : ''}${c[i] === today ? ' is-today' : ''}${c[i] > today ? ' is-future' : ''}`, title: `${c[i]}${days.has(c[i]) ? ' · trening' : ''}` }))])),
    h('p', { class: 'dz-foot' }, n ? `${n} ${plural(n, 'dzień', 'dni', 'dni')} z treningiem w 6 tygodni` : 'Brak zapisanych treningów — pojawią się po zapisaniu serii lub czasu.'));
}

// „Wymaga uwagi” (I2): sygnały z Zapasów, CFA, Suplementacji i synchronizacji w jednym miejscu (tylko dzień bieżący).
// Część zależna od bazy (niewysłane zmiany, chmura) dopisywana po odczycie — bez opóźniania reszty widoku.
function attentionCard(ctx) {
  const st = ctx.store?.state;
  const list = h('ul', { class: 'dz-attn-list' });
  const count = h('span', { class: 'dz-attn-count', 'aria-hidden': 'true' });
  const sub = h('p', { class: 'dz-attn-sub' });
  const empty = h('div', { class: 'dz-attn-empty' }, h('span', { class: 'dz-at-ic' }, icon('circle-check', { size: 18 })),
    h('p', {}, h('strong', {}, 'Wszystko pod kontrolą'), h('span', {}, 'Nic nie wymaga dziś uwagi.')));
  const box = h('section', { class: 'dz-attn', 'aria-labelledby': 'dz-attn-h' },
    h('div', { class: 'dz-attn-head' }, h('span', { class: 'dz-attn-bell' }, icon('bell', { size: 18 })),
      h('div', { class: 'dz-attn-ht' }, h('h2', { id: 'dz-attn-h' }, 'Wymaga uwagi'), sub), count),
    list, empty);
  // Każdy sygnał jako kafelek-odnośnik: ikona w kolorze poziomu, tekst, strzałka; nagłówek z licznikiem (I2, nowy wygląd — D-097)
  const put = items => {
    for (const x of items) list.append(h('li', { class: `at-${x.level}` },
      h('a', { class: 'dz-at-item', href: x.href },
        h('span', { class: 'dz-at-ic' }, icon(x.level === 'warn' ? 'triangle-alert' : 'info', { size: 16 })),
        h('span', { class: 'dz-at-t' }, x.text), icon('chevron-right', { size: 16, cls: 'dz-at-go' }))));
    const n = list.childElementCount, w = list.querySelectorAll('.at-warn').length;
    empty.hidden = n > 0; count.hidden = n === 0; count.textContent = String(n);
    sub.textContent = n ? (w ? `${w} ${plural(w, 'pilna sprawa', 'pilne sprawy', 'pilnych spraw')}${n > w ? ` · ${n - w} ${plural(n - w, 'informacja', 'informacje', 'informacji')}` : ''}` : `${n} ${plural(n, 'informacja', 'informacje', 'informacji')}`) : 'Przegląd sygnałów z modułów';
    box.classList.toggle('has-warn', w > 0);
  };
  put(attention(st, { today: ctx.today, hour: new Date().getHours(), custom: st?.catalogUser || [] }));
  if (ctx.store) (async () => {
    const cloud = await cloudStatus(ctx.store).catch(() => null);
    if (cloud?.config) {
      if (cloud.pending && (!cloud.lastSync || Date.now() - Date.parse(cloud.lastSync) > 24 * 3600e3))
        put([{ level: 'warn', text: `Chmura: ${cloud.pending} zmian czeka na wysłanie`, href: '#/dane' }]);
      return;
    }
    const exp = await ctx.store.adapter.getMeta('lastExport').catch(() => null);
    const own = ctx.store.allEvents().filter(e => e.dev === ctx.store.device && (!exp || e.hlc > exp.hlc)).length;
    if (own && (!exp || Date.now() - Date.parse(exp.at) > 24 * 3600e3))
      put([{ level: 'info', text: `Niewysłane zmiany z tego urządzenia: ${own} — wyślij plik synchronizacji`, href: '#/dane' }]);
  })();
  return box;
}

// Tydzień (I3): 7 dni z resolvera — trening, sauna, dieta, bloki CFA, recall, zakupy, wyjątki. Komputer: 7 kolumn; telefon: lista.
function renderWeek(root, ctx, date) {
  const week = weekSummary(date), mon = mondayOf(date), sun = addDays(mon, 6);
  const wlink = d => `#/dzis?v=tydzien&d=${d}`;
  add(root, h('header', { class: 'dz-head' },
    h('div', {}, h('h1', {}, 'Tydzień'),
      h('div', { class: 'topline' }, h('span', { class: 'date' }, `${shortDate(mon)} – ${longDate(sun)}`))),
    h('div', { class: 'row daynav' },
      mondayOf(PLAN_START) < mon && h('a', { class: 'btn dz-nav', href: wlink(addDays(mon, -7)), 'aria-label': 'Poprzedni tydzień' }, icon('chevron-left', { size: 18 }), h('span', {}, 'Poprzedni tydzień')),
      h('a', { class: 'btn dz-nav', href: `#/dzis${date === ctx.today ? '' : `?d=${date < PLAN_START ? PLAN_START : date}`}` }, 'Dzień'),
      addDays(mon, 7) <= PLAN_END && h('a', { class: 'btn dz-nav', href: wlink(addDays(mon, 7)), 'aria-label': 'Następny tydzień' }, h('span', {}, 'Następny tydzień'), icon('chevron-right', { size: 18 })))),   // D15: bez tygodni po końcu planu
    h('ol', { class: 'wk-grid', 'aria-label': 'Dni tygodnia' }, week.map(x => h('li', {},
      h('a', { class: `wk-day${x.date === ctx.today ? ' is-today' : ''}${x.outside ? ' is-out' : ''}`, href: `#/dzis?d=${x.date}`,
        'aria-label': `${x.dayName}, ${longDate(x.date)}${x.date === ctx.today ? ' (dziś)' : ''}` },
        h('span', { class: 'wk-d' }, h('strong', {}, dayShort(x.date)), ` ${shortDate(x.date)}`, x.date === ctx.today && h('span', { class: 'now-tag' }, 'dziś')),
        x.zero ? h('span', { class: 'wk-l' }, icon('sparkles', { size: 14 }), 'Dzień zero — planowanie') : x.outside ? h('span', { class: 'muted' }, 'poza planem') : [
          h('span', { class: 'wk-l wk-train' }, icon('dumbbell', { size: 14 }), x.training),
          h('span', { class: 'wk-l' }, icon('utensils', { size: 14 }), x.noDiet ? 'bez diety' : `${x.diet} · ${x.kcal} kcal`),
          x.cfa > 0 && h('span', { class: 'wk-l' }, icon('graduation-cap', { size: 14 }), x.mock ? `Mock CFA · ${x.cfa} ${plural(x.cfa, 'blok', 'bloki', 'bloków')}` : `${x.cfa} ${plural(x.cfa, 'blok', 'bloki', 'bloków')}${x.recall ? ' + recall' : ''}`),
          x.blocks && h('span', { class: 'wk-l wk-blocks' }, icon('book-open', { size: 14 }), x.blocks),
          x.mpw > 0 && h('span', { class: 'wk-l' }, icon('landmark', { size: 14 }), x.mpwSpan.sim
            ? (x.mpwSpan.rest ? `MPW: ${x.mpwSpan.rest.n} ${plural(x.mpwSpan.rest.n, 'blok', 'bloki', 'bloków')} od ${x.mpwSpan.rest.from} + symulacja ${x.mpwSpan.sim.from}` : `Symulacja MPW ${x.mpwSpan.sim.from}`)
            : `MPW: ${x.mpw} ${plural(x.mpw, 'blok', 'bloki', 'bloków')} · ${x.mpwSpan.all.from}`),
          x.shopping && h('span', { class: 'wk-l' }, icon('shopping-cart', { size: 14 }), `Zakupy ${x.shopping}`),
          x.phase != null && x.date === mon && h('span', { class: 'wk-l muted' }, `Faza ${x.phase}`),
          x.note && h('span', { class: 'wk-note' }, x.note)])))));
}

export function renderDzis(root, ctx) {
  const date = ctx.params.get('d') || ctx.today;
  if (ctx.params.get('v') === 'tydzien') return renderWeek(root, ctx, date);
  const r = resolveDay(date);
  // Dzień sprzed startu planu (D-088): bez planu dnia — tylko informacja i przejście do pierwszego dnia planu
  const nav = (n, label, ic) => h('a', { class: 'btn dz-nav', href: `#/dzis?d=${addDays(date, n)}`, 'aria-label': label }, n < 0 && icon(ic, { size: 18 }), h('span', {}, label), n > 0 && icon(ic, { size: 18 }));
  // D14 (audyt 31.10.2026): widok „Dnia zero” (D-097) usunięty — po D-100 plan nie ma Dnia zero (`phases.zero`), resolver traktuje go ogólnie
  // Dzień poza planem (D-088, D-097): przed Dniem zero albo po końcu planu (28.03.2027)
  if (r.outside) {
    const target = r.after ? PLAN_END : PLAN_START;
    add(root, h('header', { class: 'dz-head' },
      h('div', {}, h('h1', {}, r.dayName[0].toUpperCase() + r.dayName.slice(1)),
        h('div', { class: 'topline' }, h('span', { class: 'date' }, `${r.dayName}, ${longDate(date)}`), h('span', { class: 'chip' }, 'poza planem'))),
      h('div', { class: 'row daynav' }, h('a', { class: 'btn dz-nav', href: '#/dzis' }, 'Dziś'))),
    h('section', { class: 'panel dz-outside' }, h('h2', {}, 'Poza planem'),
      h('p', {}, r.after ? `Plan zakończył się ${longDate(PLAN_END)}. Dni późniejsze nie mają planu dnia, treningu, suplementacji ani zużycia w Zapasach.`
        : `Realny początek planu: ${longDate(PLAN_REAL_START)} (regularny trening i dieta od ${longDate(TRAIN_START)}). Dni wcześniejsze są historią — zapisane dane zostają, ale nie mają planu dnia, treningu, suplementacji ani zużycia w Zapasach; plan CFA liczy się od ${longDate(SRC.cfa.D.stat.start)}.`),
      h('a', { class: 'btn primary', href: `#/dzis?d=${target}` }, `Przejdź do ${shortDate(target)}`)));
    return;
  }
  // B3 (audyt 23.10.2026): „Teraz”, wyróżnienie bieżącego slotu i następna pora dawek aktualizowane z upływem czasu (ctx.tick, w miejscu —
  // bez przerysowania strony, przewinięcie i rozwinięte sekcje zostają); podział na „Minione punkty” — z chwili wyświetlenia
  const hm = () => { const x = new Date(); return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
  let hhmm = hm();
  let now = date === ctx.today ? { ...currentSlot(r.slots, hhmm), hhmm } : null;
  // D-110: poświata tła w kolorze bieżącego punktu planu (tylko dzień bieżący)
  const ambient = () => { if (now?.current?.domain) document.documentElement.dataset.domain = now.current.domain; };
  ambient();
  const t = plan(r.dietVariant, r.phase ?? 0).total;
  const D = dayData(r, date, ctx.store, ctx.today);
  const cfaMin = r.cfa.blocks.length * 53;
  // Od 12.11.2026 (koniec planu CFA) nauka w podsumowaniu = MPW (D-095)
  const mpwNow = isTab(byId.mpw, date), MD = SRC.mpw.D;
  const slotIdx = now?.current ? r.slots.indexOf(now.current) : -1;
  const allDoses = r.slots.flatMap(s => s.doses);
  const nextDose = () => allDoses.find(x => x.time >= hhmm);
  // Kafel KPI (D-110): ikona i pasek w kolorze domeny, liczba z jednostką pomniejszoną (tekst kafla bez zmian — „0 / 11 bloków”)
  // D-113: kafel KPI = metric() — liczba krojem Display, jednostka pomniejszona, podpis i mini-wykres z prawdziwych danych (klasy kafli bez zmian)
  const kpi = (label, ic, dom, value, unit, hint, extra, cls = '', chart = null, href = null) =>
    metric({ label, ic, value, unit, hint, chart: chart || extra, dom, cls: `dz-kpi ${cls}`.trim(), href });
  const bar = (v, max, dom) => h('span', { class: 'dz-bar', role: 'presentation' }, h('span', { style: { width: `${max ? Math.min(100, (v / max) * 100) : 0}%`, background: `var(--${dom})` } }));
  // Pielęgnacja (D-094): plan z danych użytkownika; bez planu — bez karty i bez znaczników w slotach
  const cm = careModel(ctx.store?.state?.careDefs || []), cDone = ctx.store?.state?.careDone || {};
  // D-111: krok przypięty do slotu innego wariantu dnia — znacznik w slocie tego dnia o tej porze (np. niedziela świąteczna bez basenu)
  const care = cm.empty ? null : { date, ...placeSlotProgress(slotProgress(cm, cDone, date), r.slots, slotDefs(SRC.dayTemplate)) };
  const careP = cm.empty ? null : progress(stepsFor(cm, date), cDone, date);
  const nowBox = region(() => {
    if (!now || !(now.current || now.next)) return null;
    const idx = now.current ? r.slots.indexOf(now.current) : -1;
    // D-110: postęp bieżącego punktu w czasie (od–do) i czas do końca; przed pierwszym punktem — czas do rozpoczęcia
    const clk = now.current ? slotClock(now.current, hhmm) : null;
    const wait = !now.current ? (toMin(now.next.from) - toMin(hhmm) + 1440) % 1440 : 0;
    return h('section', { class: 'nowcard dz-now', 'aria-label': 'Teraz', style: { '--dc': `var(--${(now.current || now.next).domain || 'accent'})` } },
      h('div', { class: 'dz-now-main' },
        h('p', { class: 'nowcard-l' }, now.current ? `Teraz · ${now.current.from}–${now.current.to}` : 'Za chwilę'),
        h('p', { class: 'nowcard-t' }, (now.current || now.next).title),
        clk ? h('div', { class: 'dz-now-prog' }, h('span', { class: 'dz-now-bar', 'aria-hidden': 'true' }, h('span', { style: { width: `${(clk.frac * 100).toFixed(1)}%` } })),
          h('span', { class: 'dz-now-left' }, `zostało ${minLabel(clk.left)}`))
          : h('p', { class: 'dz-now-left' }, `za ${minLabel(wait)} · ${now.next.from}`),
        now.current && now.next && h('p', { class: 'muted' }, `Następnie ${now.next.from} · ${now.next.title}`),
        now.current && h('a', { class: 'btn', href: `#${now.current.id}` }, 'Pokaż w planie')),
      idx >= 0 && h('div', { class: 'dz-now-side' }, progressRing(idx + 1, r.slots.length, 'Postęp dnia'), h('span', { class: 'muted' }, `punkt ${idx + 1} z ${r.slots.length}`)));
  });
  const suppFoot = region(() => { const nd = nextDose();
    return h('p', { class: 'dz-foot' }, date !== ctx.today ? 'Szczegóły w planie dnia poniżej.' : nd ? `Następna pora: ${nd.time} — szczegóły w planie dnia.` : 'Wszystkie dzisiejsze dawki za Tobą.'); });

  add(root,
    h('header', { class: 'dz-head' },
      h('div', {},
        h('h1', {}, date === ctx.today ? 'Dziś' : r.dayName[0].toUpperCase() + r.dayName.slice(1)),
        h('div', { class: 'topline' },
          h('span', { class: 'date' }, `${r.dayName}, ${longDate(date)}`),
          h('span', { class: 'chip' }, r.phase == null ? 'start planu · przed Fazą 0' : `Faza ${r.phase}`),
          h('span', { class: 'chip' }, r.sessionLabel),
          h('span', { class: 'chip' }, r.noDiet ? 'bez diety' : `${r.kcal} kcal (${r.dietVariant})`),
          r.cfa.isMock && h('span', { class: 'chip' }, 'Mock CFA'),
          r.mpw.isSim && h('span', { class: 'chip' }, 'Symulacja MPW'),
          r.blocks && h('span', { class: 'chip' }, r.blocks.short))),
      h('div', { class: 'row daynav' }, date > PLAN_START && nav(-1, 'Poprzedni dzień', 'chevron-left'),
        date !== ctx.today && h('a', { class: 'btn dz-nav', href: '#/dzis' }, 'Dziś'), nav(1, 'Następny dzień', 'chevron-right'))),
    r.preStart && h('p', { class: 'panel dz-prestart', role: 'note' }, `Przed startem planu — realny początek planu: ${longDate(PLAN_REAL_START)} (dieta od ${longDate(DIET_START)}, trening od ${longDate(TRAIN_START)}).`),
    h('div', { class: 'row quicklinks' },
      h('a', { class: 'btn ql', href: `#/dzis?v=tydzien&d=${date}` }, icon('calendar-range', { size: 18 }), h('span', {}, 'Tydzień')),
      h('a', { class: 'btn ql', href: `#/kalendarz?m=${date.slice(0, 7)}` }, icon('calendar', { size: 18 }), h('span', {}, 'Kalendarz')),
      !r.noDiet && h('a', { class: 'btn ql', href: `#/dieta?d=${r.date}` }, icon('utensils', { size: 18 }), h('span', {}, 'Jadłospis dnia')),
      h('a', { class: 'btn ql', href: `#/suplementy?d=${date}` }, icon('pill', { size: 18 }), h('span', {}, 'Suplementacja dnia')),
      r.training?.length > 0 && h('a', { class: 'btn ql', href: `#/trening?d=${date}` }, icon('dumbbell', { size: 18 }), h('span', {}, 'Trening dnia')),
      r.cfa.inPlan && h('a', { class: 'btn ql', href: `#/cfa?v=dzien&d=${date}` }, icon('graduation-cap', { size: 18 }), h('span', {}, 'Bloki CFA')),
      r.mpw.inPlan && h('a', { class: 'btn ql', href: `#/mpw?v=dzien&d=${date}` }, icon('landmark', { size: 18 }), h('span', {}, 'Bloki MPW')),
      careP && h('a', { class: 'btn ql', href: `#/pielegnacja?d=${date}` }, icon('sparkles', { size: 18 }), h('span', {}, 'Pielęgnacja'))),
    h('div', { class: 'dz-grid' },
      nowBox.el,   // D-110: najpierw „Teraz” (co robię), potem „Wymaga uwagi” — ta sama kolejność na telefonie i komputerze
      date === ctx.today && attentionCard(ctx),
      h('div', { class: 'stats dz-kpis' },
        r.noDiet ? kpi('Dieta', 'utensils', 'diet', 'Bez diety', null, `dieta od ${longDate(DIET_START)}`)
          : kpi('Dieta', 'utensils', 'diet', String(r.kcal), 'kcal', `${r.dietVariant === 'T' ? 'dzień treningowy' : 'dzień nietreningowy'} · B ${fmt(t.p)} / W ${fmt(t.c)} / T ${fmt(t.f)} g`,
            null, '', macroMix(t),
            `#/dieta?d=${r.date}`),
        kpi('Trening', 'dumbbell', 'train', D.planned ? `${D.done} / ${D.planned}` : (r.training?.length ? r.sessionLabel : 'Bez treningu'), null,
          D.planned ? `serii · ${r.sessionLabel}` : (r.sauna ? `sauna: ${r.sauna} ${r.sauna === 1 ? 'runda' : 'rundy'}` : r.sessionLabel),
          null, '', sparkline(D.trainSpark, { label: `Serie wykonane w ostatnich 14 dniach: ${D.trainSpark.map(v => v ?? 0).reduce((a, b) => a + b, 0)}` }), `#/trening?d=${date}`),
        mpwNow ? kpi('MPW', 'landmark', 'cfa', r.mpw.blocks.length ? `${D.mpwToday} / ${r.mpw.blocks.length}` : r.mpw.inPlan ? 'dzień wolny' : date < MD.stat.start ? `od ${shortDate(MD.stat.start)}` : 'po planie',
          r.mpw.blocks.length ? 'bloków' : null, r.mpw.blocks.length ? mpwHint(r.mpw.blocks) : null,
          null, '', D.mpwSpark.days.length ? sparkline(D.mpwSpark.done, { max: D.mpwSpark.max, label: `Bloki MPW wykonane w ostatnich ${D.mpwSpark.days.length} dniach planu` }) : null, `#/mpw?v=dzien&d=${date}`) :
        kpi('CFA', 'graduation-cap', 'cfa', r.cfa.inPlan ? `${D.cfaToday} / ${r.cfa.blocks.length}` : 'poza planem', r.cfa.inPlan ? 'bloków' : null,
          r.cfa.inPlan ? `${cfaMin} min${r.cfa.recall ? ` + 53 min recall${recallDone(ctx.store?.state?.settings, date) ? ' ✓' : ''}` : ' · bez recall'}` : null,
          null, '', D.cfaSpark.days.length ? sparkline(D.cfaSpark.done, { max: D.cfaSpark.max, label: `Bloki CFA wykonane w ostatnich ${D.cfaSpark.days.length} dniach planu` }) : null, `#/cfa?v=dzien&d=${date}`),
        kpi('Zapasy', 'package', 'prep', D.inv ? (D.inv.known ? String(D.inv.critical.length) : 'brak stanów') : '—', D.inv?.known ? plural(D.inv.critical.length, 'pilna', 'pilne', 'pilnych') : null,
          D.inv ? `zakupy ${dayShort(D.inv.shop.date)} ${shortDate(D.inv.shop.date)} · ${D.inv.toBuy} ${plural(D.inv.toBuy, 'pozycja', 'pozycje', 'pozycji')}` : null, null,
          D.inv?.critical.length ? 'is-alert' : '', D.inv?.known ? statusStrip(D.inv) : null, '#/zapasy')),
      h('aside', { class: 'dz-aside', 'aria-label': 'Podsumowanie dnia' },
        // Tylko podsumowanie (liczba dawek, następna pora) — nazwy dawek są w planie dnia; bez dublowania (D-041)
        card('Suplementy', 'pill', `#/suplementy?d=${date}`,
          h('div', { class: 'dz-prog' }, h('strong', {}, String(allDoses.length)), h('span', { class: 'muted' }, `${plural(allDoses.length, 'dawka', 'dawki', 'dawek')} w ${new Set(allDoses.map(x => x.time)).size} porach`)),
          suppFoot.el),
        careP && card('Pielęgnacja', 'sparkles', `#/pielegnacja?d=${date}`,
          h('div', { class: 'dz-prog' }, h('strong', {}, `${careP.done} / ${careP.total}`), h('span', { class: 'muted' }, 'kroków dziś')), bar(careP.done, careP.total, 'care')),
        card('Meal prep', 'chef-hat', '#/mealprep',
          h('div', { class: 'dz-prog' }, h('strong', {}, `${D.prepDone} / ${D.prepTotal}`), h('span', { class: 'muted' }, 'kroków dziś')), bar(D.prepDone, D.prepTotal, 'prep')),
        D.inv && card('Zapasy', 'package', '#/zapasy',
          D.inv.critical.length ? h('ul', { class: 'dz-list' }, D.inv.critical.slice(0, 4).map(x => h('li', {}, h('span', { class: 'dz-flag' }, icon('triangle-alert', { size: 14 })), h('span', {}, x.it.name), statusBadge(x.info.code, x.info.label, { title: x.info.badge }))))
            : h('p', { class: 'muted' }, D.inv.known ? 'Brak pilnych braków.' : 'Wczytaj kopię zapasów w module Dane albo ustaw stany w Zapasach.'),
          h('p', { class: 'dz-foot' }, `Najbliższe zakupy: ${dayShort(D.inv.shop.date)} ${shortDate(D.inv.shop.date)}`)),
        mpwNow ? card('Plan MPW', 'landmark', '#/mpw?v=plan',
          h('div', { class: 'dz-prog' }, h('strong', {}, `${Math.round((D.mpwAll / MD.bloki.length) * 100)}%`), h('span', { class: 'muted' }, `${D.mpwAll} z ${MD.bloki.length} bloków`)),
          bar(D.mpwAll, MD.bloki.length, 'cfa'))
        : card('Plan CFA', 'graduation-cap', '#/cfa?v=plan',
          h('div', { class: 'dz-prog' }, h('strong', {}, `${Math.round((D.cfaAll / SRC.cfa.D.bloki.length) * 100)}%`), h('span', { class: 'muted' }, `${D.cfaAll} z ${SRC.cfa.D.bloki.length} bloków`)),
          bar(D.cfaAll, SRC.cfa.D.bloki.length, 'cfa')),
        card('Aktywność treningowa', 'dumbbell', '#/trening?v=stat', activityGrid(ctx.store, ctx.today))),
      r.mpw.blocks.length > 0 && mpwCard(r, ctx),
      h('section', { class: 'dz-plan', 'aria-labelledby': 'dz-plan-h' },
        h('h2', { id: 'dz-plan-h', class: 'dz-plan-h' }, 'Plan dnia'),
        // U-a: w dniu bieżącym minione punkty planu zwinięte (plan zaczyna się od „teraz”); rozwinięcie pamiętane do przeładowania
        slotIdx > 0 && h('details', { class: 'dz-past', open: pastOpen || null, ontoggle: e => { pastOpen = e.target.open; } },
          h('summary', {}, icon('chevron-down', { size: 16 }), `Minione punkty (${slotIdx}) · ${r.slots[0].from}–${r.slots[slotIdx - 1].to}`),
          h('div', { class: 'day' }, r.slots.slice(0, slotIdx).map(s => slotView(s, now, care)))),
        h('div', { class: 'day' }, r.slots.slice(Math.max(0, slotIdx)).map(s => slotView(s, now, care))))));

  if (date !== ctx.today) return;
  const shopDay = D.inv?.shop.date;
  ctx.tick?.(() => {
    const x = new Date(), t = hm();
    // Koniec slotu zakupów (najbliższe zakupy przesuwają się) — „Do kupienia”, KPI i „Wymaga uwagi” liczone od nowa (przerysowanie w tle)
    if (D.inv && nextShopping(ctx.today, x.getHours(), x.getMinutes()).date !== shopDay) { ctx.soft?.(); return; }
    const prev = now, dose = nextDose()?.time;
    hhmm = t;
    const n = { ...currentSlot(r.slots, t), hhmm: t };
    if (n.current !== prev.current || n.next !== prev.next) {
      now = n; nowBox.refresh(); ambient();
      for (const s of new Set([prev.current, n.current].filter(Boolean))) { const el = document.getElementById(s.id); if (el) swap(el, slotView(s, now, care)); }
    } else if (t !== prev.hhmm) {
      // ta sama pora: odliczanie w karcie „Teraz” i wypełnienie linii osi czasu (bez przebudowy punktów planu)
      now = n; nowBox.refresh();
      if (n.current) document.getElementById(n.current.id)?.style.setProperty('--el', slotClock(n.current, t).frac.toFixed(3));
    }
    if (nextDose()?.time !== dose) suppFoot.refresh();
  });
}
let pastOpen = false;
