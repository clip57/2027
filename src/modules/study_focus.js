// Tryb skupienia — Nauka (D-114 etap 2; CFA i MPW, widok wspólny jak study.js): jeden blok naraz — źródło, temat, tryb, zadania bloku,
// pierścień 53 min (ten sam minutnik co w widoku dnia), „Blok wykonany” albo przesunięcie karty w prawo, poprzedni / następny blok.
// Zapis odhaczenia tą samą funkcją co w module (`toggle` → P.types.done). Wyjście: ✕ albo Esc.
import { h, add, plural } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { swipeRow } from '../ui/gestures.js';
import { sfx } from '../ui/signal.js';
import { focusTop, focusScale, focusTimer, focusKeys } from '../ui/focus.js';
import { cfaSourceLine, sourceText } from '../core/resolver.js';
import { dayShort, shortDate } from '../core/dates.js';

let pos = null;   // { id, date, nr }

export function renderStudyFocus(root, ctx, P, { done, toggle }) {
  const { today } = ctx;
  const D = P.D;
  const date = ctx.params.get('d') || (today < D.stat.start ? D.stat.start : today > D.stat.end ? D.stat.end : today);
  const blocks = P.byDay[date] || [];
  const exit = `#/${P.id}?v=dzien&d=${date}`;
  const wrap = h('div', { class: 'fx', style: { '--dc': 'var(--cfa)' } });
  add(root, wrap);
  if (!blocks.length) {
    add(wrap, focusTop({ exit, title: `Nauka ${P.name}` }),
      h('p', { class: 'fx-msg' }, `${dayShort(date)} ${shortDate(date)}: brak bloków ${P.name} w planie.`),
      h('a', { class: 'btn primary fx-wide', href: exit }, 'Wróć do planu'));
    return;
  }
  const isDone = b => done().has(b.nr);
  const first = blocks.find(b => !isDone(b));
  if (!pos || pos.id !== P.id || pos.date !== date || !blocks.some(b => b.nr === pos.nr)) pos = { id: P.id, date, nr: (first || blocks[blocks.length - 1]).nr };
  const cur = blocks.find(b => b.nr === pos.nr), i = blocks.indexOf(cur), k = blocks.filter(isDone).length;
  const go = d => { const n = blocks[i + d]; if (!n) return; pos = { id: P.id, date, nr: n.nr }; ctx.rerender(); };
  const complete = async () => {
    sfx('check');
    await toggle(cur.nr, true);
    const n = blocks.find(b => !done().has(b.nr));
    if (n) pos = { id: P.id, date, nr: n.nr }; else sfx('done');
    ctx.rerender();
  };
  const undo = async () => { await toggle(cur.nr, false); ctx.rerender(); };
  add(wrap,
    focusTop({ exit, title: `Nauka ${P.name}`, sub: `${dayShort(date)} ${shortDate(date)} · ${k} / ${blocks.length} ${plural(blocks.length, 'blok', 'bloki', 'bloków')}`,
      info: { label: `Error log ${P.name}`, ic: 'list-todo', run: () => { location.hash = `#/${P.id}?v=log`; } } }),
    focusScale([blocks.map(b => ({ done: isDone(b), cur: b === cur }))], `Bloki dnia: ${k} z ${blocks.length} wykonanych`));
  const card = h('section', { class: `fx-set${isDone(cur) ? ' is-done' : ''}`, 'aria-labelledby': 'fx-set-h' },
    h('div', { class: 'fx-set-h' },
      h('button', { class: 'fx-nav', 'aria-label': 'Poprzedni blok', disabled: i === 0 || null, onclick: () => go(-1) }, icon('chevron-left', { size: 22 })),
      h('h3', { id: 'fx-set-h' }, `Blok ${cur.blok} · ${cur.godz}`, isDone(cur) && h('span', { class: 'fx-tag' }, icon('check', { size: 14 }), 'wykonany')),
      h('button', { class: 'fx-nav', 'aria-label': 'Następny blok', disabled: i === blocks.length - 1 || null, onclick: () => go(1) }, icon('chevron-right', { size: 22 }))),
    h('div', { class: 'fx-ex fx-study' },
      h('p', { class: 'fx-k' }, `${cur.tryb} · nr ${cur.nr}`),
      h('h2', { class: 'fx-name' }, cur.temat),
      h('p', { class: 'fx-plan', title: cfaSourceLine(cur) }, sourceText(cur))),
    P.tasks && P.taskOf?.(cur) && h('details', { class: 'cf-task fx-task' }, h('summary', {}, 'Zadania bloku'), h('p', {}, P.taskOf(cur))),
    isDone(cur)
      ? h('button', { class: 'fx-undo', onclick: undo }, icon('undo-2', { size: 18 }), h('span', {}, 'Cofnij — blok niewykonany'))
      : h('button', { class: 'primary fx-go', onclick: complete }, icon('check', { size: 22 }), h('span', {}, 'Blok wykonany')));
  swipeRow(card, isDone(cur) ? { left: { label: 'Cofnij', ic: 'undo-2', tone: 'neutral', run: undo } } : { right: { label: 'Blok wykonany', ic: 'check', run: complete } });
  const n2 = blocks[i + 1];
  add(wrap,
    !isDone(cur) && focusTimer(`study|${P.id}|${cur.nr}`, 53, `Blok ${cur.blok}: ${cur.temat}`, ctx.flash),
    card,
    n2 && h('p', { class: 'fx-next' }, h('span', { class: 'fx-l' }, 'Następnie'), `Blok ${n2.blok} · ${n2.godz} · ${n2.temat}`));
  focusKeys(wrap, { exit, primary: isDone(cur) ? null : complete, nav: go });
}
