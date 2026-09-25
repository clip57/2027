// Zużycie dzienne magazynu wyliczane z planu (D-003): dieta (faza × wariant) + suplementy (D-001) + dodatki (D-021).
import { plan, catalogById, EXTRA_DAILY } from '../data.js';
import { phaseFor, dosesFor, dayPlan } from '../resolver.js';

const cache = new Map();

export function consumptionForDay(date) {
  if (cache.has(date)) return cache.get(date);
  const variant = dayPlan(date).diet;   // z wyjątkami dat (D-087)
  const p = plan(variant, phaseFor(date) ?? 0);
  const use = {};
  const add = (id, q) => { if (catalogById[id]?.tracked !== false) use[id] = (use[id] || 0) + q; };
  for (const m of p.meals) for (const it of m.items) if (it.prod && it.use) add(it.prod, it.use.qty);
  for (const d of dosesFor(date)) add(d.supp, d.qty);
  for (const x of EXTRA_DAILY) add(x.prod, x.qty);
  Object.freeze(use);
  cache.set(date, use);
  return use;
}
