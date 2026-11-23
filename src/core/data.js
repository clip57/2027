// Jedyny punkt dostępu do danych źródłowych (warstwa ŹRÓDŁO, tylko do odczytu).
import { weekday } from './dates.js';
import diet from '../data/diet.json' with { type: 'json' };
import supplements from '../data/supplements.json' with { type: 'json' };
import catalog from '../data/catalog.json' with { type: 'json' };
import training from '../data/training.json' with { type: 'json' };
import cfa from '../data/cfa.json' with { type: 'json' };
import mpw from '../data/mpw.json' with { type: 'json' };
import safety from '../data/safety.json' with { type: 'json' };
import dayTemplate from '../data/day_template.json' with { type: 'json' };
import week from '../data/week.json' with { type: 'json' };
import phases from '../data/phases.json' with { type: 'json' };
import seeds from '../data/seeds.json' with { type: 'json' };
import mealprep from '../data/mealprep.json' with { type: 'json' };

const deepFreeze = o => { Object.values(o).forEach(v => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };
[diet, supplements, catalog, training, cfa, mpw, safety, dayTemplate, week, phases, seeds, mealprep].forEach(deepFreeze);

// D-120: nowe daty i godziny bloków CFA i MPW (`week.studyMoves` — numer bloku → „data godzina” początku, długość bez zmian) stosowane przy wczytaniu;
// pliki planów (cfa.json, mpw.json) bez zmian — godzina i data z planu w polach `godz_src` / `data_src`. Wszystkie widoki czytają już przesunięte bloki.
const mm = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const DAY_PL = ['', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
const SM = /** @type {any} */ (week).studyMoves || { cfa: {}, mpw: {} };
const moveTo = (b, to) => {
  const [date, start] = to.split(' '), len = mm(b.godz.slice(6)) - mm(b.godz.slice(0, 5));
  return Object.freeze({ ...b, data: date, dzien: date === b.data ? b.dzien : DAY_PL[weekday(date)], godz: `${start}–${hhmm(mm(start) + len)}`, godz_src: b.godz,
    ...(date === b.data ? {} : { data_src: b.data }) });
};
// Plan MPW (D-095) z przesunięciem godzin wg decyzji (D-097: czwartki od 07.01.2027 — bloki A–C 30 min później; `week.mpwShift`).
const shiftGodz = (g, min) => g.split('–').map(t => hhmm(mm(t) + min)).join('–');
const MS = week.mpwShift;
const shifted = b => MS && b.data >= MS.from && MS.weekdays.includes(weekday(b.data)) && !b.blok.startsWith('P');
const cfaBloki = Object.freeze(cfa.D.bloki.map(b => (SM.cfa[b.nr] ? moveTo(b, SM.cfa[b.nr]) : b)));
export const mpwBloki = Object.freeze(mpw.D.bloki.map(b => (SM.mpw[b.nr] ? moveTo(b, SM.mpw[b.nr])
  : shifted(b) ? Object.freeze({ ...b, godz: shiftGodz(b.godz, MS.minutes), godz_src: b.godz }) : b)));

export const SRC = { diet, supplements, catalog, training, cfa: Object.freeze({ ...cfa, D: Object.freeze({ ...cfa.D, bloki: cfaBloki }) }),
  mpw: Object.freeze({ ...mpw, D: Object.freeze({ ...mpw.D, bloki: mpwBloki }) }), safety, dayTemplate, week, phases, seeds, mealprep };

export const plan = (variant, phase) => diet.plans.find(p => p.variant === variant && p.phase === phase);
export const catalogById = Object.freeze(Object.fromEntries(catalog.items.map(i => [i.id, i])));
const byDay = bloki => Object.freeze(bloki.reduce((m, b) => ((m[b.data] ||= []).push(b), m), {}));
export const cfaByDay = byDay(cfaBloki);
export const mpwByDay = byDay(mpwBloki);

// Zużycie spoza tabel PDF (D-021): imbir 5 g/d do zielonej herbaty.
export const EXTRA_DAILY = Object.freeze([{ prod: 'imbir', qty: 5, unit: 'g', basis: 'D-021: imbir 5 g (2–3 plastry)' }]);
