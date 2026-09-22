// Jedyny punkt dostępu do danych źródłowych (warstwa ŹRÓDŁO, tylko do odczytu).
import diet from '../data/diet.json' with { type: 'json' };
import supplements from '../data/supplements.json' with { type: 'json' };
import catalog from '../data/catalog.json' with { type: 'json' };
import training from '../data/training.json' with { type: 'json' };
import cfa from '../data/cfa.json' with { type: 'json' };
import safety from '../data/safety.json' with { type: 'json' };
import dayTemplate from '../data/day_template.json' with { type: 'json' };
import week from '../data/week.json' with { type: 'json' };
import phases from '../data/phases.json' with { type: 'json' };
import seeds from '../data/seeds.json' with { type: 'json' };

const deepFreeze = o => { Object.values(o).forEach(v => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };
[diet, supplements, catalog, training, cfa, safety, dayTemplate, week, phases, seeds].forEach(deepFreeze);

export const SRC = { diet, supplements, catalog, training, cfa, safety, dayTemplate, week, phases, seeds };

export const plan = (variant, phase) => diet.plans.find(p => p.variant === variant && p.phase === phase);
export const catalogById = Object.freeze(Object.fromEntries(catalog.items.map(i => [i.id, i])));
export const cfaByDay = Object.freeze(cfa.D.bloki.reduce((m, b) => ((m[b.data] ||= []).push(b), m), {}));

// Zużycie spoza tabel PDF (D-021): imbir 5 g/d do zielonej herbaty.
export const EXTRA_DAILY = Object.freeze([{ prod: 'imbir', qty: 5, unit: 'g', basis: 'D-021: imbir 5 g (2–3 plastry)' }]);
