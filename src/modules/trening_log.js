// Dziennik szczegółów sesji (D-106): panel z sekcjami Basen / Rower / Sauna / Notatka wg protokołów z Rekompozycji (bez kolana — D-111).
// Zapis po każdej zmianie pola (zdarzenie `train.detail`, jeden dokument na dzień); bez przerysowywania strony, żeby nie gubić fokusu. Definicja pól: core/trainlog.js.
import { h, clear, numberOf } from '../ui/dom.js';
import { LOG, NOTE_MAX, mainKind, withValue, fieldOk, swimPace, paceText } from '../core/trainlog.js';

const filled = (doc, sec) => Object.keys(doc?.[sec] || {}).length;
const badgeText = n => (n ? `${n} ${n === 1 ? 'wpis' : n < 5 ? 'wpisy' : 'wpisów'}` : '');

export function sessionLog(store, date, r, ctx, msg) {
  if (!store || r.outside) return null;
  const kind = mainKind(r.dayType);
  const main = kind === 'swim' ? 'swim' : kind === 'bike' ? 'bike' : null;
  const doc = () => store.state.trainDetails?.[date] || { date };
  let queue = Promise.resolve();
  const refreshers = [];
  const save = (sec, key, val) => (queue = queue.then(async () => {
    if (!fieldOk(sec, key, val)) { clear(msg).append(h('div', { class: 'banner err', role: 'alert' }, 'Niepoprawna wartość pola — wpis nie został zapisany.')); return; }
    try { await store.record('train.detail', withValue(doc(), sec, key, val)); clear(msg); refreshers.forEach(f => f()); }
    catch (e) { clear(msg).append(h('div', { class: 'banner err', role: 'alert' }, e.message)); }
  }));

  const chip = (label, on, onclick, role) => h('button', { type: 'button', class: 'tl-chip', role: role === 'radio' ? 'radio' : null, [role === 'radio' ? 'aria-checked' : 'aria-pressed']: String(on), onclick }, label);
  const setOn = (btn, on) => btn.setAttribute(btn.getAttribute('role') === 'radio' ? 'aria-checked' : 'aria-pressed', String(on));

  function field(sec, key, f) {
    const cur = () => doc()[sec]?.[key];
    const hint = f.hint && h('small', { class: 'muted tl-hint' }, f.hint);
    if (f.type === 'num') {
      const input = h('input', { type: 'number', inputmode: 'decimal', min: String(f.min), max: String(f.max), step: String(f.step), value: cur() ?? '', 'aria-label': `${LOG[sec].title}: ${f.label}${f.unit ? `, ${f.unit}` : ''}`,
        onchange: e => {
          const v = numberOf(e.target);   // W2: wpis nieodczytany (badInput) = błąd, nie puste pole
          if (v === null) { e.target.removeAttribute('aria-invalid'); return save(sec, key, null); }
          if (!Number.isFinite(v) || v < f.min || v > f.max) { e.target.setAttribute('aria-invalid', 'true'); clear(msg).append(h('div', { class: 'banner err', role: 'alert' }, `${f.label}: wartość z zakresu ${f.min}–${f.max}.`)); return null; }
          e.target.removeAttribute('aria-invalid'); return save(sec, key, v);
        } });
      refreshers.push(() => { if (document.activeElement !== input) input.value = cur() ?? ''; });
      return h('label', { class: 'tl-f' }, h('span', { class: 'tl-l' }, f.label, f.unit && h('span', { class: 'muted' }, ` (${f.unit})`)), input, hint);
    }
    if (f.type === 'time') {
      const input = h('input', { type: 'time', value: cur() ?? '', 'aria-label': `${LOG[sec].title}: ${f.label}`, onchange: e => save(sec, key, e.target.value || null) });
      refreshers.push(() => { if (document.activeElement !== input) input.value = cur() ?? ''; });
      return h('label', { class: 'tl-f' }, h('span', { class: 'tl-l' }, f.label), input, hint);
    }
    if (f.type === 'bool') {
      const b = chip(f.label, !!cur(), () => save(sec, key, !cur()), 'button');
      refreshers.push(() => setOn(b, !!cur()));
      return h('div', { class: 'tl-f' }, b, hint);
    }
    if (f.type === 'enum') {
      const btns = f.options.map(([k, l]) => chip(l, cur() === k, () => save(sec, key, cur() === k ? null : k), 'radio'));
      refreshers.push(() => btns.forEach((b, i) => setOn(b, cur() === f.options[i][0])));
      return h('fieldset', { class: 'tl-f' }, h('legend', { class: 'tl-l' }, f.label), h('div', { class: 'tl-chips', role: 'radiogroup', 'aria-label': f.label }, btns), hint);
    }
    // multi
    const list = () => (Array.isArray(cur()) ? cur() : []);   // wartość z nowszej wersji (inny typ) traktowana jak brak wyboru
    const btns = f.options.map(([k, l]) => chip(l, list().includes(k), () => { const c = list(); save(sec, key, c.includes(k) ? c.filter(x => x !== k) : [...c, k]); }, 'button'));
    refreshers.push(() => btns.forEach((b, i) => setOn(b, list().includes(f.options[i][0]))));
    return h('fieldset', { class: 'tl-f' }, h('legend', { class: 'tl-l' }, f.label), h('div', { class: 'tl-chips' }, btns), hint);
  }

  function section(sec, open) {
    const badge = h('span', { class: 'tl-badge' }, badgeText(filled(doc(), sec)));
    refreshers.push(() => { badge.textContent = badgeText(filled(doc(), sec)); });
    const body = [h('div', { class: 'tl-grid' }, Object.entries(LOG[sec].fields).map(([k, f]) => field(sec, k, f)))];
    if (sec === 'swim') {
      const pace = h('p', { class: 'tl-derived' });
      const upd = () => { const t = paceText(swimPace(doc())); pace.textContent = t ? `Tempo (część właściwa): ${t}` : ''; };
      upd(); refreshers.push(upd); body.push(pace);
    }
    return h('details', { class: 'tl-sec', open: open || filled(doc(), sec) > 0 }, h('summary', {}, h('span', { class: 'tl-st' }, `${LOG[sec].icon} ${LOG[sec].title}`), badge), ...body);
  }

  const note = h('textarea', { rows: '3', maxlength: String(NOTE_MAX), 'aria-label': 'Notatka do sesji', placeholder: 'Np. samopoczucie, sprzęt, odczucia', value: doc().note ?? '', onchange: e => save('note', null, e.target.value) });
  note.value = doc().note ?? '';
  refreshers.push(() => { if (document.activeElement !== note) note.value = doc().note ?? ''; });

  const planned = r.sauna > 0 || r.dayType === 'rest_sauna2';
  const root = h('section', { class: 'panel tlog', 'aria-labelledby': `tl-h-${date}` },
    h('h2', { id: `tl-h-${date}` }, 'Dziennik sesji'),
    h('p', { class: 'muted' }, 'Wpisy są dobrowolne i zapisują się od razu. Czas treningu — u góry; serie i ciężary — przy ćwiczeniach.'),
    main && section(main, true),
    section('sauna', planned),
    h('div', { class: 'tl-f tl-note' }, h('label', { class: 'tl-l', for: `tl-note-${date}` }, 'Notatka'), Object.assign(note, { id: `tl-note-${date}` })));
  return root;
}
