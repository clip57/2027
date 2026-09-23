// Moduł Bezpieczeństwo żywności (Etap 6, odsłona 2): czytelne karty produktów zamiast gęstego zestawu pól.
// Dane: Tabela bezpieczeństwa (70 pozycji) + termos (D-013); nazwy wg D-020; brokuły mrożone -> brokuły świeże (D-028).
import { h, add, plural } from '../ui/dom.js';
import { segmented } from '../ui/components.js';
import { SRC } from '../core/data.js';
import guide from '../data/guide.json' with { type: 'json' };

const S = SRC.safety;
const SECTIONS = [...new Set(S.rows.map(r => r.section))];
const SHORT = s => s.split(' — ')[0];
const EVID = { WYS: ['wysokie', 'ev-hi'], UMI: ['umiarkowane', 'ev-mid'], NIS: ['niskie', 'ev-lo'], PRX: ['przybliżenie', 'ev-px'] };
const PREP = { '✔': ['nadaje się do meal prepu', 'ok'], '~': ['meal prep z zastrzeżeniami', 'mid'], '✘': ['nie do meal prepu', 'no'] };
const place = g => /zamraż/.test(g) && !/lodówka/.test(g) ? ['❄️', 'zamrażarka'] : /lodówk/.test(g) ? ['🧊', 'lodówka'] : /szafk|ciemn|chlebak/.test(g) ? ['🗄️', 'szafka'] : /blat/.test(g) ? ['🧺', 'blat'] : /termos/.test(g) ? ['♨️', 'termos'] : ['📍', g];

// „12 h WYS porcjowany: 2 dni” -> { main: '12 h', ev: 'WYS', rest: 'porcjowany: 2 dni' }
function splitLimit(txt) {
  const m = txt.match(/^(.*?)\s*\b(WYS|UMI|NIS|PRX)\b\s*(.*)$/);
  return m ? { main: m[1].trim(), ev: m[2], rest: m[3].trim() } : { main: txt, ev: null, rest: '' };
}
const val = v => (v && v !== '—' ? v : null);

export function renderBezpieczenstwo(root, ctx) {
  const q = (ctx.params.get('q') || '').toLowerCase();
  const sec = ctx.params.get('s') || '';
  const mode = ctx.params.get('m') || 'karty';
  const go = o => { const p = new URLSearchParams({ q: ctx.params.get('q') || '', s: sec, m: mode, ...o }); [...p].forEach(([k, v]) => !v && p.delete(k)); location.hash = `#/bezpieczenstwo?${p}`; };
  const link = ctx.params.get('p') ? S.product_links[ctx.params.get('p')] : null;
  const rows = S.rows.filter(r => (!sec || r.section === sec) && (!link || r.Produkt === link)
    && (!q || Object.values(r).join(' ').toLowerCase().includes(q)));

  add(root, h('h1', {}, 'Bezpieczeństwo żywności'),
    h('div', { class: 'rules' },
      [['🧊', 'Lodówka', '≤ 4 °C'], ['❄️', 'Zamrażarka', '−18 °C'], ['⏱', 'Poza chłodzeniem', 'maks. 2 h'],
        ['♨️', 'Odgrzewanie', '70 °C / 2 min lub 75 °C / 30 s'], ['🥡', 'Lunch w termosie', 'prosto z patelni, > 63 °C przy jedzeniu']]
        .map(([i, t, v]) => h('div', { class: 'rule' }, h('span', { class: 'rule-i', 'aria-hidden': 'true' }, i), h('span', { class: 'rule-t' }, t), h('strong', {}, v)))),
    h('div', { class: 'sf-search' },
      h('input', { type: 'search', value: ctx.params.get('q') || '', placeholder: '🔍 Szukaj produktu, miejsca lub ryzyka', 'aria-label': 'Szukaj',
        onchange: e => go({ q: e.target.value, p: '' }) }),
      segmented('Widok', [{ value: 'karty', label: 'Karty' }, { value: 'tabela', label: 'Tabela' }, { value: 'poradnik', label: 'Poradnik' }], mode, m => go({ m }))),
    h('div', { class: 'pills', role: 'group', 'aria-label': 'Kategoria' },
      h('button', { class: `pill-b${!sec ? ' is-on' : ''}`, 'aria-pressed': String(!sec), onclick: () => go({ s: '', p: '' }) }, 'Wszystko'),
      SECTIONS.map(x => h('button', { class: `pill-b${x === sec ? ' is-on' : ''}`, 'aria-pressed': String(x === sec), onclick: () => go({ s: x, p: '' }) }, SHORT(x)))),
    h('p', { class: 'muted' }, `${rows.length} ${plural(rows.length, 'pozycja', 'pozycje', 'pozycji')}${link ? ` · odesłanie: ${link}` : ''}`));

  if (mode === 'poradnik') { renderGuide(root, ctx); return; }
  if (mode === 'tabela') {
    add(root, h('div', { class: 'scroll-x' }, h('table', { class: 'data safety-table' },
      h('thead', {}, h('tr', {}, S.columns.map(c => h('th', {}, c)))),
      h('tbody', {}, rows.map(r => h('tr', { class: r.user_decision ? 'is-decision' : null }, S.columns.map(c => h('td', {}, r[c] || ''))))))),
    h('button', { onclick: () => print() }, '🖨 Drukuj (A4 poziomo)'));
    return;
  }

  const bySec = rows.reduce((m, r) => ((m[r.section] ||= []).push(r), m), {});
  for (const [s, list] of Object.entries(bySec)) {
    const [title, note] = s.split(' — ');
    add(root, h('section', { class: 'sf-sec' },
      h('h2', { class: 'sf-sec-h' }, title, note && h('span', { class: 'muted' }, ` — ${note}`)),
      h('div', { class: 'sf-grid' }, list.map(r => {
        const lim = splitLimit(r['FINALNY LIMIT'] || '');
        const [pi, pl] = place(r.Gdzie || '');
        const facts = [['Po otwarciu', val(r['Po otwarciu'])], ['Po przygotowaniu', val(r['Po przygot.'])], ['Po rozmrożeniu', val(r['Po rozmroż.'])]].filter(([, v]) => v);
        const prep = PREP[r.Prep];
        return h('article', { class: `sf-card${r.user_decision ? ' is-decision' : ''}` },
          h('div', { class: 'sf-top' },
            h('div', {}, h('h3', {}, r.Produkt), val(r.Forma) && h('p', { class: 'muted small' }, r.Forma)),
            h('span', { class: 'sf-place', title: r.Gdzie }, h('span', { 'aria-hidden': 'true' }, pi), pl)),
          h('div', { class: 'sf-limit' },
            h('span', { class: 'eyebrow' }, 'Limit'),
            h('strong', { class: 'sf-limit-v' }, lim.main),
            lim.ev && h('span', { class: `ev ${EVID[lim.ev][1]}` }, `dowody: ${EVID[lim.ev][0]}`),
            lim.rest && h('span', { class: 'sf-limit-r' }, lim.rest)),
          h('div', { class: 'sf-meta' },
            val(r['Temp.']) && h('span', { class: 'sf-chip' }, `🌡 ${r['Temp.']}`),
            prep && h('span', { class: `sf-chip prep-${prep[1]}` }, prep[0]),
            val(r['Próżnia']) && h('span', { class: 'sf-chip' }, `próżnia: ${r['Próżnia']}`)),
          facts.length > 0 && h('dl', { class: 'sf-facts' }, facts.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v)))),
          val(r['Najważniejsze ryzyko']) && h('p', { class: 'sf-risk' }, h('span', { 'aria-hidden': 'true' }, '⚠️ '), h('strong', {}, 'Ryzyko: '), r['Najważniejsze ryzyko']),
          (val(r.Opakowanie) || val(r.Gdzie)) && h('details', { class: 'sf-more' }, h('summary', {}, 'Przechowywanie i opakowanie'),
            val(r.Gdzie) && h('p', {}, h('strong', {}, 'Gdzie: '), r.Gdzie),
            val(r.Opakowanie) && h('p', {}, h('strong', {}, 'Opakowanie: '), r.Opakowanie)),
          r.user_decision && h('p', { class: 'muted small' }, `Pozycja z decyzji użytkownika (${(r.decisions || []).join(', ')}).`));
      }))));
  }
}

// ---------------- Poradnik (Bezpieczne v3 po zaakceptowanych zmianach) ----------------
const TAGS = /(PRAWO|ORGAN|PARAMETR|MOJA REK\.|✅ bez zmian|⚠️ korekta)/;
const TAG_CLS = { PRAWO: 'tg-law', ORGAN: 'tg-org', PARAMETR: 'tg-op', 'MOJA REK.': 'tg-me', '✅ bez zmian': 'tg-ok', '⚠️ korekta': 'tg-warn' };
const tagged = t => String(t).split(TAGS).filter(Boolean).map(x => TAG_CLS[x] ? h('span', { class: `tg ${TAG_CLS[x]}` }, x) : x);

function gblock(b) {
  switch (b.type) {
    case 'h3': return h('h3', { class: 'rk-h3' }, tagged(b.text));
    case 'h4': return h('h4', { class: 'gd-h4' }, tagged(b.text));
    case 'old': return h('p', { class: 'gd-old' }, b.text);
    case 'small': return h('p', { class: 'rk-small' }, tagged(b.text));
    case 'list': return h(b.ordered ? 'ol' : 'ul', { class: 'rk-list' }, b.items.map(i => h('li', {}, tagged(i))));
    case 'table': return h('div', { class: 'scroll-x rk-tw' }, h('table', { class: 'data rk-table' },
      h('thead', {}, h('tr', {}, b.head.map(c => h('th', {}, c)))), h('tbody', {}, b.rows.map(r => h('tr', {}, r.map(c => h('td', {}, tagged(c))))))));
    case 'card': return h('article', { class: `gd-card gd-${b.kind}` }, b.kind === 'rt' && h('p', { class: 'eyebrow' }, 'Korekta'), b.blocks.map(gblock));
    default: return h('p', {}, tagged(b.text));
  }
}

function renderGuide(root, ctx) {
  const open = ctx.params.get('g');
  add(root,
    h('section', { class: 'panel gd-intro' }, guide.intro.map(gblock)),
    guide.sections.map((s, i) => h('details', { class: 'rk-sec', open: String(i) === open || (i === 0 && !open) || null },
      h('summary', {}, h('span', { class: 'rk-t' }, s.title)),
      h('div', { class: 'rk-body' }, s.blocks.map(gblock)))));
}
