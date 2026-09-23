// Rejestr modułów. `stage` = etap, w którym moduł dostaje docelowy interfejs (SPEC v1.1, sekcja 9).
export const MODULES = [
  { id: 'dzis', name: 'Dziś', domain: 'regen', tab: true, stage: 3, ready: true },
  { id: 'dieta', name: 'Dieta', domain: 'diet', tab: true, stage: 3, ready: true },
  { id: 'zapasy', name: 'Zapasy', domain: 'prep', tab: true, stage: 4, ready: true },
  { id: 'trening', name: 'Trening', domain: 'train', tab: true, stage: 5, ready: true },
  { id: 'cfa', name: 'CFA', domain: 'cfa', tab: true, stage: 5, ready: true },
  { id: 'suplementy', name: 'Suplementacja', domain: 'diet', stage: 3, ready: true },
  { id: 'mealprep', name: 'Meal Prep', domain: 'prep', stage: 4, ready: true },
  { id: 'bezpieczenstwo', name: 'Bezpieczeństwo żywności', domain: 'prep', stage: 6, ready: true },
  { id: 'rekompozycja', name: 'Rekompozycja', domain: 'train', stage: 6, ready: true },
  { id: 'dane', name: 'Dane i synchronizacja', domain: 'regen', stage: 2, ready: true },
];
export const byId = Object.fromEntries(MODULES.map(m => [m.id, m]));
