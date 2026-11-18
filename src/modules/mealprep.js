// Moduł Meal Prep (Etap 4): procedury z MEAL_PREP z ilościami wyliczonymi dla aktywnej fazy i wariantu dnia (D-003),
// progami z D-013, odhaczaniem kroków i zapisem testów kalibracyjnych. Fragmenty z wynikami badań: pakiet prywatny (D-035).
import { h, clear, fmt, add, plural } from '../ui/dom.js';
import { progressRing, timerChip } from '../ui/components.js';
import { SRC, plan, catalogById } from '../core/data.js';
import { resolveDay, PLAN_START, DIET_START } from '../core/resolver.js';
import { longDate, addDays, dayShort, shortDate } from '../core/dates.js';
import { coverage } from '../core/calc/inventory.js';
import { icon } from '../ui/icons.js';
import { swipeRow } from '../ui/gestures.js';
import { sfx } from '../ui/signal.js';
import { focusTop, focusScale, focusTimer, focusKeys } from '../ui/focus.js';

// {produkt} -> gramatura z planu diety na dany dzień; brak pozycji w planie = jawna informacja
export function resolveText(text, phase, variant, pack) {
  const p = plan(variant, phase);
  return text.replace(/\{(\w+):?(\d+)?\}/g, (m, key, idx) => {
    if (key === 'private') {
      const sec = pack?.sections?.find(s => s.id === 'mp-why');
      const block = sec?.blocks?.find(b => b.marker === Number(idx));
      return block ? block.text : '[fragment w pakiecie prywatnym — zaimportuj go w module Dane]';
    }
    for (const meal of p.meals) for (const it of meal.items) if (it.prod === key && it.use) {
      const unit = it.use.unit === 'szt.' ? ' szt.' : ` ${it.use.unit}`;
      return `${fmt(it.use.qty, 2)}${unit}`;
    }
    return `(brak w planie: ${catalogById[key]?.name || key})`;
  });
}

// Produkty katalogu użyte w karcie (znaczniki {produkt} w krokach i notatkach)
const cardProds = c => [...new Set([...JSON.stringify(c.blocks).matchAll(/\{(\w+)\}/g)].map(m => m[1]).filter(k => catalogById[k]))];

// Klucz kroku karty w zdarzeniu `prep.step` (Etap 4): numer bloku karty × 100 + numer kroku w bloku — bez zmian dla bloków 0–1 (wszystkie dotychczasowe
// karty i zapisane odhaczenia). R3 (audyt 23.10.2026): dalsze bloki kroków (od trzeciego) zapisują się jako karta `<id>.b<numer bloku>` z numerem kroku,
// więc `idx` jest zawsze < 200 — mieści się w walidacji każdej wersji aplikacji (`PREP_IDX_LIMIT`) i zapis z pliku lub chmury nie trafia
// na starszym urządzeniu do kwarantanny. Test w mealprep.test.mjs: klucze wszystkich kart planu unikalne i zgodne z walidacją.
export const prepKey = (card, block, item) => (block < 2 ? { card, idx: block * 100 + item } : { card: `${card}.b${block}`, idx: item });
const prepKeyText = (date, k) => `${date}|${k.card}|${k.idx}`;
const timerMin = text => { const m = text.match(/(\d+)(?:–(\d+))?\s*min/); return m ? Number(m[2] || m[1]) : null; };

// Minutnik kroku (D5): wspólny komponent `timerChip` (components.js) — odliczanie globalne z sygnałem także po zmianie widoku

// Fazy w kolejności dnia: „Wieczór poprzedniego dnia” (karty 21:45–21:55) wykonuje się wieczorem tego dnia na jutro,
// więc jest po „Wieczorze”, a jej ilości pochodzą z planu jutra (B1: na granicy faz, np. 11.11 → 12.11 — Faza 0 → Faza 1, płatki 85 g).
// Identyfikatory sekcji (`mp-ph-<nr>`) = numer fazy w MEAL_PREP.
const EVE = 0;
const ORDER = [...SRC.mealprep.phases.keys()].filter(i => i !== EVE && SRC.mealprep.phases[i].cards.some(Boolean))
  .concat(EVE, [...SRC.mealprep.phases.keys()].filter(i => i !== EVE && !SRC.mealprep.phases[i].cards.some(Boolean)));
const dietLabel = v => (v === 'T' ? 'dzień treningowy' : 'dzień nietreningowy');

let prepPos = null;   // D-114: bieżący krok trybu gotowania { date, key }
export function renderMealPrep(root, ctx) {
  const { store, today } = ctx;
  const q = ctx.params?.get('d');
  const date = q && q >= PLAN_START ? q : today;   // dzień wykonywania kroków (odhaczenia zapisane pod tą datą)
  const r = resolveDay(date);
  const phase = r.phase ?? 0, variant = r.dietVariant;
  const tomorrow = addDays(date, 1), rt = resolveDay(tomorrow);
  const pack = store?.state?.privatePack || null;
  const T = t => resolveText(t, phase, variant, pack);
  const TN = t => resolveText(t, rt.phase ?? 0, rt.dietVariant, pack);   // karty wieczorne — na jutro
  const msg = h('div', { role: 'status', 'aria-live': 'polite' });
  const done = store?.state?.prep || {};

  // Postęp liczony lokalnie i aktualizowany na bieżąco (bez przeładowania widoku).
  const state = Object.fromEntries(Object.entries(done).filter(([k]) => k.startsWith(`${date}|`)));
  const byId = Object.fromEntries(SRC.mealprep.cards.map(c => [c.id, c]));
  const eveIds = new Set(SRC.mealprep.phases[EVE].cards);
  const textOf = (c, t) => (eveIds.has(c.id) ? TN(t) : T(t));
  const stepsOf = c => c.blocks.flatMap((b, bi) => (b.items || []).map((it, i) => ({ key: prepKeyText(date, prepKey(c.id, bi, i)), text: it, card: c })));
  // D-100: w dniu bez diety (08–11.10) tylko wieczorne przygotowanie na jutro (11.10 → 12.10) — a gdy i jutro bez diety (08–10.10), brak kart
  const order = r.noDiet ? (rt.noDiet ? [] : [EVE]) : ORDER;
  const allSteps = order.flatMap(i => SRC.mealprep.phases[i].cards.map(id => byId[id]).filter(Boolean).flatMap(stepsOf));
  // Składniki na jutro (D-074): stan na koniec dnia vs zużycie jutra wg planu — dla produktów używanych w kartach
  const inv = store?.state?.inv;
  const cover = inv ? coverage(inv, SRC.mealprep.cards.filter(c => c.id).flatMap(cardProds), date, tomorrow) : [];
  const known = cover.filter(x => x.stock != null), short = known.filter(x => x.short);
  const shortIds = new Set(short.map(x => x.prod));
  const unitOf = id => catalogById[id]?.unit || '';
  const ringBox = h('div', { class: 'mp-ring' });
  const nextBox = h('div', { class: 'mp-next' });
  const cardBars = {};
  const refresh = () => {
    const n = allSteps.filter(x => state[x.key]).length;
    ringBox.replaceChildren(progressRing(n, allSteps.length, 'Wykonane kroki'), h('span', { class: 'muted' }, `${n} / ${allSteps.length} kroków`));
    const nx = allSteps.find(x => !state[x.key]);
    document.querySelectorAll('.prep-card.is-next').forEach(el => el.classList.remove('is-next'));
    if (nx) document.getElementById(`mp-${nx.card.id}`)?.classList.add('is-next');
    nextBox.replaceChildren(nx
      ? h('div', {}, h('p', { class: 'eyebrow' }, `Następny krok · ${nx.card.title}${nx.card.time ? ` · ${nx.card.time}` : ''}`),
          h('p', { class: 'mp-next-t' }, textOf(nx.card, nx.text)), h('a', { class: 'btn', href: `#mp-${nx.card.id}` }, 'Przejdź do karty'))
      : h('p', { class: 'mp-next-t' }, `✓ Wszystkie kroki ${date === today ? 'na dziś' : 'tego dnia'} wykonane`));
    for (const [id, el] of Object.entries(cardBars)) {
      const st = stepsOf(byId[id]), k = st.filter(x => state[x.key]).length;
      el.fill.style.width = `${st.length ? (k / st.length) * 100 : 0}%`;
      el.text.textContent = `${k}/${st.length}`;
      el.card.classList.toggle('is-complete', st.length > 0 && k === st.length);
    }
  };
  const toggle = async (card, idx, value) => {
    if (!store) return;
    const key = `${date}|${card}|${idx}`;
    state[key] = value; refresh();
    try { await store.record('prep.step', { date, card, idx, done: value }); }
    catch (e) { state[key] = !value; refresh(); clear(msg).append(h('div', { class: 'banner err' }, e.message)); }
  };

  // D-114 etap 2: tryb gotowania — krok po kroku (ten sam zapis `prep.step`), minutnik przy kroku z czasem, ekran nie gaśnie
  if (ctx.params.get('v') === 'fokus') return prepFocus();
  function prepFocus() {
    const exit = `#/mealprep${date === today ? '' : `?d=${date}`}`;
    const steps = order.flatMap(pi => SRC.mealprep.phases[pi].cards.map(id => byId[id]).filter(Boolean).flatMap(c => c.blocks.flatMap((b, bi) =>
      (b.items || []).map((it, i) => { const pk = prepKey(c.id, bi, i); return { pk, key: prepKeyText(date, pk), it, card: c, phase: SRC.mealprep.phases[pi].title }; }))));
    const wrap = h('div', { class: 'fx', style: { '--dc': 'var(--prep)' } });
    add(root, wrap);
    if (!steps.length) {
      add(wrap, focusTop({ exit, title: 'Gotowanie' }), h('p', { class: 'fx-msg' }, 'Brak kroków przygotowania tego dnia.'), h('a', { class: 'btn primary fx-wide', href: exit }, 'Wróć do Meal Prep'));
      return;
    }
    const isDone = x => !!state[x.key];
    if (!prepPos || prepPos.date !== date || !steps.some(x => x.key === prepPos.key)) prepPos = { date, key: (steps.find(x => !isDone(x)) || steps[steps.length - 1]).key };
    const cur = steps.find(x => x.key === prepPos.key), i = steps.indexOf(cur), k = steps.filter(isDone).length;
    const go = d => { const n = steps[i + d]; if (!n) return; prepPos = { date, key: n.key }; ctx.rerender(); };
    const save = async v => {
      if (!store) return;
      try { await store.record('prep.step', { date, card: cur.pk.card, idx: cur.pk.idx, done: v }); } catch (e) { ctx.flash(e.message || String(e)); return false; }
      return true;
    };
    const complete = async () => {
      sfx('check');
      if (!(await save(true))) return;
      const n = steps.find(x => !store.state.prep[x.key]);
      if (n) prepPos = { date, key: n.key }; else sfx('done');
      ctx.rerender();
    };
    const undo = async () => { if (await save(false)) ctx.rerender(); };
    const groups = [];
    for (const x of steps) { const g = groups[groups.length - 1]; if (g && g.card === x.card) g.items.push(x); else groups.push({ card: x.card, items: [x] }); }
    const mins = timerMin(cur.it);
    const card = h('section', { class: `fx-set${isDone(cur) ? ' is-done' : ''}`, 'aria-labelledby': 'fx-set-h' },
      h('div', { class: 'fx-set-h' },
        h('button', { class: 'fx-nav', 'aria-label': 'Poprzedni krok', disabled: i === 0 || null, onclick: () => go(-1) }, icon('chevron-left', { size: 22 })),
        h('h3', { id: 'fx-set-h' }, `Krok ${i + 1} z ${steps.length}`, isDone(cur) && h('span', { class: 'fx-tag' }, icon('check', { size: 14 }), 'wykonany')),
        h('button', { class: 'fx-nav', 'aria-label': 'Następny krok', disabled: i === steps.length - 1 || null, onclick: () => go(1) }, icon('chevron-right', { size: 22 }))),
      h('div', { class: 'fx-ex fx-study' },
        h('p', { class: 'fx-k' }, `${cur.phase} · ${cur.card.title}${cur.card.time ? ` · ${cur.card.time}` : ''}`),
        h('h2', { class: 'fx-name fx-step-t' }, textOf(cur.card, cur.it))),
      isDone(cur)
        ? h('button', { class: 'fx-undo', onclick: undo }, icon('undo-2', { size: 18 }), h('span', {}, 'Cofnij — krok niewykonany'))
        : h('button', { class: 'primary fx-go', onclick: complete }, icon('check', { size: 22 }), h('span', {}, 'Krok wykonany')));
    swipeRow(card, isDone(cur) ? { left: { label: 'Cofnij', ic: 'undo-2', tone: 'neutral', run: undo } } : { right: { label: 'Krok wykonany', ic: 'check', run: complete } });
    const n2 = steps[i + 1];
    add(wrap,
      focusTop({ exit, title: 'Gotowanie', sub: `${dayShort(date)} ${shortDate(date)} · ${k} / ${steps.length} kroków` }),
      focusScale(groups.map(g => g.items.map(x => ({ done: isDone(x), cur: x === cur }))), `Kroki: ${k} z ${steps.length} wykonanych`),
      mins && !isDone(cur) && focusTimer(`mp|${cur.key}`, mins, cur.card.title, ctx.flash),
      card,
      n2 && h('p', { class: 'fx-next' }, h('span', { class: 'fx-l' }, 'Następnie'), `${n2.card.title} · ${textOf(n2.card, n2.it)}`));
    focusKeys(wrap, { exit, primary: isDone(cur) ? null : complete, nav: go });
  }

  add(root, msg,
    h('section', { class: 'hero-tr' },
      h('div', { class: 'hero-tr-main' },
        h('p', { class: 'eyebrow' }, `${longDate(date)} · Faza ${phase} · ${dietLabel(variant)}`),
        h('h1', {}, 'Meal Prep'),
        h('p', { class: 'muted' }, `Ilości wyliczone z jadłospisu na ${date === today ? 'dziś' : `${dayShort(date)} ${shortDate(date)}`}; karty wieczorne (21:45–21:55) — z jadłospisu na jutro.`),
        h('div', { class: 'row daynav mp-daynav' },
          date > PLAN_START && h('a', { class: 'btn dz-nav', href: `#/mealprep?d=${addDays(date, -1)}`, 'aria-label': 'Poprzedni dzień' }, icon('chevron-left', { size: 18 }), h('span', {}, 'Poprzedni dzień')),
          date !== today && h('a', { class: 'btn dz-nav', href: '#/mealprep' }, 'Dziś'),
          h('a', { class: 'btn dz-nav', href: `#/mealprep?d=${tomorrow}`, 'aria-label': 'Następny dzień' }, h('span', {}, 'Następny dzień'), icon('chevron-right', { size: 18 }))),
        allSteps.length > 0 && h('a', { class: 'btn primary mp-focus', href: `#/mealprep?v=fokus${date === today ? '' : `&d=${date}`}` }, icon('focus', { size: 18 }), h('span', {}, 'Tryb gotowania'))),
      h('div', { class: 'hero-tr-side' }, ringBox),
      h('div', { class: 'hero-tr-map' }, nextBox)),
    h('nav', { class: 'mp-jump', 'aria-label': 'Fazy dnia' }, order.map(i => h('a', { class: 'chip-b', href: `#mp-ph-${i}` }, SRC.mealprep.phases[i].title))),
    inv && h('section', { class: `mp-stock${short.length ? ' has-short' : ''}`, 'aria-labelledby': 'mp-stock-h' },
      h('div', { class: 'mp-stock-h' }, h('h2', { id: 'mp-stock-h' }, icon('package-check', { size: 18 }), 'Składniki na jutro'),
        h('span', { class: 'muted' }, `${dayShort(tomorrow)} ${shortDate(tomorrow)} · Faza ${rt.phase ?? 0} · ${dietLabel(rt.dietVariant)}`)),
      !known.length ? h('p', { class: 'muted' }, 'Brak stanów składników — ustaw je w module Zapasy.')
        : short.length === 0 ? h('p', { class: 'mp-ok' }, icon('circle-check', { size: 16 }), `Wszystkie ${known.length} ${plural(known.length, 'składnik karty wystarczy', 'składniki kart wystarczą', 'składników kart wystarczy')} na jutro.`)
        : [h('ul', { class: 'mp-short-list' }, short.map(x => h('li', {},
            h('span', {}, catalogById[x.prod].name),
            h('span', { class: 'muted' }, `potrzeba ${fmt(x.need, 1)} ${unitOf(x.prod)} · zostanie ${fmt(Math.max(0, x.stock), 1)} ${unitOf(x.prod)}`)))),
          h('p', { class: 'muted' }, `Wystarczy: ${known.length - short.length} z ${known.length} składników.`),
          h('a', { class: 'btn', href: '#/zapasy?s=CRITICAL' }, icon('shopping-cart', { size: 18 }), 'Uzupełnij w Zapasach')]));

  r.noDiet && add(root, h('p', { class: 'panel muted' }, rt.noDiet ? `Dziś i jutro bez diety — dieta od ${longDate(DIET_START)}; bez przygotowania posiłków.` : 'Dziś bez diety — przygotowanie posiłków tylko na jutro (wieczorem).'));
  order.forEach(pi => {
    const ph = SRC.mealprep.phases[pi];
    add(root, h('h2', { class: 'prep-phase', id: `mp-ph-${pi}` }, ph.title),
      pi === EVE && h('p', { class: 'muted mp-eve' }, `Wieczorem ${date === today ? 'dziś' : `${dayShort(date)} ${shortDate(date)}`} — ilości na jutro: ${dayShort(tomorrow)} ${shortDate(tomorrow)} · Faza ${rt.phase ?? 0} · ${dietLabel(rt.dietVariant)}.`));
    for (const id of ph.cards) {
      const c = byId[id];
      if (!c) continue;
      const fill = h('span', { class: 'prog-fill' }), text = h('span', { class: 'mp-count' });
      const card = h('article', { class: 'prep-card', id: `mp-${c.id}` },
        h('div', { class: 'prep-head' }, h('span', { class: 'prep-ico' }, c.icon), h('h3', {}, c.title),
          c.time && h('span', { class: 'chip' }, c.time), text),
        cardProds(c).some(k => shortIds.has(k)) && h('p', { class: 'mp-short' }, icon('triangle-alert', { size: 14 }),
          `Brak na jutro: ${cardProds(c).filter(k => shortIds.has(k)).map(k => catalogById[k].name).join(', ')}`),
        h('span', { class: 'prog-bar mp-bar' }, fill),
        c.blocks.map((b, bi) => {
          if (b.items) {
            return h('ul', { class: `prep-list ${b.type}` }, b.items.map((it, i) => {
              const pk = prepKey(c.id, bi, i), key = prepKeyText(date, pk);
              const mins = timerMin(it);
              return h('li', {},
                h('label', {}, h('input', { type: 'checkbox', checked: !!state[key], disabled: !store,
                  onchange: e => toggle(pk.card, pk.idx, e.target.checked) }), h('span', {}, textOf(c, it))),
                mins ? timerChip(`mp|${key}`, mins, c.title, ctx.flash) : null);
            }));
          }
          return h('p', { class: `prep-note n-${b.type}` }, textOf(c, b.text));
        }));
      cardBars[c.id] = { fill, text, card };
      add(root, card);
    }
  });
  refresh();

  // Tabele: naczynia, urządzenia, testy kalibracyjne, wkłady chłodzące
  const testCell = ri => {
    const id = `test${ri}`;
    const rec = store.state.prepTests[id];
    const save = async pass => {
      try { await store.record('prep.test', { id, date: today, pass }); ctx.flash(`Zapisano wynik testu: ${pass ? 'zdany' : 'niezdany'}.`); ctx.rerender(); }
      catch (e) { clear(msg).append(h('div', { class: 'banner err' }, e.message)); }
    };
    return h('td', {}, h('span', { class: 'row' },
      h('button', { onclick: () => save(true) }, 'Zdany'),
      h('button', { onclick: () => save(false) }, 'Niezdany'),
      rec && h('span', { class: 'muted' }, `${rec.pass ? 'zdany' : 'niezdany'} · ${dayShort(rec.date)} ${shortDate(rec.date)}`)));
  };
  for (const t of SRC.mealprep.tables) {
    const isTest = t.head[0] === 'Test';
    const title = isTest ? 'Testy kalibracyjne' : t.head[0] === 'Wkłady' ? 'Wkłady chłodzące' : `Tabela: ${t.head[0]}`;
    const head = h('tr', {}, t.head.map(x => h('th', {}, x)), isTest && store ? h('th', {}, 'Wynik') : null);
    const body = t.rows.map((row, ri) => h('tr', {}, row.map(cell => h('td', {}, T(cell))), isTest && store ? testCell(ri) : null));
    add(root, h('details', { class: 'panel fold' }, h('summary', {}, h('h2', {}, title)),
      h('div', { class: 'scroll-x' }, h('table', { class: 'data' }, h('thead', {}, head), h('tbody', {}, body)))));
  }

  add(root, h('details', { class: 'panel fold' }, h('summary', {}, h('h2', {}, 'Dlaczego tak')), SRC.mealprep.why.map(w =>
    h('details', { class: 'meal' }, h('summary', {}, h('span', { class: 'meal-n' }, w.title)),
      h('div', { class: 'why-body' }, w.body.map(b => h('p', {}, T(b))))))));
}
