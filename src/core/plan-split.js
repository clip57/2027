// U6 (audyt 23.10.2026): plany nauki (CFA, MPW) w pakiecie aplikacji bez pól, których aplikacja nie używa, a zadania bloków MPW — poza pakietem
// (wczytywane przy otwarciu modułu MPW: `plan-tasks.js`). Pliki src/data/*.json się nie zmieniają: podział robi build (tools/build.mjs), a w Node
// (testy, narzędzia) dane są pełne. Test `plan-split.test.mjs`: żadne usuwane pole nie występuje w kodzie aplikacji (src/), a zadania tylko przez
// `planTasks` — nowe użycie pola = usunięcie go z listy DROP.
export const DROP = {
  // Plan CFA V44 (D-103): analityka planu (katalog readingów, przydział banku pytań, strony, powiązania, mieszanie, mocki) i zadania bloków —
  // widok CFA ich nie pokazuje (zadania tylko w MPW). Zostają m.in. `version`, `previousVersion`, `progressRequirements`, `finalization` (R2).
  cfa: {
    plan: ['nightDates', 'nightExceptions', 'noNightDates', 'readingCatalog', 'fpLastSlot', 'fpLastTime', 'mockCov', 'mockDetail', 'mockAnalysis',
      'recallSessions', 'practiceSummary', 'primaryPageRanges', 'supplementRanges', 'sourceLinks', 'questionBank', 'calendarChanges',
      'videoReferences', 'progressReviewNeeded', 'auditChanges'],
    block: ['zadania', 'bankAllocation', 'objetosc_zrodla', 'planStatus', 'topics', 'practiceReadingIds', 'prerequisiteIds', 'practiceType',
      'readingKind', 'readingIds', 'questionTarget', 'sourceKey', 'corePageCount', 'pageStart', 'pageEnd', 'pageCount', 'pageLimit', 'bankNewCount',
      'supplementRanges', 'defaultCurriculum', 'mix', 'mixPair', 'mixPart', 'mockId', 'mockSession', 'sessionPart', 'analysisStage'],
  },
  mpw: { plan: ['mockCov', 'prac'], block: ['objetosc_zrodla', 'fid'] },
};
// Pole bloku wczytywane osobno (study.js — „Zadania bloku” w MPW)
export const LAZY = { mpw: 'zadania' };
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
