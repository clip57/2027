// Zużycie dzienne magazynu wyliczane z planu (D-003): dieta (faza × wariant) + suplementy (D-001) + dodatki (D-021).
import { plan, catalogById, EXTRA_DAILY } from '../data.js';
import { phaseFor, dosesFor, dayPlan, inPlan } from '../resolver.js';

const cache = new Map();

export function consumptionForDay(date) {
  if (cache.has(date)) return cache.get(date);
  // Poza planem (D-088) i w Dniu zero (D-097) brak zużycia wg planu — inwentaryzacja sprzed startu jest odliczana od pierwszego dnia planu (08.10.2026; 08.10 bez diety — D-100)
  if (!inPlan(date) || dayPlan(date).zero) { const none = Object.freeze({}); cache.set(date, none); return none; }
  const dp = dayPlan(date), variant = dp.diet;   // z wyjątkami dat (D-087)
  const p = plan(variant, phaseFor(date) ?? 0);
  const use = {};
  const add = (id, q) => { if (catalogById[id]?.tracked !== false) use[id] = (use[id] || 0) + q; };
  if (!dp.noDiet) for (const m of p.meals) for (const it of m.items) if (it.prod && it.use) add(it.prod, it.use.qty);   // D-100: 08.10 bez diety
  for (const d of dosesFor(date)) add(d.supp, d.qty);
  for (const x of EXTRA_DAILY) add(x.prod, x.qty);
  Object.freeze(use);
  cache.set(date, use);
  return use;
}
