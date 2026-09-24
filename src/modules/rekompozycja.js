// Moduł Rekompozycja (Etap 6): dokument PLAN_REKOMPOZYCJI po zaakceptowanych zmianach (D-049, D-050).
// Sekcje 1 i 21 oraz zdania z danymi osobowymi i medycznymi pochodzą z pakietu prywatnego (D-035).
import { h, add, plural } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import rekomp from '../data/rekomp.json' with { type: 'json' };

const BOX = { key: ['📌', 'Najważniejsze'], cal: ['🗓', 'Harmonogram'], stop: ['⛔', 'Uwaga'], go: ['✅', 'Tak działaj'] };

// Tekst ze znacznikami {private:N} -> węzły; treść z pakietu albo wyraźny znacznik braku.
function rich(text, pack) {
  const sec = pack?.sections?.find(s => s.id === 'rek-priv');
  return String(text).split(/(\{private:\d+\})/).filter(Boolean).map(part => {
    const m = part.match(/^\{private:(\d+)\}$/);
    if (!m) return part;
    const b = sec?.blocks?.find(x => x.marker === Number(m[1]));
    return b ? h('span', { class: 'priv-in', title: 'z pakietu prywatnego' }, b.text) : h('span', { class: 'priv-miss' }, '🔒 fragment w pakiecie prywatnym');
  });
}

function table(head, rows, pack, caption) {
  return h('div', { class: 'scroll-x rk-tw' }, h('table', { class: 'data rk-table' },
    caption && h('caption', {}, rich(caption, pack)),
    h('thead', {}, h('tr', {}, head.map(c => h('th', {}, rich(c, pack))))),
    h('tbody', {}, rows.map(r => h('tr', {}, r.map(c => h('td', {}, rich(c, pack))))))));
}

function block(b, pack) {
  switch (b.type) {
    case 'h3': return h('h3', { class: 'rk-h3' }, rich(b.text, pack));
    case 'h4': return h('h4', { class: 'rk-h4' }, rich(b.text, pack));
    case 'small': return h('p', { class: 'rk-small' }, rich(b.text, pack));
    case 'list': return h(b.ordered ? 'ol' : 'ul', { class: 'rk-list' }, b.items.map(i => h('li', {}, rich(i, pack))));
    case 'table': return table(b.head, b.rows, pack, b.caption);
    case 'box': { const [ic, lab] = BOX[b.kind] || ['ℹ️', 'Informacja'];
      return h('aside', { class: `rk-box rk-${b.kind}` }, h('p', { class: 'rk-box-h' }, h('span', { 'aria-hidden': 'true' }, ic), b.label || lab), h('p', {}, rich(b.text, pack))); }
    case 'decision': return h('aside', { class: 'rk-box rk-decision' }, h('p', { class: 'rk-box-h' }, '✍️ Decyzja użytkownika — obowiązuje'), h('p', {}, b.text));
    case 'original': return h('details', { class: 'rk-orig' }, h('summary', {}, 'Pierwotne uzasadnienie (nie stanowi obecnej decyzji)'), h('p', {}, rich(b.text, pack)));
    default: return h('p', {}, rich(b.text, pack));
  }
}

// Sekcje prywatne w całości z pakietu (bloki: p / h / list / table)
function privateSection(id, pack) {
  const sec = pack?.sections?.find(s => s.id === `rek-${id}`);
  if (!sec) return [h('p', { class: 'priv-miss block' }, '🔒 Ta sekcja jest w pakiecie prywatnym. Zaimportuj plik 2027-prywatne.json w module Dane i synchronizacja.')];
  return sec.blocks.map(b => b.type === 'h' ? h('h3', { class: 'rk-h3' }, b.text) : b.type === 'list' ? h('ul', { class: 'rk-list' }, b.items.map(i => h('li', {}, i)))
    : b.type === 'table' ? table(b.rows[0] || [], b.rows.slice(1), null) : h('p', {}, b.text));
}

export function renderRekompozycja(root, ctx) {
  const pack = ctx.store?.state?.privatePack || null;
  const open = ctx.params.get('s');
  // Szukanie w planie (D-076): sekcje z trafieniem rozwinięte, pozostałe ukryte — tylko widok, treść bez zmian
  const q = (ctx.params.get('q') || '').trim().toLowerCase();
  const textOf = s => JSON.stringify(s.blocks || '').toLowerCase() + ' ' + s.title.toLowerCase();
  const hits = q ? rekomp.sections.filter(s => textOf(s).includes(q)) : null;
  const setAll = v => document.querySelectorAll('.rk-sec').forEach(d => { d.open = v; });
  add(root,
    h('section', { class: 'hero-tr rk-hero' }, h('div', { class: 'hero-tr-main' },
      h('p', { class: 'eyebrow' }, 'Plan indywidualny · punkt startowy 21.09.2026'),
      h('h1', {}, 'Plan rekompozycji'),
      h('p', { class: 'muted' }, 'Dieta, trening, regeneracja i monitoring — z uwzględnieniem Twoich decyzji. Sekcje i zdania z danymi medycznymi pochodzą z pakietu prywatnego.'),
      !pack && h('p', { class: 'priv-miss block' }, '🔒 Pakiet prywatny nie jest zaimportowany — część treści jest ukryta.'))),
    h('div', { class: 'rk-tools' },
      h('label', { class: 'rk-search' }, h('span', { class: 'sr-only' }, 'Szukaj w planie'),
        h('input', { type: 'search', value: ctx.params.get('q') || '', placeholder: 'Szukaj w planie (np. kreatyna, sen, sauna)',
          onchange: e => { const v = e.target.value.trim(); location.hash = v ? `#/rekompozycja?q=${encodeURIComponent(v)}` : '#/rekompozycja'; } })),
      h('button', { onclick: () => setAll(true) }, icon('chevron-down', { size: 16 }), 'Rozwiń wszystko'),
      h('button', { onclick: () => setAll(false) }, 'Zwiń wszystko')),
    hits && h('p', { class: 'muted rk-hits', role: 'status' }, hits.length
      ? `„${ctx.params.get('q')}”: ${hits.length} ${plural(hits.length, 'sekcja', 'sekcje', 'sekcji')}`
      : `Brak „${ctx.params.get('q')}” w treści planu (fragmenty z pakietu prywatnego nie są przeszukiwane).`),
    h('nav', { class: 'rk-toc', 'aria-label': 'Spis treści' }, (hits || rekomp.sections).map(s =>
      h('a', { href: `#/rekompozycja?s=${s.id}`, class: `rk-toc-a${s.id === open ? ' is-on' : ''}` }, h('span', { class: 'rk-n' }, s.num), s.title, s.private && h('span', { 'aria-label': 'prywatne' }, ' 🔒')))),
    (hits || rekomp.sections).map(s => h('details', { class: 'rk-sec', id: `rk-${s.id}`, open: s.id === open || (hits && hits.length <= 3) || null },
      h('summary', {}, h('span', { class: 'rk-n' }, s.num), h('span', { class: 'rk-t' }, s.title), s.private && h('span', { class: 'rk-lock' }, '🔒')),
      h('div', { class: 'rk-body' }, s.private ? privateSection(s.id, pack) : s.blocks.map(b => block(b, pack))))));
  if (open) requestAnimationFrame(() => document.getElementById(`rk-${open}`)?.scrollIntoView({ block: 'start' }));
}
