// Rejestr modułów. group — grupa w bocznym panelu (Dzień / Trening / Dieta / Nauka / System; zgodna z domenami modułów),
// icon — ikona Lucide, tab — sekcja głównego paska na telefonie (4 + „Więcej”). `stage` — etap, w którym moduł powstał.
// tabUntil / tabFrom (D-095) — zakładka tylko w okresie: CFA do końca planu CFA (11.11.2026), od 12.11.2026 jej miejsce zajmuje MPW
// (wcześniej MPW czeka w „Więcej”). Daty zgodne z planami (test w plan-mpw.test.mjs).
export const GROUPS = ['Dzień', 'Trening', 'Dieta', 'Nauka', 'System'];
export const MODULES = [
  { id: 'dzis', name: 'Dziś', group: 'Dzień', icon: 'sun', domain: 'regen', tab: true, stage: 3, ready: true },
  { id: 'kalendarz', name: 'Kalendarz', group: 'Dzień', icon: 'calendar', domain: 'regen', stage: 7, ready: true },   // D-097
  { id: 'pielegnacja', name: 'Pielęgnacja', group: 'Dzień', icon: 'sparkles', domain: 'care', stage: 7, ready: true },   // D-094
  { id: 'dieta', name: 'Dieta', group: 'Dieta', icon: 'utensils', domain: 'diet', tab: true, stage: 3, ready: true },
  { id: 'trening', name: 'Trening', group: 'Trening', icon: 'dumbbell', domain: 'train', tab: true, stage: 5, ready: true },
  { id: 'cfa', name: 'CFA', group: 'Nauka', icon: 'graduation-cap', domain: 'cfa', tab: true, tabUntil: '2026-11-11', stage: 5, ready: true },
  { id: 'mpw', name: 'MPW', group: 'Nauka', icon: 'landmark', domain: 'cfa', tab: true, tabFrom: '2026-11-12', stage: 7, ready: true },   // D-095
  { id: 'rekompozycja', name: 'Rekompozycja', group: 'Trening', icon: 'target', domain: 'train', stage: 6, ready: true },
  { id: 'suplementy', name: 'Suplementacja', group: 'Dieta', icon: 'pill', domain: 'diet', stage: 3, ready: true },
  { id: 'zapasy', name: 'Zapasy', group: 'Dieta', icon: 'package', domain: 'prep', stage: 4, ready: true },
  { id: 'mealprep', name: 'Meal Prep', group: 'Dieta', icon: 'chef-hat', domain: 'prep', stage: 4, ready: true },
  { id: 'bezpieczenstwo', name: 'Bezpieczeństwo żywności', group: 'Dieta', icon: 'shield-check', domain: 'prep', stage: 6, ready: true },
  { id: 'dane', name: 'Dane i synchronizacja', group: 'System', icon: 'database', domain: 'regen', stage: 2, ready: true },
];
export const byId = Object.fromEntries(MODULES.map(m => [m.id, m]));
// Moduły w dniu `today`: zakładka wg okresu; w obrębie grupy moduły z zakładką na początku (od 12.11: MPW przed CFA),
// pozostałe w kolejności rejestru — każda grupa zajmuje te same miejsca listy co w MODULES.
export const isTab = (m, today) => !!m.tab && (!m.tabFrom || today >= m.tabFrom) && (!m.tabUntil || today <= m.tabUntil);
export function modulesOn(today) {
  const list = MODULES.map(m => ({ ...m, tab: isTab(m, today) }));
  const queue = Object.fromEntries(GROUPS.map(g => { const l = list.filter(m => m.group === g); return [g, [...l.filter(m => m.tab), ...l.filter(m => !m.tab)]]; }));
  return list.map(m => queue[m.group].shift());
}
