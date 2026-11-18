// Tryb skupienia — Trening (D-114, System 4.0 „Instrument”): pełny ekran dla jednej serii naraz — duże cyfry ciężaru i powtórzeń,
// kroki ±, RIR, „Seria wykonana” (albo przesunięcie karty w prawo), automatyczna przerwa i następna seria. Ekran nie gaśnie
// (blokada w app.js na tej trasie), wyjście: ✕ albo Esc.
// Zapisy identyczne jak w widoku sesji: `train.set` { date, ex, set, done, kg, reps, rir } — bieżący stan czytany z magazynu w chwili
// zapisu, zapisy w kolejce. Wartości podpowiadane (poprzednia seria dziś albo ta sama seria z ostatniej sesji) są szare i zapisują się
// dopiero po potwierdzeniu: zmianie wartości albo „Seria wykonana” (jak w aplikacjach treningowych — potwierdzasz to, co widzisz).
import { h, add, fmt, plural, numberOf } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { swipeRow } from '../ui/gestures.js';
import { play } from '../ui/motion.js';
import { sfx, timersChanged } from '../ui/signal.js';
import { restNow, setRest, restLeft, restSignal } from '../ui/live.js';
import { nextSet, sessions } from '../core/calc/training.js';
import { resolveDay } from '../core/resolver.js';
import { SRC } from '../core/data.js';
import { longDate } from '../core/dates.js';

const T = SRC.training;
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const STEP = { kg: 2.5, reps: 1 };
let pos = null;     // { date, ex, set } — wybrana seria (domyślnie pierwsza niewykonana)
let draft = null;   // { key, kg?, reps? } — wartości z kroków ±, zapisywane po chwili bez dotknięcia (jedno zdarzenie zamiast kilku)
let draftTimer = null;

export function renderFocus(root, ctx, kit) {
  const { store, today } = ctx;
  const date = ctx.params.get('d') || today;
  const r = resolveDay(date), phase = r.phase ?? 0;
  const plan = (T.days[r.session] || []).map(e => ({ e, n: e.series[String(phase)] || 0 })).filter(x => x.n > 0);
  const exit = `#/trening?d=${date}`;
  const close = h('a', { class: 'fx-x', href: exit, 'aria-label': 'Zakończ tryb skupienia', onclick: () => flush() }, icon('x', { size: 22 }));
  if (!plan.length) {
    add(root, h('div', { class: 'fx fx-empty' }, h('header', { class: 'fx-top' }, close, h('div', { class: 'fx-title' }, h('h1', {}, 'Tryb skupienia'))),
      h('p', { class: 'fx-msg' }, `${r.dayName}, ${longDate(date)}: ${r.sessionLabel} — brak serii do wykonania w trybie skupienia.`),
      h('a', { class: 'btn primary fx-wide', href: exit }, 'Wróć do treningu')));
    return;
  }
  const log = () => store?.state?.train || {};
  const keyOf = (e, s) => `${date}|${e.id}|${s}`;
  const flat = plan.flatMap((x, xi) => [...Array(x.n)].map((_, i) => ({ e: x.e, set: i + 1, of: x.n, xi })));
  // Zapisy w kolejce; bieżący stan serii z magazynu w chwili zapisu (jak saveNow w trening.js)
  let queue = Promise.resolve();
  const save = (e, set, patch) => (queue = queue.then(async () => {
    if (!store) return;
    const cur = store.state.train[keyOf(e, set)] || { done: false, kg: null, reps: null, rir: null };
    try { await store.record('train.set', { date, ex: e.id, set, done: cur.done, kg: cur.kg ?? null, reps: cur.reps ?? null, rir: cur.rir ?? null, ...patch }); }
    catch (err) { ctx.flash(err.message || String(err)); throw err; }
  }));
  function flush() {
    clearTimeout(draftTimer); draftTimer = null;
    const d = draft; draft = null;
    if (!d) return queue;
    const x = flat.find(f => keyOf(f.e, f.set) === d.key);
    const patch = {};
    if ('kg' in d) patch.kg = d.kg;
    if ('reps' in d) patch.reps = d.reps;
    return x && Object.keys(patch).length ? save(x.e, x.set, patch) : queue;
  }
  // wybrana seria: zapamiętana (ten sam dzień) albo pierwsza niewykonana; po ukończeniu sesji — ekran podsumowania
  const nx = nextSet(plan, log(), date);
  if (!pos || pos.date !== date || !flat.some(f => f.e.id === pos.ex && f.set === pos.set)) pos = nx ? { date, ex: nx.e.id, set: nx.set } : null;
  const doneN = flat.filter(f => log()[keyOf(f.e, f.set)]?.done).length;
  const head = h('header', { class: 'fx-top' }, close,
    h('div', { class: 'fx-title' }, h('h1', {}, r.sessionLabel), h('span', { class: 'fx-sub' }, `${doneN} / ${flat.length} ${plural(flat.length, 'seria', 'serie', 'serii')} · ${Math.round((doneN / flat.length) * 100)}%`)),
    pos && h('button', { class: 'fx-tech', 'aria-label': `Technika i mięśnie: ${flat.find(f => f.e.id === pos.ex).e.name}`, onclick: () => kit.techniqueDialog(flat.find(f => f.e.id === pos.ex).e.name) }, icon('info', { size: 22 })));
  // podziałka sesji: jedna kreska na serię, ćwiczenia rozdzielone odstępem
  const scale = h('div', { class: 'fx-scale', role: 'img', 'aria-label': `Postęp sesji: ${doneN} z ${flat.length} serii` },
    plan.map((x, xi) => h('span', { class: 'fx-sc-g' }, flat.filter(f => f.xi === xi).map(f =>
      h('span', { class: `fx-sc${log()[keyOf(f.e, f.set)]?.done ? ' is-done' : ''}${pos && f.e.id === pos.ex && f.set === pos.set ? ' is-cur' : ''}` })))));
  const root2 = h('div', { class: 'fx', style: { '--dc': 'var(--train)' } }, head, scale);
  add(root, root2);

  if (!pos) {   // sesja ukończona
    const day = Object.fromEntries(Object.entries(log()).filter(([k]) => k.startsWith(`${date}|`)));
    const s = sessions(day, store?.state?.trainSessions?.[date] ? { [date]: store.state.trainSessions[date] } : {}).find(x => x.date === date);
    add(root2, h('section', { class: 'fx-done-all' },
      h('span', { class: 'fx-trophy' }, icon('trophy', { size: 40 })),
      h('h2', {}, 'Sesja ukończona'),
      s && h('p', { class: 'fx-sum' }, `${s.sets} ${plural(s.sets, 'seria', 'serie', 'serii')} · ${fmt(Math.round(s.volume))} kg objętości · ${fmt(s.reps)} powt.`),
      h('a', { class: 'btn primary fx-wide', href: exit }, 'Zakończ')));
    keys(root2, exit, null);
    return;
  }

  const cur = flat.find(f => f.e.id === pos.ex && f.set === pos.set), e = cur.e, key = keyOf(e, cur.set);
  const v = log()[key] || {};
  const sp = kit.spec(e);
  // podpowiedź: poprzednia seria dziś, potem ta sama seria z ostatniej sesji, potem jej ostatnia seria
  const prevToday = cur.set > 1 ? log()[keyOf(e, cur.set - 1)] : null;
  const last = kit.lastResult(log(), e.id, date);
  const lastSame = last?.sets.find(x => x.set === cur.set) || last?.sets[last.sets.length - 1] || null;
  const sugg = f => (prevToday?.[f] ?? null) ?? (lastSame?.[f] ?? null);
  const val = f => (draft?.key === key && f in draft ? draft[f] : v[f] ?? null);
  const shown = f => val(f) ?? sugg(f);

  const inputs = {};   // pola ciężaru i powtórzeń — „Seria wykonana” zatwierdza wartości widoczne w polach (wpisane, z kroków albo podpowiedź)
  const num = (f, label) => {
    const input = inputs[f] = h('input', { class: `fx-in${val(f) == null && sugg(f) != null ? ' is-sugg' : ''}`, type: 'text', inputmode: 'decimal', autocomplete: 'off',
      'aria-label': `${e.name}, seria ${cur.set}: ${label}`, value: shown(f) == null ? '' : fmt(shown(f), 1), placeholder: '—',
      onfocus: ev => ev.target.select(),
      onchange: ev => {
        const x = numberOf(ev.target);
        if (Number.isNaN(x)) { ev.target.value = shown(f) == null ? '' : fmt(shown(f), 1); ctx.flash('Nie odczytano liczby — wpisz ją jeszcze raz (np. 62,5).'); return; }
        if (draft?.key === key) delete draft[f];
        save(e, cur.set, { [f]: x == null ? null : f === 'reps' ? Math.round(x) : x }).then(() => ctx.rerender(), () => {});
      } });
    const step = d => {
      const base = shown(f) ?? 0, next = Math.max(0, Math.round((base + d * STEP[f]) * 10) / 10);
      draft = draft?.key === key ? draft : { key };
      draft[f] = f === 'reps' ? Math.round(next) : next;
      input.value = fmt(draft[f], 1); input.classList.remove('is-sugg'); play(input, 'flip', 400);
      clearTimeout(draftTimer); draftTimer = setTimeout(() => { flush(); }, 900);
    };
    return h('div', { class: 'fx-num' }, h('span', { class: 'fx-l' }, label),
      h('div', { class: 'fx-row' },
        h('button', { class: 'fx-step', 'aria-label': `${label}: mniej`, onclick: () => step(-1) }, icon('minus', { size: 22 })),
        input,
        h('button', { class: 'fx-step', 'aria-label': `${label}: więcej`, onclick: () => step(1) }, icon('plus', { size: 22 }))));
  };
  const rir = h('div', { class: 'fx-rir', role: 'group', 'aria-label': `RIR (plan ${sp.rir})` },
    h('span', { class: 'fx-l' }, `RIR · plan ${sp.rir}`),
    h('div', { class: 'fx-rir-b' }, [0, 1, 2, 3, 4].map(n => h('button', { class: 'fx-chip', 'aria-pressed': String(v.rir === n), 'aria-label': `RIR ${n}`,
      onclick: () => save(e, cur.set, { rir: v.rir === n ? null : n }).then(() => ctx.rerender(), () => {}) }, String(n)))));

  const complete = async () => {
    const patch = { done: true };
    for (const f of ['kg', 'reps']) {   // pole puste — bez zmiany zapisanej wartości; nieczytelne (NaN) — pomijane
      const x = numberOf(inputs[f]);
      if (x != null && Number.isFinite(x) && x !== v[f]) patch[f] = f === 'reps' ? Math.round(x) : x;
    }
    if (draft?.key === key) { clearTimeout(draftTimer); draftTimer = null; draft = null; }
    sfx('check');
    try { await save(e, cur.set, patch); } catch { return; }
    const after = nextSet(plan, log(), date);
    if (date === ctx.today) kit.startRest(e, cur.set, cur.of, date, after); else setRest(null);
    pos = after ? { date, ex: after.e.id, set: after.set } : null;
    if (!after) sfx('done');
    ctx.rerender();
  };
  const undo = async () => {
    try { await save(e, cur.set, { done: false }); } catch { return; }
    if (restNow()?.key === key) setRest(null);
    ctx.rerender();
  };
  const go = d => { const i = flat.indexOf(cur) + d; if (i < 0 || i >= flat.length) return; flush(); pos = { date, ex: flat[i].e.id, set: flat[i].set }; ctx.rerender(); };

  const card = h('section', { class: `fx-set${v.done ? ' is-done' : ''}`, 'aria-labelledby': 'fx-set-h' },
    h('div', { class: 'fx-set-h' },
      h('button', { class: 'fx-nav', 'aria-label': 'Poprzednia seria', disabled: flat.indexOf(cur) === 0 || null, onclick: () => go(-1) }, icon('chevron-left', { size: 22 })),
      h('h3', { id: 'fx-set-h' }, `Seria ${cur.set} z ${cur.of}`, v.done && h('span', { class: 'fx-tag' }, icon('check', { size: 14 }), 'wykonana')),
      h('button', { class: 'fx-nav', 'aria-label': 'Następna seria', disabled: flat.indexOf(cur) === flat.length - 1 || null, onclick: () => go(1) }, icon('chevron-right', { size: 22 }))),
    h('div', { class: 'fx-nums' }, num('kg', 'Ciężar · kg'), num('reps', 'Powtórzenia')),
    rir,
    (lastSame || prevToday) && h('p', { class: 'fx-last' },
      prevToday?.kg != null || prevToday?.reps != null ? `Seria ${cur.set - 1} dziś: ${prevToday.kg ?? '–'} kg × ${prevToday.reps ?? '–'}` : '',
      prevToday && lastSame ? ' · ' : '',
      lastSame ? `ostatnio (${last.date.slice(8)}.${last.date.slice(5, 7)}): ${lastSame.kg ?? '–'} kg × ${lastSame.reps ?? '–'}` : ''),
    v.done
      ? h('button', { class: 'fx-undo', onclick: undo }, icon('undo-2', { size: 18 }), h('span', {}, 'Cofnij — seria niewykonana'))
      : h('button', { class: 'primary fx-go', onclick: complete }, icon('check', { size: 22 }), h('span', {}, 'Seria wykonana')));
  swipeRow(card, v.done ? { left: { label: 'Cofnij', ic: 'undo-2', tone: 'neutral', run: undo } } : { right: { label: 'Seria wykonana', ic: 'check', run: complete } });

  const exIdx = plan.findIndex(x => x.e === e);
  add(root2,
    h('section', { class: 'fx-ex' },
      h('p', { class: 'fx-k' }, `Ćwiczenie ${exIdx + 1} z ${plan.length}`),
      h('h2', { class: 'fx-name' }, e.name),
      T.info[e.name]?.en && h('p', { class: 'fx-en' }, T.info[e.name].en),
      h('p', { class: 'fx-plan' }, `plan: ${sp.reps} powt. · RIR ${sp.rir} · przerwa ${sp.rest}`)),
    restGauge(date),
    card,
    (() => { const n2 = flat[flat.indexOf(cur) + 1]; return n2 && h('p', { class: 'fx-next' }, h('span', { class: 'fx-l' }, 'Następnie'), `${n2.e.name} · seria ${n2.set} z ${n2.of}`); })());
  keys(root2, exit, v.done ? null : complete, go);
}

// Przerwa w trybie skupienia: pierścień odliczania, +30 s, Pomiń — ten sam stan co pasek przerwy i pigułka (ui/live.js)
function restGauge(date) {
  const rest = restNow();
  if (!rest || rest.date !== date) return null;
  const NS = 'http://www.w3.org/2000/svg', R = 54, L = 2 * Math.PI * R;
  const ring = document.createElementNS(NS, 'svg');
  ring.setAttribute('viewBox', '0 0 128 128'); ring.setAttribute('class', 'fx-ring'); ring.setAttribute('aria-hidden', 'true');
  const bg = document.createElementNS(NS, 'circle'), fg = document.createElementNS(NS, 'circle');
  for (const [c, cls] of /** @type {[SVGCircleElement, string][]} */ ([[bg, 'fx-ring-bg'], [fg, 'fx-ring-fg']])) { c.setAttribute('cx', '64'); c.setAttribute('cy', '64'); c.setAttribute('r', String(R)); c.setAttribute('class', cls); }
  fg.setAttribute('transform', 'rotate(-90 64 64)'); fg.setAttribute('stroke-dasharray', `${L} ${L}`);
  ring.append(bg, fg);
  const t = h('strong', { class: 'fx-rest-t' }), note = h('span', { class: 'fx-rest-n' }), planL = h('span', { class: 'fx-rest-p' }, `plan ${rest.label}`);
  const live = h('span', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const box = h('section', { class: 'fx-rest', 'aria-label': 'Przerwa między seriami' },
    h('div', { class: 'fx-rest-dial' }, ring, h('div', { class: 'fx-rest-read' }, note, t, planL)),
    h('div', { class: 'fx-rest-act' },
      h('button', { 'aria-label': 'Wydłuż przerwę o 30 s', onclick: () => { const x = restNow(); if (!x) return; x.min += 30; x.max += 30; x.signaled = false; timersChanged(); tick(); } }, '+30 s'),
      h('button', { 'aria-label': 'Pomiń przerwę', onclick: () => { setRest(null); box.remove(); } }, icon('skip-forward', { size: 18 }), h('span', {}, 'Pomiń'))),
    live);
  let announced = false;
  function tick() {
    const x = restNow();
    if (!x || x.date !== date) { box.remove(); return false; }
    const left = restLeft(x), el = x.min - left;
    t.textContent = left > 0 ? mmss(Math.ceil(left)) : `+${mmss(-left)}`;
    note.textContent = left > 0 ? 'Przerwa' : 'Możesz zaczynać'; planL.textContent = `plan ${x.label}`;
    fg.setAttribute('stroke-dashoffset', String(Math.min(L, Math.max(0, (el / x.min) * L))));
    box.classList.toggle('is-ready', left <= 0);
    if (left <= 0 && !announced) { announced = true; live.textContent = 'Przerwa zakończona.'; restSignal(); }
    return true;
  }
  tick();
  const id = setInterval(() => { if (!box.isConnected || !tick()) clearInterval(id); }, 1000);
  return box;
}

// Klawiatura (komputer): Esc — wyjście, Enter — seria wykonana (poza polami), ← → — poprzednia / następna seria
function keys(root, exit, complete, go = null) {
  const on = ev => {
    if (!root.isConnected) { document.removeEventListener('keydown', on); return; }
    if (document.querySelector('dialog[open]')) return;
    const inField = ev.target.closest?.('input, textarea, select');
    if (ev.key === 'Escape') { ev.preventDefault(); location.hash = exit; }
    else if (!inField && ev.key === 'Enter' && complete && !ev.target.closest?.('button, a')) { ev.preventDefault(); complete(); }
    else if (!inField && go && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) { ev.preventDefault(); go(ev.key === 'ArrowLeft' ? -1 : 1); }
  };
  document.addEventListener('keydown', on);
}
