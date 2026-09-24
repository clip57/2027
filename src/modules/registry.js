// Rejestr modułów. group — grupa w bocznym panelu (Dzień / Trening / Dieta / Nauka / System; zgodna z domenami modułów),
// icon — ikona Lucide, tab — sekcja głównego paska na telefonie (4 + „Więcej”). `stage` — etap, w którym moduł powstał.
export const GROUPS = ['Dzień', 'Trening', 'Dieta', 'Nauka', 'System'];
export const MODULES = [
  { id: 'dzis', name: 'Dziś', group: 'Dzień', icon: 'sun', domain: 'regen', tab: true, stage: 3, ready: true },
  { id: 'dieta', name: 'Dieta', group: 'Dieta', icon: 'utensils', domain: 'diet', tab: true, stage: 3, ready: true },
  { id: 'trening', name: 'Trening', group: 'Trening', icon: 'dumbbell', domain: 'train', tab: true, stage: 5, ready: true },
  { id: 'cfa', name: 'CFA', group: 'Nauka', icon: 'graduation-cap', domain: 'cfa', tab: true, stage: 5, ready: true },
  { id: 'rekompozycja', name: 'Rekompozycja', group: 'Trening', icon: 'target', domain: 'train', stage: 6, ready: true },
  { id: 'suplementy', name: 'Suplementacja', group: 'Dieta', icon: 'pill', domain: 'diet', stage: 3, ready: true },
  { id: 'zapasy', name: 'Zapasy', group: 'Dieta', icon: 'package', domain: 'prep', stage: 4, ready: true },
  { id: 'mealprep', name: 'Meal Prep', group: 'Dieta', icon: 'chef-hat', domain: 'prep', stage: 4, ready: true },
  { id: 'bezpieczenstwo', name: 'Bezpieczeństwo żywności', group: 'Dieta', icon: 'shield-check', domain: 'prep', stage: 6, ready: true },
  { id: 'dane', name: 'Dane i synchronizacja', group: 'System', icon: 'database', domain: 'regen', stage: 2, ready: true },
];
export const byId = Object.fromEntries(MODULES.map(m => [m.id, m]));
