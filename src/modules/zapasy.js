// Moduł Zapasy (Etap 4, odsłona 2): odwzorowanie funkcji pierwotnego pliku ZAPASY_DIETA.html
// na nowej architekturze — stan liczony z inwentaryzacji i planu (D-003, D-027), zapis zdarzeniami,
// bez dat zakodowanych na sztywno i bez wstawiania danych do innerHTML.
import { h, clear, fmt, plural, add } from '../ui/dom.js';
import { stockAt, forecast, status, statusInfo, shoppingList, nextShopping, allItems, runway } from '../core/calc/inventory.js';
import { icon } from '../ui/icons.js';
import { sheet as dialog } from '../ui/components.js';
import { parseReceipt } from '../core/receipt.js';
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
  // Wiele zmian naraz (operacje zbiorcze, plan zakupów, paragon, przywrócenie stanu): jedna transakcja i jedno przeliczenie (B8)
  const many = list => store.recordMany(list);

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
        onclick: () => goto({ s: filter === k ? 'all' : k }) }, h('span', { class: `dot-s s-${k}`, 'aria-hidden': 'true' }), h('strong', {}, String(counts[k] || 0)), h('span', {}, lab))),
    // U-c: filtr „Do zakupów” (pozycje z listy najbliższych zakupów) — był w logice (s=shop), bez przycisku
    h('button', { class: `counter c-shop${filter === 'shop' ? ' is-on' : ''}`, 'aria-pressed': String(filter === 'shop'),
      onclick: () => goto({ s: filter === 'shop' ? 'all' : 'shop' }) }, icon('shopping-cart', { size: 14 }), h('strong', {}, String(list.length)), h('span', {}, 'Do zakupów'))),
    h('div', { class: 'toolbar' },
      // U-c: filtrowanie na bieżąco podczas pisania (bez przerysowania widoku — fokus i klawiatura zostają); adres aktualizowany bez zdarzenia
      h('input', { type: 'search', id: 'zp-q', value: query, placeholder: 'Szukaj pozycji…', 'aria-label': 'Szukaj pozycji',
        oninput: e => liveSearch(e.target.value) }),
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

  // U-c: wyszukiwanie na bieżąco — zawężanie ukrywa pozycje już wyświetlone; poszerzenie poza zapytanie z adresu przerysowuje widok
  const empty = h('p', { class: 'muted zp-empty', hidden: true }, 'Brak pozycji pasujących do wyszukiwania.');
  let searchTimer = null;
  function liveSearch(v) {
    const t = v.trim().toLowerCase();
    const p = new URLSearchParams(location.hash.split('?')[1] || '');
    if (t) p.set('q', v.trim()); else p.delete('q');
    history.replaceState(history.state, '', `#/zapasy${p.toString() ? `?${p}` : ''}`);
    if (query && !t.includes(query.toLowerCase())) { clearTimeout(searchTimer); searchTimer = setTimeout(() => ctx.rerender(), 300); return; }
    let n = 0;
    zmain.querySelectorAll('.inv-item').forEach(el => { const hit = !t || el.querySelector('h3').textContent.toLowerCase().includes(t); el.hidden = !hit; n += hit; });
    empty.hidden = n > 0 || visible.length === 0;
  }
  add(zmain, empty,
    // U-g: znaczenie pola „Stan” (D-027 — inwentaryzacja na koniec dnia; od następnego dnia odliczane zużycie z planu)
    h('p', { class: 'muted zp-hint', id: 'zp-stan-hint' }, icon('info', { size: 14 }),
      'Pole „Stan” to ilość na koniec dzisiejszego dnia — wpisz, ile zostanie po dzisiejszych posiłkach. Od jutra aplikacja odlicza zużycie z planu.'));
  add(zmain, h('div', { class: 'inv' }, visible.length === 0 ? h('p', { class: 'muted' }, 'Brak pozycji dla tego widoku.') :
    visible.map(r => {
      const it = r.it;
      const runsOutBeforeShopping = r.fc?.runOut && r.fc.runOut <= shop.date;
      const lowAfter = ['CRITICAL', 'WARNING'].includes(r.status);
      const rw = r.st != null && it.tracked !== false && r.daily > 0 ? runway(it, r.fc, shop.inDays) : null;
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
          r.st != null && it.tracked !== false && r.daily > 0 && h('span', { class: runsOutBeforeShopping || r.st <= 0 ? 'inv-warn' : lowAfter ? 'inv-ok inv-low' : 'inv-ok' },
            (() => {
              if (r.st <= 0) return `⚠️ Brak na ${shop.inDays} ${plural(shop.inDays, 'dzień', 'dni', 'dni')} przed zakupami`;
              // B7: status v31 (pilne / średnie) liczony od dziś zostaje (D-046); komunikat mówi wprost, że do zakupów wystarczy,
              // ale zapas jest krótki — zamiast sprzecznego zestawienia „pilne” + „✓ wystarczy”
              if (!runsOutBeforeShopping) return lowAfter ? `✓ Wystarczy do zakupów (${dayShort(shop.date)} ${shortDate(shop.date)}) · zapas ${r.status === 'CRITICAL' ? 'pilny' : 'średni'}${shopIds.has(it.id) ? ' — na liście zakupów' : ''}` : '✓ Wystarczy do zakupów';
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
                'aria-label': `Stan: ${it.name}`, 'aria-describedby': 'zp-stan-hint', title: 'Stan na koniec dzisiejszego dnia',
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
            it.packSize && h('span', { class: 'tag' }, `Opakowanie ${fmt(it.packSize)} ${it.unit}`),
            it.maxLimit && h('span', { class: 'tag' }, `Limit: ${fmt(it.maxLimit)} ${it.unit}`),
            r.daily > 0 && h('span', { class: 'tag' }, `${fmt(r.daily, 2)} ${it.unit}/d`),
            it.note && h('span', { class: 'tag' }, it.note),
            h('span', { class: 'tag' }, it.category),
            SAFE.has(it.name) && h('a', { class: 'btn zp-safe', href: `#/bezpieczenstwo?q=${encodeURIComponent(it.name)}` }, 'Przechowywanie →')),
          it.tracked !== false && h('div', { class: 'row' },
            h('button', { onclick: () => save('inv.move', { prod: it.id, qty: -(r.daily || 1), date: today, kind: 'adjust' }, `${it.name}: −1 porcja`) }, '− porcja'),
            h('button', { onclick: () => save('inv.move', { prod: it.id, qty: (r.daily || 1), date: today, kind: 'adjust' }, `${it.name}: +1 porcja`) }, '+ porcja'),
            String(it.id).startsWith('custom_') && h('button', { 'aria-label': `Edytuj ${it.name}`, onclick: () => addDialog(it) }, icon('pencil', { size: 16 }), 'Edytuj'),
            String(it.id).startsWith('custom_') && h('button', { class: 'danger', 'aria-label': `Usuń ${it.name}`,
              onclick: () => confirm(`Usunąć pozycję „${it.name}”?`) && save('cat.delete', { id: it.id }, `Usunięto ${it.name}.`) }, 'Usuń pozycję'))); }
    })));

  // ---------- operacje zbiorcze (rzadkie, nieodwracalne bez historii) — zwinięte
  add(zmain, h('details', { class: 'zp-bulk' }, h('summary', {}, 'Operacje zbiorcze'), h('div', { class: 'row bulk' },
    h('button', { class: 'danger', onclick: async () => {
      if (!confirm('Wyzerować stany wszystkich pozycji? Zmianę można cofnąć w historii.')) return;
      try { await many(rows.filter(r => r.it.tracked !== false).map(r => ['inv.count', { prod: r.it.id, qty: 0, date: today }]));
        ctx.flash('Wyzerowano stany.'); ctx.rerender(); } catch (e) { err(e); }
    } }, 'Zeruj stany'),
    h('button', { onclick: async () => {
      const custom = store.state.catalogUser || [];
      if (!custom.length) return ctx.flash('Lista jest już fabryczna.') || ctx.rerender();
      if (!confirm(`Usunąć ${custom.length} własnych pozycji? Stany fabrycznych pozycji zostaną bez zmian.`)) return;
      try { await many(custom.map(c => ['cat.delete', { id: c.id }]));
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

  // Dodanie albo edycja (U-c) własnej pozycji: edycja = ten sam identyfikator, nowe `cat.upsert` (wygrywa późniejsza zmiana)
  function addDialog(edit = null) {
    const f = {};
    const field = (label, el) => h('label', { class: 'field' }, h('span', {}, label), el);
    const input = (key, props) => (f[key] = h('input', props));
    const select = (key, opts, cur) => (f[key] = h('select', {}, opts.map(o => h('option', { value: o[0], selected: o[0] === cur || null }, o[1]))));
    const val = x => (x == null ? null : String(x));
    const dlg = dialog(edit ? `Edytuj pozycję: ${edit.name}` : 'Dodaj nową pozycję',
      field('Nazwa', input('name', { placeholder: 'np. Cynk organiczny, Dorsz', value: val(edit?.name) })),
      field('Kategoria', select('cat', CATS.slice(1).concat([['Inne']]).map(c => (Array.isArray(c) ? c : [c, c])), edit?.category)),
      field('Trwałość', select('shelf', [['short', 'Świeże (≤ 7 dni, alert < 2 dni)'], ['long', 'Trwałe (> 7 dni, alert < 7 dni)']], edit?.shelfLife)),
      field('Jednostka', select('unit', UNITS.map(u => [u, u]), edit?.unit)),
      field('Zużycie dzienne', input('daily', { type: 'number', step: 'any', min: '0', placeholder: 'np. 5 lub 0.3', value: val(edit?.daily_v31) })),
      !edit && field('Stan początkowy', input('stock', { type: 'number', step: 'any', min: '0', placeholder: '0' })),
      field('Opakowanie', input('pack', { type: 'number', step: 'any', min: '1', placeholder: 'np. 400 lub 500', value: val(edit?.packSize) })),
      field('Limit (opcjonalnie)', input('max', { type: 'number', step: 'any', min: '0', placeholder: 'brak', value: val(edit?.maxLimit) })),
      field('Notatka', input('note', { placeholder: 'np. rano na czczo', value: val(edit?.note) })),
      edit && h('p', { class: 'muted' }, 'Stan zmienisz polem „Stan” na liście pozycji.'),
      h('button', { class: 'primary', onclick: async () => {
        const name = f.name.value.trim();
        if (!name) { dlg.error(new Error('Podaj nazwę pozycji.')); f.name.focus(); return; }
        const id = edit ? edit.id : `custom_${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${Date.now().toString(36)}`;
        const item = { id, name, category: f.cat.value, unit: f.unit.value, shelfLife: f.shelf.value,
          packSize: Number(f.pack.value) || 1, daily_v31: Number(f.daily.value) || 0 };
        if (Number(f.max.value) > 0) item.maxLimit = Number(f.max.value);
        if (f.note.value.trim()) item.note = f.note.value.trim();
        try {
          const q = edit ? NaN : Number(f.stock.value);
          await many([['cat.upsert', { item }], ...(Number.isFinite(q) && q >= 0 ? [['inv.count', { prod: id, qty: q, date: today }]] : [])]);
          dlg.close(); ctx.flash(edit ? `Zapisano zmiany: ${name}.` : `Dodano pozycję: ${name}.`); ctx.rerender();
        } catch (e) { dlg.error(e); }
      } }, edit ? 'Zapisz zmiany' : 'Zapisz pozycję'));
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
            await many(chosen.map(x => ['inv.move', { prod: x.id, qty: x.toBuy, date: today, kind: 'purchase' }]));
            dlg.close(); ctx.flash(`Zaktualizowano stany dla ${chosen.length} pozycji.`, 'info'); ctx.rerender();
          } catch (e) { dlg.error(e); }
        } }, icon('check', { size: 18 }), 'Zaktualizuj stan'),
        h('button', { onclick: async () => {
          const text = (checked.size ? list.filter(x => checked.has(x.id)) : list).map(x => `${x.name}: ${fmt(x.toBuy)} ${x.unit}`).join('\n');
          try { await navigator.clipboard.writeText(text); ctx.flash('Lista skopiowana do schowka.'); } catch { ctx.flash('Nie udało się skopiować listy.'); }
          dlg.close(); ctx.rerender();
        } }, icon('copy', { size: 18 }), 'Kopiuj listę'),
        h('a', { class: 'btn', href: `shortcuts://run-shortcut?name=DodajZakupySpozywcze&input=text&text=${encodeURIComponent(list.map(x => `${x.name}: ${fmt(x.toBuy)} ${x.unit}`).join('\n'))}` }, icon('smartphone', { size: 18 }), 'Do Reminders')));
    upd();
  }

  // Paragon (I7): tekst („banan 1,2 kg”, „kefir 2 × 400 ml”) albo dotychczasowy JSON ({"banan": 1200}) → podgląd → zapis
  function receiptDialog() {
    const ta = h('textarea', { rows: '8', 'aria-label': 'Treść paragonu', placeholder: 'banan 1,2 kg\nkefir 2 × 400 ml\njajka 10 szt.\npłatki owsiane 2   (2 opakowania)' });
    const pv = h('div', { class: 'rc-preview', role: 'status', 'aria-live': 'polite' });
    let parsed = null;
    const read = () => {
      const txt = ta.value.trim();
      if (txt.startsWith('{')) {
        let obj;
        try { obj = JSON.parse(txt); } catch { throw new Error('To nie jest poprawny JSON.'); }
        const amount = v => parseFloat(String(v && typeof v === 'object' ? (v.qty ?? v.amount ?? 0) : v).replace(',', '.'));
        const byId = id => catalogById[id] || store.state.catalogUser.find(c => c.id === id);
        return { rows: Object.entries(obj).map(([k, v]) => ({ raw: k, item: byId(k), qty: amount(v), note: '' })).filter(x => x.item && Number.isFinite(x.qty) && x.qty > 0),
          unknown: Object.keys(obj).filter(k => !byId(k)) };
      }
      return parseReceipt(txt, items.filter(i => i.tracked !== false));
    };
    const check = () => {
      try { parsed = read(); } catch (e) { parsed = null; clear(pv); return dlg.error(e); }
      clear(dlg.el.querySelector('.sheet-msg'));
      clear(pv).append(
        parsed.rows.length ? h('ul', { class: 'rc-list' }, parsed.rows.map(x => h('li', {}, h('span', { class: 'rc-n' }, x.item.name),
          h('strong', {}, `${fmt(x.qty, 1)} ${x.item.unit}`), h('span', { class: 'muted' }, x.note || x.raw))))
          : h('p', {}, 'Nie rozpoznano żadnej pozycji.'),
        parsed.unknown.length > 0 && h('p', { class: 'muted' }, `Pominięte (${parsed.unknown.length}): ${parsed.unknown.join(' · ')}`));
      save1.disabled = save2.disabled = !parsed.rows.length;
    };
    const apply = async mode => {
      if (!parsed?.rows.length) return dlg.error(new Error('Najpierw sprawdź paragon — nie rozpoznano żadnej pozycji.'));
      try {
        await many(parsed.rows.map(x => (mode === 'add' ? ['inv.move', { prod: x.item.id, qty: x.qty, date: today, kind: 'purchase' }]
          : ['inv.count', { prod: x.item.id, qty: x.qty, date: today }])));
        dlg.close();
        ctx.flash(`Paragon: ${parsed.rows.length} pozycji${parsed.unknown.length ? `, pominięto: ${parsed.unknown.length}` : ''}.`, 'info');
        ctx.rerender();
      } catch (e) { dlg.error(e); }
    };
    const save1 = h('button', { class: 'primary', disabled: true, onclick: () => apply('add') }, icon('plus', { size: 18 }), 'Dodaj do zapasów');
    const save2 = h('button', { disabled: true, onclick: () => { if (confirm('Zastąpić dotychczasowe stany wartościami z paragonu?')) apply('set'); } }, icon('refresh-cw', { size: 18 }), 'Zastąp stany');
    ta.addEventListener('input', () => { parsed = null; save1.disabled = save2.disabled = true; });
    const dlg = dialog('Importuj rachunek / paragon',
      h('p', { class: 'muted' }, 'Wklej pozycje z paragonu, po jednej w wierszu: nazwa i ilość (kg, g, l, ml, szt., op). Sama liczba bez jednostki = liczba opakowań. Działa też dotychczasowy format JSON z identyfikatorami, np. {"banan": 1200}.'),
      ta,
      h('div', { class: 'row' }, h('button', { onclick: check }, icon('list-checks', { size: 18 }), 'Sprawdź')),
      pv,
      h('div', { class: 'row' }, save1, save2),
      h('details', {}, h('summary', {}, 'Identyfikatory pozycji (format JSON)'), h('p', { class: 'muted' }, items.map(i => i.id).join(', '))));
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
        await many(items.filter(it => it.tracked !== false).map(it => [it, stockAt(past.inv, it.id, today)]).filter(([, q]) => q != null)
          .map(([it, q]) => ['inv.count', { prod: it.id, qty: Math.max(0, q), date: today }]));
        dlg.close(); ctx.flash(`Przywrócono stan z: ${new Date(e.at).toLocaleString('pl-PL')}`); ctx.rerender();
      } catch (x) { dlg.error(x); }
    };
    const dlg = dialog('Historia i cofanie zmian',
      evs.length === 0 ? h('p', {}, 'Brak zapisanych zmian.') :
        h('ul', { class: 'hist' }, evs.map(e => h('li', {},
          h('span', { class: 'muted' }, `${new Date(e.at).toLocaleString('pl-PL')} · ${e.dev === store.device ? 'to urządzenie' : 'inne urządzenie'}`),
          h('span', {}, desc(e)),
          h('span', { class: 'row' },
            h('button', { onclick: () => restore(e) }, icon('undo-2', { size: 16 }), 'Przywróć ten stan'),
            h('button', { onclick: async () => {
              try { await store.record('setting', { key: 'zapasy.hidden', value: [...hidden, e.id] }); dlg.close(); historyDialog(); } catch (x) { dlg.error(x); }
            } }, 'Usuń wpis'))))),
      evs.length > 0 && h('button', { class: 'danger', onclick: async () => {
        if (!confirm('Wyczyścić rejestr historii? Wpisy znikną z listy; stany magazynu się nie zmienią.')) return;
        try { await store.record('setting', { key: 'zapasy.clearedAt', value: evs[0].hlc }); dlg.close(); ctx.flash('Wyczyszczono rejestr historii.'); ctx.rerender(); } catch (x) { dlg.error(x); }
      } }, icon('trash-2', { size: 18 }), 'Wyczyść rejestr historii'),
      h('p', { class: 'muted' }, 'Usunięcie wpisu lub wyczyszczenie rejestru ukrywa wpisy na liście. Same zdarzenia pozostają w dzienniku, aby synchronizacja między urządzeniami działała poprawnie.'));
  }

  function backupDialog() {
    const input = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => {
      const f = input.files[0]; if (!f) return;
      let pv;
      try { pv = await preview(store, JSON.parse(await f.text())); } catch (e) { return dlg.error(new Error(`Nie można odczytać pliku: ${e.message}`)); }
      if (!pv.ok) return dlg.error(new Error(pv.errors.join(' ')));
      if (!confirm(`Plik: ${f.name}\nNowe zmiany: ${pv.fresh.length}, już znane: ${pv.known}, konflikty: ${pv.conflicts.length}.\n\nScalić dane?`)) return;
      try { const n = await apply(store, pv); dlg.close(); ctx.flash(`Wczytano kopię: ${n} zmian.`); ctx.rerender(); } catch (e) { dlg.error(e); }
    } });
    const dlg = dialog('Kopia zapasowa (plik .json)',
      h('p', { class: 'muted' }, 'Kopia zawiera wszystkie dane aplikacji (także zapasy) i jest tym samym plikiem co synchronizacja przez iCloud. Wczytanie scala dane — nic nie jest nadpisywane.'),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: async () => {
          const b = await exportBundle(store);
          const file = new File([JSON.stringify(b)], `2027-kopia-${today}.json`, { type: 'application/json' });
          if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
          const a = h('a', { href: URL.createObjectURL(file), download: file.name }); document.body.append(a); a.click(); a.remove();
        } }, icon('download', { size: 18 }), 'Pobierz kopię do pliku (.json)'),
        h('button', { onclick: () => { input.value = ''; input.click(); } }, icon('folder-open', { size: 18 }), 'Wczytaj plik JSON'), input));
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
