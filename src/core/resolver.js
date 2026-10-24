// Resolver dnia: data -> kompletny opis dnia. Jedyne miejsce, w którym łączą się
// kalendarz faz (D-017), typ dnia (D-018), dieta, suplementy (D-001), trening, CFA i szablon godzin (D-004).
import { SRC, plan, cfaByDay, mpwByDay } from './data.js';
import { weekday, dayName, isValidDay } from './dates.js';

const CFA_FIRST = SRC.cfa.D.stat.start, CFA_LAST = SRC.cfa.D.stat.end;
const NIGHT_RECALL = new Set((SRC.cfa.D.nightRecall || []).map(r => r.data));   // D-101: dni sesji recall 22:00 z planu CFA
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

// Plan (D-088, D-103c): kalendarz, dieta, trening i realny początek planu — daty z `phases.json` (`start`, `end`; obecnie 18.10.2026–28.03.2027; plan CFA V44 ma własny zakres od 16.10 — `cfa.json`). Dni
// wcześniejsze i późniejsze są poza planem — bez treningu, dawek, bloków i zużycia w Zapasach. Dzień zero (D-097) usunięty z kalendarza w D-100 (obsługa w kodzie zostaje).
// Zdarzenia z dni poza planem zostają w dzienniku (eksport, synchronizacja, analiza) — pomijają je tylko widoki i obliczenia planu.
export const PLAN_START = SRC.phases.start;
export const PLAN_END = SRC.phases.end || '9999-12-31';
export const DAY_ZERO = SRC.phases.zero || null;   // D-100: Dzień zero usunięty z kalendarza (zero: null) — obsługa zostaje w kodzie
// D-100…D-103c: realny początek planu, start diety i treningów — z `phases.json` (`realStart`, `dietStart`, `trainStart`; obecnie wszystkie = `start`, 18.10.2026).
// Flaga `noDiet` (dni planu przed startem diety) przy starcie diety = starcie planu nie występuje
export const PLAN_REAL_START = SRC.phases.realStart || PLAN_START;
export const DIET_START = SRC.phases.dietStart || PLAN_START;
export const TRAIN_START = SRC.phases.trainStart || PLAN_START;
export const inPlan = date => date >= PLAN_START && date <= PLAN_END;
export const isZero = date => date === DAY_ZERO;

export function phaseFor(date) {
  let ph = null;
  for (const p of SRC.phases.phases) if (date >= p.from) ph = p.phase;
  return ph; // null = przed Fazą 0 (fazy z `phases.json`; obecnie Faza 0 od 18.10.2026, Faza 1 od 12.11, Faza 2 od 11.12 — D-103, D-103c)
}

// Dzień z blokiem J (plan CFA v14, D-099: 21:00–21:53 w dni poza pt i sob) — wieczór układany inaczej (kolacja przed blokiem).
export const hasJ = date => (cfaByDay[date] || []).some(b => b.blok === 'J');
const hasLetter = (date, ...l) => (cfaByDay[date] || []).some(b => l.includes(b.blok));
const SUPPER_J = '20:50';   // kolacja 20:50–21:00 w dni z blokiem J (D-099); chondroityna idzie z kolacją
const POST_M = '19:15';     // posiłek potreningowy 19:15 (zamiast 20:15 / 19:30 w niedzielę) w dni treningowe z blokiem M (D-103)
// D-103: dzień TRENINGOWY z blokiem M 19:40–20:33 — trening 18:15–19:15, powrót do domu z posiłkiem 19:15–19:25, prysznic i mycie głowy 19:25–19:40, bez sauny.
// Czwartki (osobny wariant) i dni z blokami K/L (bez treningu — okno treningowe zajęte) nie należą do tej grupy.
export const mTrainDay = date => {
  if (!hasLetter(date, 'M') || hasLetter(date, 'K', 'L')) return false;
  const d = dayPlan(date);
  return !d.outside && d.dayType !== 'free' && !String(d.variant || '').startsWith('czwartek');
};
// Godzina dawki w danym dniu (D-099, D-103: kreatyna z posiłkiem potreningowym 19:15; D-103b: w niedzielę bez treningu — bez basenu — kreatyna 19:30 idzie z posiłkiem 20:15,
// bo w dni z blokami L/M slot na 19:30 nie niesie dawek i dawka znikała z widoku dnia)
export const doseTime = (time, date) => (time === '21:00' && hasJ(date) ? SUPPER_J
  : (time === '20:15' || time === '19:30') && mTrainDay(date) ? POST_M
    : time === '19:30' && dayPlan(date).dayType === 'free' ? '20:15' : time);

export function dosesFor(date) {
  if (!inPlan(date) || isZero(date)) return [];   // suplementacja od dnia 1 planu (D-088, D-097)
  const wd = weekday(date);
  const doses = SRC.supplements.doses.filter(d =>
    d.weekdays.includes(wd) && inValidity(d, date));
  return doses.map(d => ({ ...d, time: doseTime(d.time, date) }));   // D-099, D-103, D-103b
}
// Okres przyjmowania preparatów czasowych (D-015; `validity` w `supplements.json`, obecnie 18.10.2026–28.03.2027 — D-103c). `from` opcjonalne.
export function inValidity(d, date) {
  return !d.validity || ((!d.validity.from || date >= d.validity.from) && date <= d.validity.until);
}

// Plan dnia tygodnia (D-018) z wyjątkami dla konkretnych dat (`week.json` → `exceptions`; D-087, D-096, D-103, D-103b: np. 01–02.11 i 03–11.11 bez treningu,
// święta, czwartki od 07.01) — trening, sauna, dieta, recall.
export function dayPlan(date) {
  const w = SRC.week.days[String(weekday(date))];
  // D-102, D-103b: plan CFA ma własny zakres (`nightRecall`) — recall CFA także w ewentualnych dniach sprzed startu planu, które są historią
  if (!inPlan(date)) return { ...w, dayType: 'free', session: null, sessionName: 'Poza planem', sauna: 0, recall: NIGHT_RECALL.has(date), variant: null,
    outside: true, after: date > PLAN_END, note: null, decision: 'D-088' };
  // Dzień zero (D-097): jak dzień poza planem (bez diety, treningu, nauki, suplementów i zużycia), ale z własnym widokiem w „Dziś”
  if (isZero(date)) return { ...w, dayType: 'zero', session: null, sessionName: 'Dzień zero', sauna: 0, recall: false, variant: null,
    outside: true, zero: true, note: null, decision: 'D-097' };
  const x = SRC.week.exceptions?.[date];
  let d = x ? { ...w, ...x } : w;
  // D-101: sesje recall 22:00 wg harmonogramu CFA (`nightRecall`: codziennie poza 23.10 i 25.10) zamiast reguły „bez pt i sob”
  if (NIGHT_RECALL.size && date >= CFA_FIRST && date <= CFA_LAST) d = { ...d, recall: NIGHT_RECALL.has(date) };
  return date < DIET_START ? { ...d, noDiet: true } : d;   // D-100: dni planu przed startem diety (przy starcie diety = start planu — nigdy)
}

// Szablon godzin dnia z wariantem dnia (poza dniem mocka): niedziela „basen” (D-094), czwartek „czwartek” — sauna i zakupy,
// od 07.01 „czwartek_st” — zakupy 15:30 i bloki MPW 30 min później (D-097). Soboty bez zakupów (plan CFA v12, D-097).
export function templateFor(date, isMock = MOCKS.has(date)) {
  const base = baseTemplate(date, isMock);
  if (mTrainDay(date)) return trainingBeforeM(hasJ(date) ? jEvening(base) : base, date);   // D-103: najpierw wieczór z J, potem układ z blokiem M
  const t = mycieBeforeM(base, date);
  return trimTrainWindow(hasJ(date) ? jEvening(t) : t, date);
}

function baseTemplate(date, isMock) {
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

// Dni treningowe z blokiem M 19:40–20:33 (D-103, polecenie użytkownika 16.10.2026): trening skrócony do 18:15–19:15, potem „Powrót do domu” 19:15–19:25 z posiłkiem
// potreningowym o 19:15 (zamiast 20:15) i „Prysznic i mycie głowy” 19:25–19:40. Sauna, chłodzenie i dawne mycie głowy odpadają (nie mieszczą się przed blokiem M);
// przygotowywanie kolacji zaczyna się tuż po bloku M. Kroki z usuniętych slotów (prysznic, woda z sodem, przebranie) przechodzą do nowych slotów — poza opisem
// wychładzania po saunie. Układ w `day_template.json` → `mTraining`.
function trainingBeforeM(list, date) {
  const m = (cfaByDay[date] || []).find(b => b.blok === 'M'), t = SRC.dayTemplate.mTraining;
  const a = list.findIndex(s => s.id.startsWith('slot.1815')), z = list.findIndex(s => s.id === 'slot.2045');   // trening … przygotowywanie kolacji
  if (!m || !t || a < 0 || z <= a) return list;
  const dropped = list.slice(a + 1, z), tasks = ids => dropped.filter(s => ids.includes(s.id)).flatMap(s => s.items.filter(i => i.kind === 'task'));
  const home = { ...t.home, items: [...t.home.items, ...tasks(['slot.2005']).filter(i => !/wychłodzen/i.test(i.text))] };   // woda z sodem, przebranie
  const wash = { ...t.wash, items: tasks(['slot.1935', 'slot.2015n']) };                                                      // prysznic (+ pielęgnacja po basenie)
  return [...list.slice(0, a), { ...list[a], to: t.trainTo, decision: 'D-103' }, home, wash,
    { ...list[z], from: m.godz.slice(6), decision: 'D-103' }, ...list.slice(z + 1)];
}

// Dni bez treningu z blokami po południu (D-103: 23.10, od D-101 także 03–11.11): okno treningowe („Wolne”) nie może pokrywać się z blokami K, L, M — sloty „train”
// są pomniejszane o czas bloków (bez tego karta „Teraz” pokazywała „Wolne” zamiast bloku). Sloty z treścią (czwartek) i dni treningowe bez zmian.
function trimTrainWindow(list, date) {
  if (dayPlan(date).dayType !== 'free' || dayPlan(date).outside) return list;   // dni poza planem (D-103c) zostają przy szablonie podstawowym
  const keys = new Set([...list.filter(s => s.role === 'cfa').map(s => s.key), ...Object.values(SRC.week.mock.replace)]);
  const cuts = (cfaByDay[date] || []).filter(b => !keys.has(b.blok)).map(b => b.godz.split('–')).sort();
  if (!cuts.length) return list;
  return list.flatMap(s => {
    if (s.domain !== 'train') return [s];
    let parts = [[s.from, s.to]];
    for (const [cf, ct] of cuts) parts = parts.flatMap(([f, t]) => (t <= cf || f >= ct) ? [[f, t]] : [f < cf ? [f, cf] : null, t > ct ? [ct, t] : null].filter(Boolean));
    return parts.filter(([f, t]) => toMin(t) - toMin(f) >= 1).map(([f, t], i) => ({ ...s, id: i ? `${s.id}.${i}` : s.id, from: f, to: t }));
  });
}

// Dni z blokiem M 19:40–20:33 bez treningu (D-101: 22.10, 29.10 i 03–11.11; D-103b: także 17.10, 01.11 i 02.11): posiłek po saunie / potreningowy o 20:15 zostaje w trakcie bloku (decyzja użytkownika), a mycie głowy
// (`slot.2035`) jest skrócone i leży tuż przed blokiem M — między blokami L i M (19:33–19:40) albo, gdy nie ma bloku L, 19:30–19:40. Zwolnione 10 min dostaje slot
// z posiłkiem (powrót do domu), sąsiednie sloty „Wolne” (okno treningowe w dni bez treningu) są odpowiednio przycięte. Czwartki 22/29.10 mają to już w wariancie `czwartek_zl` (wariant `czwartek_k` dla 15.10 jest od D-103b nieużywany).
function mycieBeforeM(list, date) {
  const blocks = cfaByDay[date] || [], m = blocks.find(b => b.blok === 'M'), l = blocks.find(b => b.blok === 'L');
  const i = list.findIndex(s => s.id === 'slot.2035');
  if (!m || i < 1 || list[i].from < '20:00' || dayPlan(date).outside) return list;   // brak bloku M, brak slotu mycia (niedziela z basenem), mycie już przed blokiem (czwartek_k) albo dzień poza planem (D-103c: 16–17.10 mają tylko bloki CFA)
  const to = m.godz.slice(0, 5), from = l ? l.godz.slice(6) : earlier(to);
  const out = [];
  for (const s of list) {
    if (s.id === 'slot.2035') continue;
    if (s.id === list[i - 1].id) out.push({ ...s, to: list[i].to, decision: 'D-101' });   // posiłek (powrót do domu) przejmuje zwolniony czas po myciu
    else if (s.domain === 'train' && s.from < to && s.to > from) {                        // okno treningowe (w dni bez treningu — „Wolne”) przycięte wokół mycia
      if (s.from >= from && s.to <= to) continue;
      out.push({ ...s, from: s.from < from ? s.from : to, to: s.to > to ? s.to : from });
    } else out.push(s);
  }
  const at = out.findIndex(s => s.from >= to);   // mycie przed pierwszym slotem zaczynającym się nie wcześniej niż blok M
  out.splice(at < 0 ? out.length : at, 0, { ...list[i], from, to, decision: 'D-101' });
  return out;
}

// Wieczór w dni z blokiem J 21:00–21:53 (D-099, polecenie użytkownika 08.10.2026): slot z posiłkiem potreningowym („Powrót do domu” — w czwartek „Zakupy”,
// w niedzielę „Powrót do domu” po basenie) skrócony o 10 min (20:15–20:25), kolejne sloty o 10 min wcześniej, kolacja (z chondroityną) 20:50–21:00,
// „Przygotowywanie posiłków, melisy i wieczorna pielęgnacja” 21:53–22:00. Inne dni bez zmian.
const toMin = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const fromMin = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const earlier = (t, n = 10) => fromMin(toMin(t) - n);
function jEvening(list) {
  const post = list.findIndex(s => s.items.some(i => i.kind === 'meal' && i.meal === 'post'));
  const sup = list.findIndex(s => s.id === 'slot.2100'), tail = list.findIndex(s => s.id === 'slot.2145');
  if (post < 0 || sup <= post || tail <= sup) return list;
  return list.map((s, i) => {
    if (i === post) return { ...s, to: earlier(s.to), decision: 'D-099' };
    if (i > post && i < sup) return { ...s, from: earlier(s.from), to: earlier(s.to), decision: 'D-099' };
    if (i === sup) return { ...s, from: SUPPER_J, to: '21:00', title_src: 'Kolacja', decision: 'D-099',
      items: s.items.map(it => (it.kind === 'meal' && it.meal === 'supper' ? { ...it, time: SUPPER_J } : it)) };
    if (i === tail) return { ...s, from: '21:53', decision: 'D-099' };
    return s;
  });
}

// U1 (audyt 23.10.2026): slot nauki bez bloku poza okresem planu CFA (od 12.11 przez 4,5 miesiąca — 9 slotów dziennie z tekstem „Brak bloku CFA —
// Poza okresem planu nauki”) to „Czas własny” (`own` — „Dziś” pokazuje go lżej). Slot, w którego czasie wypadają bloki MPW A–C (plan MPW ma osobną
// kartę „Nauka MPW”, a szablon godzin dnia się nie zmienia — D-095), nazywa je wprost z godzinami bloków. Godziny slotów bez zmian.
const overlaps = (godz, from, to) => { const [f, t] = godz.split('–'); return f < to && t > from; };
function ownTime(s, mpw) {
  const list = mpw.filter(b => !b.blok.startsWith('P') && overlaps(b.godz, s.from, s.to));
  if (!list.length) return { title: 'Czas własny', desc: '', cfa: [], own: true };
  return { title: 'Nauka MPW', desc: `${list.length === 1 ? 'Blok' : 'Bloki'} ${list.map(b => `${b.blok} ${b.godz}`).join(', ')} — w karcie „Nauka MPW”`, cfa: [] };
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
  const noDiet = !!w.noDiet;   // D-100: dzień planu przed startem diety — bez posiłków i kcal, bez zużycia żywności (od D-101 dane tego nie używają)
  const inCfa = date >= CFA_FIRST && date <= CFA_LAST;
  const blocks = cfaByDay[date] || [];
  const isMock = MOCKS.has(date);
  const doses = dosesFor(date);
  const wb = dayBlocks(date), mpwAll = mpwByDay[date] || [], mpwP = mpwSlotBlocks(date);
  const exercises = w.session && SRC.training.days[w.session]; // basen (nd) nie ma listy ćwiczeń w TRENING
  const session = exercises ? exercises.map(e => ({ ...e, seriesToday: e.series[String(effPhase)] })) : null;

  const mealName = key => (key === 'post' && w.diet === 'NT' ? 'Posiłek po saunie' : MEAL_NAMES[key]); // D-018
  const mTrain = mTrainDay(date), sauna = mTrain ? 0 : w.sauna;   // D-103: w dni treningowe z blokiem M nie ma sauny (po treningu od razu dom, prysznic i blok M)
  const note = w.note || (mTrain && w.sauna ? 'Bez sauny: blok M o 19:40, trening do 19:15 (D-103)' : null);
  const sessionLabel = sauna === 1 ? `${w.sessionName} + sauna` : w.sessionName; // D-040
  const free = w.dayType === 'free' || !!w.zero;   // dzień bez treningu i sauny (D-087): całe okno treningowe wolne
  const tpl = templateFor(date, isMock);
  const slots = tpl.map(s => {
    // Podpunkty: suplementy z tekstu PLAN_DNIA są ukryte — pokazywane są wyłącznie dawki z SUPLEMENTACJI (D-001).
    const items = (s.items || []).filter(i => i.kind === 'task' || (i.kind === 'meal' && !noDiet)).map(i => i.kind === 'meal'
      ? { kind: 'meal', meal: i.meal, time: i.time, text: `${mealName(i.meal)} (${i.time})`, kcal: p.meals.find(m => m.id === i.meal)?.total.kcal ?? null }
      : { kind: 'task', text: i.text, decision: i.decision });
    // `key` — rola slotu w szablonie (np. aktywność: warmup / main / sauna, posiłek: id posiłku); także w wariantach dnia o innych identyfikatorach slotów
    const out = { id: s.id, key: s.key ?? null, from: s.from, to: s.to, domain: s.domain, role: s.role, title: s.title_src, desc: '', items, shop: !!s.shop,
      doses: doses.filter(d => d.time >= s.from && (s.to < s.from || d.time < s.to)) };
    if (s.role === 'cfa') {
      const letter = isMock && SRC.week.mock.replace[s.key] ? SRC.week.mock.replace[s.key] : s.key;
      const bl = blocks.filter(b => b.blok === letter);
      const pb = !inCfa && (s.mpwSlot ? mpwAll : mpwP).find(b => b.godz.startsWith(s.from));
      if (pb) Object.assign(out, { title: `MPW blok ${pb.blok}`, desc: pb.temat, cfa: [], mpw: pb });   // D-096: P1–P7 w slotach A–G; D-097: czwartek
      else if (s.mpwSlot) Object.assign(out, ownTime(s, mpwAll));
      else if (!inCfa && wb && (wb.kind === 'wolne' || s.to <= BLOCKS_END)) Object.assign(out, { title: wb.title, desc: wb.desc, cfa: [], block: wb.kind });
      else if (!inCfa) Object.assign(out, ownTime(s, mpwAll));
      else if (!bl.length) Object.assign(out, { title: 'Wolne', desc: isMock ? 'Dzień mocka — brak bloku w planie (D-036)' : 'Brak bloku w planie CFA tego dnia', cfa: [] });
      else if (isMock && letter.startsWith('S')) {
        // Bloki sesji przypisane tylko do pierwszego slotu sesji (A lub C); drugi slot = kontynuacja.
        const first = Object.entries(SRC.week.mock.replace).find(([, v]) => v === letter)[0] === s.key;
        Object.assign(out, { title: `Mock CFA — sesja ${letter[1]}`, desc: first ? '' : `Kontynuacja sesji (${bl[0].godz})`, cfa: first ? bl : [] });
      }
      else Object.assign(out, { title: `CFA blok ${s.key}`, cfa: bl });
    } else if (s.role === 'meal') {
      const m = p.meals.find(x => x.id === s.key);
      Object.assign(out, { meal: s.key, kcal: m && !noDiet ? m.total.kcal : null, mealName: mealName(s.key) });
    } else if (s.role === 'activity') {
      out.title = SRC.week.activity[w.dayType]?.[s.key] ?? 'Wolne';   // Dzień zero (D-097) — bez zajęć
      if (s.key === 'main' && w.session && SRC.training.days[w.session] && w.dayType.startsWith('strength')) out.title = `Trening siłowy: ${w.sessionName}`;
      if (s.key === 'main' && note) out.desc = note;   // wyjątek dnia (D-087), np. trening kalibracyjny
    } else if (free && s.domain === 'train') {
      Object.assign(out, { title: 'Wolne', items: [] });
    } else if (s.role === 'recall') {
      const on = inCfa && w.recall;
      Object.assign(out, { recall: on, title: on ? 'CFA Active Recall' : 'Wieczór wolny', own: !inCfa,   // U1: poza planem CFA — bez opisu „Poza okresem planu nauki”
        desc: on ? 'Sesja active recall (53 min)' : (inCfa ? 'Brak sesji recall tego dnia (wg harmonogramu CFA)' : '') });
    }
    return out;
  });

  // D-099: blok o literze bez slotu w szablonie (plan v14: J 21:00–21:53 poza pt/sob) — własny slot „CFA blok J” między kolacją (20:50–21:00) a przygotowaniem posiłków (21:53–22:00);
  // wieczór w dni z J układa `jEvening`. Eksport ICS i licznik bloków dostają slot automatycznie.
  if (inCfa) {
    const letters = new Set(tpl.filter(t => t.role === 'cfa').map(t => (isMock && SRC.week.mock.replace[t.key]) || t.key));
    const extra = {};
    for (const b of blocks) if (!letters.has(b.blok)) (extra[b.blok] ||= []).push(b);
    const domain = slots.find(x => x.role === 'cfa')?.domain;
    for (const [letter, list] of Object.entries(extra)) {
      const [from, to] = list[0].godz.split('–');
      const at = slots.findIndex(x => x.to > x.from && x.from >= from);   // przed pierwszym slotem zaczynającym się nie wcześniej niż blok
      slots.splice(at < 0 ? slots.length : at, 0, { id: `slot.cfa.${letter}`, from, to, domain, role: 'cfa', title: `CFA blok ${letter}`, desc: '', items: [], shop: false, doses: [], cfa: list, extra: true });
    }
  }

  return {
    date, weekday: wd, dayName: dayName(date), phase, outside: !!w.outside, zero: !!w.zero, after: !!w.after, dayType: w.dayType, session: w.session, sessionName: w.sessionName, sessionLabel,
    note, exception: w.decision || null,
    sauna, dietVariant: w.diet, noDiet, preStart: date < PLAN_REAL_START, kcal: noDiet ? null : p.total.kcal, meals: noDiet ? [] : mealsFor(w.diet, effPhase),
    doses, training: session, cfa: { inPlan: inCfa, blocks, isMock, recall: inCfa && w.recall },
    mpw: { inPlan: date >= MPW_FIRST && date <= MPW_LAST, blocks: mpwByDay[date] || [], isSim: SIMS.has(date) }, blocks: wb, slots,
  };
}

// Linia źródła bloku CFA (D-039), np. „Curriculum 2026 Vol 1 (QM), s. 3–13 (11 s.)”.
export const cfaSourceLine = b => `${b.zrodlo}, ${b.do_przeczytania}`;
