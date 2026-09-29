// Resolver dnia: data -> kompletny opis dnia. Jedyne miejsce, w którym łączą się
// kalendarz faz (D-017), typ dnia (D-018), dieta, suplementy (D-001), trening, CFA i szablon godzin (D-004).
import { SRC, plan, cfaByDay, mpwByDay } from './data.js';
import { weekday, dayName, isValidDay } from './dates.js';

const CFA_FIRST = SRC.cfa.D.stat.start, CFA_LAST = SRC.cfa.D.stat.end;
const MOCKS = new Set(SRC.cfa.D.mockCFA);
// Plan MPW (D-095; v8 — D-096): 16.11.2026–20.03.2027 — bloki A–C 15:30–18:23 nie zmieniają szablonu godzin (osobna karta w „Dziś”);
// bloki P1–P7 (powtórka całości, 8:00–15:23 w wybrane weekendy) zajmują sloty A–G o tych samych godzinach; w czwartki od 07.01
// (D-097) bloki A–C są 30 min później i mają własne sloty wariantu „czwartek_st” (`mpwSlot`)
const MPW_FIRST = SRC.mpw.D.stat.start, MPW_LAST = SRC.mpw.D.stat.end, SIMS = new Set(SRC.mpw.D.mockCFA);
const mpwSlotBlocks = date => (mpwByDay[date] || []).filter(b => b.blok.startsWith('P'));
// Weekendowe bloki 8:00–15:23 (D-096): studia, rozmowa, praca magisterska, święta, egzamin MPW — sloty A–G
export const dayBlocks = date => SRC.week.blocks?.[date] || null;
const BLOCKS_END = '15:23';
const MEAL_NAMES = { breakfast: 'Śniadanie', lunch: 'Lunch', snack: 'Przekąska', post: 'Posiłek potreningowy',
  dinner: 'Obiad', supper: 'Kolacja', drinks: 'Napoje' };

// Plan (D-088, D-097): od Dnia zero 29.09.2026 do 28.03.2027 (`phases.json` → `start`, `zero`, `end`). Dni wcześniejsze i późniejsze są
// poza planem — bez treningu, dawek, bloków i zużycia w Zapasach. Dzień zero: bez diety, treningu, nauki i suplementów (pielęgnacja tak).
// Zdarzenia z dni poza planem zostają w dzienniku (eksport, synchronizacja, analiza) — pomijają je tylko widoki i obliczenia planu.
export const PLAN_START = SRC.phases.start;
export const PLAN_END = SRC.phases.end || '9999-12-31';
export const DAY_ZERO = SRC.phases.zero || null;
export const inPlan = date => date >= PLAN_START && date <= PLAN_END;
export const isZero = date => date === DAY_ZERO;

export function phaseFor(date) {
  let ph = null;
  for (const p of SRC.phases.phases) if (date >= p.from) ph = p.phase;
  return ph; // null = przed Fazą 0 (start planu i Faza 0 od 27.09.2026 — D-088, D-090)
}

export function dosesFor(date) {
  if (!inPlan(date) || isZero(date)) return [];   // suplementacja od dnia 1 planu (D-088, D-097)
  const wd = weekday(date);
  return SRC.supplements.doses.filter(d =>
    d.weekdays.includes(wd) && inValidity(d, date));
}
// Okres przyjmowania preparatów czasowych (D-015; 30.09.2026–28.03.2027 — D-097). `from` opcjonalne.
export function inValidity(d, date) {
  return !d.validity || ((!d.validity.from || date >= d.validity.from) && date <= d.validity.until);
}

// Plan dnia tygodnia (D-018) z wyjątkami dla konkretnych dat (D-087: 25–27.09.2026) — trening, sauna, dieta, recall.
export function dayPlan(date) {
  const w = SRC.week.days[String(weekday(date))];
  if (!inPlan(date)) return { ...w, dayType: 'free', session: null, sessionName: 'Poza planem', sauna: 0, recall: false, variant: null,
    outside: true, after: date > PLAN_END, note: null, decision: 'D-088' };
  // Dzień zero (D-097): jak dzień poza planem (bez diety, treningu, nauki, suplementów i zużycia), ale z własnym widokiem w „Dziś”
  if (isZero(date)) return { ...w, dayType: 'zero', session: null, sessionName: 'Dzień zero', sauna: 0, recall: false, variant: null,
    outside: true, zero: true, note: null, decision: 'D-097' };
  const x = SRC.week.exceptions?.[date];
  return x ? { ...w, ...x } : w;
}

// Szablon godzin dnia z wariantem dnia (poza dniem mocka): niedziela „basen” (D-094), czwartek „czwartek” — sauna i zakupy,
// od 07.01 „czwartek_st” — zakupy 15:30 i bloki MPW 30 min później (D-097). Soboty bez zakupów (plan CFA v12, D-097).
export function templateFor(date, isMock = MOCKS.has(date)) {
  const name = dayPlan(date).variant;
  const v = !isMock && name && SRC.dayTemplate.variants?.[name];
  if (!v) return SRC.dayTemplate.slots;
  const out = [];
  for (const s of SRC.dayTemplate.slots) {
    if (s.id === v.replaces[0]) out.push(...v.slots);
    if (!v.replaces.includes(s.id)) out.push(s);
  }
  return out;
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
  const w = dayPlan(date);
  const phase = phaseFor(date);
  const effPhase = phase ?? 0;
  const p = plan(w.diet, effPhase);
  const inCfa = date >= CFA_FIRST && date <= CFA_LAST;
  const blocks = cfaByDay[date] || [];
  const isMock = MOCKS.has(date);
  const doses = dosesFor(date);
  const wb = dayBlocks(date), mpwAll = mpwByDay[date] || [], mpwP = mpwSlotBlocks(date);
  const exercises = w.session && SRC.training.days[w.session]; // basen (nd) nie ma listy ćwiczeń w TRENING
  const session = exercises ? exercises.map(e => ({ ...e, seriesToday: e.series[String(effPhase)] })) : null;

  const mealName = key => (key === 'post' && w.diet === 'NT' ? 'Posiłek po saunie' : MEAL_NAMES[key]); // D-018
  const sessionLabel = w.sauna === 1 ? `${w.sessionName} + sauna` : w.sessionName; // D-040
  const free = w.dayType === 'free' || !!w.zero;   // dzień bez treningu i sauny (D-087): całe okno treningowe wolne
  const slots = templateFor(date, isMock).map(s => {
    // Podpunkty: suplementy z tekstu PLAN_DNIA są ukryte — pokazywane są wyłącznie dawki z SUPLEMENTACJI (D-001).
    const items = (s.items || []).filter(i => i.kind === 'task' || i.kind === 'meal').map(i => i.kind === 'meal'
      ? { kind: 'meal', meal: i.meal, time: i.time, text: `${mealName(i.meal)} (${i.time})`, kcal: p.meals.find(m => m.id === i.meal)?.total.kcal ?? null }
      : { kind: 'task', text: i.text, decision: i.decision });
    const out = { id: s.id, from: s.from, to: s.to, domain: s.domain, role: s.role, title: s.title_src, desc: '', items, shop: !!s.shop,
      doses: doses.filter(d => d.time >= s.from && (s.to < s.from || d.time < s.to)) };
    if (s.role === 'cfa') {
      const letter = isMock && SRC.week.mock.replace[s.key] ? SRC.week.mock.replace[s.key] : s.key;
      const bl = blocks.filter(b => b.blok === letter);
      const pb = !inCfa && (s.mpwSlot ? mpwAll : mpwP).find(b => b.godz.startsWith(s.from));
      if (pb) Object.assign(out, { title: `MPW blok ${pb.blok}`, desc: pb.temat, cfa: [], mpw: pb });   // D-096: P1–P7 w slotach A–G; D-097: czwartek
      else if (s.mpwSlot) Object.assign(out, { title: 'Wolne', desc: 'Brak bloku MPW', cfa: [] });
      else if (!inCfa && wb && (wb.kind === 'wolne' || s.to <= BLOCKS_END)) Object.assign(out, { title: wb.title, desc: wb.desc, cfa: [], block: wb.kind });
      else if (!inCfa) Object.assign(out, { title: 'Brak bloku CFA', desc: 'Poza okresem planu nauki', cfa: [] });
      else if (!bl.length) Object.assign(out, { title: 'Wolne', desc: isMock ? 'Dzień mocka — brak bloku w planie (D-036)' : 'Brak bloku w planie CFA tego dnia', cfa: [] });
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
      out.title = SRC.week.activity[w.dayType]?.[s.key] ?? 'Wolne';   // Dzień zero (D-097) — bez zajęć
      if (s.key === 'main' && w.session && SRC.training.days[w.session] && w.dayType.startsWith('strength')) out.title = `Trening siłowy: ${w.sessionName}`;
      if (s.key === 'main' && w.note) out.desc = w.note;   // wyjątek dnia (D-087), np. trening kalibracyjny
    } else if (free && s.domain === 'train') {
      Object.assign(out, { title: 'Wolne', items: [] });
    } else if (s.role === 'recall') {
      const on = inCfa && w.recall;
      Object.assign(out, { recall: on, title: on ? 'CFA Active Recall' : 'Wieczór wolny',
        desc: on ? 'Sesja active recall (53 min)' : (inCfa ? 'W piątki i soboty brak sesji recall' : 'Poza okresem planu nauki') });
    }
    return out;
  });

  return {
    date, weekday: wd, dayName: dayName(date), phase, outside: !!w.outside, zero: !!w.zero, after: !!w.after, dayType: w.dayType, session: w.session, sessionName: w.sessionName, sessionLabel,
    note: w.note || null, exception: w.decision || null,
    sauna: w.sauna, dietVariant: w.diet, kcal: p.total.kcal, meals: mealsFor(w.diet, effPhase),
    doses, training: session, cfa: { inPlan: inCfa, blocks, isMock, recall: inCfa && w.recall },
    mpw: { inPlan: date >= MPW_FIRST && date <= MPW_LAST, blocks: mpwByDay[date] || [], isSim: SIMS.has(date) }, blocks: wb, slots,
  };
}

// Linia źródła bloku CFA (D-039), np. „Curriculum 2026 Vol 1 (QM), s. 3–13 (11 s.)”.
export const cfaSourceLine = b => `${b.zrodlo}, ${b.do_przeczytania}`;
