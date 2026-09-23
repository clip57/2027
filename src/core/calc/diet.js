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
