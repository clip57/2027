// Moduł Zapasy (Etap 4, odsłona 2): odwzorowanie funkcji pierwotnego pliku ZAPASY_DIETA.html
// na nowej architekturze — stan liczony z inwentaryzacji i planu (D-003, D-027), zapis zdarzeniami,
// bez dat zakodowanych na sztywno i bez wstawiania danych do innerHTML.
import { h, clear, fmt, plural, add } from '../ui/dom.js';
import { stockAt, forecast, status, statusInfo, shoppingList, nextShopping, allItems, runway } from '../core/calc/inventory.js';
import { icon } from '../ui/icons.js';
import { reduce } from '../core/storage/store.js';
import { exportBundle, preview, apply } from '../core/sync/bundle.js';
import { consumptionForDay } from '../core/calc/consumption.js';
import { SRC, catalogById } from '../core/data.js';
// Nazwy z Tabeli bezpieczeństwa — link „Przechowywanie” tylko przy identycznej nazwie (bez zgadywania powiązań)
const SAFE = new Set(SRC.safety.rows.map(r => r.Produkt));
import { addDays, dayShort, longDate, shortDate, diffDays } from '../core/dates.js';
import { resolveDay } from '../core/resolver.js';

const CATS = ['Wszystko', 'Śniadanie', 'Lunch', 'Przekąska', 'Po treningu', 'Obiad', 'Kolacja', 'Napoje', 'Suplementy'];
const SORTS = [['days', 'Najmniej dni'], ['urgent', 'Najpilniejsze'], ['shop', 'Do zakupów'],
  ['name', 'Nazwa A–Z'], ['cat', 'Kategoria'], ['most', 'Najwięcej dni']];
const LABEL = { OK: 'Zapas OK', WARNING: 'Średni stan', CRITICAL: 'Pilny brak', UNKNOWN: 'Brak stanu', UNTRACKED: 'Nieśledzony' };
const DN = ['Nd', 'Pn', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'], MN = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const v31Date = d => { const [y, m, dd] = d.split('-').map(Number); const x = new Date(y, m - 1, dd); return `${DN[x.getDay()]}, ${dd} ${MN[m - 1]}`; };
const UNITS = ['g', 'kaps.', 'szt.', 'ml', 'tabl.'];
const rank = { CRITICAL: 0, WARNING: 1, UNKNOWN: 2, OK: 3, UNTRACKED: 4 };
// Rozwinięte sekcje przetrwają przerysowanie widoku po zapisie (np. kilka korekt z rzędu) — stan wyłącznie interfejsu.
const opened = new Set();
const keepOpen = key => ({ open: opened.has(key) || null, ontoggle: e => { if (e.target.open) opened.add(key); else opened.delete(key); } });

const dialog = (title, ...body) => {
  const d = h('dialog', { class: 'sheet' });
  const close = () => { d.close(); d.remove(); };
  d.append(h('div', { class: 'sheet-head' }, h('h2', {}, title), h('button', { onclick: close, 'aria-label': 'Zamknij' }, '✕')),
    h('div', { class: 'sheet-body' }, ...body.filter(Boolean)));
  document.body.append(d); d.showModal();
  return { el: d, close };
};

export function renderZapasy(root, ctx) {
  const { store, today } = ctx;
  if (!store) {
    add(root, h('h1', {}, 'Zapasy'), h('div', { class: 'banner err' }, 'Baza danych jest niedostępna — stany nie mogą być wyświetlone ani zapisane.'));
    return;
  }
  const cat = ctx.params.get('c') || 'Wszystko';
  const sort = ctx.params.get('sort') || 'days';
  const filter = ctx.params.get('s') || 'all';
  const query = ctx.params.get('q') || '';
  const goto = (o = {}) => {
    const p = new URLSearchParams({ c: cat, sort, s: filter, q: query, ...o });
    [...p].forEach(([k, v]) => { if (!v || (k === 's' && v === 'all') || (k === 'c' && v === 'Wszystko')) p.delete(k); });
    location.hash = `#/zapasy${p.toString() ? `?${p}` : ''}`;
  };
  const msg = h('div', { role: 'status', 'aria-live': 'polite' });
  const err = e => clear(msg).append(h('div', { class: 'banner err' }, e.message || String(e)));
  const save = async (type, data, text) => {
    try { await store.record(type, data); if (text) ctx.flash(text); ctx.rerender(); } catch (e) { err(e); }
  };

  const items = [...allItems(), ...(store.state.catalogUser || [])];
  const day = resolveDay(today);
  const shop = nextShopping(today, new Date().getHours(), store.state.settings.shopWeekday ?? 6);
  const rows = items.map(it => {
    const st = stockAt(store.state.inv, it.id, today);
    const fc = forecast(it.id, st, today);
    const daily = consumptionForDay(today)[it.id] ?? it.daily_v31 ?? 0;
    const info = statusInfo(it, st, fc);
    return { it, st, fc, daily, info, status: info.code };
  });
  const list = shoppingList(store.state.inv, today, items);
  const shopIds = new Set(list.map(x => x.id));
  const counts = rows.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
  const soonest = rows.filter(r => r.fc?.runOut).sort((a, b) => (a.fc.runOut < b.fc.runOut ? -1 : 1))[0];

  const undoable = store.allEvents().filter(e => ['inv.count', 'inv.move', 'inv.dayshift'].includes(e.t))
    .sort((a, b) => (a.hlc < b.hlc ? -1 : 1));
  const last = undoable[undoable.length - 1];
  const packs = list.reduce((n, x) => n + x.packs, 0);
  const known = rows.filter(r => r.st != null && r.it.tracked !== false).length;
  // Kolejność listy zakupów wg pilności (najwcześniejszy brak najpierw) — ta sama lista co w oknie planu zakupów
  const runOut = id => rows.find(r => r.it.id === id)?.fc?.runOut || '9999-12-31';
  const byNeed = list.slice().sort((a, b) => (runOut(a.id) < runOut(b.id) ? -1 : runOut(a.id) > runOut(b.id) ? 1 : a.name.localeCompare(b.name, 'pl')));

  // ---------- nagłówek
  add(root, h('header', { class: 'zp-head' }, h('h1', {}, 'Zapasy'),
    h('div', { class: 'topline' }, h('span', { class: 'date' }, `${dayShort(today)} ${longDate(today)}`),
      h('span', { class: 'chip' }, `Faza ${day.phase ?? 0}`), h('span', { class: 'chip' }, day.dietVariant === 'T' ? 'dzień treningowy' : 'dzień nietreningowy'))), msg);

  // ---------- przegląd: zdrowie magazynu (pasek z liczników statusów) i najbliższe zakupy (D-072)
  const seg = k => (counts[k] || 0) / (rows.length || 1) * 100;
  add(root, h('section', { class: 'dash', 'aria-label': 'Przegląd zapasów' },
    h('div', { class: 'dash-box zp-health' }, h('p', { class: 'dash-l' }, 'Stan magazynu'),
      h('p', { class: 'dash-v' }, `${rows.length} pozycji`),
      h('span', { class: 'zp-hbar', role: 'img', 'aria-label': `Pilne ${counts.CRITICAL || 0}, średnie ${counts.WARNING || 0}, wystarczające ${counts.OK || 0}, bez stanu ${counts.UNKNOWN || 0}` },
        ['CRITICAL', 'WARNING', 'OK', 'UNKNOWN'].map(k => h('span', { class: `s-${k}`, style: { width: `${seg(k)}%` } }))),
      h('p', { class: 'zp-legend' },
        [['CRITICAL', 'pilne'], ['WARNING', 'średnie'], ['OK', 'OK'], ['UNKNOWN', 'bez stanu']].filter(([k]) => counts[k]).map(([k, l]) =>
          h('span', {}, h('span', { class: `dot-s s-${k}`, 'aria-hidden': 'true' }), `${counts[k]} ${l}`))),
      soonest && h('p', { class: 'muted' }, `Najbliższy brak: ${soonest.it.name} (${dayShort(soonest.fc.runOut)} ${shortDate(soonest.fc.runOut)})`))));

  // ---------- akcje: zwarta siatka ikon (wszystkie funkcje D-046 bez zmian)
  const act = (ic, label, onclick, extra = {}) => h('button', { class: 'zp-act', onclick, ...extra }, icon(ic, { size: 20 }), h('span', {}, label));
  add(root, h('div', { class: 'actions', role: 'group', 'aria-label': 'Narzędzia zapasów' },
    act('shopping-cart', 'Zakupy', () => shopDialog(), { class: 'zp-act primary' }),
    act('plus', 'Dodaj', () => addDialog()),
    act('receipt', 'Paragon', () => receiptDialog()),
    act('undo-2', 'Cofnij', () => undo(last), { disabled: !last }),
    act('history', 'Historia', () => historyDialog()),
    act('bot', 'Status AI', () => aiStatus()),
    act('save', 'Kopia', () => backupDialog())));

  // ---------- do kupienia: najpilniejsze pozycje z listy zakupów, „Kupione” jednym dotknięciem (D-072)
  const shopCard = h('section', { class: 'zp-shop', 'aria-labelledby': 'zp-shop-h' },
    h('div', { class: 'zp-shop-h' }, h('h2', { id: 'zp-shop-h' }, icon('shopping-cart', { size: 18 }), 'Do kupienia'),
      h('span', { class: 'zp-shop-d' }, `${dayShort(shop.date)} ${shortDate(shop.date)} · ${shop.inDays === 0 ? 'dzisiaj' : `za ${shop.inDays} ${plural(shop.inDays, 'dzień', 'dni', 'dni')}`}`)),
    h('p', { class: 'muted' }, `Następne zakupy: ${list.length} ${plural(list.length, 'pozycja', 'pozycje', 'pozycji')} · ${packs} ${plural(packs, 'opakowanie', 'opakowania', 'opakowań')}. Najpilniejsze:`),
    list.length === 0 ? h('p', { class: 'muted' }, known ? 'Nic nie trzeba kupować — zapasy wystarczą.' : 'Ustaw stany pozycji, aby wyliczyć zakupy.') :
      h('ul', { class: 'zp-buy' }, byNeed.slice(0, 5).map(x => h('li', {},
        h('span', { class: 'zp-buy-n' }, x.name, h('span', { class: 'muted' }, `${x.packs} × ${fmt(x.packSize)} ${x.unit} · masz ${fmt(x.current, 1)}`)),
        h('button', { class: 'zp-buy-b', 'aria-label': `Kupione: ${x.name}, +${fmt(x.toBuy)} ${x.unit}`,
          onclick: () => save('inv.move', { prod: x.id, qty: x.toBuy, date: today, kind: 'purchase' }, `${x.name}: +${fmt(x.toBuy)} ${x.unit} (kupione)`) },
          icon('check', { size: 16 }), h('span', {}, `+${fmt(x.toBuy)} ${x.unit}`))))),
    list.length > 5 && h('button', { class: 'zp-more-b', onclick: () => shopDialog() }, `Pełny plan zakupów (${list.length})`));

  // ---------- korekta zużycia dnia (rzadko) — zwinięta
  const dayFix = h('details', { class: 'daycard', ...keepOpen('dayfix') },
    h('summary', {}, icon('sliders-horizontal', { size: 18 }), h('span', {}, 'Korekta zużycia dnia'),
      h('span', { class: 'muted' }, 'zużycie liczone automatycznie z planu')),
    h('p', { class: 'muted' }, `${dayShort(today)} ${longDate(today)} · ${day.dietVariant === 'T' ? 'dzień treningowy' : 'dzień nietreningowy'} · Faza ${day.phase ?? 0}. Użyj, gdy rzeczywiste zużycie różni się od planu o cały dzień.`),
    h('div', { class: 'row' },
      h('button', { onclick: () => save('inv.dayshift', { date: today, dir: 1 }, 'Cofnięto zużycie jednego dnia.') }, '+1 dzień (cofnij zużycie)'),
      h('button', { onclick: () => save('inv.dayshift', { date: today, dir: -1 }, 'Odliczono zużycie jednego dnia.') }, '−1 dzień (odlicz)')));

  // ---------- filtry, wyszukiwarka, sortowanie, kategorie
  const zmain = h('div', { class: 'zp-main' });
  add(zmain, h('div', { class: 'counters', role: 'group', 'aria-label': 'Filtr statusu' },
    [['CRITICAL', 'Pilne'], ['WARNING', 'Średnie'], ['OK', 'OK']].map(([k, lab]) =>
      h('button', { class: `counter c-${k}${filter === k ? ' is-on' : ''}`, 'aria-pressed': String(filter === k),
        onclick: () => goto({ s: filter === k ? 'all' : k }) }, h('span', { class: `dot-s s-${k}`, 'aria-hidden': 'true' }), h('strong', {}, String(counts[k] || 0)), h('span', {}, lab)))),
    h('div', { class: 'toolbar' },
      h('input', { type: 'search', value: query, placeholder: 'Szukaj pozycji…', 'aria-label': 'Szukaj pozycji',
        onchange: e => goto({ q: e.target.value }) }),
      h('select', { 'aria-label': 'Sortowanie', onchange: e => goto({ sort: e.target.value }) },
        SORTS.map(([v, lab]) => h('option', { value: v, selected: v === sort }, lab)))),
    h('div', { class: 'pills' }, CATS.map(c => h('button', { class: `pill-b${c === cat ? ' is-on' : ''}`, 'aria-pressed': String(c === cat),
      onclick: () => goto({ c }) }, c))));

  // ---------- lista pozycji
  let visible = rows.filter(r => (cat === 'Wszystko' || r.it.category === cat)
    && (filter === 'all' || (filter === 'shop' ? shopIds.has(r.it.id) : r.status === filter))
    && (!query || r.it.name.toLowerCase().includes(query.toLowerCase())));
  const days = r => (r.fc ? r.fc.days : Infinity);
  const cmp = { days: (a, b) => days(a) - days(b), most: (a, b) => days(b) - days(a),
    urgent: (a, b) => rank[a.status] - rank[b.status] || days(a) - days(b),
    shop: (a, b) => (shopIds.has(b.it.id) - shopIds.has(a.it.id)) || days(a) - days(b),
    name: (a, b) => a.it.name.localeCompare(b.it.name, 'pl'),
    cat: (a, b) => (a.it.category || '').localeCompare(b.it.category || '', 'pl') || a.it.name.localeCompare(b.it.name, 'pl') };
  visible = visible.sort(cmp[sort] || cmp.days);

  add(zmain, h('div', { class: 'inv' }, visible.length === 0 ? h('p', { class: 'muted' }, 'Brak pozycji dla tego widoku.') :
    visible.map(r => {
      const it = r.it;
      const runsOutBeforeShopping = r.fc?.runOut && r.fc.runOut <= shop.date;
      const rw = r.st != null && it.tracked !== false && r.daily > 0 ? runway(it, r.fc, shop.inDays) : null;
      const unitTag = it.unit === 'g' || it.unit === 'ml' ? it.unit.toUpperCase() : ` ${it.unit}`;
      return h('article', { class: `inv-item st-${r.status}`, id: `zp-${it.id}` },
        h('div', { class: 'inv-head' },
          h('h3', {}, it.name),
          h('span', { class: `pill pill-${r.status}` }, r.info.badge)),
        h('p', { class: 'inv-sum' },
          h('span', { class: 'tag' }, it.category === 'Suplementy' ? 'SUPLEMENT' : it.shelfLife === 'short' ? 'ŚWIEŻE (≤7D)' : 'TRWAŁE (>7D)'),
          h('span', { class: 'inv-meta' },
            r.st == null ? 'Stan nieznany — ustaw stan poniżej.' :
            r.st <= 0 ? 'Wystarczy do: DZIŚ (Brak)' :
            r.fc?.lastCovered ? `Wystarczy do: ${v31Date(r.fc.lastCovered)}` : r.daily ? 'Wystarczy do: dziś' : 'Nie jest zużywana'),
          r.st != null && it.tracked !== false && r.daily > 0 && h('span', { class: runsOutBeforeShopping || r.st <= 0 ? 'inv-warn' : 'inv-ok' },
            (() => {
              if (r.st <= 0) return `⚠️ Brak na ${shop.inDays} ${plural(shop.inDays, 'dzień', 'dni', 'dni')} przed zakupami`;
              if (!runsOutBeforeShopping) return '✓ Wystarczy do zakupów';
              const d = Math.max(1, diffDays(r.fc.runOut, shop.date));
              return `⚠️ Skończy się ${d}d przed zakupami`;
            })())),
        // Pasek zapasu: dni pokrycia na tle 14 dni (suplementy 30) z kreską dnia zakupów
        rw && h('span', { class: 'zp-run', role: 'img', 'aria-label': `Zapas na ${fmt(rw.days, 1)} dnia, zakupy za ${shop.inDays} ${plural(shop.inDays, 'dzień', 'dni', 'dni')}` },
          h('span', { class: 'zp-run-f', style: { width: `${rw.pct}%` } }), h('span', { class: 'zp-run-s', style: { left: `${rw.shopPct}%` } })),
        it.tracked === false ? h('p', { class: 'muted' }, 'Pozycja nieśledzona (zapas wieloletni).') :
          h('div', { class: 'inv-actions' },
            h('label', { class: 'inv-set' }, h('span', { class: 'sr-only' }, 'Stan'),
              h('input', { type: 'number', inputmode: 'decimal', step: 'any', min: '0', value: r.st == null ? '' : String(r.st),
                'aria-label': `Stan: ${it.name}`,
                onchange: e => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) save('inv.count', { prod: it.id, qty: v, date: today }, `${it.name}: stan ${fmt(v, 1)} ${it.unit}`); } }),
              h('span', {}, it.unit)),
            h('button', { class: 'zp-pack', 'aria-label': `+ opakowanie (${fmt(it.packSize || 1)} ${it.unit}): ${it.name}`,
              onclick: () => save('inv.move', { prod: it.id, qty: it.packSize || 1, date: today, kind: 'purchase' }, `${it.name}: +${fmt(it.packSize || 1)} ${it.unit}`) },
              icon('plus', { size: 16 }), h('span', {}, `${fmt(it.packSize || 1)} ${it.unit}`)),
            moreBox()),
        it.tracked === false && moreBox());
      // Szczegóły i rzadsze korekty — zwinięte (w wierszu czynności; po rozwinięciu zajmują całą szerokość)
      function moreBox() { return h('details', { class: 'zp-more', ...keepOpen(`more:${it.id}`) }, h('summary', { 'aria-label': `Szczegóły i korekty: ${it.name}` }, icon('ellipsis', { size: 18 }), h('span', {}, 'Więcej')),
          h('p', { class: 'inv-tags' },
            it.packSize && h('span', { class: 'tag' }, `Opakowanie ${fmt(it.packSize)}${unitTag}`),
            it.maxLimit && h('span', { class: 'tag' }, `Limit: ${fmt(it.maxLimit)} ${it.unit}`),
            r.daily > 0 && h('span', { class: 'tag' }, `${fmt(r.daily, 2)} ${it.unit}/d`),
            it.note && h('span', { class: 'tag' }, it.note),
            h('span', { class: 'tag' }, it.category),
            SAFE.has(it.name) && h('a', { class: 'btn zp-safe', href: `#/bezpieczenstwo?q=${encodeURIComponent(it.name)}` }, 'Przechowywanie →')),
          it.tracked !== false && h('div', { class: 'row' },
            h('button', { onclick: () => save('inv.move', { prod: it.id, qty: -(r.daily || 1), date: today, kind: 'adjust' }, `${it.name}: −1 porcja`) }, '− porcja'),
            h('button', { onclick: () => save('inv.move', { prod: it.id, qty: (r.daily || 1), date: today, kind: 'adjust' }, `${it.name}: +1 porcja`) }, '+ porcja'),
            String(it.id).startsWith('custom_') && h('button', { class: 'danger', 'aria-label': `Usuń ${it.name}`,
              onclick: () => confirm(`Usunąć pozycję „${it.name}”?`) && save('cat.delete', { id: it.id }, `Usunięto ${it.name}.`) }, 'Usuń pozycję'))); }
    })));

  // ---------- operacje zbiorcze (rzadkie, nieodwracalne bez historii) — zwinięte
  add(zmain, h('details', { class: 'zp-bulk' }, h('summary', {}, 'Operacje zbiorcze'), h('div', { class: 'row bulk' },
    h('button', { class: 'danger', onclick: async () => {
      if (!confirm('Wyzerować stany wszystkich pozycji? Zmianę można cofnąć w historii.')) return;
      try { for (const r of rows) if (r.it.tracked !== false) await store.record('inv.count', { prod: r.it.id, qty: 0, date: today });
        ctx.flash('Wyzerowano stany.'); ctx.rerender(); } catch (e) { err(e); }
    } }, 'Zeruj stany'),
    h('button', { onclick: async () => {
      const custom = store.state.catalogUser || [];
      if (!custom.length) return ctx.flash('Lista jest już fabryczna.') || ctx.rerender();
      if (!confirm(`Usunąć ${custom.length} własnych pozycji? Stany fabrycznych pozycji zostaną bez zmian.`)) return;
      try { for (const c of custom) await store.record('cat.delete', { id: c.id });
        ctx.flash('Przywrócono listę fabryczną.'); ctx.rerender(); } catch (e) { err(e); }
    } }, 'Fabryczna lista'))));

  // Układ: telefon — przegląd, zakupy, akcje, lista; komputer — lista + przyklejona kolumna zakupów (D-072)
  add(root, h('div', { class: 'zp-layout' }, zmain, h('aside', { class: 'zp-aside', 'aria-label': 'Zakupy i korekty' }, shopCard, dayFix)));

  // ================= okna =================
  function undo(ev) {
    const name = id => catalogById[id]?.name || (store.state.catalogUser.find(c => c.id === id)?.name) || id;
    if (ev.t === 'inv.move') return save('inv.move', { prod: ev.d.prod, qty: -ev.d.qty, date: today, kind: 'adjust' }, `Cofnięto: ${name(ev.d.prod)}`);
    if (ev.t === 'inv.dayshift') return save('inv.dayshift', { date: ev.d.date, dir: -ev.d.dir }, 'Cofnięto korektę dnia.');
    if (ev.t === 'inv.count') {
      const prev = store.allEvents().filter(e => e.t === 'inv.count' && e.d.prod === ev.d.prod && e.hlc < ev.hlc)
        .sort((a, b) => (a.hlc < b.hlc ? -1 : 1)).pop();
      if (!prev) return ctx.flash('Nie ma wcześniejszego stanu do przywrócenia.') || ctx.rerender();
      return save('inv.count', { prod: ev.d.prod, qty: prev.d.qty, date: today }, `Przywrócono stan: ${name(ev.d.prod)}`);
    }
  }

  function addDialog() {
    const f = {};
    const field = (label, el) => h('label', { class: 'field' }, h('span', {}, label), el);
    const input = (key, props) => (f[key] = h('input', props));
    const select = (key, opts) => (f[key] = h('select', {}, opts.map(o => h('option', { value: o[0] }, o[1]))));
    const dlg = dialog('Dodaj nową pozycję',
      field('Nazwa', input('name', { placeholder: 'np. Cynk organiczny, Dorsz' })),
      field('Kategoria', select('cat', CATS.slice(1).concat([['Inne']]).map(c => (Array.isArray(c) ? c : [c, c])))),
      field('Trwałość', select('shelf', [['short', 'Świeże (≤ 7 dni, alert < 2 dni)'], ['long', 'Trwałe (> 7 dni, alert < 7 dni)']])),
      field('Jednostka', select('unit', UNITS.map(u => [u, u]))),
      field('Zużycie dzienne', input('daily', { type: 'number', step: 'any', min: '0', placeholder: 'np. 5 lub 0.3' })),
      field('Stan początkowy', input('stock', { type: 'number', step: 'any', min: '0', placeholder: '0' })),
      field('Opakowanie', input('pack', { type: 'number', step: 'any', min: '1', placeholder: 'np. 400 lub 500' })),
      field('Limit (opcjonalnie)', input('max', { type: 'number', step: 'any', min: '0', placeholder: 'brak' })),
      field('Notatka', input('note', { placeholder: 'np. rano na czczo' })),
      h('button', { class: 'primary', onclick: async () => {
        const name = f.name.value.trim();
        if (!name) return err(new Error('Podaj nazwę pozycji.'));
        const id = `custom_${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${Date.now().toString(36)}`;
        const item = { id, name, category: f.cat.value, unit: f.unit.value, shelfLife: f.shelf.value,
          packSize: Number(f.pack.value) || 1, daily_v31: Number(f.daily.value) || 0 };
        if (Number(f.max.value) > 0) item.maxLimit = Number(f.max.value);
        if (f.note.value.trim()) item.note = f.note.value.trim();
        try {
          await store.record('cat.upsert', { item });
          const q = Number(f.stock.value);
          if (Number.isFinite(q) && q >= 0) await store.record('inv.count', { prod: id, qty: q, date: today });
          dlg.close(); ctx.flash(`Dodano pozycję: ${name}.`); ctx.rerender();
        } catch (e) { dlg.close(); err(e); }
      } }, 'Zapisz pozycję'));
  }

  function shopDialog() {
    const checked = new Set();
    const bar = h('span', { class: 'prog-fill' });
    const txt = h('span', { class: 'prog-t' });
    const upd = () => {
      const pct = list.length ? Math.round((checked.size / list.length) * 100) : 100;
      txt.textContent = `${checked.size} / ${list.length} (${pct}%)`; bar.style.width = `${pct}%`;
    };
    const dlg = dialog(`Plan zakupów — ${dayShort(shop.date)} ${shortDate(shop.date)}`,
      h('div', { class: 'prog' }, h('span', { class: 'prog-bar' }, bar), txt),
      list.length === 0 ? h('p', {}, 'Nic nie trzeba kupować — zapasy wystarczą.') :
        h('ul', { class: 'shop-list' }, list.map(x => h('li', {},
          h('label', {}, h('input', { type: 'checkbox', onchange: e => { e.target.checked ? checked.add(x.id) : checked.delete(x.id); upd(); } }),
            h('span', { class: 'f-n' }, x.name)),
          h('span', { class: 'f-q' }, `${fmt(x.toBuy)} ${x.unit}`),
          h('span', { class: 'muted block' }, `${x.packs} × ${fmt(x.packSize)} ${x.unit} · na ${x.targetDays} dni · masz ${fmt(x.current, 1)} ${x.unit}${x.overLimit ? ' · przekracza limit' : ''}`)))),
      list.length > 0 && h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: async () => {
          const chosen = checked.size ? list.filter(x => checked.has(x.id)) : list;
          if (!confirm(checked.size ? `Dodać ${chosen.length} zaznaczonych pozycji do stanu magazynu?` : `Dodać wszystkie ${chosen.length} wyliczone zakupy do stanu magazynu?`)) return;
          try {
            for (const x of chosen) await store.record('inv.move', { prod: x.id, qty: x.toBuy, date: today, kind: 'purchase' });
            dlg.close(); ctx.flash(`✅ Zaktualizowano stany dla ${chosen.length} pozycji!`); ctx.rerender();
          } catch (e) { dlg.close(); err(e); }
        } }, '✅ Zaktualizuj stan'),
        h('button', { onclick: async () => {
          const text = (checked.size ? list.filter(x => checked.has(x.id)) : list).map(x => `${x.name}: ${fmt(x.toBuy)} ${x.unit}`).join('\n');
          try { await navigator.clipboard.writeText(text); ctx.flash('Lista skopiowana do schowka.'); } catch { ctx.flash('Nie udało się skopiować listy.'); }
          dlg.close(); ctx.rerender();
        } }, '📋 Kopiuj listę'),
        h('a', { class: 'btn', href: `shortcuts://run-shortcut?name=DodajZakupySpozywcze&input=text&text=${encodeURIComponent(list.map(x => `${x.name}: ${fmt(x.toBuy)} ${x.unit}`).join('\n'))}` }, '📲 Do Reminders')));
    upd();
  }

  function receiptDialog() {
    const ta = h('textarea', { rows: '8', placeholder: '{"banan": 1200, "kefir": 800}' });
    const apply = async mode => {
      let obj;
      try { obj = JSON.parse(ta.value); } catch { return err(new Error('To nie jest poprawny JSON.')); }
      const amount = v => parseFloat(String(v && typeof v === 'object' ? (v.qty ?? v.amount ?? 0) : v).replace(',', '.'));
      const entries = Object.entries(obj).map(([k, v]) => [k, amount(v)])
        .filter(([k, v]) => Number.isFinite(v) && v > 0 && (catalogById[k] || store.state.catalogUser.some(c => c.id === k)));
      const unknown = Object.keys(obj).filter(k => !catalogById[k] && !store.state.catalogUser.some(c => c.id === k));
      if (!entries.length) return err(new Error('Nie rozpoznano żadnej pozycji.'));
      try {
        for (const [k, v] of entries) {
          if (mode === 'add') await store.record('inv.move', { prod: k, qty: v, date: today, kind: 'purchase' });
          else await store.record('inv.count', { prod: k, qty: v, date: today });
        }
        dlg.close();
        ctx.flash(`Paragon: ${entries.length} pozycji${unknown.length ? `, pominięto nieznane: ${unknown.join(', ')}` : ''}.`);
        ctx.rerender();
      } catch (e) { dlg.close(); err(e); }
    };
    const dlg = dialog('Importuj rachunek / paragon',
      h('p', { class: 'muted' }, 'Wklej dane JSON: identyfikator pozycji i ilość w jednostce magazynu, np. {"banan": 1200} lub {"banan": {"qty": "1,2"}}.'),
      h('p', { class: 'muted' }, `Identyfikatory: ${items.map(i => i.id).join(', ')}`),
      ta,
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => apply('add') }, '➕ Dodaj do zapasów'),
        h('button', { onclick: () => { if (confirm('Zastąpić dotychczasowe stany wartościami z paragonu?')) apply('set'); } }, '🔄 Zastąp stany')));
  }

  function historyDialog() {
    const name = id => catalogById[id]?.name || (store.state.catalogUser.find(c => c.id === id)?.name) || id;
    const desc = e => e.t === 'inv.count' ? `${name(e.d.prod)}: stan ${fmt(e.d.qty, 1)}`
      : e.t === 'inv.move' ? `${name(e.d.prod)}: ${e.d.qty > 0 ? '+' : ''}${fmt(e.d.qty, 1)} (${e.d.kind === 'purchase' ? 'zakup' : 'korekta'})`
      : `korekta dnia ${e.d.date} (${e.d.dir > 0 ? 'cofnięcie zużycia' : 'odliczenie dnia'})`;
    const hidden = new Set(store.state.settings['zapasy.hidden'] || []);
    const clearedAt = store.state.settings['zapasy.clearedAt'] || '';
    const evs = undoable.filter(e => !hidden.has(e.id) && e.hlc > clearedAt).slice(-120).reverse();
    const restore = async e => {
      if (!confirm(`⚠️ PEŁNE PRZYWRÓCENIE STANU\n\nMagazyn wróci do stanu z chwili: ${new Date(e.at).toLocaleString('pl-PL')}.\nZmiany wprowadzone później zostaną zastąpione.\n(Możesz to cofnąć przyciskiem „↩ Cofnij”).\n\nKontynuować?`)) return;
      const past = reduce(store.allEvents().filter(x => x.hlc <= e.hlc));
      try {
        for (const it of items) {
          if (it.tracked === false) continue;
          const q = stockAt(past.inv, it.id, today);
          if (q != null) await store.record('inv.count', { prod: it.id, qty: Math.max(0, q), date: today });
        }
        dlg.close(); ctx.flash(`↩ Przywrócono stan z: ${new Date(e.at).toLocaleString('pl-PL')}`); ctx.rerender();
      } catch (x) { dlg.close(); err(x); }
    };
    const dlg = dialog('Historia i cofanie zmian',
      evs.length === 0 ? h('p', {}, 'Brak zapisanych zmian.') :
        h('ul', { class: 'hist' }, evs.map(e => h('li', {},
          h('span', { class: 'muted' }, `${new Date(e.at).toLocaleString('pl-PL')} · ${e.dev === store.device ? 'to urządzenie' : 'inne urządzenie'}`),
          h('span', {}, desc(e)),
          h('span', { class: 'row' },
            h('button', { onclick: () => restore(e) }, '↩ Przywróć ten stan'),
            h('button', { onclick: async () => {
              try { await store.record('setting', { key: 'zapasy.hidden', value: [...hidden, e.id] }); dlg.close(); historyDialog(); } catch (x) { err(x); }
            } }, 'Usuń wpis'))))),
      evs.length > 0 && h('button', { class: 'danger', onclick: async () => {
        if (!confirm('Wyczyścić rejestr historii? Wpisy znikną z listy; stany magazynu się nie zmienią.')) return;
        try { await store.record('setting', { key: 'zapasy.clearedAt', value: evs[0].hlc }); dlg.close(); ctx.flash('Wyczyszczono rejestr historii.'); ctx.rerender(); } catch (x) { err(x); }
      } }, '🗑️ Wyczyść rejestr historii'),
      h('p', { class: 'muted' }, 'Usunięcie wpisu lub wyczyszczenie rejestru ukrywa wpisy na liście. Same zdarzenia pozostają w dzienniku, aby synchronizacja między urządzeniami działała poprawnie.'));
  }

  function backupDialog() {
    const input = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => {
      const f = input.files[0]; if (!f) return;
      let pv;
      try { pv = await preview(store, JSON.parse(await f.text())); } catch (e) { return err(new Error(`Nie można odczytać pliku: ${e.message}`)); }
      if (!pv.ok) { dlg.close(); return err(new Error(pv.errors.join(' '))); }
      if (!confirm(`Plik: ${f.name}\nNowe zmiany: ${pv.fresh.length}, już znane: ${pv.known}, konflikty: ${pv.conflicts.length}.\n\nScalić dane?`)) return;
      try { const n = await apply(store, pv); dlg.close(); ctx.flash(`Wczytano kopię: ${n} zmian.`); ctx.rerender(); } catch (e) { dlg.close(); err(e); }
    } });
    const dlg = dialog('Kopia zapasowa (plik .json)',
      h('p', { class: 'muted' }, 'Kopia zawiera wszystkie dane aplikacji (także zapasy) i jest tym samym plikiem co synchronizacja przez iCloud. Wczytanie scala dane — nic nie jest nadpisywane.'),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: async () => {
          const b = await exportBundle(store);
          const file = new File([JSON.stringify(b)], `2027-kopia-${today}.json`, { type: 'application/json' });
          if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
          const a = h('a', { href: URL.createObjectURL(file), download: file.name }); document.body.append(a); a.click(); a.remove();
        } }, '📥 Pobierz kopię do pliku (.json)'),
        h('button', { onclick: () => { input.value = ''; input.click(); } }, '📂 Wczytaj plik JSON'), input));
  }

  async function aiStatus() {
    const groups = { CRITICAL: [], WARNING: [], OK: [] };
    for (const r of rows) {
      const line = `• ${r.it.name} [${r.it.category} | ${r.info.group || '—'}]: masz ${r.st == null ? '?' : fmt(r.st, 2)} ${r.it.unit} (starczy do: ${r.st != null && r.st <= 0 ? 'DZIŚ (Brak)' : r.fc?.lastCovered ? v31Date(r.fc.lastCovered) : '—'}, dzienna porcja: ${fmt(r.daily, 3)} ${r.it.unit})`;
      (groups[r.status] || groups.OK).push(line);
    }
    const text = `Cześć! Oto mój aktualny bilans zapasów spożywczych (${new Date().toLocaleDateString('pl-PL')}, Faza ${day.phase ?? 0}, ${day.dietVariant === 'T' ? 'dzień treningowy' : 'dzień nietreningowy'}):\n\n`
      + `🚨 PILNE BRAKI (Świeże < 2 dni / Trwałe < 7 dni / Suplementy < 10 dni):\n${groups.CRITICAL.join('\n') || 'Brak braków!'}\n\n`
      + `⚠️ ŚREDNI STAN:\n${groups.WARNING.join('\n') || 'Wszystko zabezpieczone.'}\n\n`
      + `🟢 WYSTARCZAJĄCY ZAPAS:\n${groups.OK.join('\n') || 'Brak pozycji z dużym zapasem.'}\n\n`
      + '👉 Na podstawie powyższego stanu pomóż mi zaplanować zakupy lub podpowiedz alternatywy.';
    try { await navigator.clipboard.writeText(text); ctx.flash('🤖 Skopiowano raport dla AI do schowka!'); }
    catch { ctx.flash('Nie udało się skopiować raportu.'); }
    ctx.rerender();
  }
}
