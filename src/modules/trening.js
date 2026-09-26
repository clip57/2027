// Moduł Trening (Etap 5): plan z TRENING.html (= REKOMPOZYCJA s.9–17), faza z kalendarza (D-017),
// dziennik serii (wykonana, ciężar, powtórzenia, RIR) zapisywany trwale zdarzeniami train.set (D-008),
// mapa mięśni z free-exercise-db (domena publiczna).
import { h, clear, add, fmt, plural } from '../ui/dom.js';
import { progressRing, segmented, section, statGrid, stat, sheet } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { movementPlayer } from '../ui/movement.js';
import { barChart, lineChart } from '../ui/charts.js';
import { sessions, weekly, muscleSets, exerciseHistory, records, streakWeeks, weekStart, restSeconds, nextSet, TRAIN_FROM } from '../core/calc/training.js';
import { bodyMap, MUSCLE_PL } from '../ui/bodymap.js';
import { SRC } from '../core/data.js';
import { resolveDay, dayPlan, PLAN_START } from '../core/resolver.js';
import { addDays, weekday, longDate, shortDate } from '../core/dates.js';
import muscles from '../data/muscles.json' with { type: 'json' };

const T = SRC.training;
const M = muscles.exercises;
const TABS = [['pon', 'PN', 1], ['wt', 'WT', 2], ['sr', 'ŚR', 3], ['czw', 'CZW', 4], ['pt', 'PT', 5], ['sob', 'SOB', 6], ['nd', 'ND', 7]];
const strip = html => (html || '').replace(/<[^>]+>/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const serie = n => (n === 1 ? 'seria' : n >= 2 && n <= 4 ? 'serie' : 'serii');
// Parametry ćwiczenia z planu (wiersz źródłowy `raw` ma pierwszeństwo — zawiera też zakres ruchu i progresję).
const spec = e => (e.raw ? { reps: e.raw[2], rir: e.raw[3], rest: e.raw[4], range: e.raw[5], prog: e.raw[6] } : { reps: e.reps, rir: e.rir, rest: e.rest });
const mmss = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

// Licznik przerwy między seriami (D-068): stan wyłącznie interfejsu, w pamięci karty — nie trafia do dziennika zdarzeń
// ani do pliku synchronizacji. Czas liczony od znacznika startu (poprawny także po wygaszeniu ekranu telefonu).
let rest = null; // { key, date, name, set, of, next, start, min, max, label }
function startRest(e, set, of, date, next) {
  const r = restSeconds(spec(e).rest);
  rest = r && next ? { key: `${date}|${e.id}|${set}`, date, name: e.name, set, of, next, start: Date.now(), ...r, label: spec(e).rest } : null;
}
function restBar() {
  if (!rest) return null;
  if ((Date.now() - rest.start) / 1000 > rest.max + 300) { rest = null; return null; } // dawno zakończona — nie wracamy do niej
  const time = h('strong', { class: 'tr-rest-t' }), note = h('span', { class: 'tr-rest-n' }), fill = h('span', { class: 'tr-rest-fill' });
  const live = h('span', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  let ready = false;
  const bar = h('section', { class: 'tr-rest', 'aria-label': 'Przerwa między seriami' },
    h('span', { class: 'tr-rest-ic' }, icon('timer', { size: 20 })),
    h('div', { class: 'tr-rest-main' }, note, time, h('span', { class: 'tr-rest-next' }, `Następnie: ${rest.next.e.name} · seria ${rest.next.set} z ${rest.next.of}`),
      h('span', { class: 'tr-rest-bar', role: 'presentation' }, fill)),
    h('div', { class: 'tr-rest-act' },
      h('button', { onclick: () => { rest.min += 30; rest.max += 30; ready = false; tick(); } }, '+30 s'),
      h('button', { 'aria-label': 'Pomiń przerwę', onclick: () => { rest = null; bar.remove(); } }, icon('skip-forward', { size: 18 }), h('span', {}, 'Pomiń'))),
    live);
  function tick() {
    if (!rest) return false;
    const el = (Date.now() - rest.start) / 1000, left = rest.min - el;
    time.textContent = left > 0 ? mmss(Math.ceil(left)) : `+${mmss(-left)}`;
    fill.style.width = `${Math.min(100, (el / rest.min) * 100)}%`;
    note.textContent = left > 0 ? `Przerwa · plan ${rest.label}` : el < rest.max ? `Możesz zaczynać · plan ${rest.label}` : 'Przerwa zakończona';
    bar.classList.toggle('is-ready', left <= 0);
    if (left <= 0 && !ready) { ready = true; live.textContent = `Przerwa zakończona. Następnie: ${rest.next.e.name}, seria ${rest.next.set}.`; }
    return true;
  }
  tick();
  const id = setInterval(() => { if (!rest || !bar.isConnected) clearInterval(id); else tick(); }, 1000); // nowy widok = nowy pasek
  return bar;
}

// Czas treningu: stoper (start/stop zapisywany w dzienniku) lub wpis ręczny w minutach (zdarzenie train.session).
function sessionTimer(store, date, ctx, msg) {
  if (!store) return null;
  const cur = store.state.trainSessions[date] || {};
  const running = cur.start && !cur.end;
  const saveSess = async patch => {
    try { await store.record('train.session', { date, start: cur.start ?? null, end: cur.end ?? null, minutes: cur.minutes ?? null, ...patch }); ctx.rerender(); }
    catch (e) { clear(msg).append(h('div', { class: 'banner err' }, e.message)); }
  };
  const clock = h('strong', { class: 'tm-clock' });
  if (running) {
    const tick = () => { const m = Math.max(0, (Date.now() - Date.parse(cur.start)) / 60000); clock.textContent = `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}:${String(Math.floor((m * 60) % 60)).padStart(2, '0')}`; };
    tick(); const id = setInterval(() => (clock.isConnected ? tick() : clearInterval(id)), 1000);
  }
  const minutes = h('input', { type: 'number', min: '0', max: '600', step: '1', inputmode: 'numeric', value: cur.minutes ?? '', placeholder: 'min', 'aria-label': 'Czas treningu w minutach',
    onchange: e => { const v = e.target.value === '' ? null : Math.round(Number(e.target.value)); if (v === null || (v >= 0 && v < 1440)) saveSess({ minutes: v }); } });
  return h('div', { class: 'hero-tr-map tm' },
    h('div', {}, h('p', { class: 'eyebrow' }, 'Czas treningu'),
      running ? h('p', { class: 'tm-run' }, clock, h('span', { class: 'muted' }, ` od ${new Date(cur.start).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`))
        : h('p', { class: 'muted' }, cur.minutes ? `Zapisano: ${cur.minutes} min` : 'Nie zapisano czasu')),
    h('div', { class: 'row' },
      running ? h('button', { class: 'primary', onclick: () => { const end = new Date().toISOString();
          saveSess({ end, minutes: Math.max(1, Math.round((Date.parse(end) - Date.parse(cur.start)) / 60000)) }); } }, icon('square', { size: 18 }), h('span', {}, 'Zakończ trening'))
        : h('button', { onclick: () => saveSess({ start: new Date().toISOString(), end: null }) }, icon('play', { size: 18 }), h('span', {}, cur.minutes ? 'Uruchom ponownie' : 'Rozpocznij trening')),
      h('label', { class: 'tm-man' }, h('span', {}, 'lub wpisz:'), minutes, h('span', {}, 'min'))));
}

const sheetDialog = sheet;   // wspólny arkusz: nazwa dostępna, usunięcie po Esc (B3)

const muscleLegend = m => h('div', { class: 'bm-legend' },
  h('p', {}, h('span', { class: 'sw sw-p' }), h('strong', {}, 'Główne: '), m.primary.map(x => MUSCLE_PL[x] || x).join(', ') || '—'),
  m.secondary.length > 0 && h('p', {}, h('span', { class: 'sw sw-s' }), h('strong', {}, 'Pomocnicze: '), m.secondary.map(x => MUSCLE_PL[x] || x).join(', ')));

function techniqueDialog(name) {
  const i = T.info[name], m = M[name];
  sheetDialog(name,
    h('p', { class: 'muted' }, `${i.en} · ${i.p}${i.ft ? ` · ${i.ft}` : ''}`),
    h('h3', {}, 'Jak wykonać — schemat ruchu'),
    movementPlayer(name),
    m && h('div', { class: 'tech-map' }, bodyMap(m, { size: 'lg' }), muscleLegend(m),
      h('p', { class: 'muted small' }, `Mięśnie: free-exercise-db (domena publiczna), rekord „${m.src_name}”${m.match === 'closest' ? ' — najbliższy odpowiednik w zbiorze' : ''}.`)),
    i.s && h('p', {}, h('strong', {}, 'Ustawienie: '), i.s),
    i.c?.length && [h('h3', {}, 'Kluczowe punkty'), h('ul', { class: 'tech-list' }, i.c.map(x => h('li', {}, x)))],
    i.r && h('p', {}, h('strong', {}, 'Zakres ruchu: '), i.r),
    i.e?.length && [h('h3', {}, 'Najczęstsze błędy'), h('ul', { class: 'tech-list err' }, i.e.map(x => h('li', {}, x)))],
    i.m && h('p', { class: 'muted' }, h('strong', {}, 'Ruch: '), i.m),
    i.vid?.length && [h('h3', {}, 'Wideo'), h('ul', { class: 'tech-list' }, i.vid.map(([id, who, title]) =>
      h('li', {}, h('a', { href: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`, target: '_blank', rel: 'noopener' }, title), ` — ${who}`)))]);
}

function infoDialog(text) {
  const [title, ...rest] = text.replace(/\s*✕\s*/, '|').split('|');
  sheetDialog(title.trim(), h('p', { class: 'sheet-text' }, rest.join(' ').trim()));
}

// Ostatnie wyniki ćwiczenia z wcześniejszego dnia (do podpowiedzi „ostatnio”).
function lastResult(train, exId, before) {
  const byDate = {};
  for (const [k, v] of Object.entries(train)) {
    const [d, ex, set] = k.split('|');
    if (ex === exId && d < before && d >= TRAIN_FROM && (v.kg != null || v.reps != null)) (byDate[d] ||= []).push({ set: Number(set), ...v });
  }
  const d = Object.keys(byDate).sort().pop();
  return d ? { date: d, sets: byDate[d].sort((a, b) => a.set - b.set) } : null;
}

const VIEWS = [{ value: 'sesja', label: 'Trening' }, { value: 'stat', label: 'Statystyki' }, { value: 'historia', label: 'Historia' }];

export function renderTrening(root, ctx) {
  const view = ctx.params.get('v') || 'sesja';
  add(root, h('div', { class: 'controls' }, segmented('Widok', VIEWS, view, v => { location.hash = `#/trening?v=${v}`; })));
  if (view === 'stat') return renderStats(root, ctx);
  if (view === 'historia') return renderHistory(root, ctx);
  return renderSession(root, ctx);
}

function renderSession(root, ctx) {
  const { store, today } = ctx;
  const monday = addDays(today, 1 - weekday(today));
  const date = ctx.params.get('d') || today;
  const r = resolveDay(date);
  const key = r.session;   // sesja dnia z planu tygodnia i wyjątków dat (D-087); null = bez treningu
  const phase = r.phase ?? 0;
  const msg = h('div', { role: 'status', 'aria-live': 'polite' });
  const log = store?.state?.train || {};
  // Zapisy szeregowane w kolejce: kolejny zapis tej samej serii widzi wynik poprzedniego.
  let queue = Promise.resolve();
  const save = (ex, set, patch, rerender = false) => (queue = queue.then(() => saveNow(ex, set, patch, rerender)));
  const saveNow = async (ex, set, patch, rerender) => {
    if (!store) return;
    // Bieżący stan z magazynu (nie z chwili renderowania) — inaczej zapis ciężaru kasowałby odhaczenie serii.
    const cur = store.state.train[`${date}|${ex}|${set}`] || { done: false, kg: null, reps: null, rir: null };
    try {
      await store.record('train.set', { date, ex, set, done: cur.done, kg: cur.kg ?? null, reps: cur.reps ?? null, rir: cur.rir ?? null, ...patch });
      if (rerender) ctx.rerender();
    } catch (e) { clear(msg).append(h('div', { class: 'banner err' }, e.message)); }
  };
  const exercises = T.days[key] || [];
  const plan = exercises.map(e => ({ e, n: e.series[String(phase)] }));
  const total = plan.reduce((a, x) => a + x.n, 0);
  const done = plan.reduce((a, x) => a + [...Array(x.n)].filter((_, i) => log[`${date}|${x.e.id}|${i + 1}`]?.done).length, 0);
  const sessionMuscles = { primary: [...new Set(plan.filter(x => x.n > 0).flatMap(x => M[x.e.name]?.primary || []))] };
  sessionMuscles.secondary = [...new Set(plan.filter(x => x.n > 0).flatMap(x => M[x.e.name]?.secondary || []))].filter(m => !sessionMuscles.primary.includes(m));
  const sheets = T.sheets.filter(s => s.length > 5);
  const nx = nextSet(plan, log, date);
  const sessNow = sessions(log, store?.state?.trainSessions || {}).find(x => x.date === date);
  const lastLine = e => { const l = lastResult(log, e.id, date); return l ? ` · ostatnio ${l.sets.map(x => `${x.kg ?? '–'} kg × ${x.reps ?? '–'}`).join(', ')}` : ''; };

  // --- pasek dni z nazwami sesji
  add(root, h('div', { class: 'day-strip', role: 'tablist', 'aria-label': 'Dzień tygodnia' },
    TABS.map(([, lab, n]) => {
      const d = addDays(monday, n - 1), w = dayPlan(d);
      return h('a', { class: `ds${d === date ? ' is-on' : ''}${d === today ? ' is-today' : ''}`, href: `#/trening?d=${d}`, role: 'tab', 'aria-selected': String(d === date) },
        h('span', { class: 'ds-d' }, lab), h('span', { class: 'ds-s' }, w.outside ? '—' : w.sessionName.replace('Bez treningu, ', '')));
    })),
    msg);

  // --- nagłówek sesji
  add(root, h('section', { class: 'hero-tr' },
    h('div', { class: 'hero-tr-main' },
      h('p', { class: 'eyebrow' }, `${r.dayName}, ${longDate(date)}${r.outside ? '' : ` · Faza ${phase}`}`),
      h('h1', {}, r.sessionLabel),
      r.note && h('p', {}, r.note),
      total > 0 && h('p', { class: 'muted' }, `${exercises.filter((_, i) => plan[i].n > 0).length} ćwiczeń · ${total} ${serie(total)}`),
      h('div', { class: 'row' }, sheets.map(sh => h('button', { class: 'chip-b', onclick: () => infoDialog(sh) }, sh.split('✕')[0].trim())))),
    total > 0 && h('div', { class: 'hero-tr-side' }, progressRing(done, total, 'Wykonane serie'), h('span', { class: 'muted' }, `${done} / ${total} serii`)),
    // Następna seria z planu albo podsumowanie ukończonej sesji (wyłącznie z dziennika — D-069)
    total > 0 && (nx
      ? h('div', { class: 'tr-next' },
        h('div', {}, h('p', { class: 'eyebrow' }, done ? 'Następna seria' : 'Pierwsza seria'),
          h('p', { class: 'tr-next-t' }, `${nx.e.name} · seria ${nx.set} z ${nx.of}`),
          h('p', { class: 'muted' }, `plan: ${spec(nx.e).reps} powt. · RIR ${spec(nx.e).rir} · przerwa ${spec(nx.e).rest}${lastLine(nx.e)}`)),
        h('a', { class: 'btn', href: `#ex-${nx.e.id}` }, icon('chevron-down', { size: 18 }), h('span', {}, 'Przejdź do ćwiczenia')))
      : h('div', { class: 'tr-next tr-done' },
        h('span', { class: 'tr-done-ic' }, icon('circle-check', { size: 22 })),
        h('div', {}, h('p', { class: 'tr-next-t' }, 'Sesja ukończona'),
          h('p', { class: 'muted' }, `${sessNow.sets} ${plural(sessNow.sets, 'seria', 'serie', 'serii')} · ${fmt(Math.round(sessNow.volume))} kg objętości · ${fmt(sessNow.reps)} powt.${sessNow.minutes ? ` · ${sessNow.minutes} min` : ' · czas nie zapisany'}`)))),
    !r.outside && sessionTimer(store, date, ctx, msg),
    total > 0 && h('div', { class: 'hero-tr-map' }, bodyMap(sessionMuscles, { size: 'md', title: 'Mięśnie w tej sesji' }), muscleLegend(sessionMuscles))));

  if (!exercises.length) {
    add(root, h('div', { class: 'panel' },
      h('p', {}, r.dayType === 'rest_sauna2' ? 'Dzień bez treningu. Dwie rundy sauny według protokołu (arkusz „Sauna”). Kolagen, witamina C i tauryna o 17:15 jak w pozostałe dni.'
        : r.dayType === 'swim' ? 'Basen 55 min.' : r.outside ? `Poza planem — plan i treningi zaczynają się ${longDate(PLAN_START)}.`
          : r.dayType === 'free' ? 'Dzień bez treningu.' : 'Brak zaplanowanych ćwiczeń.')));
    return;
  }
  // Ćwiczenie spoza aktywnej fazy: zapis dobrowolny, wyraźnie oznaczony (opt: true).
  function optionalSets(e) {
    const rows = Object.values(log).filter(v => v.date === date && v.ex === e.id).sort((a, b) => a.set - b.set);
    return h('div', { class: 'opt' },
      h('p', { class: 'opt-note' }, `⚠️ To ćwiczenie nie jest elementem Fazy ${phase}. Zapis serii jest opcjonalny i oznaczany w statystykach.`),
      rows.length > 0 && h('div', { class: 'sets' }, h('div', { class: 'set set-h' }, h('span', {}, 'Seria'), h('span', {}, 'kg'), h('span', {}, 'powt.'), h('span', {}, 'RIR'), h('span', {})),
        rows.map(v => h('div', { class: `set${v.done ? ' is-done' : ''}` },
          h('button', { class: 'set-toggle', 'aria-pressed': String(!!v.done), onclick: () => save(e.id, v.set, { done: !v.done, opt: true }, true) }, v.done ? '✓' : String(v.set)),
          ...['kg', 'reps', 'rir'].map(field => h('input', { type: 'number', inputmode: 'decimal', step: field === 'kg' ? '0.5' : '1', min: '0',
            placeholder: field === 'kg' ? 'kg' : field === 'reps' ? 'powt.' : 'RIR', value: v[field] ?? '', 'aria-label': `${e.name}, seria opcjonalna ${v.set}: ${field}`,
            onchange: ev => { const x = ev.target.value === '' ? null : Number(ev.target.value); if (x === null || Number.isFinite(x)) save(e.id, v.set, { [field]: x, opt: true }); } })),
          h('span', { class: 'set-copy-sp' })))),
      rows.length < 10 && h('button', { class: 'opt-add', onclick: () => save(e.id, rows.length + 1, { done: false, opt: true }, true) }, '+ Dodaj serię (opcjonalnie)'));
  }
  const phaseBlock = (label, text) => text && h('details', { class: 'meal' }, h('summary', {}, h('span', { class: 'meal-n' }, label)),
    h('div', { class: 'why-body' }, h('p', {}, text.replace(/^(Rozgrzewka|Schłodzenie) 10 min ▾\s*/, ''))));
  add(root, phaseBlock('🔥 Rozgrzewka · 10 min', T.warmup[key]));

  add(root, h('div', { class: 'ex-list' }, plan.map(({ e, n }, idx) => {
    const rom = e.raw ? spec(e) : null;
    const { reps, rir, rest: pause } = spec(e);
    const last = lastResult(log, e.id, date);
    const exDone = [...Array(n)].filter((_, i) => log[`${date}|${e.id}|${i + 1}`]?.done).length;
    const sets = [...Array(n)].map((_, i) => {
      const s = i + 1, v = log[`${date}|${e.id}|${s}`] || {}, prev = log[`${date}|${e.id}|${s - 1}`];
      const num = (field, ph, step) => h('input', { type: 'number', inputmode: 'decimal', step, min: '0', placeholder: ph, value: v[field] ?? '',
        'aria-label': `${e.name}, seria ${s}: ${ph}`,
        onchange: ev => { const x = ev.target.value === '' ? null : Number(ev.target.value); if (x === null || Number.isFinite(x)) save(e.id, s, { [field]: x }); } });
      return h('div', { class: `set${v.done ? ' is-done' : ''}` },
        h('button', { class: 'set-toggle', 'aria-pressed': String(!!v.done), 'aria-label': `Seria ${s} ${v.done ? 'wykonana' : 'do wykonania'}`,
          onclick: () => {
            const key = `${date}|${e.id}|${s}`;
            if (!v.done && date === ctx.today) startRest(e, s, n, date, nextSet(plan, { ...store?.state?.train, [key]: { done: true } }, date));
            else if (v.done && rest?.key === key) rest = null;
            save(e.id, s, { done: !v.done }, true);
          } }, v.done ? '✓' : String(s)),
        num('kg', 'kg', '0.5'), num('reps', 'powt.', '1'), num('rir', 'RIR', '1'),
        s > 1 && prev && (prev.kg != null || prev.reps != null) && !v.kg && !v.reps
          ? h('button', { class: 'set-copy', title: 'Skopiuj z poprzedniej serii', 'aria-label': `Skopiuj wartości serii ${s - 1}`,
            onclick: () => save(e.id, s, { kg: prev.kg ?? null, reps: prev.reps ?? null, rir: prev.rir ?? null }, true) }, icon('copy', { size: 16 }))
          : h('span', { class: 'set-copy-sp' }));
    });
    return h('article', { class: `ex${n > 0 && exDone === n ? ' is-complete' : ''}${nx?.e === e ? ' is-next' : ''}`, id: `ex-${e.id}` },
      h('div', { class: 'ex-top' },
        h('div', { class: 'ex-main' },
          h('div', { class: 'ex-head' }, h('span', { class: 'ex-n' }, n > 0 && exDone === n ? '✓' : String(idx + 1)),
            h('div', { class: 'ex-title' }, h('h3', {}, e.name), h('p', { class: 'muted' }, T.info[e.name]?.en || ''))),
          h('p', { class: 'ex-plan' },
            h('span', { class: 'kpi' }, h('b', {}, String(n)), serie(n)), h('span', { class: 'kpi' }, h('b', {}, reps), 'powt.'),
            h('span', { class: 'kpi' }, h('b', {}, rir), 'RIR'), h('span', { class: 'kpi' }, h('b', {}, pause), 'przerwa')),
          rom && h('p', { class: 'ex-note' }, `Zakres: ${rom.range} · progresja: ${rom.prog}`),
          e.note_html && h('p', { class: 'ex-note' }, strip(e.note_html)),
          last && h('p', { class: 'ex-last' }, `Ostatnio (${last.date.slice(8)}.${last.date.slice(5, 7)}): `,
            last.sets.map(x => `${x.kg ?? '–'} kg × ${x.reps ?? '–'}`).join(' · ')),
          h('button', { class: 'ex-tech', onclick: () => techniqueDialog(e.name) }, 'Technika i mięśnie')),
        M[e.name] && h('button', { class: 'ex-map', onclick: () => techniqueDialog(e.name), 'aria-label': `Mapa mięśni: ${e.name}` }, bodyMap(M[e.name], { size: 'sm' }))),
      n === 0 ? optionalSets(e) :
        h('div', { class: 'sets' }, h('div', { class: 'set set-h' }, h('span', {}, 'Seria'), h('span', {}, 'kg'), h('span', {}, 'powt.'), h('span', {}, 'RIR'), h('span', {})), sets));
  })));
  add(root, phaseBlock('❄️ Schłodzenie · 10 min', T.cooldown[key]), rest?.date === date ? restBar() : null);
}

// ---------------- Statystyki (styl Hevy) ----------------
function renderStats(root, ctx) {
  const { store, today } = ctx;
  const train = store?.state?.train || {}, sess = store?.state?.trainSessions || {};
  const all = sessions(train, sess);
  if (!all.length) {
    add(root, h('div', { class: 'panel' }, h('h2', {}, 'Statystyki'),
      h('p', {}, 'Brak zapisanych treningów. Statystyki pojawią się po zapisaniu pierwszych serii lub czasu treningu.')));
    return;
  }
  const withMin = all.filter(s => s.minutes);
  const totalMin = withMin.reduce((a, s) => a + s.minutes, 0);
  const vol = all.reduce((a, s) => a + s.volume, 0);
  const wk = weekly(train, sess, 12, today);
  const wkLabel = w => shortDate(w.week);
  const range = ctx.params.get('r') || '7';
  const from = addDays(today, -(Number(range) - 1));
  const ms = muscleSets(train, from, today);
  const msSorted = Object.entries(ms).sort((a, b) => b[1] - a[1]);
  const top = msSorted.slice(0, 3).map(([m]) => m);
  const names = [...new Set(Object.values(train).map(v => Object.values(SRC.training.days).flat().find(e => e.id === v.ex)?.name).filter(Boolean))]
    .filter(n => exerciseHistory(train, n).length).sort((a, b) => a.localeCompare(b, 'pl'));
  const exName = ctx.params.get('ex') || names[0];
  const hist = exName ? exerciseHistory(train, exName) : [];
  const recs = records(train);
  const go = o => { const p = new URLSearchParams({ v: 'stat', r: range, ex: exName || '', ...o }); location.hash = `#/trening?${p}`; };

  add(root,
    statGrid(
      stat('Treningi', String(all.length), `seria: ${streakWeeks(train, sess, today)} ${plural(streakWeeks(train, sess, today), 'tydzień', 'tygodnie', 'tygodni')} z rzędu`),
      stat('Czas łącznie', totalMin >= 60 ? `${Math.floor(totalMin / 60)} h ${totalMin % 60} min` : `${totalMin} min`, withMin.length ? `średnio ${Math.round(totalMin / withMin.length)} min (${withMin.length} z czasem)` : 'brak zapisanego czasu'),
      (() => { const ns = all.reduce((a, s) => a + s.sets, 0);
        return stat('Objętość', `${fmt(Math.round(vol))} kg`, `${fmt(ns)} ${plural(ns, 'seria', 'serie', 'serii')} · ${fmt(all.reduce((a, s) => a + s.reps, 0))} powt.`); })(),
      stat('Rekordy', String(recs.filter(r => r.e1rm).length), 'ćwiczeń z szacowanym 1RM')),
    section('st-vol', 'Objętość tygodniowa (kg × powt.)', barChart(wk.map(w => ({ label: wkLabel(w), value: w.volume, hl: w.week === weekStart(today) })), { title: 'Objętość tygodniowa', unit: ' kg', fmt: v => fmt(Math.round(v)) })),
    section('st-time', 'Czas treningów tygodniowo (min)', barChart(wk.map(w => ({ label: wkLabel(w), value: w.minutes, hl: w.week === weekStart(today) })), { title: 'Czas tygodniowo', unit: ' min' })),
    section('st-mus', 'Serie na grupę mięśni',
      h('div', { class: 'controls' }, segmented('Okres', [{ value: '7', label: '7 dni' }, { value: '28', label: '28 dni' }], range, r => go({ r }))),
      msSorted.length === 0 ? h('p', { class: 'muted' }, 'Brak serii w tym okresie.') : h('div', { class: 'mus-grid' },
        bodyMap({ primary: top, secondary: msSorted.slice(3).map(([m]) => m) }, { size: 'md', title: 'Najczęściej trenowane grupy mięśni' }),
        h('div', { class: 'mus-bars' }, msSorted.map(([m, n]) => h('div', { class: 'mus-row' },
          h('span', {}, MUSCLE_PL[m] || m), h('span', { class: 'prog-bar' }, h('span', { class: 'prog-fill', style: { width: `${(n / msSorted[0][1]) * 100}%`, background: 'var(--train)' } })),
          h('strong', {}, fmt(n, 1)))))),
      h('p', { class: 'muted small' }, 'Mięsień główny ćwiczenia = 1 seria, pomocniczy = 0,5 serii. Mapa: najczęściej trenowane (pełny kolor) i pozostałe.')),
    names.length > 0 && section('st-ex', 'Postęp ćwiczenia',
      h('label', { class: 'field' }, h('span', {}, 'Ćwiczenie'), h('select', { onchange: e => go({ ex: e.target.value }) }, names.map(n => h('option', { value: n, selected: n === exName }, n)))),
      hist.filter(x => x.bestE1rm).length >= 2 ? [h('p', { class: 'eyebrow' }, 'Szacowany 1RM (Epley)'), lineChart(hist.filter(x => x.bestE1rm).map(x => ({ label: shortDate(x.date), value: x.bestE1rm })), { title: 'Szacowany 1RM', unit: ' kg', fmt: v => fmt(v, 1) }),
        h('p', { class: 'eyebrow' }, 'Najcięższa seria (kg)'), lineChart(hist.filter(x => x.topKg).map(x => ({ label: shortDate(x.date), value: x.topKg })), { title: 'Najcięższa seria', unit: ' kg', fmt: v => fmt(v, 1) })]
        : h('p', { class: 'muted' }, hist.some(x => x.bestE1rm)
          ? `Jedna sesja z wynikiem (szacowany 1RM ${fmt(hist.find(x => x.bestE1rm).bestE1rm, 1)} kg). Wykres postępu pojawi się po drugiej sesji.`
          : 'Wpisz ciężar i powtórzenia, aby zobaczyć wykres postępu.'),
      h('div', { class: 'scroll-x' }, h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, ['Data', 'Serie', 'Najlepsza seria', '1RM', 'Objętość'].map(x => h('th', {}, x)))),
        h('tbody', {}, hist.slice().reverse().map(x => h('tr', {}, h('td', {}, shortDate(x.date)), h('td', {}, String(x.sets)),
          h('td', {}, x.bestSet?.kg ? `${fmt(x.bestSet.kg, 1)} kg × ${x.bestSet.reps ?? '–'}` : '—'), h('td', {}, x.bestE1rm ? `${fmt(x.bestE1rm, 1)} kg` : '—'),
          h('td', {}, x.volume ? `${fmt(x.volume)} kg` : '—'))))))),
    recs.length > 0 && section('st-pr', 'Rekordy osobiste',
      h('div', { class: 'scroll-x' }, h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, ['Ćwiczenie', '1RM (szac.)', 'Maks. ciężar', 'Maks. powt.', 'Najlepsza seria (objętość)'].map(x => h('th', {}, x)))),
        h('tbody', {}, recs.map(r => h('tr', {}, h('td', {}, r.name),
          h('td', {}, r.e1rm ? `${fmt(r.e1rm.value, 1)} kg` : '—'), h('td', {}, r.kg ? `${fmt(r.kg.value, 1)} kg` : '—'),
          h('td', {}, r.reps ? String(r.reps.value) : '—'), h('td', {}, r.volume ? `${fmt(r.volume.value)} kg (${r.volume.kg} × ${r.volume.reps})` : '—'))))))));
}

// ---------------- Historia sesji ----------------
function renderHistory(root, ctx) {
  const { store } = ctx;
  const all = sessions(store?.state?.train || {}, store?.state?.trainSessions || {}).reverse();
  add(root, all.length === 0 ? h('div', { class: 'panel' }, h('p', {}, 'Brak zapisanych treningów.')) :
    h('div', { class: 'hist-list' }, all.map(s => h('a', { class: 'hist-item', href: `#/trening?d=${s.date}` },
      h('div', { class: 'hist-h' }, h('strong', {}, `${dayPlan(s.date).sessionName} · ${shortDate(s.date)}`),
        h('span', { class: 'muted' }, s.minutes ? `${s.minutes} min` : 'czas nie zapisany')),
      h('p', { class: 'hist-k' }, h('span', {}, `${s.sets} ${plural(s.sets, 'seria', 'serie', 'serii')}`), h('span', {}, `${fmt(Math.round(s.volume))} kg`), h('span', {}, `${fmt(s.reps)} powt.`),
        s.optional > 0 && h('span', { class: 'opt-tag' }, `${s.optional} ${plural(s.optional, 'opcjonalna', 'opcjonalne', 'opcjonalnych')}`)),
      h('p', { class: 'muted small' }, s.exercises.join(' · '))))));
}
