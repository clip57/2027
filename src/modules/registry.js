// Rejestr modułów. `stage` = etap, w którym moduł dostaje docelowy interfejs (SPEC v1.1, sekcja 9).
export const MODULES = [
  { id: 'dzis', name: 'Dziś', domain: 'regen', tab: true, stage: 3 },
  { id: 'dieta', name: 'Dieta', domain: 'diet', tab: true, stage: 3 },
  { id: 'zapasy', name: 'Zapasy', domain: 'prep', tab: true, stage: 4 },
  { id: 'trening', name: 'Trening', domain: 'train', tab: true, stage: 5 },
  { id: 'cfa', name: 'CFA', domain: 'cfa', tab: true, stage: 5 },
  { id: 'suplementy', name: 'Suplementacja', domain: 'diet', stage: 3 },
  { id: 'mealprep', name: 'Meal Prep', domain: 'prep', stage: 4 },
  { id: 'bezpieczenstwo', name: 'Bezpieczeństwo żywności', domain: 'prep', stage: 6 },
  { id: 'rekompozycja', name: 'Rekompozycja', domain: 'train', stage: 6 },
  { id: 'dane', name: 'Dane i synchronizacja', domain: 'regen', stage: 2 },
];
export const byId = Object.fromEntries(MODULES.map(m => [m.id, m]));
