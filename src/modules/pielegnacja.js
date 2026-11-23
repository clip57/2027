// Moduł Pielęgnacja (D-094): codzienna pielęgnacja skóry i włosów — co, kiedy, czym, jak często, czy wykonane, jakie produkty
// są w użyciu. Plan (kroki, produkty) pochodzi WYŁĄCZNIE z danych użytkownika: import pliku `2027-pielegnacja.json` w module Dane
// albo edycja tutaj (zdarzenia `care.def`); odhaczenia — `care.done`. W repozytorium nie ma treści planu (D-035).
// Widoki: Dzień (lista kontrolna wg pór, licznik „odczekaj”), Tydzień, Produkty, Plan (edycja, eksport).
import { h, clear, add, plural } from '../ui/dom.js';
import { checkInput } from '../ui/check.js';
import { segmented, sheet } from '../ui/components.js';
import { segRing } from '../ui/rings.js';
import { focusTop, focusScale, focusTimer, focusKeys } from '../ui/focus.js';
import { swipeRow } from '../ui/gestures.js';
import { signal, unlockAudio, timersChanged, sfx, startCountdown, countdown } from '../ui/signal.js';
import { icon } from '../ui/icons.js';
import { region } from '../ui/patch.js';
import { SRC } from '../core/data.js';
import { inPlan, PLAN_START, PLAN_END, templateFor } from '../core/resolver.js';
import { addDays, longDate, shortDate, dayShort, weekday, range, diffDays } from '../core/dates.js';
import { careModel, stepsFor, progress, byPora, isDone, ruleText, productUse, weekGrid, slotOptions, slotDefs, PORY, AREAS, STATUS, DAY_SHORT } from '../core/calc/care.js';

const VIEWS = [{ value: 'dzien', label: 'Dzień' }, { value: 'tydzien', label: 'Tydzień' }, { value: 'produkty', label: 'Produkty' }, { value: 'plan', label: 'Plan' }];
const STATUS_LABEL = Object.fromEntries(STATUS);
// Sloty planu dnia, do których można przypiąć krok (postęp widoczny w „Dziś”): szablon, warianty dnia i układ dni z blokiem M — każdy raz,
// z dniami wyliczonymi z kalendarza planu (B9); lista liczona przy pierwszym użyciu
const SLOT_DEFS = slotDefs(SRC.dayTemplate);
let slotList = null;
const SLOTS = () => (slotList ||= slotOptions([...range(PLAN_START, PLAN_END)], templateFor, SLOT_DEFS));
const slotLabel = id => SLOTS().find(x => x[0] === id)?.[1] || (d => (d ? `${d.from} · ${d.title_src} (nie występuje w planie)` : id))(SLOT_DEFS.find(x => x.id === id));

// Licznik „odczekaj N min” — stan wyłącznie interfejsu (jak przerwa w Treningu, D-068): nie trafia do dziennika ani synchronizacji
let timer = null;   // { label, start, sec }
let rpos = null;    // tryb rutyny: { date, pora, id } — bieżący krok

/** @param {HTMLElement} root @param {import('../core/types').Ctx} ctx */
export function renderPielegnacja(root, ctx) {
  const { store, today } = ctx;
  const view = ctx.params.get('v') || 'dzien';
  const date = ctx.params.get('d') || today;
  const go = o => { const p = new URLSearchParams({ v: view, ...Object.fromEntries(ctx.params), ...o }); location.hash = `#/pielegnacja?${p}`; };
  const msg = h('div', { role: 'status', 'aria-live': 'polite' });
  const err = e => clear(msg).append(h('div', { class: 'banner err' }, e.message || String(e)));
  if (!store) { add(root, h('h1', {}, 'Pielęgnacja'), h('div', { class: 'banner err' }, 'Baza danych jest niedostępna.')); return; }
  // Stan pochodny — zmienne przeliczane po zapisie (P2: punktowe odświeżanie)
  /** @type {any} */ let model;
  let done;
  const derive = () => { model = careModel(store.state.careDefs || []); done = store.state.careDone || {}; };
  derive();
  if (view === 'fokus' && !model.empty) return routineView();

  add(root, h('header', { class: 'pg-head' }, h('h1', {}, 'Pielęgnacja'),
    h('div', { class: 'topline' },
      !model.empty && h('span', { class: 'chip' }, `${model.steps.length} ${plural(model.steps.length, 'krok', 'kroki', 'kroków')} · ${model.products.length} ${plural(model.products.length, 'produkt', 'produkty', 'produktów')}`))),
  msg, h('div', { class: 'controls' }, segmented('Widok', VIEWS, view, v => go({ v }))));

  // Licznik odczekania: pasek u dołu ekranu (jak przerwa w Treningu); „Pomiń” zamyka
  // D-114: pasek odliczania widoczny → pigułka „na żywo” się chowa (timersChanged odświeża jej widoczność)
  function startTimer(s) { unlockAudio(); timer = { label: s.text, start: Date.now(), sec: s.wait * 60 }; timerBox.refresh(); timersChanged(); }
  const timerBox = region(() => {
    if (!timer) return null;
    const time = h('strong', { class: 'pg-timer-t' }), fill = h('span', { class: 'pg-timer-fill' });
    const live = h('span', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    let announced = false;
    const bar = h('section', { class: 'pg-timer', 'aria-label': 'Odczekaj przed kolejnym krokiem' },
      h('span', { class: 'pg-timer-ic' }, icon('timer', { size: 20 })),
      h('div', { class: 'pg-timer-main' }, h('span', { class: 'pg-timer-n' }, `Odczekaj · ${timer.label}`), time,
        h('span', { class: 'pg-timer-bar', role: 'presentation' }, fill)),
      h('button', { 'aria-label': 'Zamknij licznik', onclick: () => { timer = null; timerBox.refresh(); timersChanged(); } }, icon('x', { size: 18 }), h('span', {}, 'Zamknij')),
      live);
    const tick = () => {
      if (!timer) return;
      const el = (Date.now() - timer.start) / 1000, left = Math.max(0, timer.sec - el);
      const sec = Math.ceil(left);
      time.textContent = left > 0 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : 'Gotowe';
      fill.style.width = `${Math.min(100, (el / timer.sec) * 100)}%`;
      bar.classList.toggle('is-ready', left <= 0);
      if (left <= 0 && !announced) { announced = true; live.textContent = `Czas minął. Możesz przejść do kolejnego kroku po: ${timer.label}.`; if (!timer.signaled) { timer.signaled = true; if (timer.sec - el > -5) signal(); } }
    };
    tick();
    const id = setInterval(() => (bar.isConnected && timer ? tick() : clearInterval(id)), 1000);
    return bar;
  });

  // Pomocnicze okien edycji — przed wyborem widoku (widok kończy funkcję; stałe po `return` nie byłyby zainicjalizowane)
  const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';
  const newId = (p, name) => `${p}.${slug(name)}-${Date.now().toString(36)}`;
  const field = (label, el) => h('label', { class: 'field' }, h('span', {}, label), el);
  const opts = (list, cur) => list.map(([v, l]) => h('option', { value: v, selected: v === (cur ?? '') || null }, l));

  if (model.empty && view !== 'plan') { add(root, emptyState()); return; }
  if (view === 'tydzien') return weekView();
  if (view === 'produkty') return productsView();
  if (view === 'plan') return planView();
  return dayView();

  function emptyState() {
    return h('section', { class: 'panel pg-empty' },
      h('h2', {}, icon('sparkles', { size: 20 }), 'Brak planu pielęgnacji'),
      h('p', {}, 'Plan (kroki i produkty) jest przechowywany wyłącznie w Twoich danych na urządzeniu i w synchronizacji — nie ma go w kodzie aplikacji. Zaimportuj plik planu pielęgnacji w module Dane albo dodaj kroki ręcznie w widoku Plan.'),
      h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/dane' }, icon('folder-open', { size: 18 }), h('span', {}, 'Importuj w module Dane')),
        h('a', { class: 'btn', href: '#/pielegnacja?v=plan' }, icon('plus', { size: 18 }), h('span', {}, 'Dodaj kroki ręcznie'))));
  }

  // ---------------- Dzień: lista kontrolna wg pór dnia
  function dayView() {
    const nav = h('div', { class: 'row daynav' },
      date > PLAN_START && h('a', { class: 'btn dz-nav', href: `#/pielegnacja?d=${addDays(date, -1)}`, 'aria-label': 'Poprzedni dzień' }, icon('chevron-left', { size: 18 }), h('span', {}, 'Poprzedni dzień')),
      date !== today && h('a', { class: 'btn dz-nav', href: '#/pielegnacja' }, 'Dziś'),
      h('a', { class: 'btn dz-nav', href: `#/pielegnacja?d=${addDays(date, 1)}`, 'aria-label': 'Następny dzień' }, h('span', {}, 'Następny dzień'), icon('chevron-right', { size: 18 })));
    if (!inPlan(date)) { add(root, nav, h('p', { class: 'panel pg-outside' }, date > PLAN_END ? `Poza planem — plan zakończył się ${longDate(PLAN_END)}.` : `Poza planem — plan zaczyna się ${longDate(PLAN_START)}.`)); return; }
    const list = stepsFor(model, date);
    const poras = byPora(list);
    // D-119 (Instrument+): przyrząd — trzy pierścienie pór (łuk = krok wymagany, wypełniony = wykonany); bieżąca pora wg godziny (dziś)
    const hr = new Date().getHours();
    const curPora = date !== today ? null : hr < 12 ? 'rano' : hr < 18 ? 'dzien' : 'wieczor';
    const req = x => x.steps.filter(st => !st.asNeeded);
    const hero = region(() => {
      const p = progress(list, done, date);
      const next = poras.find(x => progress(x.steps, done, date).done < progress(x.steps, done, date).total);
      const left = next ? progress(next.steps, done, date).total - progress(next.steps, done, date).done : 0;
      return h('section', { class: 'pg-hero', 'aria-labelledby': 'pg-hero-h' },
        h('div', { class: 'pg-hero-top' },
          h('div', {},
            h('p', { class: 'eyebrow', id: 'pg-hero-h' }, `${dayShort(date)} ${longDate(date)}${date === today ? ' · dziś' : ''}`),
            h('p', { class: 'pg-hero-t' }, p.total ? `${p.done} z ${p.total} ${plural(p.total, 'kroku', 'kroków', 'kroków')} wykonanych` : 'Brak kroków tego dnia'),
            h('p', { class: 'muted' }, next ? `Następna pora: ${next.label} — ${left} do wykonania` : p.total ? 'Wszystkie kroki tego dnia wykonane' : '')),
          next && h('a', { class: 'btn primary pg-start', href: `#/pielegnacja?v=fokus&d=${date}&p=${next.id}` }, icon('play', { size: 18 }),
            h('span', {}, `Rozpocznij rutynę: ${next.label.toLowerCase()}`))),
        h('nav', { class: 'pg-rings', 'aria-label': 'Pory dnia' }, poras.map(x => {
          const pr = progress(x.steps, done, date), st = req(x);
          return h('a', { class: `pg-ring${x.id === curPora ? ' is-now' : ''}${pr.total && pr.done === pr.total ? ' is-done' : ''}`, href: `#pg-${x.id}`,
            'aria-label': `${x.label}: ${pr.done} z ${pr.total} kroków`,
            onclick: e => { e.preventDefault(); document.getElementById(`pg-${x.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); } },
            h('span', { class: 'pg-ring-d' },
              segRing(st.length ? st.map(sx => ({ v: isDone(done, date, sx.id) ? 1 : 0, tone: isDone(done, date, sx.id) ? 'done' : x.id === curPora ? 'next' : 'todo' })) : [{ v: 0 }],
                { size: 76, stroke: 7, gap: 5, label: '' }),
              h('span', { class: 'pg-ring-c' }, icon(x.icon, { size: 18 }))),
            h('span', { class: 'pg-ring-l' }, x.label), h('span', { class: 'pg-ring-n' }, `${pr.done}/${pr.total}`));
        })),
        nav);
    });
    add(root, hero.el);
    const counts = {};
    for (const p of poras) {
      counts[p.id] = region(() => { const x = progress(p.steps, done, date); return h('span', { class: `pg-count${x.total && x.done === x.total ? ' is-done' : ''}` }, `${x.done} / ${x.total}`); });
      const opt = p.steps.filter(st => st.asNeeded);
      add(root, h('section', { class: `panel pg-pora${p.id === curPora ? ' is-now' : ''}`, id: `pg-${p.id}`, 'aria-labelledby': `pg-h-${p.id}` },
        h('div', { class: 'pg-pora-h' }, h('h2', { id: `pg-h-${p.id}` }, icon(p.icon, { size: 20 }), p.label), counts[p.id].el,
          req(p).length > 0 && h('a', { class: 'pg-go', href: `#/pielegnacja?v=fokus&d=${date}&p=${p.id}`, 'aria-label': `Tryb rutyny: ${p.label}` }, icon('play', { size: 16 }), h('span', {}, 'Rutyna'))),
        p.groups.map(g => { const gs = g.steps.filter(st => !st.asNeeded); return gs.length > 0 && h('div', { class: 'pg-group' },
          g.name && h('h3', {}, g.name),
          h('ul', { class: 'pg-list' }, gs.map(st => stepItem(st, p.id)))); }),
        // kroki doraźne — osobna, cichsza grupa (nie liczą się do postępu)
        opt.length > 0 && h('div', { class: 'pg-group pg-opt' }, h('h3', {}, 'Doraźnie'), h('ul', { class: 'pg-list' }, opt.map(st => stepItem(st, p.id))))));
    }
    add(root, timerBox.el);

    function stepItem(s, pora) {
      const on = isDone(done, date, s.id), prod = s.product && model.product[s.product];
      const li = h('li', { class: `pg-step${on ? ' is-done' : ''}${s.asNeeded ? ' is-opt' : ''}` });
      add(li,
        h('label', { class: 'pg-check' },
          checkInput(h('input', { type: 'checkbox', checked: on || null, onchange: e => toggle(s, e.target.checked, li, pora) })),
          h('span', { class: 'pg-step-b' },
            h('span', { class: 'pg-step-t' }, s.text),
            prod && h('span', { class: `pg-prod pg-st-${prod.status || 'uzywany'}` }, prod.name, prod.status && prod.status !== 'uzywany' && h('span', { class: 'pg-prod-s' }, ` · ${STATUS_LABEL[prod.status]}`)),
            (s.asNeeded || (s.days?.length && s.days.length < 7) || s.from || s.until || s.cycle) && h('span', { class: 'pg-rule' }, weekDots(s, date), h('span', {}, ruleText(s))),
            s.note && h('span', { class: 'pg-note' }, s.note))),
        s.warn && h('p', { class: 'pg-warn' }, icon('triangle-alert', { size: 14 }), h('span', {}, s.warn)),
        s.wait > 0 && h('button', { class: 'pg-wait', 'aria-label': `Odczekaj ${s.wait} min: ${s.text}`, onclick: () => startTimer(s) },
          icon('timer', { size: 16 }), h('span', {}, `Odczekaj ${s.wait} min`)));
      return li;
    }
    async function toggle(s, value, li, pora) {
      li.classList.toggle('is-done', value);
      try {
        await store.record('care.done', { date, step: s.id, done: value });
        derive(); hero.refresh(); counts[pora].refresh();
      } catch (e) { li.classList.toggle('is-done', !value); li.querySelector('input').checked = !value; err(e); }
    }
  }

  // ---------------- Tydzień (D-119): macierz kroki × dni — kropka = krok w planie dnia, wypełniona = wykonany; nagłówek dnia = przejście
  function weekView() {
    const mon = addDays(date, 1 - weekday(date));
    const grid = weekGrid(model, done, mon);
    const wl = d => `#/pielegnacja?v=tydzien&d=${d}`;
    const per = grid.map(d => new Set(inPlan(d.date) ? stepsFor(model, d.date).map(x => x.id) : []));
    const rows = model.steps.filter(st => !st.asNeeded && per.some(x => x.has(st.id)));
    const cellTxt = (st, d, i) => !per[i].has(st.id) ? 'nie w planie' : isDone(done, d.date, st.id) ? 'wykonany' : d.date < today ? 'niewykonany' : 'do wykonania';
    add(root, h('div', { class: 'row daynav' },
      h('a', { class: 'btn dz-nav', href: wl(addDays(mon, -7)), 'aria-label': 'Poprzedni tydzień' }, icon('chevron-left', { size: 18 }), h('span', {}, 'Poprzedni tydzień')),
      h('a', { class: 'btn dz-nav', href: wl(addDays(mon, 7)), 'aria-label': 'Następny tydzień' }, h('span', {}, 'Następny tydzień'), icon('chevron-right', { size: 18 }))),
    h('section', { class: 'panel pg-mx', 'aria-label': `Tydzień ${shortDate(mon)} – ${shortDate(addDays(mon, 6))}` },
      h('ol', { class: 'pg-week' }, grid.map(d => h('li', {},
        h('a', { class: `pg-wday${d.date === today ? ' is-today' : ''}${!inPlan(d.date) ? ' is-out' : ''}`, href: `#/pielegnacja?d=${d.date}`,
          'aria-label': `${DAY_SHORT[weekday(d.date) - 1]} ${shortDate(d.date)}: ${inPlan(d.date) ? `${d.done} z ${d.total} kroków` : 'poza planem'}` },
          h('span', { class: 'pg-wd' }, h('strong', {}, dayShort(d.date)), h('span', {}, shortDate(d.date))),
          inPlan(d.date) ? [h('span', { class: 'pg-wprog' }, `${d.done} / ${d.total}`),
            h('span', { class: 'dz-bar', role: 'presentation' }, h('span', { style: { width: `${d.total ? (d.done / d.total) * 100 : 0}%`, background: 'var(--care)' } }))]
            : h('span', { class: 'muted' }, 'poza planem'))))),
      rows.length ? h('ul', { class: 'pg-mx-rows' }, rows.map(st => h('li', { class: 'pg-mx-r' },
        h('span', { class: 'pg-mx-n' }, st.text),
        h('span', { class: 'pg-mx-c', role: 'img', 'aria-label': `${st.text}: ${grid.map((d, i) => `${DAY_SHORT[i]} ${cellTxt(st, d, i)}`).join(', ')}` },
          grid.map((d, i) => h('span', { class: `pg-mx-d${per[i].has(st.id) ? (isDone(done, d.date, st.id) ? ' is-done' : d.date < today ? ' is-miss' : ' is-due') : ''}${d.date === today ? ' is-today' : ''}` }))))))
        : h('p', { class: 'muted' }, 'Brak kroków w tym tygodniu.'),
      h('p', { class: 'pg-mx-key muted' }, h('span', { class: 'pg-mx-d is-done' }), 'wykonany', h('span', { class: 'pg-mx-d is-due' }), 'w planie', h('span', { class: 'pg-mx-d is-miss' }), 'niewykonany')));
  }

  // ---------------- Produkty: obszar, status, data otwarcia, gdzie i jak często używany
  // D-119: użycie produktu z odhaczeń kroków (`care.done`) — liczba i data ostatniego użycia (bez nowych danych)
  function usage(pid) {
    const ids = new Set(model.steps.filter(x => x.product === pid).map(x => x.id));
    let n = 0, last = '';
    for (const [k, v] of Object.entries(done)) if (v === true && ids.has(k.slice(11)) && k.slice(0, 10) >= PLAN_START) { n++; if (k.slice(0, 10) > last) last = k.slice(0, 10); }   // D-121: bez dni sprzed startu
    return { n, last };
  }
  function productsView() {
    const f = ctx.params.get('s') || '';
    const list = model.products.filter(p => !f || (p.status || 'uzywany') === f);
    add(root, h('div', { class: 'row pg-tools' },
      h('div', { class: 'pills', role: 'group', 'aria-label': 'Status produktu' },
        [['', 'Wszystkie'], ...STATUS].map(([v, l]) => h('button', { class: `pill-b${f === v ? ' is-on' : ''}`, 'aria-pressed': String(f === v), onclick: () => go({ s: v }) }, l))),
      h('button', { class: 'primary', onclick: () => productDialog() }, icon('plus', { size: 18 }), h('span', {}, 'Dodaj produkt'))));
    for (const [area, label] of AREAS) {
      const items = list.filter(p => (p.area || 'detale') === area);
      if (!items.length) continue;
      add(root, h('section', { class: 'panel pg-area', 'aria-labelledby': `pg-a-${area}` }, h('h2', { id: `pg-a-${area}` }, label),
        h('div', { class: 'pg-prods' }, items.map(p => {
          const use = productUse(model, p.id), st = p.status || 'uzywany';
          return h('article', { class: `pg-prod-card st-${st}`, id: `pg-p-${p.id}` },
            h('div', { class: 'pg-prod-h' }, h('h3', {}, p.name), h('span', { class: `pill pg-st-${st}` }, STATUS_LABEL[st] || st)),
            p.opened && h('p', { class: 'muted' }, `Otwarty ${longDate(p.opened)}`),
            (u => h('p', { class: 'pg-used' }, icon('history', { size: 14 }), h('span', {}, u.n ? `Użyty ${u.n}× · ostatnio ${dayShort(u.last)} ${shortDate(u.last)}` : 'Jeszcze bez odhaczeń')))(usage(p.id)),
            p.note && h('p', { class: 'pg-note' }, p.note),
            use.length ? h('ul', { class: 'pg-use' }, use.map(u => h('li', {}, h('strong', {}, u.pora), ` · ${u.step.text} · `, h('span', { class: 'muted' }, u.rule))))
              : h('p', { class: 'muted' }, 'Nieprzypisany do żadnego kroku.'),
            h('div', { class: 'row' }, h('button', { 'aria-label': `Edytuj produkt: ${p.name}`, onclick: () => productDialog(p) }, icon('pencil', { size: 16 }), h('span', {}, 'Edytuj'))));
        }))));
    }
    if (!list.length) add(root, h('p', { class: 'panel muted' }, 'Brak produktów o tym statusie.'));
  }

  // ---------------- Plan: pełna rutyna z edycją i eksportem
  function planView() {
    add(root, h('div', { class: 'row pg-tools' },
      h('button', { class: 'primary', onclick: () => stepDialog() }, icon('plus', { size: 18 }), h('span', {}, 'Dodaj krok')),
      h('button', { onclick: () => productDialog() }, icon('plus', { size: 18 }), h('span', {}, 'Dodaj produkt')),
      !model.empty && h('button', { onclick: exportPlan }, icon('download', { size: 18 }), h('span', {}, 'Eksport planu (.json)')),
      h('a', { class: 'btn', href: '#/dane' }, icon('folder-open', { size: 18 }), h('span', {}, 'Import w Dane'))),
    h('p', { class: 'muted pg-priv' }, icon('lock', { size: 14 }), h('span', {}, 'Plan jest tylko w Twoich danych (urządzenie, plik synchronizacji, zaszyfrowana chmura) — nie ma go w kodzie aplikacji.')));
    if (model.empty) { add(root, emptyState()); return; }
    add(root, periodsTimeline());
    for (const p of byPora(model.steps)) {
      add(root, h('section', { class: 'panel pg-pora', 'aria-labelledby': `pg-ph-${p.id}` },
        h('div', { class: 'pg-pora-h' }, h('h2', { id: `pg-ph-${p.id}` }, icon(p.icon, { size: 20 }), p.label), h('span', { class: 'pg-count' }, `${p.steps.length} ${plural(p.steps.length, 'krok', 'kroki', 'kroków')}`)),
        p.groups.map(g => h('div', { class: 'pg-group' }, g.name && h('h3', {}, g.name),
          h('ul', { class: 'pg-plan' }, g.steps.map(s => h('li', { class: 'pg-plan-i' },
            h('div', { class: 'pg-step-b' },
              h('span', { class: 'pg-step-t' }, s.text),
              s.product && model.product[s.product] && h('span', { class: 'pg-prod' }, model.product[s.product].name),
              h('span', { class: 'pg-rule' }, ruleText(s)),
              s.warn && h('span', { class: 'pg-warn' }, icon('triangle-alert', { size: 14 }), h('span', {}, s.warn)),
              s.wait > 0 && h('span', { class: 'muted' }, `odczekaj ${s.wait} min`),
              s.slot && h('span', { class: 'muted' }, `plan dnia: ${slotLabel(s.slot)}`)),
            h('button', { class: 'pg-edit', 'aria-label': `Edytuj krok: ${s.text}`, onclick: () => stepDialog(s) }, icon('pencil', { size: 16 })))))))));
    }
  }

  // D-119: oś okresów — kroki z datą „od” lub „do” jako odcinki na osi czasu (co się kończy, co się zaczyna); znacznik „dziś”
  function periodsTimeline() {
    const st = model.steps.filter(x => x.from || x.until);
    if (!st.length) return null;
    const lo = [today, ...st.map(x => x.from).filter(Boolean)].sort()[0], hiRaw = [addDays(today, 14), ...st.map(x => x.until).filter(Boolean)].sort().at(-1);
    const a = addDays(lo, -7), z = addDays(hiRaw, 7), span = Math.max(1, diffDays(a, z));
    const pos = d => `${(diffDays(a, d) / span) * 100}%`;
    return h('section', { class: 'panel pg-tl', 'aria-labelledby': 'pg-tl-h' },
      h('h2', { id: 'pg-tl-h' }, icon('calendar-range', { size: 20 }), 'Okresy kroków'),
      h('div', { class: 'pg-tl-axis', 'aria-hidden': 'true' }, h('span', {}, shortDate(a)), h('span', {}, shortDate(z))),
      h('ul', { class: 'pg-tl-list', style: { '--today': pos(today) } }, st.map(x => h('li', { class: 'pg-tl-r' },
        h('span', { class: 'pg-tl-n' }, x.text, h('span', { class: 'muted' }, ` · ${[x.from && `od ${shortDate(x.from)}`, x.until && `do ${shortDate(x.until)}`].filter(Boolean).join(' ')}`)),
        h('span', { class: 'pg-tl-track', 'aria-hidden': 'true' },
          h('span', { class: `pg-tl-bar${x.from ? '' : ' is-open-l'}${x.until ? '' : ' is-open-r'}${x.until && x.until < today ? ' is-past' : ''}`,
            style: { left: pos(x.from || a), right: `calc(100% - ${pos(x.until || z)})` } }))))),
      h('p', { class: 'muted pg-tl-key' }, 'Pionowa linia — dziś. Odcinek bez początku lub końca — krok bez daty „od” / „do”.'));
  }

  async function exportPlan() {
    const strip = ({ kind, ...x }) => x;
    const obj = { format: '2027-care', schema: 1, created: today, products: model.products.map(strip), steps: model.steps.map(strip) };
    const file = new File([JSON.stringify(obj, null, 1)], `2027-pielegnacja-${today}.json`, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = h('a', { href: URL.createObjectURL(file), download: file.name }); document.body.append(a); a.click(); a.remove();
    ctx.flash('Zapisano plik planu pielęgnacji (tylko na tym urządzeniu).', 'info');
  }

  // ---------------- Okna edycji (sheet): produkt i krok; zapis = nowa wersja definicji (care.def), usunięcie = `deleted`
  function productDialog(p = null) {
    const f = {
      name: h('input', { value: p?.name || '', placeholder: 'Nazwa produktu' }),
      area: h('select', {}, opts(AREAS, p?.area || 'twarz')),
      status: h('select', {}, opts(STATUS, p?.status || 'uzywany')),
      opened: h('input', { type: 'date', value: p?.opened || '' }),
      note: h('input', { value: p?.note || '', placeholder: 'np. strefa T, po goleniu' }),
    };
    const use = p ? productUse(model, p.id).length : 0;
    const dlg = sheet(p ? `Edytuj produkt: ${p.name}` : 'Nowy produkt',
      field('Nazwa', f.name), field('Obszar', f.area), field('Status', f.status), field('Data otwarcia (opcjonalnie)', f.opened), field('Notatka', f.note),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: async () => {
          const name = f.name.value.trim();
          if (!name) { dlg.error(new Error('Podaj nazwę produktu.')); f.name.focus(); return; }
          const data = { name, area: f.area.value, status: f.status.value };
          if (f.opened.value) data.opened = f.opened.value;
          if (f.note.value.trim()) data.note = f.note.value.trim();
          if (p?.order != null) data.order = p.order;
          try { await store.record('care.def', { id: p?.id || newId('p', name), kind: 'product', data }); dlg.close(); ctx.flash(p ? `Zapisano: ${name}.` : `Dodano produkt: ${name}.`, 'info'); ctx.rerender(); }
          catch (e) { dlg.error(e); }
        } }, p ? 'Zapisz zmiany' : 'Dodaj produkt'),
        p && h('button', { class: 'danger', onclick: async () => {
          if (!confirm(`Usunąć produkt „${p.name}”?${use ? ` Jest przypisany do ${use} ${plural(use, 'kroku', 'kroków', 'kroków')} — kroki zostaną bez produktu.` : ''}`)) return;
          try { await store.record('care.def', { id: p.id, kind: 'product', data: {}, deleted: true }); dlg.close(); ctx.flash(`Usunięto: ${p.name}.`, 'info'); ctx.rerender(); }
          catch (e) { dlg.error(e); }
        } }, 'Usuń produkt')));
  }

  function stepDialog(s = null) {
    const days = new Set(s?.days?.length ? s.days : [1, 2, 3, 4, 5, 6, 7]);
    const groups = [...new Set(model.steps.map(x => x.group).filter(Boolean))];
    const f = {
      text: h('input', { value: s?.text || '', placeholder: 'np. Mycie twarzy' }),
      pora: h('select', {}, opts(PORY.map(p => [p.id, p.label]), s?.pora || 'rano')),
      group: h('input', { value: s?.group || '', list: 'pg-groups', placeholder: 'np. Twarz' }),
      order: h('input', { type: 'number', step: '1', value: s?.order ?? (model.steps.length + 1) }),
      product: h('select', {}, opts([['', '— bez produktu —'], ...model.products.map(p => [p.id, p.name])], s?.product || '')),
      from: h('input', { type: 'date', value: s?.from || '' }),
      until: h('input', { type: 'date', value: s?.until || '' }),
      // Cykl (D-097): N dni kroku, M dni przerwy — liczony od daty „od”
      cycOn: h('input', { type: 'number', min: '0', step: '1', value: s?.cycle?.on || '', placeholder: 'dni' }),
      cycOff: h('input', { type: 'number', min: '0', step: '1', value: s?.cycle?.off ?? '', placeholder: 'dni' }),
      asNeeded: h('input', { type: 'checkbox', checked: s?.asNeeded || null }),
      warn: h('input', { value: s?.warn || '', placeholder: 'np. Nie płucz po szczotkowaniu' }),
      wait: h('input', { type: 'number', min: '0', step: '1', value: s?.wait || '', placeholder: 'min' }),
      note: h('input', { value: s?.note || '' }),
      // dotychczasowe powiązanie zostaje na liście także wtedy, gdy slotu nie ma już w planie (zapis nie może go po cichu usunąć)
      slot: h('select', {}, opts([['', '— bez powiązania —'], ...SLOTS(), ...(s?.slot && !SLOTS().some(x => x[0] === s.slot) ? [[s.slot, slotLabel(s.slot)]] : [])], s?.slot || '')),
    };
    const dayBoxes = DAY_SHORT.map((l, i) => h('label', { class: 'chk pg-day' },
      h('input', { type: 'checkbox', checked: days.has(i + 1) || null, onchange: e => (e.target.checked ? days.add(i + 1) : days.delete(i + 1)) }), ` ${l}`));
    const dlg = sheet(s ? 'Edytuj krok' : 'Nowy krok',
      field('Czynność', f.text), field('Pora dnia', f.pora), field('Grupa', f.group),
      h('datalist', { id: 'pg-groups' }, groups.map(g => h('option', { value: g }))),
      field('Kolejność', f.order), field('Produkt', f.product),
      h('fieldset', { class: 'pg-days' }, h('legend', {}, 'Dni tygodnia'), dayBoxes),
      h('div', { class: 'row' }, field('Od (opcjonalnie)', f.from), field('Do (opcjonalnie)', f.until)),
      h('div', { class: 'row' }, field('Cykl: dni kroku (opcjonalnie)', f.cycOn), field('Cykl: dni przerwy', f.cycOff)),
      h('label', { class: 'chk' }, f.asNeeded, ' Doraźnie (nie liczy się do postępu dnia)'),
      field('Ostrzeżenie', f.warn), field('Odczekaj po kroku (min)', f.wait), field('Notatka', f.note), field('Powiązanie z planem dnia', f.slot),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: async () => {
          const text = f.text.value.trim();
          if (!text) { dlg.error(new Error('Podaj czynność.')); f.text.focus(); return; }
          if (!days.size) { dlg.error(new Error('Wybierz co najmniej jeden dzień tygodnia.')); return; }
          if (f.from.value && f.until.value && f.until.value < f.from.value) { dlg.error(new Error('Data „do” jest wcześniejsza niż „od”.')); return; }
          const cOn = Number(f.cycOn.value) || 0, cOff = Number(f.cycOff.value) || 0;
          if (cOn > 0 && !f.from.value) { dlg.error(new Error('Cykl liczony jest od daty „od” — podaj ją.')); f.from.focus(); return; }
          const data = { pora: f.pora.value, group: f.group.value.trim(), order: Number(f.order.value) || 0, text };
          if (days.size < 7) data.days = [...days].sort((a, b) => a - b);
          for (const k of ['product', 'from', 'until', 'slot']) if (f[k].value) data[k] = f[k].value;
          if (cOn > 0) data.cycle = { on: cOn, off: cOff };
          if (f.asNeeded.checked) data.asNeeded = true;
          if (f.warn.value.trim()) data.warn = f.warn.value.trim();
          if (Number(f.wait.value) > 0) data.wait = Number(f.wait.value);
          if (f.note.value.trim()) data.note = f.note.value.trim();
          try { await store.record('care.def', { id: s?.id || newId('s', text), kind: 'step', data }); dlg.close(); ctx.flash(s ? 'Zapisano krok.' : 'Dodano krok.', 'info'); ctx.rerender(); }
          catch (e) { dlg.error(e); }
        } }, s ? 'Zapisz zmiany' : 'Dodaj krok'),
        s && h('button', { class: 'danger', onclick: async () => {
          if (!confirm(`Usunąć krok „${s.text}”? Historia odhaczeń zostaje w danych.`)) return;
          try { await store.record('care.def', { id: s.id, kind: 'step', data: {}, deleted: true }); dlg.close(); ctx.flash('Usunięto krok.', 'info'); ctx.rerender(); }
          catch (e) { dlg.error(e); }
        } }, 'Usuń krok')));
  }

  // ---------------- Tryb rutyny (D-119): jeden krok naraz, „Gotowe” zapisuje `care.done` (ten sam zapis co lista), krok z `wait` —
  // odliczanie startuje samo (globalny minutnik: sygnał także po wyjściu z trybu), ekran nie gaśnie (app.js — trasa ?v=fokus)
  function routineView() {
    const P = PORY.find(x => x.id === ctx.params.get('p')) || PORY[0];
    const steps = stepsFor(model, date).filter(x => x.pora === P.id && !x.asNeeded);
    const exit = `#/pielegnacja?d=${date}`;
    const wrap = h('div', { class: 'fx care-fx', style: { '--dc': 'var(--care)' } });
    add(root, wrap);
    if (!steps.length) {
      add(wrap, focusTop({ exit, title: `Rutyna · ${P.label}` }), h('p', { class: 'fx-msg' }, `${dayShort(date)} ${shortDate(date)}: brak kroków tej pory.`),
        h('a', { class: 'btn primary fx-wide', href: exit }, 'Wróć do planu'));
      return;
    }
    const dn = x => isDone(done, date, x.id);
    if (!rpos || rpos.date !== date || rpos.pora !== P.id || !steps.some(x => x.id === rpos.id)) rpos = { date, pora: P.id, id: (steps.find(x => !dn(x)) || steps[steps.length - 1]).id };
    const cur = steps.find(x => x.id === rpos.id), i = steps.indexOf(cur), k = steps.filter(dn).length, prev = steps[i - 1], nx = steps[i + 1];
    const goTo = d => { const n = steps[i + d]; if (!n) return; rpos.id = n.id; ctx.rerender(); };
    const waitKey = x => `care|${date}|${x.id}`;
    const set = async value => {
      try { await store.record('care.done', { date, step: cur.id, done: value }); } catch (e) { err(e); return false; }
      derive(); return true;
    };
    const complete = async () => {
      sfx('check');
      if (!await set(true)) return;
      if (cur.wait > 0) { unlockAudio(); startCountdown(waitKey(cur), cur.wait * 60, `Odczekaj po: ${cur.text}`, l => ctx.flash(`${l} — czas minął.`, 'info')); }
      const n = steps.slice(i + 1).find(x => !dn(x)) || steps.find(x => !dn(x));
      if (n) rpos.id = n.id; else sfx('done');
      ctx.rerender();
    };
    const undo = async () => { if (await set(false)) ctx.rerender(); };
    const prod = cur.product && model.product[cur.product];
    const card = h('section', { class: `fx-set${dn(cur) ? ' is-done' : ''}`, 'aria-labelledby': 'fx-set-h' },
      h('div', { class: 'fx-set-h' },
        h('button', { class: 'fx-nav', 'aria-label': 'Poprzedni krok', disabled: i === 0 || null, onclick: () => goTo(-1) }, icon('chevron-left', { size: 22 })),
        h('h3', { id: 'fx-set-h' }, `Krok ${i + 1} z ${steps.length}`, dn(cur) && h('span', { class: 'fx-tag' }, icon('check', { size: 14 }), 'wykonany')),
        h('button', { class: 'fx-nav', 'aria-label': 'Następny krok', disabled: i === steps.length - 1 || null, onclick: () => goTo(1) }, icon('chevron-right', { size: 22 }))),
      h('div', { class: 'fx-ex fx-study' },
        cur.group && h('p', { class: 'fx-k' }, cur.group),
        h('h2', { class: 'fx-name' }, cur.text),
        prod && h('p', { class: 'fx-plan' }, prod.name),
        cur.note && h('p', { class: 'fx-plan' }, cur.note)),
      cur.warn && h('p', { class: 'pg-warn' }, icon('triangle-alert', { size: 14 }), h('span', {}, cur.warn)),
      cur.wait > 0 && !dn(cur) && h('p', { class: 'fx-plan care-wait' }, icon('timer', { size: 16 }), h('span', {}, `Po „Gotowe” odliczanie ${cur.wait} min ruszy samo.`)),
      dn(cur)
        ? h('button', { class: 'fx-undo', onclick: undo }, icon('undo-2', { size: 18 }), h('span', {}, 'Cofnij — krok niewykonany'))
        : h('button', { class: 'primary fx-go', onclick: complete }, icon('check', { size: 22 }), h('span', {}, 'Gotowe')));
    swipeRow(card, dn(cur) ? { left: { label: 'Cofnij', ic: 'undo-2', tone: 'neutral', run: undo } } : { right: { label: 'Gotowe', ic: 'check', run: complete } });
    // odliczanie po poprzednim kroku (np. 10 min przed kolejnym) — nad bieżącym krokiem
    const waiting = prev && prev.wait > 0 && countdown(waitKey(prev)) ? prev : null;
    add(wrap,
      focusTop({ exit, title: `Rutyna · ${P.label}`, sub: `${dayShort(date)} ${shortDate(date)} · ${k} / ${steps.length} ${plural(steps.length, 'krok', 'kroki', 'kroków')}` }),
      focusScale([steps.map(x => ({ done: dn(x), cur: x === cur }))], `Kroki: ${k} z ${steps.length} wykonanych`),
      msg,
      waiting && h('p', { class: 'fx-next' }, h('span', { class: 'fx-l' }, 'Odczekaj'), `po: ${waiting.text}`),
      waiting && focusTimer(waitKey(waiting), waiting.wait, `Odczekaj po: ${waiting.text}`, ctx.flash),
      card,
      nx && h('p', { class: 'fx-next' }, h('span', { class: 'fx-l' }, 'Następnie'), nx.text),
      k === steps.length && h('a', { class: 'btn fx-wide', href: exit }, icon('check', { size: 18 }), h('span', {}, `${P.label}: wszystkie kroki wykonane — wróć`)));
    focusKeys(wrap, { exit, primary: dn(cur) ? null : complete, nav: goTo });
  }
}

// D-119: reguła dni jako 7 kropek tygodnia (PN…ND) — wypełniona = krok w tym dniu; dzień wyświetlany wyróżniony. Cykl i „doraźnie” — bez kropek.
function weekDots(s, date) {
  if (s.asNeeded || s.cycle?.on > 0 || !s.days?.length || s.days.length === 7) return null;
  const wd = weekday(date);
  return h('span', { class: 'pg-dots', 'aria-hidden': 'true' }, DAY_SHORT.map((l, i) => h('span', { class: `pg-dot${s.days.includes(i + 1) ? ' is-on' : ''}${i + 1 === wd ? ' is-cur' : ''}`, title: l })));
}
