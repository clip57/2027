// Resolver dnia: data -> kompletny opis dnia. Jedyne miejsce, w którym łączą się
// kalendarz faz (D-017), typ dnia (D-018), dieta, suplementy (D-001), trening, CFA i szablon godzin (D-004).
import { SRC, plan, cfaByDay } from './data.js';
import { weekday, dayName, isValidDay } from './dates.js';

const CFA_FIRST = SRC.cfa.D.stat.start, CFA_LAST = SRC.cfa.D.stat.end;
const MOCKS = new Set(SRC.cfa.D.mockCFA);
const MEAL_NAMES = { breakfast: 'Śniadanie', lunch: 'Lunch', snack: 'Przekąska', post: 'Posiłek potreningowy',
  dinner: 'Obiad', supper: 'Kolacja', drinks: 'Napoje' };

export function phaseFor(date) {
  let ph = null;
  for (const p of SRC.phases.phases) if (date >= p.from) ph = p.phase;
  return ph; // null = przed startem planu (25.09.2026, D-086)
}

export function dosesFor(date) {
  const wd = weekday(date);
  return SRC.supplements.doses.filter(d =>
    d.weekdays.includes(wd) && inValidity(d, date));
}
// Okres przyjmowania preparatów czasowych (D-015; od 25.09.2026 — D-086). `from` opcjonalne.
export function inValidity(d, date) {
  return !d.validity || ((!d.validity.from || date >= d.validity.from) && date <= d.validity.until);
}

export function mealsFor(variant, phase) {
  const p = plan(variant, phase);
  return p.meals.map(m => ({
    id: m.id,
    name: m.id === 'post' && variant === 'NT' ? 'Posiłek po saunie' : MEAL_NAMES[m.id], // D-018
    label_src: m.label_src, total: m.total, items: m.items,
  }));
}

export function resolveDay(date) {
  if (!isValidDay(date)) throw new TypeError(`Nieprawidłowa data: ${date}`);
  const wd = weekday(date);
  const w = SRC.week.days[String(wd)];
  const phase = phaseFor(date);
  const effPhase = phase ?? 0;
  const p = plan(w.diet, effPhase);
  const inCfa = date >= CFA_FIRST && date <= CFA_LAST;
  const blocks = cfaByDay[date] || [];
  const isMock = MOCKS.has(date);
  const doses = dosesFor(date);
  const exercises = w.session && SRC.training.days[w.session]; // basen (nd) nie ma listy ćwiczeń w TRENING
  const session = exercises ? exercises.map(e => ({ ...e, seriesToday: e.series[String(effPhase)] })) : null;

  const mealName = key => (key === 'post' && w.diet === 'NT' ? 'Posiłek po saunie' : MEAL_NAMES[key]); // D-018
  const sessionLabel = w.sauna === 1 ? `${w.sessionName} + sauna` : w.sessionName; // D-040
  const slots = SRC.dayTemplate.slots.map(s => {
    // Podpunkty: suplementy z tekstu PLAN_DNIA są ukryte — pokazywane są wyłącznie dawki z SUPLEMENTACJI (D-001).
    const items = (s.items || []).filter(i => i.kind === 'task' || i.kind === 'meal').map(i => i.kind === 'meal'
      ? { kind: 'meal', meal: i.meal, time: i.time, text: `${mealName(i.meal)} (${i.time})`, kcal: p.meals.find(m => m.id === i.meal)?.total.kcal ?? null }
      : { kind: 'task', text: i.text, decision: i.decision });
    const out = { id: s.id, from: s.from, to: s.to, domain: s.domain, role: s.role, title: s.title_src, desc: '', items,
      doses: doses.filter(d => d.time >= s.from && (s.to < s.from || d.time < s.to)) };
    if (s.role === 'cfa') {
      const letter = isMock && SRC.week.mock.replace[s.key] ? SRC.week.mock.replace[s.key] : s.key;
      const bl = blocks.filter(b => b.blok === letter);
      if (!inCfa) Object.assign(out, { title: 'Brak bloku CFA', desc: 'Poza okresem planu nauki', cfa: [] });
      else if (!bl.length) Object.assign(out, { title: 'Wolne', desc: 'Dzień mocka — brak bloku w planie (D-036)', cfa: [] });
      else if (isMock && letter.startsWith('S')) {
        // Bloki sesji przypisane tylko do pierwszego slotu sesji (A lub C); drugi slot = kontynuacja.
        const first = Object.entries(SRC.week.mock.replace).find(([, v]) => v === letter)[0] === s.key;
        Object.assign(out, { title: `Mock CFA — sesja ${letter[1]}`, desc: first ? '' : `Kontynuacja sesji (${bl[0].godz})`, cfa: first ? bl : [] });
      }
      else Object.assign(out, { title: `CFA blok ${s.key}`, cfa: bl });
    } else if (s.role === 'meal') {
      const m = p.meals.find(x => x.id === s.key);
      Object.assign(out, { meal: s.key, kcal: m ? m.total.kcal : null, mealName: mealName(s.key) });
    } else if (s.role === 'activity') {
      out.title = SRC.week.activity[w.dayType][s.key];
      if (s.key === 'main' && w.session && SRC.training.days[w.session] && w.dayType.startsWith('strength')) out.title = `Trening siłowy: ${w.sessionName}`;
    } else if (s.role === 'recall') {
      const on = inCfa && w.recall;
      Object.assign(out, { recall: on, title: on ? 'CFA Active Recall' : 'Wieczór wolny',
        desc: on ? 'Sesja active recall (53 min)' : (inCfa ? 'W piątki i soboty brak sesji recall' : 'Poza okresem planu nauki') });
    }
    return out;
  });

  return {
    date, weekday: wd, dayName: dayName(date), phase, dayType: w.dayType, sessionName: w.sessionName, sessionLabel,
    sauna: w.sauna, dietVariant: w.diet, kcal: p.total.kcal, meals: mealsFor(w.diet, effPhase),
    doses, training: session, cfa: { inPlan: inCfa, blocks, isMock, recall: inCfa && w.recall }, slots,
  };
}

// Linia źródła bloku CFA (D-039), np. „Curriculum 2026 Vol 1 (QM), s. 3–13 (11 s.)”.
export const cfaSourceLine = b => `${b.zrodlo}, ${b.do_przeczytania}`;
