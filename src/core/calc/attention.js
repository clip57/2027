// „Wymaga uwagi” (I2, audyt 25.09.2026): jedno miejsce na sygnały rozproszone po modułach — wyłącznie z danych,
// które te moduły już liczą (plan CFA i MPW, dziennik, prognoza zapasów, okres preparatów). Tylko odczyt.
// Wynik: [{ id, level: 'warn' | 'info', text, href }] w kolejności ważności.
import { SRC } from '../data.js';
import { cfaPace } from './cfa.js';
import { recallStats } from './recall.js';
import { stockAt, forecast, statusInfo, nextShopping, allItems } from './inventory.js';
import { diffDays, dayShort, shortDate } from '../dates.js';
import { careModel, upcomingChanges } from './care.js';

const END_WARN_DAYS = 14;   // zapowiedź końca preparatów czasowych

export function attention(state, { today, hour = 12, custom = [] } = {}) {
  const out = [];
  const push = (id, level, text, href) => out.push({ id, level, text, href });
  if (!state) return out;

  // Zapasy: pozycje, których zabraknie przed najbliższymi zakupami (suplementy bez nazw — nazwy dawek tylko w planie dnia, D-041)
  const shop = nextShopping(today, hour);
  const short = [], supp = [];
  for (const it of [...allItems(), ...custom]) {
    if (it.tracked === false) continue;
    const st = stockAt(state.inv, it.id, today);
    if (st == null) continue;
    const fc = forecast(it.id, st, today);
    const runsOut = st <= 0 || (fc?.runOut && fc.runOut <= shop.date);
    if (it.category === 'Suplementy') { if (runsOut || statusInfo(it, st, fc).code === 'CRITICAL') supp.push(it); }
    else if (runsOut) short.push(it.name);
  }
  if (short.length) push('shop', 'warn', `Zabraknie przed zakupami (${dayShort(shop.date)} ${shortDate(shop.date)}): ${short.slice(0, 4).join(', ')}${short.length > 4 ? ` i ${short.length - 4} innych` : ''}`, '#/zapasy?s=shop');
  if (supp.length) push('supp', 'warn', `Suplementy do uzupełnienia: ${supp.length}`, '#/suplementy');

  // CFA: zaległe bloki i nieodhaczone sesje recall (do wczoraj) — do dnia egzaminu CFA; później bez znaczenia (D-095)
  if (today < SRC.cfa.exam) {
    const pace = cfaPace(SRC.cfa.D.bloki, state.cfaDone || new Set(), today);
    if (pace.overdue.length) push('cfa', 'warn', `Zaległe bloki CFA: ${pace.overdue.length}`, '#/cfa?v=harmonogram&zal=1');
    const rs = recallStats(state.settings, today);
    if (rs.due - rs.doneDue > 0) push('recall', 'info', `Nieodhaczone sesje recall: ${rs.due - rs.doneDue}`, '#/cfa?v=plan');
  }
  // MPW (D-095): zaległe bloki planu MPW — do dnia egzaminu MPW
  if (today < SRC.mpw.exam) {
    const pace = cfaPace(SRC.mpw.D.bloki, state.mpwDone || new Set(), today);
    if (pace.overdue.length) push('mpw', 'warn', `Zaległe bloki MPW: ${pace.overdue.length}`, '#/mpw?v=harmonogram&zal=1');
  }

  // Koniec preparatów czasowych (D-015, D-087) w ciągu 14 dni
  const ends = [...new Set(SRC.supplements.doses.filter(d => d.validity?.until).map(d => d.validity.until))];
  for (const until of ends) {
    const left = diffDays(today, until);
    if (left >= 0 && left <= END_WARN_DAYS) push(`end-${until}`, 'info', `Koniec preparatów czasowych ${shortDate(until)} (za ${left} ${left === 1 ? 'dzień' : 'dni'})`, '#/suplementy');
  }

  // Pielęgnacja (D-094): zmiana w planie (koniec lub początek kroku z okresem) w ciągu 14 dni — z danych użytkownika
  const care = upcomingChanges(careModel(state.careDefs || []), today, END_WARN_DAYS);
  if (care.length) {
    const first = care[0], left = diffDays(today, first.date);
    push('care', 'info', `Pielęgnacja: zmiana w planie ${shortDate(first.date)} (za ${left} ${left === 1 ? 'dzień' : 'dni'})${care.length > 1 ? ` i ${care.length - 1} innych` : ''}`, '#/pielegnacja?v=plan');
  }

  // Dziennik: zdarzenia z nowszej wersji aplikacji
  if (state.unprocessed?.count) push('future', 'warn', `Zdarzenia z nowszej wersji aplikacji: ${state.unprocessed.count} — zaktualizuj aplikację`, '#/dane');
  return out;
}
