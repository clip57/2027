// Moduł Meal Prep (Etap 4): procedury z MEAL_PREP z ilościami wyliczonymi dla aktywnej fazy i wariantu dnia (D-003),
// progami z D-013, odhaczaniem kroków i zapisem testów kalibracyjnych. Fragmenty z wynikami badań: pakiet prywatny (D-035).
import { h, clear, fmt, add } from '../ui/dom.js';
import { section, progressRing } from '../ui/components.js';
import { SRC, plan, catalogById } from '../core/data.js';
import { resolveDay } from '../core/resolver.js';
import { longDate } from '../core/dates.js';

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

const timerMin = text => { const m = text.match(/(\d+)(?:–(\d+))?\s*min/); return m ? Number(m[2] || m[1]) : null; };

function timer(minutes, label) {
  const out = h('span', { class: 'timer-v' }, `${minutes}:00`);
  let left = minutes * 60, id = null;
  const btn = h('button', { class: 'timer-b', onclick: () => {
    if (id) { clearInterval(id); id = null; btn.textContent = 'Start'; return; }
    btn.textContent = 'Stop';
    id = setInterval(() => {
      left -= 1;
      out.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      if (left <= 0) { clearInterval(id); id = null; btn.textContent = 'Start'; out.textContent = 'gotowe'; }
    }, 1000);
  } }, 'Start');
  return h('span', { class: 'timer', title: label }, out, btn);
}

export function renderMealPrep(root, ctx) {
  const { store, today } = ctx;
  const r = resolveDay(today);
  const phase = r.phase ?? 0, variant = r.dietVariant;
  const pack = store?.state?.privatePack || null;
  const T = t => resolveText(t, phase, variant, pack);
  const msg = h('div', { role: 'status', 'aria-live': 'polite' });
  const done = store?.state?.prep || {};

  // Postęp liczony lokalnie i aktualizowany na bieżąco (bez przeładowania widoku).
  const state = Object.fromEntries(Object.entries(done).filter(([k]) => k.startsWith(`${today}|`)));
  const byId = Object.fromEntries(SRC.mealprep.cards.map(c => [c.id, c]));
  const stepsOf = c => c.blocks.flatMap((b, bi) => (b.items || []).map((it, i) => ({ key: `${today}|${c.id}|${bi * 100 + i}`, text: it, card: c })));
  const allSteps = SRC.mealprep.phases.flatMap(ph => ph.cards.map(id => byId[id]).filter(Boolean).flatMap(stepsOf));
  const ringBox = h('div', { class: 'mp-ring' });
  const nextBox = h('div', { class: 'mp-next' });
  const cardBars = {};
  const refresh = () => {
    const n = allSteps.filter(x => state[x.key]).length;
    ringBox.replaceChildren(progressRing(n, allSteps.length, 'Wykonane kroki'), h('span', { class: 'muted' }, `${n} / ${allSteps.length} kroków`));
    const nx = allSteps.find(x => !state[x.key]);
    nextBox.replaceChildren(nx
      ? h('div', {}, h('p', { class: 'eyebrow' }, `Następny krok · ${nx.card.title}${nx.card.time ? ` · ${nx.card.time}` : ''}`),
          h('p', { class: 'mp-next-t' }, T(nx.text)), h('a', { class: 'btn', href: `#mp-${nx.card.id}` }, 'Przejdź do karty'))
      : h('p', { class: 'mp-next-t' }, '✓ Wszystkie kroki na dziś wykonane'));
    for (const [id, el] of Object.entries(cardBars)) {
      const st = stepsOf(byId[id]), k = st.filter(x => state[x.key]).length;
      el.fill.style.width = `${st.length ? (k / st.length) * 100 : 0}%`;
      el.text.textContent = `${k}/${st.length}`;
      el.card.classList.toggle('is-complete', st.length > 0 && k === st.length);
    }
  };
  const toggle = async (card, idx, value) => {
    if (!store) return;
    const key = `${today}|${card}|${idx}`;
    state[key] = value; refresh();
    try { await store.record('prep.step', { date: today, card, idx, done: value }); }
    catch (e) { state[key] = !value; refresh(); clear(msg).append(h('div', { class: 'banner err' }, e.message)); }
  };

  add(root, msg,
    h('section', { class: 'hero-tr' },
      h('div', { class: 'hero-tr-main' },
        h('p', { class: 'eyebrow' }, `${longDate(today)} · Faza ${phase} · ${variant === 'T' ? 'dzień treningowy' : 'dzień nietreningowy'}`),
        h('h1', {}, 'Meal Prep'),
        h('p', { class: 'muted' }, 'Ilości wyliczone z jadłospisu na dziś.')),
      h('div', { class: 'hero-tr-side' }, ringBox),
      h('div', { class: 'hero-tr-map' }, nextBox)),
    h('nav', { class: 'mp-jump', 'aria-label': 'Fazy dnia' }, SRC.mealprep.phases.map((ph, i) => h('a', { class: 'chip-b', href: `#mp-ph-${i}` }, ph.title))));

  SRC.mealprep.phases.forEach((ph, pi) => {
    add(root, h('h2', { class: 'prep-phase', id: `mp-ph-${pi}` }, ph.title));
    for (const id of ph.cards) {
      const c = byId[id];
      if (!c) continue;
      const fill = h('span', { class: 'prog-fill' }), text = h('span', { class: 'mp-count' });
      const card = h('article', { class: 'prep-card', id: `mp-${c.id}` },
        h('div', { class: 'prep-head' }, h('span', { class: 'prep-ico' }, c.icon), h('h3', {}, c.title),
          c.time && h('span', { class: 'chip' }, c.time), text),
        h('span', { class: 'prog-bar mp-bar' }, fill),
        c.blocks.map((b, bi) => {
          if (b.items) {
            return h('ul', { class: `prep-list ${b.type}` }, b.items.map((it, i) => {
              const key = `${today}|${c.id}|${bi * 100 + i}`;
              const mins = timerMin(it);
              return h('li', {},
                h('label', {}, h('input', { type: 'checkbox', checked: !!state[key], disabled: !store,
                  onchange: e => toggle(c.id, bi * 100 + i, e.target.checked) }), h('span', {}, T(it))),
                mins ? timer(mins, c.title) : null);
            }));
          }
          return h('p', { class: `prep-note n-${b.type}` }, T(b.text));
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
      rec && h('span', { class: 'muted' }, `${rec.pass ? 'zdany' : 'niezdany'} · ${rec.date}`)));
  };
  for (const t of SRC.mealprep.tables) {
    const isTest = t.head[0] === 'Test';
    const title = isTest ? 'Testy kalibracyjne' : t.head[0] === 'Wkłady' ? 'Wkłady chłodzące' : `Tabela: ${t.head[0]}`;
    const head = h('tr', {}, t.head.map(x => h('th', {}, x)), isTest && store ? h('th', {}, 'Wynik') : null);
    const body = t.rows.map((row, ri) => h('tr', {}, row.map(cell => h('td', {}, T(cell))), isTest && store ? testCell(ri) : null));
    add(root, section(`h-t-${t.head[0].slice(0, 6)}`, title,
      h('div', { class: 'scroll-x' }, h('table', { class: 'data' }, h('thead', {}, head), h('tbody', {}, body)))));
  }

  add(root, section('h-why', 'Dlaczego tak', SRC.mealprep.why.map(w =>
    h('details', { class: 'meal' }, h('summary', {}, h('span', { class: 'meal-n' }, w.title)),
      h('div', { class: 'why-body' }, w.body.map(b => h('p', {}, T(b))))))));
}
