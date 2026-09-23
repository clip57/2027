// Moduł CFA (Etap 5): harmonogram z Plan_nauki_CFA v3 (D-006), trwały postęp (cfa.done) i error log (cfa.err.*),
// eksport i import CSV zgodny z v3. Daty lokalne (naprawa błędu UTC z v1/v2).
import { h, clear, fmt, plural, add } from '../ui/dom.js';
import { segmented, progressRing, section } from '../ui/components.js';
import { SRC, cfaByDay } from '../core/data.js';
import { cfaSourceLine } from '../core/resolver.js';
import { addDays, diffDays, longDate, shortDate, dayShort, weekday, parse } from '../core/dates.js';
import { previewEvents, apply } from '../core/sync/bundle.js';
import { cfaErrorLogEvents } from '../core/migrate/cfa.js';
import { sha256 } from '../core/hash.js';

const D = SRC.cfa.D;
const EXAM = SRC.cfa.exam;
const KINDS = ['brak wiedzy', 'pomyłka rachunkowa', 'niezrozumienie pytania', 'błąd interpretacyjny', 'błąd pamięciowy', 'pośpiech', 'błędna strategia'];
const VIEWS = [{ value: 'dzien', label: 'Dzień' }, { value: 'harmonogram', label: 'Harmonogram' }, { value: 'kalendarz', label: 'Kalendarz' },
  { value: 'log', label: 'Error log' }, { value: 'plan', label: 'Plan' }];
const MODE_CLASS = { 'FIRST PASS': 'm-fp', CONSOLIDATION: 'm-co', MOCK: 'm-mo', 'ANALIZA BŁĘDÓW': 'm-an', 'ACTIVE RECALL': 'm-ar' };

export function renderCFA(root, ctx) {
  const { store, today } = ctx;
  const view = ctx.params.get('v') || 'dzien';
  const go = o => {
    const p = new URLSearchParams({ v: view, ...Object.fromEntries(ctx.params), ...o });
    location.hash = `#/cfa?${p}`;
  };
  const done = store?.state?.cfaDone || new Set();
  const msg = h('div', { role: 'status', 'aria-live': 'polite' });
  const err = e => clear(msg).append(h('div', { class: 'banner err' }, e.message || String(e)));
  const toggle = async (nr, value) => {
    if (!store) return err(new Error('Baza danych jest niedostępna.'));
    try { await store.record('cfa.done', { block: nr, done: value }); ctx.rerender(); } catch (e) { err(e); }
  };
  const doneCount = done.size;
  const hoursDone = Math.round(doneCount * 53 / 60 * 10) / 10;
  const toExam = diffDays(today, EXAM);

  add(root, h('section', { class: 'hero-tr hero-cfa' },
    h('div', { class: 'hero-tr-main' },
      h('p', { class: 'eyebrow' }, `CFA Level I · egzamin ${longDate(EXAM)}`),
      h('h1', {}, toExam > 0 ? `${toExam} ${plural(toExam, 'dzień', 'dni', 'dni')} do egzaminu` : toExam === 0 ? 'Egzamin dziś' : 'Po egzaminie'),
      h('p', { class: 'muted' }, `${doneCount} / ${D.bloki.length} bloków · ${fmt(hoursDone, 1)} / ${fmt(D.stat.godziny, 2)} h netto`)),
    h('div', { class: 'hero-tr-side' }, progressRing(doneCount, D.bloki.length, 'Wykonane bloki'))),
  msg,
  h('div', { class: 'controls' }, segmented('Widok', VIEWS, view, v => go({ v }))));

  const blockRow = b => h('div', { class: `cfa-row${done.has(b.nr) ? ' is-done' : ''}` },
    h('button', { class: 'set-toggle', 'aria-pressed': String(done.has(b.nr)), 'aria-label': `Blok ${b.nr} ${done.has(b.nr) ? 'wykonany' : 'do wykonania'}`,
      onclick: () => toggle(b.nr, !done.has(b.nr)) }, done.has(b.nr) ? '✓' : b.blok),
    h('div', { class: 'cfa-body' },
      h('p', { class: 'cfa-src' }, cfaSourceLine(b)),
      h('p', { class: 'cfa-topic' }, b.temat),
      h('p', { class: 'cfa-meta' }, h('span', { class: `mode ${MODE_CLASS[b.tryb] || ''}` }, b.tryb), h('span', { class: 'muted' }, `${b.godz} · nr ${b.nr}`))));

  // ---------------- Dzień
  if (view === 'dzien') {
    const first = D.stat.start, last = D.stat.end;
    let date = ctx.params.get('d') || (today < first ? first : today > last ? last : today);
    const blocks = cfaByDay[date] || [];
    const dDone = blocks.filter(b => done.has(b.nr)).length;
    const isMock = D.mockCFA.includes(date);
    const recall = weekday(date) !== 5 && weekday(date) !== 6 && date >= first && date <= last;
    add(root, h('div', { class: 'row daynav' },
      date > first && h('button', { onclick: () => go({ d: addDays(date, -1) }) }, 'Poprzedni dzień'),
      date !== today && today >= first && today <= last && h('button', { onclick: () => go({ d: today }) }, 'Dziś'),
      date < last && h('button', { onclick: () => go({ d: addDays(date, 1) }) }, 'Następny dzień')),
      h('div', { class: 'panel' },
        h('div', { class: 'cfa-dayhead' },
          h('div', {}, h('h2', {}, `${dayShort(date)} ${longDate(date)}`),
            h('p', { class: 'muted' }, `${dDone} / ${blocks.length} bloków${isMock ? ' · dzień mocka' : ''}${recall ? ' · recall 22:00' : ' · bez recall'}`)),
          progressRing(dDone, blocks.length || 1, 'Bloki dnia')),
        blocks.length ? h('div', { class: 'cfa-list' }, blocks.map(blockRow)) : h('p', {}, 'Brak bloków w tym dniu (poza planem).'),
        blocks.length > 0 && h('div', { class: 'row' },
          h('button', { onclick: async () => { try { for (const b of blocks) if (!done.has(b.nr)) await store.record('cfa.done', { block: b.nr, done: true }); ctx.rerender(); } catch (e) { err(e); } } }, 'Oznacz cały dzień'),
          h('button', { onclick: async () => { try { for (const b of blocks) if (done.has(b.nr)) await store.record('cfa.done', { block: b.nr, done: false }); ctx.rerender(); } catch (e) { err(e); } } }, 'Wyczyść dzień'))));
  }

  // ---------------- Harmonogram z filtrami
  if (view === 'harmonogram') {
    const q = (ctx.params.get('q') || '').toLowerCase();
    const kat = ctx.params.get('kat') || '', tryb = ctx.params.get('tryb') || '', todo = ctx.params.get('todo') === '1';
    const sel = (name, label, opts, val) => h('label', { class: 'field' }, h('span', {}, label),
      h('select', { onchange: e => go({ [name]: e.target.value }) }, h('option', { value: '' }, 'wszystkie'), opts.map(o => h('option', { value: o, selected: o === val }, o))));
    const list = D.bloki.filter(b => (!kat || b.kategoria === kat) && (!tryb || b.tryb === tryb) && (!todo || !done.has(b.nr))
      && (!q || `${b.temat} ${b.zrodlo} ${b.zakres} ${b.data}`.toLowerCase().includes(q)));
    const byDay = list.reduce((m, b) => ((m[b.data] ||= []).push(b), m), {});
    add(root, h('div', { class: 'panel filters' },
      h('label', { class: 'field' }, h('span', {}, 'Szukaj'), h('input', { type: 'search', value: ctx.params.get('q') || '', placeholder: 'temat, źródło, strony, data',
        onchange: e => go({ q: e.target.value }) })),
      sel('kat', 'Kategoria', Object.keys(D.stat.kat), kat),
      sel('tryb', 'Tryb', Object.keys(D.stat.tryb), tryb),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: todo, onchange: e => go({ todo: e.target.checked ? '1' : '' }) }), ' tylko niewykonane'),
      h('p', { class: 'muted' }, `${list.length} ${plural(list.length, 'blok', 'bloki', 'bloków')} w ${Object.keys(byDay).length} ${plural(Object.keys(byDay).length, 'dniu', 'dniach', 'dniach')}`)),
    Object.entries(byDay).map(([d, bl]) => h('section', { class: 'panel' },
      h('h2', { class: 'cfa-dh' }, h('a', { href: `#/cfa?v=dzien&d=${d}` }, `${dayShort(d)} ${shortDate(d)}`),
        h('span', { class: 'muted' }, ` · ${bl.filter(b => done.has(b.nr)).length}/${bl.length}`)),
      h('div', { class: 'cfa-list' }, bl.map(blockRow)))));
  }

  // ---------------- Kalendarz
  if (view === 'kalendarz') {
    const months = [...new Set(Object.keys(cfaByDay).map(d => d.slice(0, 7)).concat(EXAM.slice(0, 7)))].sort();
    add(root, h('div', { class: 'cal-legend' },
      h('span', { class: 'cl c-0' }, '0%'), h('span', { class: 'cl c-1' }, '1–99%'), h('span', { class: 'cl c-2' }, '100%'),
      h('span', { class: 'cl c-mock' }, 'mock'), h('span', { class: 'cl c-exam' }, 'egzamin')));
    for (const ym of months) {
      const [y, m] = ym.split('-').map(Number);
      const first = `${ym}-01`, days = new Date(y, m, 0).getDate();
      const cells = [...Array(weekday(first) - 1)].map(() => h('span', { class: 'cal-e' }));
      for (let i = 1; i <= days; i++) {
        const d = `${ym}-${String(i).padStart(2, '0')}`, bl = cfaByDay[d] || [];
        const k = bl.filter(b => done.has(b.nr)).length;
        const cls = d === EXAM ? 'c-exam' : !bl.length ? 'c-none' : D.mockCFA.includes(d) ? 'c-mock' : k === bl.length ? 'c-2' : k > 0 ? 'c-1' : 'c-0';
        cells.push(bl.length || d === EXAM
          ? h('a', { class: `cal-d ${cls}${d === today ? ' is-today' : ''}`, href: `#/cfa?v=dzien&d=${d}`, 'aria-label': `${longDate(d)}: ${k}/${bl.length}` },
            h('span', {}, String(i)), bl.length ? h('small', {}, `${k}/${bl.length}`) : h('small', {}, 'egz.'))
          : h('span', { class: 'cal-d c-none' }, h('span', {}, String(i))));
      }
      add(root, section(`cal-${ym}`, parse(first).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' }),
        h('div', { class: 'cal' }, ['pn', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'].map(x => h('span', { class: 'cal-h' }, x)), cells)));
    }
  }

  // ---------------- Error log
  if (view === 'log') {
    const entries = [...(store?.state?.cfaErrors || [])].sort((a, b) => (a.data < b.data ? 1 : -1));
    const edit = ctx.params.get('e');
    const cur = entries.find(x => x.id === edit) || {};
    const f = {
      data: h('input', { type: 'date', value: cur.data || today }),
      temat: h('input', { value: cur.temat || '', placeholder: 'np. FI — duration, LM 3' }),
      rodzaj: h('select', {}, KINDS.map(k => h('option', { value: k, selected: k === (cur.rodzaj || KINDS[0]) }, k))),
      regula: h('textarea', { rows: '3', placeholder: 'prawidłowa reguła / wniosek' }, cur.regula || ''),
    };
    const saveEntry = async () => {
      if (!f.temat.value.trim()) return err(new Error('Podaj temat lub źródło.'));
      const id = cur.id || `e_${Date.now().toString(36)}`;
      try {
        await store.record('cfa.err.put', { id, data: { egz: 'CFA', data: f.data.value, temat: f.temat.value.trim(), rodzaj: f.rodzaj.value, regula: f.regula.value.trim() } });
        ctx.flash(cur.id ? 'Zapisano zmiany wpisu.' : 'Dodano wpis do error logu.'); go({ e: '' });
      } catch (e) { err(e); }
    };
    const csvInput = h('input', { type: 'file', accept: '.csv,text/csv', hidden: true, onchange: async () => {
      const file = csvInput.files[0]; if (!file) return;
      try {
        const pv = previewEvents(store, await cfaErrorLogEvents(await file.text(), sha256), 'cfa-errors');
        if (!pv.ok) return err(new Error(pv.errors.join(' ')));
        if (!confirm(`Nowe wpisy: ${pv.fresh.length}, już znane: ${pv.known}. Zaimportować?`)) return;
        const n = await apply(store, pv); ctx.flash(`Zaimportowano ${n} wpisów.`); ctx.rerender();
      } catch (e) { err(e); }
    } });
    const counts = KINDS.map(k => [k, entries.filter(x => x.rodzaj === k).length]).filter(([, n]) => n);
    add(root, h('section', { class: 'panel' }, h('h2', {}, cur.id ? 'Edytuj wpis' : 'Nowy wpis'),
      h('div', { class: 'form-grid' },
        h('label', { class: 'field' }, h('span', {}, 'Data'), f.data),
        h('label', { class: 'field' }, h('span', {}, 'Temat / źródło'), f.temat),
        h('label', { class: 'field' }, h('span', {}, 'Rodzaj błędu'), f.rodzaj),
        h('label', { class: 'field wide' }, h('span', {}, 'Prawidłowa reguła'), f.regula)),
      h('div', { class: 'row' }, h('button', { class: 'primary', disabled: !store, onclick: saveEntry }, cur.id ? 'Zapisz zmiany' : 'Dodaj wpis'),
        cur.id && h('button', { onclick: () => go({ e: '' }) }, 'Anuluj'))),
    counts.length > 0 && h('p', { class: 'chips' }, counts.map(([k, n]) => h('span', { class: 'chip' }, `${k}: ${n}`))),
    h('div', { class: 'row' },
      h('button', { disabled: !entries.length, onclick: () => {
        const head = 'egzamin;data;temat_zrodlo;rodzaj_bledu;prawidlowa_regula';
        const rows = entries.map(e => [e.egz || 'CFA', e.data, e.temat, e.rodzaj, e.regula].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'));
        const file = new File(['\ufeff' + head + '\n' + rows.join('\n')], 'error-log.csv', { type: 'text/csv' });
        const a = h('a', { href: URL.createObjectURL(file), download: file.name }); document.body.append(a); a.click(); a.remove();
      } }, 'Eksport CSV'),
      h('button', { disabled: !store, onclick: () => { csvInput.value = ''; csvInput.click(); } }, 'Import CSV (v3)'), csvInput),
    entries.length === 0 ? h('p', { class: 'muted' }, 'Error log jest pusty.') :
      h('div', { class: 'log-list' }, entries.map(e => h('article', { class: 'log-item' },
        h('div', { class: 'log-head' }, h('span', { class: 'mode m-an' }, e.rodzaj), h('span', { class: 'muted' }, e.data)),
        h('p', { class: 'log-t' }, e.temat),
        e.regula && h('p', { class: 'log-r' }, e.regula),
        h('div', { class: 'row' },
          h('button', { onclick: () => go({ e: e.id }) }, 'Edytuj'),
          h('button', { class: 'danger', onclick: async () => {
            if (!confirm('Usunąć wpis?')) return;
            try { await store.record('cfa.err.del', { id: e.id }); ctx.flash('Usunięto wpis.'); ctx.rerender(); } catch (x) { err(x); }
          } }, 'Usuń'))))));
  }

  // ---------------- Plan (działy, mocki, statystyki)
  if (view === 'plan') {
    const topicDone = t => D.bloki.filter(b => b.kategoria === 'CFA Curriculum' && b.zrodlo.includes(`(${t.kod})`)).map(b => b.nr);
    add(root, section('h-topics', 'Działy — pierwsze przejście',
      h('div', { class: 'topic-list' }, D.cfa.map(t => {
        const nrs = topicDone(t), k = nrs.filter(n => done.has(n)).length;
        return h('div', { class: 'topic' },
          h('div', { class: 'topic-h' }, h('strong', {}, `${t.kod}`), h('span', {}, t.tytul), h('span', { class: 'muted' }, t.waga)),
          h('span', { class: 'prog-bar' }, h('span', { class: 'prog-fill', style: { width: `${nrs.length ? (k / nrs.length) * 100 : 0}%`, background: 'var(--cfa)' } })),
          h('p', { class: 'muted small' }, `${k}/${nrs.length} bloków · ${t.strony} s. · ${shortDate(t.start)}–${shortDate(t.koniecd)}`));
      }))),
    section('h-mocks', 'Mocki', h('ul', { class: 'tech-list' }, D.mockCFA.map((d, i) => h('li', {},
      h('a', { href: `#/cfa?v=dzien&d=${d}` }, `Mock ${i + 1}: ${dayShort(d)} ${shortDate(d)}`),
      ` — ${(cfaByDay[d] || []).filter(b => done.has(b.nr)).length}/${(cfaByDay[d] || []).length} bloków`)))),
    section('h-stat', 'Statystyki planu', h('dl', { class: 'kv' },
      h('dt', {}, 'Bloki'), h('dd', {}, `${D.stat.bloki} (${D.stat.dni} dni × 8)`),
      h('dt', {}, 'Godziny netto'), h('dd', {}, `${fmt(D.stat.godziny, 2)} h + recall ${fmt(D.stat.recallH, 2)} h (${D.stat.recall} sesji)`),
      Object.entries(D.stat.tryb).map(([k, n]) => [h('dt', {}, k), h('dd', {}, `${n} ${plural(n, 'blok', 'bloki', 'bloków')} · wykonane ${D.bloki.filter(b => b.tryb === k && done.has(b.nr)).length}`)]))));
  }
}
