// Diagnostyka spójności danych (I8, audyt 25.09.2026): tylko odczyt, nic nie zmienia w dzienniku. Wynik = lista kontroli
// { id, level: 'ok' | 'info' | 'warn', title, detail, href } — widok w module Dane, test w tests/unit/diagnostics.test.mjs.
import { stockAt, allItems } from './inventory.js';
import { SRC } from '../data.js';
import { addDays } from '../dates.js';
import { PLAN_START } from '../resolver.js';

const STALE_DAYS = 14;

export function diagnose(state, { today, custom = [], quarantined = 0, health = null, cloud = null } = {}) {
  const out = [];
  const push = (id, level, title, detail = '', href = null) => out.push({ id, level, title, detail, href });
  if (health && !health.ok) push('storage', 'warn', 'Zapis niedostępny', health.error || 'Baza danych nie działa — zmiany nie są zapisywane.');

  // Zapasy: stany ujemne (np. zużycie z planu większe niż wpisany stan) i dawno nieaktualizowane pozycje
  const items = [...allItems(), ...custom].filter(it => it.tracked !== false);
  const neg = [], stale = [], unknown = [];
  const since = addDays(today, -STALE_DAYS);
  for (const it of items) {
    const st = stockAt(state.inv, it.id, today);
    if (st == null) { unknown.push(it.name); continue; }
    if (st < 0) neg.push(`${it.name} (${st})`);
    const last = [...(state.inv.counts[it.id] || []), ...(state.inv.moves[it.id] || [])].reduce((m, x) => (x.date > m ? x.date : m), '');
    if (last && last < since) stale.push(it.name);
  }
  push('neg', neg.length ? 'warn' : 'ok', neg.length ? `Ujemne stany: ${neg.length}` : 'Brak ujemnych stanów',
    neg.length ? `${neg.slice(0, 6).join(', ')}${neg.length > 6 ? '…' : ''} — wpisz rzeczywisty stan w Zapasach.` : '', neg.length ? '#/zapasy?s=CRITICAL' : null);
  push('stale', stale.length ? 'info' : 'ok', stale.length ? `Bez inwentaryzacji i zakupów od ponad ${STALE_DAYS} dni: ${stale.length}` : `Stany aktualizowane w ostatnich ${STALE_DAYS} dniach`,
    stale.length ? `${stale.slice(0, 6).join(', ')}${stale.length > 6 ? '…' : ''} — prognoza liczona z planu może się rozjechać z rzeczywistością; sprawdź stan.` : '', stale.length ? '#/zapasy' : null);
  if (unknown.length) push('unknown', 'info', `Pozycje bez stanu: ${unknown.length}`, 'Bez inwentaryzacji nie ma prognozy ani listy zakupów dla tych pozycji.', '#/zapasy');

  // CFA: bloki odhaczone z datą w przyszłości (np. pomyłka przy odhaczaniu harmonogramu)
  const future = SRC.cfa.D.bloki.filter(b => b.data > today && state.cfaDone.has(b.nr));
  push('cfa-future', future.length ? 'warn' : 'ok', future.length ? `Bloki CFA odhaczone z przyszłą datą: ${future.length}` : 'Brak bloków CFA odhaczonych „na zapas”',
    future.length ? future.slice(0, 5).map(b => `nr ${b.nr} (${b.data})`).join(', ') : '', future.length ? `#/cfa?v=dzien&d=${future[0].data}` : null);

  // Dziennik: kwarantanna i zdarzenia z nowszej wersji
  push('quarantine', quarantined ? 'warn' : 'ok', quarantined ? `W kwarantannie: ${quarantined} uszkodzonych wpisów` : 'Kwarantanna pusta',
    quarantined ? 'Wpisy odłożone przy otwarciu bazy (surowa kopia zachowana). Nowsza wersja aplikacji może je odzyskać.' : '');
  const up = state.unprocessed?.count || 0;
  push('future', up ? 'warn' : 'ok', up ? `Zdarzenia z nowszej wersji aplikacji: ${up}` : 'Wszystkie zdarzenia rozpoznane',
    up ? `Zachowane, ale pomijane w obliczeniach (${Object.keys(state.unprocessed.types).join(', ')}). Zaktualizuj aplikację.` : '');

  // Start planu (D-088, D-090): serie i czasy treningu sprzed 27.09.2026 zostają w dzienniku, poza statystykami
  const pre = Object.values(state.train || {}).filter(s => s.date < PLAN_START).length
    + Object.keys(state.trainSessions || {}).filter(d => d < PLAN_START).length;
  if (pre) push('pre-start', 'info', `Wpisy treningowe sprzed startu planu: ${pre}`, `Zachowane w dzienniku i w synchronizacji; statystyki i historia liczone od ${PLAN_START} (D-088).`);

  // Chmura: zmiany czekające na wysłanie ponad dobę
  if (cloud?.config) {
    const old = cloud.lastSync && Date.now() - Date.parse(cloud.lastSync) > 24 * 3600e3;
    const lvl = cloud.pending && (old || !cloud.lastSync) ? 'warn' : 'ok';
    push('cloud', lvl, lvl === 'warn' ? `Chmura: ${cloud.pending} zmian czeka na wysłanie` : 'Chmura: synchronizacja na bieżąco',
      lvl === 'warn' ? `Ostatnia synchronizacja: ${cloud.lastSync ? new Date(cloud.lastSync).toLocaleString('pl-PL') : 'jeszcze nie'}. Użyj „Synchronizuj teraz”.` : '');
  }
  return out;
}
