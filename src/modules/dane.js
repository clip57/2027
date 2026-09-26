// Moduł „Dane i synchronizacja” (D-008, D-033, D-035): stan zapisu, wysyłka/odbiór pliku iCloud, importy, kontrola stanów.
import { h, clear, fmt, add } from '../ui/dom.js';
import { exportBundle, preview, previewEvents, apply } from '../core/sync/bundle.js';
import { cfaErrorLogEvents } from '../core/migrate/cfa.js';
import { sha256 } from '../core/hash.js';
import { stockAt, forecast, status, allItems } from '../core/calc/inventory.js';
import { shortDate } from '../core/dates.js';
import { icon } from '../ui/icons.js';
import { cloudSection } from './dane-cloud.js';
import { diagnose } from '../core/calc/diagnostics.js';
import { buildIcs, ICS_KINDS } from '../core/ics.js';
import { addDays } from '../core/dates.js';
import { PLAN_START } from '../core/resolver.js';
import { cloudStatus } from '../core/sync/cloud-local.js';

const KIND = { sync: 'Kopia / synchronizacja 2027', 'zapasy-v31': 'Kopia ZAPASY v31', private: 'Pakiet prywatny',
  'cfa-progress': 'Postęp CFA (postep-nauki.json)', 'cfa-errors': 'Error log CFA (error-log.csv)' };
const TYPE = { 'inv.count': 'stany magazynu', 'inv.move': 'zakupy i korekty', 'cat.upsert': 'własne pozycje', 'cfa.done': 'bloki CFA',
  'cfa.err.put': 'wpisy error logu', 'train.set': 'serie treningowe', setting: 'ustawienia', 'private.pack': 'pakiet prywatny', archive: 'archiwum' };
// Środowisko uruchomienia: każde (przeglądarka, aplikacja z ekranu początkowego, plik lokalny) ma OSOBNĄ bazę danych.
export const appVersion = () => document.querySelector('meta[name="app-version"]')?.content || 'nieznana';
export function runMode() {
  if (globalThis.__SINGLE__) return 'plik lokalny (jeden plik HTML)';
  const standalone = matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  return standalone ? 'aplikacja z ekranu początkowego / Docka' : 'karta przeglądarki';
}
const when = iso => (iso ? new Date(iso).toLocaleString('pl-PL') : '—');

const STATUS = { OK: 'OK', WARNING: 'Średni', CRITICAL: 'Pilne', UNKNOWN: 'Brak stanu', UNTRACKED: 'Nieśledzony' };

async function shareOrDownload(text, name, type = 'application/json') {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return 'share'; }
    catch (e) { if (e.name === 'AbortError') return 'cancel'; }
  }
  const a = h('a', { href: URL.createObjectURL(file), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'download';
}

export async function renderDane(root, ctx) {
  const { store } = ctx;
  const meta = store ? { exp: await store.adapter.getMeta('lastExport'), imp: await store.adapter.getMeta('lastImport'),
    backups: await store.adapter.getBackups() } : {};
  const own = store ? store.allEvents().filter(e => e.dev === store.device) : [];
  const unsent = meta.exp ? own.filter(e => e.hlc > meta.exp.hlc).length : own.length;
  const msg = h('div', { role: 'status', 'aria-live': 'polite' });
  const say = (text, cls = 'warn') => { clear(msg).append(h('div', { class: `banner ${cls}` }, text)); };

  // --- Stan zapisu
  const health = store?.health || { ok: false, error: ctx.storeError };
  // Kolejność (D-077): synchronizacja — najczęstsza czynność — na górze; potem aktualizacja kodu, stan zapisu, kontrola, kopie
  const syncSlot = h('div', { class: 'dn-slot' });
  add(root, h('header', { class: 'dn-head' }, h('h1', {}, 'Dane i synchronizacja'),
    h('div', { class: 'topline' }, h('span', { class: 'date' }, `${runMode()} · wersja ${appVersion()}`))), msg, syncSlot,
    h('section', { class: 'panel', 'aria-labelledby': 'h-stan' }, h('h2', { id: 'h-stan' }, 'Stan zapisu'),
      h('dl', { class: 'kv' },
        h('dt', {}, 'Zapis'), h('dd', { style: { color: health.ok ? 'var(--ok-ink)' : 'var(--err-ink)' } }, health.ok ? 'działa, każdy zapis sprawdzany odczytem' : (health.error || 'niedostępny')),
        h('dt', {}, 'Ochrona przed usunięciem'), h('dd', {}, health.persisted ? 'przyznana przez przeglądarkę' : 'nieprzyznana — eksportuj kopię regularnie'),
        h('dt', {}, 'Wersja aplikacji'), h('dd', {}, appVersion()),
        h('dt', {}, 'Uruchomiono jako'), h('dd', {}, runMode(), h('span', { class: 'muted block' }, 'To miejsce ma własną, oddzielną bazę danych — dane z innych miejsc trafiają tu tylko przez import pliku 2027-sync.json albo synchronizację w chmurze.'),
          // U-h: WebKit usuwa dane witryny w karcie Safari po 7 dniach bez otwierania; aplikacja z ekranu początkowego jest z tego wyłączona
          runMode() === 'karta przeglądarki' && h('span', { class: 'banner warn dn-evict' }, 'Karta przeglądarki: Safari może usunąć dane tej witryny po 7 dniach bez jej otwierania. Na iPhonie używaj aplikacji z ekranu początkowego (Udostępnij → Do ekranu początkowego) i synchronizuj dane (plik lub chmura) po każdej pracy.')),
        h('dt', {}, 'To urządzenie'), h('dd', {}, store?.device || '—'),
        h('dt', {}, 'Zapisane zmiany'), h('dd', {}, store ? fmt(store.allEvents().length) : '—'),
        health.quarantined > 0 && [h('dt', {}, 'Kwarantanna'), h('dd', {}, `${health.quarantined} uszkodzonych wpisów odłożono przy otwarciu`)],
        h('dt', {}, 'Ostatnie wysłanie'), h('dd', {}, meta.exp ? new Date(meta.exp.at).toLocaleString('pl-PL') : 'jeszcze nie'),
        h('dt', {}, 'Ostatni import'), h('dd', {}, meta.imp ? `${new Date(meta.imp.at).toLocaleString('pl-PL')} · ${KIND[meta.imp.kind] || meta.imp.kind} · +${meta.imp.added}` : 'jeszcze nie'),
        meta.imp?.file && [h('dt', {}, 'Wczytany plik'), h('dd', {}, `wyeksportowany ${when(meta.imp.file.exportedAt)} na urządzeniu ${meta.imp.file.device || '—'}`)],
        store?.state?.unprocessed?.count > 0 && [h('dt', {}, 'Niepełne przetwarzanie'), h('dd', { style: { color: 'var(--warn)' } },
          `${store.state.unprocessed.count} zdarzeń z nowszej wersji aplikacji jest zachowanych, ale nie jest uwzględnianych w widokach (${Object.keys(store.state.unprocessed.types).join(', ')}). Zaktualizuj aplikację.`)],
        health.restored > 0 && [h('dt', {}, 'Odzyskane z kwarantanny'), h('dd', {}, `${health.restored} zdarzeń przywróconych do bazy`)])),

    // --- Aktualizacja kodu aplikacji (oddzielnie od synchronizacji danych)
    h('section', { class: 'panel', 'aria-labelledby': 'h-upd' }, h('h2', { id: 'h-upd' }, 'Aktualizacja aplikacji'),
      h('p', { class: 'muted' }, 'Dotyczy wyłącznie kodu aplikacji. Aktualizacja nie przenosi ani nie zmienia danych — dane między urządzeniami przenosi plik 2027-sync.json albo synchronizacja w chmurze (sekcje wyżej).'),
      h('dl', { class: 'kv' }, h('dt', {}, 'Działająca wersja'), h('dd', {}, appVersion()),
        h('dt', {}, 'Stan'), h('dd', {}, ctx.update?.state === 'ready' ? 'nowa wersja pobrana — czeka na Twoją zgodę' : ctx.update?.state === 'checking' ? 'sprawdzanie…' : globalThis.__SINGLE__ ? 'plik lokalny — aktualizacja przez podmianę pliku' : 'aktualna (ostatnie sprawdzenie w tej sesji)')),
      !globalThis.__SINGLE__ && h('div', { class: 'row' },
        ctx.update?.state === 'ready' && h('button', { class: 'primary', onclick: () => ctx.update.apply() }, 'Nowa wersja — odśwież'),
        h('button', { onclick: async () => { await ctx.update?.check?.(); ctx.rerender(); } }, 'Sprawdź aktualizację'))));

  // --- Synchronizacja iCloud (wariant A)
  const sendBtn = h('button', { class: 'primary', disabled: !store, onclick: async () => {
    const b = await exportBundle(store);
    const res = await shareOrDownload(JSON.stringify(b), '2027-sync.json');
    if (res === 'cancel') return say('Wysyłanie anulowane. Nic nie zostało zapisane w iCloud.');
    const maxHlc = store.allEvents().reduce((m, e) => (e.hlc > m ? e.hlc : m), '');
    await store.adapter.setMeta('lastExport', { at: new Date().toISOString(), hlc: maxHlc, count: b.count });
    ctx.flash(res === 'share' ? 'Plik przekazany. Zapisz go w Plikach → iCloud Drive → 2027, zastępując poprzedni.' : 'Plik pobrany. Przenieś go do iCloud Drive → 2027.');
    ctx.rerender();
  } }, icon('cloud-upload', { size: 18 }), h('span', {}, 'Wyślij do iCloud'));
  const input = h('input', { type: 'file', accept: '.json,.csv,application/json,text/csv', hidden: true, onchange: () => onFile(input.files[0]) });
  const pickBtn = h('button', { disabled: !store, onclick: () => { input.value = ''; input.click(); } }, icon('cloud-download', { size: 18 }), h('span', {}, 'Pobierz z iCloud lub importuj plik'));
  add(syncSlot, h('section', { class: `panel dn-sync${unsent ? ' has-unsent' : ''}`, 'aria-labelledby': 'h-sync' },
    h('h2', { id: 'h-sync' }, icon('refresh-cw', { size: 20 }), 'Synchronizacja przez iCloud Drive'),
    h('p', { class: 'dn-sync-s' }, icon(unsent ? 'cloud-upload' : 'circle-check', { size: 20 }),
      h('span', {}, unsent ? `Masz ${unsent} niewysłanych zmian z tego urządzenia.` : 'Wszystkie zmiany z tego urządzenia zostały wysłane.')),
    h('p', { class: 'dn-sync-m' }, `Ostatnie wysłanie: ${meta.exp ? new Date(meta.exp.at).toLocaleString('pl-PL') : 'jeszcze nie'} · ostatni import: ${meta.imp ? new Date(meta.imp.at).toLocaleString('pl-PL') : 'jeszcze nie'}`),
    h('p', { class: 'muted' }, 'Po pracy na jednym urządzeniu wybierz „Wyślij do iCloud” i zapisz plik 2027-sync.json w iCloud Drive/2027. Na drugim urządzeniu wybierz „Pobierz z iCloud” i wskaż ten plik. Dane są scalane — nic nie jest nadpisywane, a ten sam plik możesz wczytać wiele razy.'),
    h('div', { class: 'row' }, sendBtn, pickBtn, input),
    h('p', { class: 'muted', style: { marginTop: '.75rem' } }, 'Ten sam przycisk importuje też kopię ZAPASY v31, postęp i error log CFA oraz pakiet prywatny.'),
    // U-h: plik synchronizacji jest jawnym tekstem (także pakiet prywatny) — w przeciwieństwie do chmury, która szyfruje zdarzenia
    h('p', { class: `dn-plain${store?.state?.privatePack ? ' banner warn' : ' muted'}` }, icon('lock', { size: 16 }),
      h('span', {}, `Plik 2027-sync.json nie jest szyfrowany${store?.state?.privatePack ? ' i zawiera zaimportowany pakiet prywatny' : ''}. Trzymaj go tylko w swoim iCloud Drive i włącz Zaawansowaną ochronę danych iCloud (Ustawienia → Twoje imię → iCloud). Synchronizacja w chmurze szyfruje dane na urządzeniu.`))),
    // Synchronizacja w chmurze (D-078, Etap 2) — niezależna od pliku; ręczna, przyciskiem
    await cloudSection(ctx));

  async function onFile(file) {
    if (!file) return;
    const text = await file.text();
    let pv;
    try {
      if (/\.csv$/i.test(file.name) || text.replace(/^\uFEFF/, '').startsWith('egzamin;')) pv = previewEvents(store, await cfaErrorLogEvents(text, sha256), 'cfa-errors');
      else pv = await preview(store, JSON.parse(text));
    } catch (e) { return say(`Nie można odczytać pliku „${file.name}”: ${e.message}`, 'err'); }
    showPreview(pv, file.name);
  }

  function showPreview(pv, name) {
    // Usunięcie z DOM także po zamknięciu klawiszem Esc (bez powielonych okien i identyfikatorów)
    const dlg = h('dialog', { 'aria-labelledby': 'pv-h', onclose: () => dlg.remove() });
    const close = () => dlg.close();
    add(dlg, h('h2', { id: 'pv-h' }, pv.ok ? 'Podgląd importu' : 'Nie można zaimportować'),
      h('p', { class: 'muted' }, `${name} · ${KIND[pv.kind] || 'nierozpoznany'}`),
      pv.file && h('p', {}, `Plik wyeksportowany ${when(pv.file.exportedAt)} na urządzeniu ${pv.file.device || '—'}${pv.file.device === store.device ? ' (to urządzenie)' : ''}.`),
      pv.file?.exportedAt && meta.imp?.file?.exportedAt && pv.file.exportedAt < meta.imp.file.exportedAt &&
        h('div', { class: 'banner warn' }, `Ten plik jest STARSZY niż ostatnio wczytany (${when(meta.imp.file.exportedAt)}). W iCloud Drive może być nowsza kopia, np. „2027-sync 2.json”.`),
      pv.future?.count > 0 && h('div', { class: 'banner warn' },
        `${pv.future.count} zdarzeń pochodzi z nowszej wersji aplikacji (${Object.keys(pv.future.types).join(', ')}). Zostaną zachowane w bazie, ale do czasu aktualizacji aplikacji nie będą uwzględniane w widokach.`),
      pv.errors.length > 0 && h('div', { class: 'banner err' }, pv.errors.join(' ')),
      pv.ok && h('dl', { class: 'kv' },
        h('dt', {}, 'Nowe zmiany'), h('dd', {}, fmt(pv.fresh.length)),
        h('dt', {}, 'Już znane'), h('dd', {}, fmt(pv.known)),
        h('dt', {}, 'Konflikty'), h('dd', {}, pv.conflicts.length ? `${pv.conflicts.length} (wygrywa nowsza zmiana; starsza zostaje w historii)` : 'brak'),
        Object.entries(pv.byType).map(([t, n]) => [h('dt', {}, TYPE[t] || t), h('dd', {}, fmt(n))])),
      h('div', { class: 'row', style: { marginTop: '1rem' } },
        pv.ok && pv.fresh.length > 0 && h('button', { class: 'primary', onclick: async () => {
          try { const n = await apply(store, pv); close(); ctx.flash(`Zaimportowano ${n} zmian. Kopia stanu sprzed importu została zapisana.`); ctx.rerender(); }
          catch (e) { close(); say(e.message, 'err'); }
        } }, 'Scal dane'),
        h('button', { onclick: close }, pv.ok && pv.fresh.length ? 'Anuluj' : 'Zamknij')));
    document.body.append(dlg); dlg.showModal();
  }

  // --- Kontrola stanów (tylko odczyt; edycja stanów — moduł Zapasy)
  if (store) {
    const rows = allItems().map(it => {
      const st = stockAt(store.state.inv, it.id, ctx.today);
      const fc = forecast(it.id, st, ctx.today);
      return { it, st, fc, status: status(it, st, fc) };
    });
    add(root, h('section', { class: 'panel', 'aria-labelledby': 'h-inv' }, h('h2', { id: 'h-inv' }, 'Kontrola stanów magazynu'),
      h('p', { class: 'muted' }, 'Stan na koniec dzisiejszego dnia, liczony z inwentaryzacji i planu (faza, typ dnia). Stany zmienisz w module ', h('a', { href: '#/zapasy' }, 'Zapasy'), '.'),
      rows.every(r => r.st == null) ? h('p', {}, 'Brak stanów. Zaimportuj kopię ZAPASY (plik zapasy_kopia_….json).')
        : h('div', { class: 'scroll-x' }, h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Pozycja'), h('th', { class: 'num' }, 'Stan'), h('th', {}, 'Wystarczy do'), h('th', {}, 'Status'))),
          h('tbody', {}, rows.map(r => h('tr', {},
            h('td', {}, r.it.name), h('td', { class: 'num' }, r.st == null ? '—' : `${fmt(r.st, 2)} ${r.it.unit}`),
            h('td', {}, r.fc?.lastCovered ? shortDate(r.fc.lastCovered) : (r.fc && r.fc.days === Infinity ? 'nie jest zużywana' : '—')),
            h('td', {}, STATUS[r.status]))))))));
  }

  // --- Przypomnienia w kalendarzu (I1): plik .ics z alarmami, generowany lokalnie z planu (bez serwera i bez kont)
  {
    const period = h('select', { 'aria-label': 'Okres' }, [[7, '7 dni'], [14, '14 dni'], [30, '30 dni'], [60, '60 dni']].map(([v, l]) => h('option', { value: String(v), selected: v === 14 || null }, l)));
    const kinds = ICS_KINDS.map(([k, label]) => [k, h('input', { type: 'checkbox', checked: true, value: k })]);
    const icsMsg = h('p', { class: 'muted', role: 'status', 'aria-live': 'polite' });
    add(root, h('section', { class: 'panel dn-ics', 'aria-labelledby': 'h-ics' }, h('h2', { id: 'h-ics' }, icon('calendar-plus', { size: 18 }), 'Przypomnienia w kalendarzu'),
      h('p', { class: 'muted' }, 'Plik .ics z alarmami do Kalendarza (iPhone, Mac, zegarek) — od dziś na wybrany okres. Po zmianie planu wyeksportuj ponownie: te same wydarzenia zostaną zaktualizowane, nie zdublowane.'),
      h('div', { class: 'dn-ics-kinds', role: 'group', 'aria-label': 'Rodzaje przypomnień' },
        kinds.map(([k, el]) => h('label', { class: 'chk' }, el, ` ${ICS_KINDS.find(x => x[0] === k)[1]}`))),
      h('div', { class: 'row' }, h('label', { class: 'field' }, h('span', {}, 'Okres'), period),
        h('button', { class: 'primary', onclick: async () => {
          const chosen = kinds.filter(([, el]) => el.checked).map(([k]) => k);
          if (!chosen.length) { icsMsg.textContent = 'Wybierz co najmniej jeden rodzaj przypomnień.'; return; }
          const from = ctx.today < PLAN_START ? PLAN_START : ctx.today;
          const { text, count } = buildIcs(from, Number(period.value), chosen);
          const res = await shareOrDownload(text, `2027-plan-${from}.ics`, 'text/calendar');
          icsMsg.textContent = res === 'cancel' ? 'Anulowano.' : `Plik z ${count} wydarzeniami (${from} – ${addDays(from, Number(period.value) - 1)}). Otwórz go w Kalendarzu i wybierz „Dodaj wszystkie”.`;
        } }, icon('download', { size: 18 }), 'Pobierz plik .ics')),
      icsMsg));
  }

  // --- Diagnostyka (I8): kontrola spójności danych, tylko odczyt
  if (store) {
    const cloud = await cloudStatus(store).catch(() => null);
    const quarantined = (await store.adapter.getQuarantine().catch(() => [])).length;
    const checks = diagnose(store.state, { today: ctx.today, custom: store.state.catalogUser || [], quarantined, health: store.health, cloud });
    const bad = checks.filter(c => c.level === 'warn').length;
    add(root, h('section', { class: 'panel dn-diag', 'aria-labelledby': 'h-diag' }, h('h2', { id: 'h-diag' }, icon('activity', { size: 18 }), 'Diagnostyka danych'),
      h('p', { class: 'muted' }, bad ? `Do sprawdzenia: ${bad}. Kontrola tylko odczytuje dane — niczego nie zmienia.` : 'Nie wykryto problemów. Kontrola tylko odczytuje dane — niczego nie zmienia.'),
      h('ul', { class: 'dn-diag-list' }, checks.map(c => h('li', { class: `dg-${c.level}` },
        icon(c.level === 'ok' ? 'circle-check' : c.level === 'warn' ? 'triangle-alert' : 'info', { size: 18 }),
        h('div', {}, h('p', { class: 'dg-t' }, c.title), c.detail && h('p', { class: 'muted' }, c.detail),
          c.href && h('a', { href: c.href }, 'Przejdź')))))));
  }

  // --- Kopie automatyczne
  add(root, h('section', { class: 'panel', 'aria-labelledby': 'h-bk' }, h('h2', { id: 'h-bk' }, 'Kopie automatyczne'),
    h('p', { class: 'muted' }, 'Aplikacja zapisuje stan sprzed każdego importu (ostatnie 5).'),
    !(meta.backups?.length) ? h('p', {}, 'Brak kopii.') :
      h('ul', {}, meta.backups.sort((a, b) => (a.at < b.at ? 1 : -1)).map(b => h('li', {}, `${new Date(b.at).toLocaleString('pl-PL')} · ${b.reason} · ${b.events.length} zmian `,
        h('button', { onclick: async () => shareOrDownload(JSON.stringify({ ...(await exportBundle({ allEvents: () => b.events, device: store.device })) }), `2027-kopia-${b.at.slice(0, 10)}.json`) }, 'Pobierz'))))));
}
