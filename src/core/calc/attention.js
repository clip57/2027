// „Wymaga uwagi” (I2, audyt 25.09.2026): jedno miejsce na sygnały rozproszone po modułach — wyłącznie z danych,
// które te moduły już liczą (plan CFA, dziennik, prognoza zapasów, okres preparatów). Tylko odczyt.
// Wynik: [{ id, level: 'warn' | 'info', text, href }] w kolejności ważności.
import { SRC } from '../data.js';
import { cfaPace } from './cfa.js';
import { recallStats } from './recall.js';
import { stockAt, forecast, statusInfo, nextShopping, allItems } from './inventory.js';
import { diffDays, dayShort, shortDate } from '../dates.js';

const END_WARN_DAYS = 14;   // zapowiedź końca preparatów czasowych

export function attention(state, { today, hour = 12, custom = [] } = {}) {
  const out = [];
  const push = (id, level, text, href) => out.push({ id, level, text, href });
  if (!state) return out;

  // Zapasy: pozycje, których zabraknie przed najbliższymi zakupami (suplementy bez nazw — nazwy dawek tylko w planie dnia, D-041)
  const shop = nextShopping(today, hour, state.settings?.shopWeekday ?? 6);
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

  // CFA: zaległe bloki i nieodhaczone sesje recall (do wczoraj)
  const pace = cfaPace(SRC.cfa.D.bloki, state.cfaDone || new Set(), today);
  if (pace.overdue.length) push('cfa', 'warn', `Zaległe bloki CFA: ${pace.overdue.length}`, '#/cfa?v=harmonogram&zal=1');
  const rs = recallStats(state.settings, today);
  if (rs.due - rs.doneDue > 0) push('recall', 'info', `Nieodhaczone sesje recall: ${rs.due - rs.doneDue}`, '#/cfa?v=plan');

  // Koniec preparatów czasowych (D-015, D-087) w ciągu 14 dni
  const ends = [...new Set(SRC.supplements.doses.filter(d => d.validity?.until).map(d => d.validity.until))];
  for (const until of ends) {
    const left = diffDays(today, until);
    if (left >= 0 && left <= END_WARN_DAYS) push(`end-${until}`, 'info', `Koniec preparatów czasowych ${shortDate(until)} (za ${left} ${left === 1 ? 'dzień' : 'dni'})`, '#/suplementy');
  }

  // Dziennik: zdarzenia z nowszej wersji aplikacji
  if (state.unprocessed?.count) push('future', 'warn', `Zdarzenia z nowszej wersji aplikacji: ${state.unprocessed.count} — zaktualizuj aplikację`, '#/dane');
  return out;
}
