// Widok diety: zestawienie planu (faza × wariant) i porównanie faz. Wartości pochodzą 1:1 z PDF (D-007).
import { plan } from '../data.js';

const MEAL_NAMES = { breakfast: 'Śniadanie', lunch: 'Lunch', snack: 'Przekąska', post: 'Posiłek potreningowy',
  dinner: 'Obiad', supper: 'Kolacja', drinks: 'Napoje' };
const round1 = x => Math.round(x * 10) / 10;

export function dietSummary(phase, variant) {
  const p = plan(variant, phase);
  return {
    phase, variant,
    header: p.header_src,
    meals: p.meals.map(m => ({
      id: m.id,
      name: m.id === 'post' && variant === 'NT' ? 'Posiłek po saunie' : MEAL_NAMES[m.id], // D-018
      total: m.total,
      items: m.items,
    })),
    total: p.total,
    // Procenty pochodzą z PDF i są liczone od kcal wyliczonych z makroskładników (4/4/9), nie od sumy kcal.
    atwater: p.atwater_kcal,
    pct: p.pct,
    kcalGap: round1(p.total.kcal - p.atwater_kcal),
    spices: p.spices_raw,
    optional: p.optional,
    src: p.src,
  };
}

// Co zmienia się między fazami w tym samym wariancie dnia (gramatury i kcal pozycji).
export function phaseDiff(variant, fromPhase, toPhase) {
  const a = plan(variant, fromPhase), b = plan(variant, toPhase);
  const out = [];
  for (const [i, m] of a.meals.entries()) {
    for (const [j, it] of m.items.entries()) {
      const other = b.meals[i].items[j];
      if (!other || other.name !== it.name) throw new Error(`Niezgodna struktura planów ${variant} F${fromPhase}/F${toPhase}`);
      if (it.label !== other.label) out.push({ meal: m.id, name: it.name, from: it.label, to: other.label,
        kcalFrom: it.kcal, kcalTo: other.kcal });
    }
  }
  return out;
}

// Godziny posiłków z planu dnia (szablon godzin jest wspólny dla wszystkich dni — D-004): { breakfast: '09:00', … }.
export function mealTimes(slots) {
  return Object.fromEntries(slots.flatMap(s => s.items).filter(i => i.kind === 'meal' && i.time).map(i => [i.meal, i.time]));
}

// Następny posiłek dnia: pierwszy o godzinie ≥ hhmm (kolejność godzin, nie kolejność w PDF). null — wszystkie za nami.
export function nextMeal(meals, times, hhmm) {
  return meals.filter(m => times[m.id]).map(m => ({ ...m, time: times[m.id] }))
    .sort((a, b) => (a.time < b.time ? -1 : 1)).find(m => m.time >= hhmm) || null;
}
