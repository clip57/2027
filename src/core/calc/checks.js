// D-113: odhaczanie bez nowych typów zdarzeń — istniejący typ `setting` (LWW per klucz, jak recall CFA I11):
//  F-D4 dawki suplementów:   `supp.dose:RRRR-MM-DD|GG:MM|<id preparatu>`  → true / false
//  F-Z2 lista zakupów w sklepie: `zapasy.shop:RRRR-MM-DD|<id pozycji>` (data najbliższych zakupów) → true / false
// Jeden klucz na pozycję: odhaczenia z dwóch urządzeń (iPhone w sklepie, MacBook) nie nadpisują się nawzajem — synchronizacja
// plikiem i w chmurze bez zmian (zdarzenia `setting` jak dotąd). Zdarzenia zostają w dzienniku na zawsze; widok czyta tylko bieżące klucze.
export const doseKey = (date, dose) => `supp.dose:${date}|${dose.time}|${dose.supp}`;
export const doseDone = (settings, date, dose) => settings?.[doseKey(date, dose)] === true;
export function dosesProgress(settings, date, doses) {
  const done = doses.filter(d => doseDone(settings, date, d)).length;
  return { done, total: doses.length };
}
export const shopKey = (shopDate, id) => `zapasy.shop:${shopDate}|${id}`;
export const shopChecked = (settings, shopDate, id) => settings?.[shopKey(shopDate, id)] === true;
// Zapis wielu odhaczeń naraz (np. „Odznacz wszystko”) — lista do store.recordMany
export const settingEvents = (keys, value) => keys.map(key => ['setting', { key, value }]);
