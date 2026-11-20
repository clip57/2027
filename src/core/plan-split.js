// U6 (audyt 23.10.2026): plany nauki (CFA, MPW) w pakiecie aplikacji bez pól, których aplikacja nie używa, a zadania bloków MPW — poza pakietem
// (wczytywane przy otwarciu modułu MPW: `plan-tasks.js`). Pliki src/data/*.json się nie zmieniają: podział robi build (tools/build.mjs), a w Node
// (testy, narzędzia) dane są pełne. Test `plan-split.test.mjs`: żadne usuwane pole nie występuje w kodzie aplikacji (src/), a zadania tylko przez
// `planTasks` — nowe użycie pola = usunięcie go z listy DROP.
export const DROP = {
  // Plan CFA Level I 2027 (D-116, MASTER_SCHEDULE_CFA_451.csv): kolumny analityczne planu (strony, bank pytań, powiązania, odsyłacze) bez użycia
  // w widoku — w pliku danych zostają. Zadania bloków — część osobna (LAZY). `sekcje` i `egzamin` zostają w pakiecie (nazwy kolidują z tekstami w kodzie).
  cfa: {
    plan: [],
    block: ['objetosc_zrodla', 'lm_2027', 'tom_i_rok', 'strony_pdf', 'strony_drukowane', 'liczba_stron', 'bank_2026', 'cwiczenia_2027', 'nowe_pytania',
      'pytania_powtorkowe', 'liczba_powtorkowych', 'bloki_pierwszego_podejscia', 'pytania_mocka', 'minuty_egzaminacyjne', 'schweser',
      'powiazane_bloki_mpw', 'odsylacze_do_materialow', 'dzial_cfa'],
  },
  mpw: { plan: ['mockCov', 'prac'], block: ['objetosc_zrodla', 'fid'] },
};
// Pole bloku wczytywane osobno (study.js — „Zadania bloku” w MPW i CFA)
export const LAZY = { mpw: 'zadania', cfa: 'zadania' };   // D-116: plan CFA 2027 ma zadania bloków
export const PLAN_IDS = Object.keys(DROP);

const omit = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

// Plan w pakiecie aplikacji: bez pól DROP i bez pola LAZY
export function corePlan(id, json) {
  const drop = DROP[id] || { plan: [], block: [] }, lazy = LAZY[id];
  const block = lazy ? [...drop.block, lazy] : drop.block;
  return { ...json, D: { ...omit(json.D, drop.plan), bloki: json.D.bloki.map(b => omit(b, block)) } };
}

// Część wczytywana osobno: { plan, field, version, values: { nr: wartość } }
export function lazyPart(id, json) {
  const field = LAZY[id];
  if (!field) return null;
  return { plan: id, field, version: json.D.version ?? null,
    values: Object.fromEntries(json.D.bloki.filter(b => b[field] != null && b[field] !== '').map(b => [b.nr, b[field]])) };
}
