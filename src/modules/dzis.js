// Widok „Dziś” (Etap 2+): wynik resolvera czytelnie podzielony na sloty i podpunkty.
// Suplementy pochodzą wyłącznie z SUPLEMENTACJI (D-001) — tekst źródłowy PLAN_DNIA ich nie powtarza.
import { h, add, fmt, plural } from '../ui/dom.js';
import { progressRing } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { recallDone } from '../core/calc/recall.js';
import { attention } from '../core/calc/attention.js';
import { weekSummary, mondayOf } from '../core/calc/week.js';
import { cloudStatus } from '../core/sync/cloud-local.js';
import { resolveDay, cfaSourceLine, PLAN_START } from '../core/resolver.js';
import { addDays, longDate, shortDate, dayShort, weekday } from '../core/dates.js';
import { SRC, plan } from '../core/data.js';
import { stockAt, forecast, statusInfo, shoppingList, nextShopping, allItems } from '../core/calc/inventory.js';
import { sessions, weekStart } from '../core/calc/training.js';

const suppName = id => SRC.supplements.supplements[id]?.name || id;

function cfaBlock(b, slot) {
  return h('div', { class: 'cfa-block' },
    h('p', { class: 'cfa-src' }, cfaSourceLine(b)),
    h('p', { class: 'cfa-topic' }, b.temat),
    h('p', { class: 'cfa-meta' }, h('span', { class: 'chip' }, b.tryb), b.godz !== `${slot.from}–${slot.to}` && h('span', { class: 'muted' }, b.godz)));
}

// Bieżący slot wyznaczany z zegara (tylko dla dzisiejszego dnia).
export function currentSlot(slots, hhmm) {
  let cur = null;
  for (const s of slots) if (s.from <= hhmm && (s.to > s.from ? hhmm < s.to : true)) cur = s;
  if (!cur && hhmm < slots[0].from) return { current: null, next: slots[0] };
  const i = cur ? slots.indexOf(cur) : -1;
  return { current: cur, next: slots[i + 1] || null };
}

function slotView(s, now) {
  // Gdy posiłek jest jednocześnie tytułem slotu (Śniadanie 09:00), kcal trafia do tytułu, a podpunkt się nie powtarza.
  const lead = s.items.find(i => i.kind === 'meal' && i.text === s.title) || null;
  const title = s.title, titleKcal = lead?.kcal ?? null;
  const items = s.items.filter(i => i !== lead);
  const isNow = now && now.current === s;
  return h('article', { class: `slot${isNow ? ' is-now' : ''}`, 'data-domain': s.domain, 'aria-labelledby': `t-${s.id}`, id: s.id },
    h('div', { class: 'slot-time' }, h('time', {}, s.from), h('span', { class: 'to' }, `–${s.to}`)),
    h('div', { class: 'slot-body' },
      h('h3', { class: 'slot-title', id: `t-${s.id}` }, title, titleKcal != null && h('span', { class: 'kcal' }, `${titleKcal} kcal`),
        isNow && h('span', { class: 'now-tag' }, 'teraz')),
      s.desc && h('p', { class: 'slot-note' }, s.desc),
      (s.cfa || []).map(b => cfaBlock(b, s)),
      items.length > 0 && h('ul', { class: 'slot-items' }, items.map(i => h('li', { class: i.kind === 'meal' ? 'is-meal' : null },
        i.text, i.kind === 'meal' && i.kcal != null && h('span', { class: 'kcal' }, `${i.kcal} kcal`)))),
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
  const prepTotal = SRC.mealprep.cards.reduce((n, c) => n + c.blocks.filter(b => b.items).reduce((k, b) => k + b.items.length, 0), 0);
  const prepDone = st ? Object.entries(st.prep || {}).filter(([k, v]) => k.startsWith(`${date}|`) && v).length : 0;
  let inv = null;
  if (st) {
    const items = [...allItems(), ...(st.catalogUser || [])];
    const rows = items.map(it => { const s = stockAt(st.inv, it.id, today); return { it, st: s, info: statusInfo(it, s, forecast(it.id, s, today)) }; });
    inv = { critical: rows.filter(x => x.info.code === 'CRITICAL'), known: rows.filter(x => x.st != null).length,
      shop: nextShopping(today, new Date().getHours(), st.settings.shopWeekday ?? 6), toBuy: shoppingList(st.inv, today, items).length };
  }
  return { planned, done, cfaToday, cfaAll, prepTotal, prepDone, inv };
}

const card = (title, ic, href, ...body) => h('section', { class: 'dz-card' },
  h('div', { class: 'dz-card-h' }, h('span', { class: 'dz-ic' }, icon(ic, { size: 18 })), h('h2', {}, title),
    href && h('a', { class: 'dz-more', href, 'aria-label': `${title} — otwórz moduł` }, icon('chevron-right', { size: 18 }))), ...body);

// Siatka aktywności: ostatnie 6 tygodni × 7 dni; kropka = dzień z zapisanym treningiem (seria lub czas)
function activityGrid(store, today) {
  const days = new Set(sessions(store?.state?.train || {}, store?.state?.trainSessions || {}).map(s => s.date));
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
  const empty = h('p', { class: 'muted' }, 'Nic nie wymaga uwagi.');
  const box = h('section', { class: 'dz-attn', 'aria-labelledby': 'dz-attn-h' },
    h('h2', { id: 'dz-attn-h' }, icon('bell', { size: 18 }), 'Wymaga uwagi'), list, empty);
  const put = items => {
    for (const x of items) list.append(h('li', { class: `at-${x.level}` }, icon(x.level === 'warn' ? 'triangle-alert' : 'info', { size: 16 }),
      h('a', { href: x.href }, x.text)));
    empty.hidden = list.childElementCount > 0;
    box.classList.toggle('has-warn', !!list.querySelector('.at-warn'));
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
      h('a', { class: 'btn dz-nav', href: wlink(addDays(mon, 7)), 'aria-label': 'Następny tydzień' }, h('span', {}, 'Następny tydzień'), icon('chevron-right', { size: 18 })))),
    h('ol', { class: 'wk-grid', 'aria-label': 'Dni tygodnia' }, week.map(x => h('li', {},
      h('a', { class: `wk-day${x.date === ctx.today ? ' is-today' : ''}${x.outside ? ' is-out' : ''}`, href: `#/dzis?d=${x.date}`,
        'aria-label': `${x.dayName}, ${longDate(x.date)}${x.date === ctx.today ? ' (dziś)' : ''}` },
        h('span', { class: 'wk-d' }, h('strong', {}, dayShort(x.date)), ` ${shortDate(x.date)}`, x.date === ctx.today && h('span', { class: 'now-tag' }, 'dziś')),
        x.outside ? h('span', { class: 'muted' }, 'poza planem') : [
          h('span', { class: 'wk-l wk-train' }, icon('dumbbell', { size: 14 }), x.training),
          h('span', { class: 'wk-l' }, icon('utensils', { size: 14 }), `${x.diet} · ${x.kcal} kcal`),
          x.cfa > 0 && h('span', { class: 'wk-l' }, icon('graduation-cap', { size: 14 }), x.mock ? `Mock CFA · ${x.cfa} ${plural(x.cfa, 'blok', 'bloki', 'bloków')}` : `${x.cfa} ${plural(x.cfa, 'blok', 'bloki', 'bloków')}${x.recall ? ' + recall' : ''}`),
          x.shopping && h('span', { class: 'wk-l' }, icon('shopping-cart', { size: 14 }), 'Zakupy 12:13'),
          x.phase != null && x.date === mon && h('span', { class: 'wk-l muted' }, `Faza ${x.phase}`),
          x.note && h('span', { class: 'wk-note' }, x.note)])))));
}

export function renderDzis(root, ctx) {
  const date = ctx.params.get('d') || ctx.today;
  if (ctx.params.get('v') === 'tydzien') return renderWeek(root, ctx, date);
  const r = resolveDay(date);
  // Dzień sprzed startu planu (D-088): bez planu dnia — tylko informacja i przejście do pierwszego dnia planu
  if (r.outside) {
    add(root, h('header', { class: 'dz-head' },
      h('div', {}, h('h1', {}, r.dayName[0].toUpperCase() + r.dayName.slice(1)),
        h('div', { class: 'topline' }, h('span', { class: 'date' }, `${r.dayName}, ${longDate(date)}`), h('span', { class: 'chip' }, 'poza planem'))),
      h('div', { class: 'row daynav' }, h('a', { class: 'btn dz-nav', href: '#/dzis' }, 'Dziś'))),
    h('section', { class: 'panel dz-outside' }, h('h2', {}, 'Poza planem'),
      h('p', {}, `Plan zaczyna się ${longDate(PLAN_START)}. Dni wcześniejsze nie mają planu dnia, treningu, suplementacji ani zużycia w Zapasach.`),
      h('a', { class: 'btn primary', href: `#/dzis?d=${PLAN_START}` }, `Przejdź do ${shortDate(PLAN_START)}`)));
    return;
  }
  const d = new Date();
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const now = date === ctx.today ? currentSlot(r.slots, hhmm) : null;
  const t = plan(r.dietVariant, r.phase ?? 0).total;
  const D = dayData(r, date, ctx.store, ctx.today);
  const cfaMin = r.cfa.blocks.length * 53;
  const nav = (n, label, ic) => h('a', { class: 'btn dz-nav', href: `#/dzis?d=${addDays(date, n)}`, 'aria-label': label }, n < 0 && icon(ic, { size: 18 }), h('span', {}, label), n > 0 && icon(ic, { size: 18 }));
  const slotIdx = now?.current ? r.slots.indexOf(now.current) : -1;
  const allDoses = r.slots.flatMap(s => s.doses);
  const nextDose = allDoses.find(x => x.time >= hhmm);
  const kpi = (label, value, hint, extra, cls = '') => h('div', { class: `stat dz-kpi ${cls}` },
    h('span', { class: 'stat-l' }, label), h('strong', { class: 'stat-v' }, value), hint && h('span', { class: 'stat-h' }, hint), extra);
  const bar = (v, max, dom) => h('span', { class: 'dz-bar', role: 'presentation' }, h('span', { style: { width: `${max ? Math.min(100, (v / max) * 100) : 0}%`, background: `var(--${dom})` } }));

  add(root,
    h('header', { class: 'dz-head' },
      h('div', {},
        h('h1', {}, date === ctx.today ? 'Dziś' : r.dayName[0].toUpperCase() + r.dayName.slice(1)),
        h('div', { class: 'topline' },
          h('span', { class: 'date' }, `${r.dayName}, ${longDate(date)}`),
          h('span', { class: 'chip' }, r.phase == null ? 'start planu · przed Fazą 0' : `Faza ${r.phase}`),
          h('span', { class: 'chip' }, r.sessionLabel),
          h('span', { class: 'chip' }, `${r.kcal} kcal (${r.dietVariant})`),
          r.cfa.isMock && h('span', { class: 'chip' }, 'Mock CFA'))),
      h('div', { class: 'row daynav' }, date > PLAN_START && nav(-1, 'Poprzedni dzień', 'chevron-left'),
        date !== ctx.today && h('a', { class: 'btn dz-nav', href: '#/dzis' }, 'Dziś'), nav(1, 'Następny dzień', 'chevron-right'))),
    h('div', { class: 'row quicklinks' },
      h('a', { class: 'btn ql', href: `#/dzis?v=tydzien&d=${date}` }, icon('calendar-range', { size: 18 }), h('span', {}, 'Tydzień')),
      h('a', { class: 'btn ql', href: `#/dieta?f=${r.phase ?? 0}&w=${r.dietVariant}` }, icon('utensils', { size: 18 }), h('span', {}, 'Jadłospis dnia')),
      h('a', { class: 'btn ql', href: `#/suplementy?d=${date}` }, icon('pill', { size: 18 }), h('span', {}, 'Suplementacja dnia')),
      r.training?.length > 0 && h('a', { class: 'btn ql', href: `#/trening?d=${date}` }, icon('dumbbell', { size: 18 }), h('span', {}, 'Trening dnia')),
      r.cfa.inPlan && h('a', { class: 'btn ql', href: `#/cfa?v=dzien&d=${date}` }, icon('graduation-cap', { size: 18 }), h('span', {}, 'Bloki CFA'))),
    h('div', { class: 'dz-grid' },
      date === ctx.today && attentionCard(ctx),
      now && (now.current || now.next) ? h('section', { class: 'nowcard dz-now', 'aria-label': 'Teraz' },
        h('div', { class: 'dz-now-main' },
          h('p', { class: 'nowcard-l' }, now.current ? `Teraz · ${now.current.from}–${now.current.to}` : 'Za chwilę'),
          h('p', { class: 'nowcard-t' }, (now.current || now.next).title),
          now.next && h('p', { class: 'muted' }, `Następnie ${now.next.from} · ${now.next.title}`),
          now.current && h('a', { class: 'btn', href: `#${now.current.id}` }, 'Pokaż w planie')),
        slotIdx >= 0 && h('div', { class: 'dz-now-side' }, progressRing(slotIdx + 1, r.slots.length, 'Postęp dnia'), h('span', { class: 'muted' }, `punkt ${slotIdx + 1} z ${r.slots.length}`))) : null,
      h('div', { class: 'stats dz-kpis' },
        kpi('Dieta', `${r.kcal} kcal`, `${r.dietVariant === 'T' ? 'dzień treningowy' : 'dzień nietreningowy'} · B ${fmt(t.p)} / W ${fmt(t.c)} / T ${fmt(t.f)} g`,
          h('span', { class: 'dz-macro' }, bar(t.p * 4, t.p * 4 + t.c * 4 + t.f * 9, 'p-col'), bar(t.c * 4, t.p * 4 + t.c * 4 + t.f * 9, 'c-col'), bar(t.f * 9, t.p * 4 + t.c * 4 + t.f * 9, 'f-col'))),
        kpi('Trening', D.planned ? `${D.done} / ${D.planned}` : (r.training?.length ? r.sessionLabel : 'Bez treningu'),
          D.planned ? `serii · ${r.sessionLabel}` : (r.sauna ? `sauna: ${r.sauna} ${r.sauna === 1 ? 'runda' : 'rundy'}` : r.sessionLabel),
          D.planned ? bar(D.done, D.planned, 'train') : null),
        kpi('CFA', r.cfa.inPlan ? `${D.cfaToday} / ${r.cfa.blocks.length} bloków` : 'poza planem',
          r.cfa.inPlan ? `${cfaMin} min${r.cfa.recall ? ` + 53 min recall${recallDone(ctx.store?.state?.settings, date) ? ' ✓' : ''}` : ' · bez recall'}` : null, r.cfa.inPlan ? bar(D.cfaToday, r.cfa.blocks.length, 'cfa') : null),
        kpi('Zapasy', D.inv ? (D.inv.known ? `${D.inv.critical.length} ${plural(D.inv.critical.length, 'pilna', 'pilne', 'pilnych')}` : 'brak stanów') : '—',
          D.inv ? `zakupy ${dayShort(D.inv.shop.date)} ${shortDate(D.inv.shop.date)} · ${D.inv.toBuy} ${plural(D.inv.toBuy, 'pozycja', 'pozycje', 'pozycji')}` : null, null,
          D.inv?.critical.length ? 'is-alert' : '')),
      h('aside', { class: 'dz-aside', 'aria-label': 'Podsumowanie dnia' },
        // Tylko podsumowanie (liczba dawek, następna pora) — nazwy dawek są w planie dnia; bez dublowania (D-041)
        card('Suplementy', 'pill', `#/suplementy?d=${date}`,
          h('div', { class: 'dz-prog' }, h('strong', {}, String(allDoses.length)), h('span', { class: 'muted' }, `${plural(allDoses.length, 'dawka', 'dawki', 'dawek')} w ${new Set(allDoses.map(x => x.time)).size} porach`)),
          h('p', { class: 'dz-foot' }, date !== ctx.today ? 'Szczegóły w planie dnia poniżej.' : nextDose ? `Następna pora: ${nextDose.time} — szczegóły w planie dnia.` : 'Wszystkie dzisiejsze dawki za Tobą.')),
        card('Meal prep', 'chef-hat', '#/mealprep',
          h('div', { class: 'dz-prog' }, h('strong', {}, `${D.prepDone} / ${D.prepTotal}`), h('span', { class: 'muted' }, 'kroków dziś')), bar(D.prepDone, D.prepTotal, 'prep')),
        D.inv && card('Zapasy', 'package', '#/zapasy',
          D.inv.critical.length ? h('ul', { class: 'dz-list' }, D.inv.critical.slice(0, 4).map(x => h('li', {}, h('span', { class: 'dz-flag' }, icon('triangle-alert', { size: 14 })), h('span', {}, x.it.name), h('span', { class: 'muted' }, x.info.badge))))
            : h('p', { class: 'muted' }, D.inv.known ? 'Brak pilnych braków.' : 'Wczytaj kopię zapasów w module Dane albo ustaw stany w Zapasach.'),
          h('p', { class: 'dz-foot' }, `Najbliższe zakupy: ${dayShort(D.inv.shop.date)} ${shortDate(D.inv.shop.date)}`)),
        card('Plan CFA', 'graduation-cap', '#/cfa?v=plan',
          h('div', { class: 'dz-prog' }, h('strong', {}, `${Math.round((D.cfaAll / SRC.cfa.D.bloki.length) * 100)}%`), h('span', { class: 'muted' }, `${D.cfaAll} z ${SRC.cfa.D.bloki.length} bloków`)),
          bar(D.cfaAll, SRC.cfa.D.bloki.length, 'cfa')),
        card('Aktywność treningowa', 'dumbbell', '#/trening?v=stat', activityGrid(ctx.store, ctx.today))),
      h('section', { class: 'dz-plan', 'aria-labelledby': 'dz-plan-h' },
        h('h2', { id: 'dz-plan-h', class: 'dz-plan-h' }, 'Plan dnia'),
        // U-a: w dniu bieżącym minione punkty planu zwinięte (plan zaczyna się od „teraz”); rozwinięcie pamiętane do przeładowania
        slotIdx > 0 && h('details', { class: 'dz-past', open: pastOpen || null, ontoggle: e => { pastOpen = e.target.open; } },
          h('summary', {}, icon('chevron-down', { size: 16 }), `Minione punkty (${slotIdx}) · ${r.slots[0].from}–${r.slots[slotIdx - 1].to}`),
          h('div', { class: 'day' }, r.slots.slice(0, slotIdx).map(s => slotView(s, now)))),
        h('div', { class: 'day' }, r.slots.slice(Math.max(0, slotIdx)).map(s => slotView(s, now))))));
}
let pastOpen = false;
