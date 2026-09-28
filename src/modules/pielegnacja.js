// Moduł Pielęgnacja (D-094): codzienna pielęgnacja skóry i włosów — co, kiedy, czym, jak często, czy wykonane, jakie produkty
// są w użyciu. Plan (kroki, produkty) pochodzi WYŁĄCZNIE z danych użytkownika: import pliku `2027-pielegnacja.json` w module Dane
// albo edycja tutaj (zdarzenia `care.def`); odhaczenia — `care.done`. W repozytorium nie ma treści planu (D-035).
// Widoki: Dzień (lista kontrolna wg pór, licznik „odczekaj”), Tydzień, Produkty, Plan (edycja, eksport).
import { h, clear, add, plural } from '../ui/dom.js';
import { segmented, progressRing, sheet } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { region } from '../ui/patch.js';
import { SRC } from '../core/data.js';
import { inPlan, PLAN_START } from '../core/resolver.js';
import { addDays, longDate, shortDate, dayShort, weekday } from '../core/dates.js';
import { careModel, stepsFor, progress, byPora, isDone, ruleText, productUse, weekGrid, PORY, AREAS, STATUS, DAY_SHORT } from '../core/calc/care.js';

const VIEWS = [{ value: 'dzien', label: 'Dzień' }, { value: 'tydzien', label: 'Tydzień' }, { value: 'produkty', label: 'Produkty' }, { value: 'plan', label: 'Plan' }];
const STATUS_LABEL = Object.fromEntries(STATUS);
const AREA_LABEL = Object.fromEntries(AREAS);
// Sloty planu dnia, do których można przypiąć krok (postęp widoczny w „Dziś”): szablon + warianty (sobota, niedziela)
const SLOTS = [...SRC.dayTemplate.slots, ...Object.values(SRC.dayTemplate.variants || {}).flatMap(v => v.slots)]
  .map(s => [s.id, `${s.from} · ${s.title_src}${s.id.endsWith('n') ? ' (niedziela)' : s.id.endsWith('z') ? ' (sobota)' : ''}`]);

// Licznik „odczekaj N min” — stan wyłącznie interfejsu (jak przerwa w Treningu, D-068): nie trafia do dziennika ani synchronizacji
let timer = null;   // { label, start, sec }

export function renderPielegnacja(root, ctx) {
  const { store, today } = ctx;
  const view = ctx.params.get('v') || 'dzien';
  const date = ctx.params.get('d') || today;
  const go = o => { const p = new URLSearchParams({ v: view, ...Object.fromEntries(ctx.params), ...o }); location.hash = `#/pielegnacja?${p}`; };
  const msg = h('div', { role: 'status', 'aria-live': 'polite' });
  const err = e => clear(msg).append(h('div', { class: 'banner err' }, e.message || String(e)));
  if (!store) { add(root, h('h1', {}, 'Pielęgnacja'), h('div', { class: 'banner err' }, 'Baza danych jest niedostępna.')); return; }
  // Stan pochodny — zmienne przeliczane po zapisie (P2: punktowe odświeżanie)
  let model, done;
  const derive = () => { model = careModel(store.state.careDefs || []); done = store.state.careDone || {}; };
  derive();

  add(root, h('header', { class: 'pg-head' }, h('h1', {}, 'Pielęgnacja'),
    h('div', { class: 'topline' },
      !model.empty && h('span', { class: 'chip' }, `${model.steps.length} ${plural(model.steps.length, 'krok', 'kroki', 'kroków')} · ${model.products.length} ${plural(model.products.length, 'produkt', 'produkty', 'produktów')}`))),
  msg, h('div', { class: 'controls' }, segmented('Widok', VIEWS, view, v => go({ v }))));

  // Licznik odczekania: pasek u dołu ekranu (jak przerwa w Treningu); „Pomiń” zamyka
  function startTimer(s) { timer = { label: s.text, start: Date.now(), sec: s.wait * 60 }; timerBox.refresh(); }
  const timerBox = region(() => {
    if (!timer) return null;
    const time = h('strong', { class: 'pg-timer-t' }), fill = h('span', { class: 'pg-timer-fill' });
    const live = h('span', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    let announced = false;
    const bar = h('section', { class: 'pg-timer', 'aria-label': 'Odczekaj przed kolejnym krokiem' },
      h('span', { class: 'pg-timer-ic' }, icon('timer', { size: 20 })),
      h('div', { class: 'pg-timer-main' }, h('span', { class: 'pg-timer-n' }, `Odczekaj · ${timer.label}`), time,
        h('span', { class: 'pg-timer-bar', role: 'presentation' }, fill)),
      h('button', { 'aria-label': 'Zamknij licznik', onclick: () => { timer = null; timerBox.refresh(); } }, icon('x', { size: 18 }), h('span', {}, 'Zamknij')),
      live);
    const tick = () => {
      if (!timer) return;
      const el = (Date.now() - timer.start) / 1000, left = Math.max(0, timer.sec - el);
      const sec = Math.ceil(left);
      time.textContent = left > 0 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : 'Gotowe';
      fill.style.width = `${Math.min(100, (el / timer.sec) * 100)}%`;
      bar.classList.toggle('is-ready', left <= 0);
      if (left <= 0 && !announced) { announced = true; live.textContent = `Czas minął. Możesz przejść do kolejnego kroku po: ${timer.label}.`; }
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
      date > PLAN_START && h('a', { class: 'btn dz-nav', href: `#/pielegnacja?d=${addDays(date, -1)}` }, icon('chevron-left', { size: 18 }), h('span', {}, 'Poprzedni dzień')),
      date !== today && h('a', { class: 'btn dz-nav', href: '#/pielegnacja' }, 'Dziś'),
      h('a', { class: 'btn dz-nav', href: `#/pielegnacja?d=${addDays(date, 1)}` }, h('span', {}, 'Następny dzień'), icon('chevron-right', { size: 18 })));
    if (!inPlan(date)) { add(root, nav, h('p', { class: 'panel pg-outside' }, `Poza planem — plan zaczyna się ${longDate(PLAN_START)}.`)); return; }
    const list = stepsFor(model, date);
    const poras = byPora(list);
    const hero = region(() => {
      const p = progress(list, done, date);
      const next = poras.find(x => progress(x.steps, done, date).done < progress(x.steps, done, date).total);
      return h('section', { class: 'hero-tr pg-hero' },
        h('div', { class: 'hero-tr-main' },
          h('p', { class: 'eyebrow' }, `${dayShort(date)} ${longDate(date)}${date === today ? ' · dziś' : ''}`),
          h('p', { class: 'pg-hero-t' }, p.total ? `${p.done} z ${p.total} ${plural(p.total, 'kroku', 'kroków', 'kroków')} wykonanych` : 'Brak kroków tego dnia'),
          h('p', { class: 'muted' }, next ? `Następna pora: ${next.label} — ${progress(next.steps, done, date).total - progress(next.steps, done, date).done} do wykonania` : p.total ? '✓ Wszystkie kroki tego dnia wykonane' : ''),
          nav),
        h('div', { class: 'hero-tr-side' }, progressRing(p.done, p.total || 1, 'Wykonane kroki'), h('span', { class: 'muted' }, `${p.done} / ${p.total}`)));
    });
    add(root, hero.el,
      h('nav', { class: 'pg-jump', 'aria-label': 'Pory dnia' }, poras.map(p => h('a', { class: 'chip-b', href: `#pg-${p.id}` }, icon(p.icon, { size: 16 }), p.label))));
    const counts = {};
    for (const p of poras) {
      counts[p.id] = region(() => { const x = progress(p.steps, done, date); return h('span', { class: `pg-count${x.total && x.done === x.total ? ' is-done' : ''}` }, `${x.done} / ${x.total}`); });
      add(root, h('section', { class: 'panel pg-pora', id: `pg-${p.id}`, 'aria-labelledby': `pg-h-${p.id}` },
        h('div', { class: 'pg-pora-h' }, h('h2', { id: `pg-h-${p.id}` }, icon(p.icon, { size: 20 }), p.label), counts[p.id].el),
        p.groups.map(g => h('div', { class: 'pg-group' },
          g.name && h('h3', {}, g.name),
          h('ul', { class: 'pg-list' }, g.steps.map(s => stepItem(s, p.id)))))));
    }
    add(root, timerBox.el);

    function stepItem(s, pora) {
      const on = isDone(done, date, s.id), prod = s.product && model.product[s.product];
      const li = h('li', { class: `pg-step${on ? ' is-done' : ''}${s.asNeeded ? ' is-opt' : ''}` });
      add(li,
        h('label', { class: 'pg-check' },
          h('input', { type: 'checkbox', checked: on || null, onchange: e => toggle(s, e.target.checked, li, pora) }),
          h('span', { class: 'pg-step-b' },
            h('span', { class: 'pg-step-t' }, s.text),
            prod && h('span', { class: 'pg-prod' }, prod.name),
            (s.asNeeded || (s.days?.length && s.days.length < 7) || s.from || s.until) && h('span', { class: 'pg-rule' }, ruleText(s)),
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

  // ---------------- Tydzień: postęp dni i kroki, które nie są codzienne
  function weekView() {
    const mon = addDays(date, 1 - weekday(date));
    const grid = weekGrid(model, done, mon);
    const wl = d => `#/pielegnacja?v=tydzien&d=${d}`;
    add(root, h('div', { class: 'row daynav' },
      h('a', { class: 'btn dz-nav', href: wl(addDays(mon, -7)), 'aria-label': 'Poprzedni tydzień' }, icon('chevron-left', { size: 18 }), h('span', {}, 'Poprzedni tydzień')),
      h('a', { class: 'btn dz-nav', href: wl(addDays(mon, 7)), 'aria-label': 'Następny tydzień' }, h('span', {}, 'Następny tydzień'), icon('chevron-right', { size: 18 }))),
    h('ol', { class: 'pg-week', 'aria-label': `Tydzień ${shortDate(mon)} – ${shortDate(addDays(mon, 6))}` }, grid.map(d => h('li', {},
      h('a', { class: `pg-wday${d.date === today ? ' is-today' : ''}${!inPlan(d.date) ? ' is-out' : ''}`, href: `#/pielegnacja?d=${d.date}`,
        'aria-label': `${DAY_SHORT[weekday(d.date) - 1]} ${shortDate(d.date)}: ${d.done} z ${d.total} kroków` },
        h('span', { class: 'pg-wd' }, h('strong', {}, dayShort(d.date)), ` ${shortDate(d.date)}`, d.date === today && h('span', { class: 'now-tag' }, 'dziś')),
        inPlan(d.date) ? [h('span', { class: 'pg-wprog' }, `${d.done} / ${d.total}`),
          h('span', { class: 'dz-bar', role: 'presentation' }, h('span', { style: { width: `${d.total ? (d.done / d.total) * 100 : 0}%`, background: 'var(--care)' } })),
          d.special.length > 0 && h('ul', { class: 'pg-wlist' }, d.special.map(s => h('li', {}, s.text, s.product && model.product[s.product] && h('span', { class: 'muted' }, ` · ${model.product[s.product].name}`))))]
          : h('span', { class: 'muted' }, 'poza planem'))))));
  }

  // ---------------- Produkty: obszar, status, data otwarcia, gdzie i jak często używany
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
              s.slot && h('span', { class: 'muted' }, `plan dnia: ${SLOTS.find(x => x[0] === s.slot)?.[1] || s.slot}`)),
            h('button', { class: 'pg-edit', 'aria-label': `Edytuj krok: ${s.text}`, onclick: () => stepDialog(s) }, icon('pencil', { size: 16 })))))))));
    }
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
      asNeeded: h('input', { type: 'checkbox', checked: s?.asNeeded || null }),
      warn: h('input', { value: s?.warn || '', placeholder: 'np. Nie płucz po szczotkowaniu' }),
      wait: h('input', { type: 'number', min: '0', step: '1', value: s?.wait || '', placeholder: 'min' }),
      note: h('input', { value: s?.note || '' }),
      slot: h('select', {}, opts([['', '— bez powiązania —'], ...SLOTS], s?.slot || '')),
    };
    const dayBoxes = DAY_SHORT.map((l, i) => h('label', { class: 'chk pg-day' },
      h('input', { type: 'checkbox', checked: days.has(i + 1) || null, onchange: e => (e.target.checked ? days.add(i + 1) : days.delete(i + 1)) }), ` ${l}`));
    const dlg = sheet(s ? 'Edytuj krok' : 'Nowy krok',
      field('Czynność', f.text), field('Pora dnia', f.pora), field('Grupa', f.group),
      h('datalist', { id: 'pg-groups' }, groups.map(g => h('option', { value: g }))),
      field('Kolejność', f.order), field('Produkt', f.product),
      h('fieldset', { class: 'pg-days' }, h('legend', {}, 'Dni tygodnia'), dayBoxes),
      h('div', { class: 'row' }, field('Od (opcjonalnie)', f.from), field('Do (opcjonalnie)', f.until)),
      h('label', { class: 'chk' }, f.asNeeded, ' Doraźnie (nie liczy się do postępu dnia)'),
      field('Ostrzeżenie', f.warn), field('Odczekaj po kroku (min)', f.wait), field('Notatka', f.note), field('Powiązanie z planem dnia', f.slot),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: async () => {
          const text = f.text.value.trim();
          if (!text) { dlg.error(new Error('Podaj czynność.')); f.text.focus(); return; }
          if (!days.size) { dlg.error(new Error('Wybierz co najmniej jeden dzień tygodnia.')); return; }
          if (f.from.value && f.until.value && f.until.value < f.from.value) { dlg.error(new Error('Data „do” jest wcześniejsza niż „od”.')); return; }
          const data = { pora: f.pora.value, group: f.group.value.trim(), order: Number(f.order.value) || 0, text };
          if (days.size < 7) data.days = [...days].sort((a, b) => a - b);
          for (const k of ['product', 'from', 'until', 'slot']) if (f[k].value) data[k] = f[k].value;
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
}
