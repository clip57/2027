// Postęp nauki CFA względem harmonogramu v3 (D-006). Wyłącznie z planu (daty bloków) i dziennika (cfa.done) — bez prognoz.
// „Zaległe” = bloki zaplanowane PRZED dniem `today` i niewykonane; bloki dnia bieżącego nie są zaległe.
export function cfaPace(bloki, done, today) {
  const due = bloki.filter(b => b.data < today);
  const overdue = due.filter(b => !done.has(b.nr));
  const todays = bloki.filter(b => b.data === today);
  return {
    due: due.length,                                            // zaplanowane do wczoraj
    doneDue: due.length - overdue.length,                       // z nich wykonane
    overdue,                                                    // lista zaległych (kolejność planu)
    today: todays.length, todayDone: todays.filter(b => done.has(b.nr)).length,
    ahead: bloki.filter(b => b.data > today && done.has(b.nr)).length, // wykonane z wyprzedzeniem
  };
}
