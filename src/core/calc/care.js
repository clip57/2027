// Pielęgnacja (D-094): harmonogram kroków z definicji użytkownika (zdarzenia `care.def`) i odhaczeń (`care.done`).
// Treść planu (kroki, produkty) pochodzi wyłącznie z danych użytkownika — w repozytorium jest tylko ta logika (D-035).
// Tylko odczyt, bez DOM — testy w tests/unit/care.test.mjs.
//
// Krok:    { id, kind: 'step', pora: 'rano'|'dzien'|'wieczor', group, order, text, product?, note?, warn?, wait? (min),
//            days? [1–7, pn = 1], from?, until? (RRRR-MM-DD, włącznie), asNeeded? (doraźnie — bez liczenia postępu), slot? (id slotu planu dnia) }
// Produkt: { id, kind: 'product', name, area, status?: 'uzywany'|'zapas'|'skonczony', opened?, note?, order? }
import { weekday, addDays, shortDate } from '../dates.js';

export const PORY = [
  { id: 'rano', label: 'Rano', icon: 'sun' },
  { id: 'dzien', label: 'W ciągu dnia', icon: 'sun-medium' },
  { id: 'wieczor', label: 'Wieczór', icon: 'moon' },
];
export const AREAS = [
  ['twarz', 'Twarz'], ['wlosy', 'Włosy'], ['cialo', 'Ciało'], ['jama', 'Jama ustna'], ['oczy', 'Oczy i nos'], ['detale', 'Pozostałe'],
];
export const STATUS = [['uzywany', 'W użyciu'], ['zapas', 'W zapasie'], ['skonczony', 'Skończony']];
export const DAY_SHORT = ['PN', 'WT', 'ŚR', 'CZW', 'PT', 'SOB', 'ND'];
const PORA_IDX = Object.fromEntries(PORY.map((p, i) => [p.id, i]));

// Definicje → model: kroki w kolejności pory i `order`, produkty wg `order` i nazwy
export function careModel(defs = []) {
  const steps = defs.filter(d => d.kind === 'step' && PORA_IDX[d.pora] != null)
    .sort((a, b) => PORA_IDX[a.pora] - PORA_IDX[b.pora] || (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id)));
  const products = defs.filter(d => d.kind === 'product')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name), 'pl'));
  return { steps, products, product: Object.fromEntries(products.map(p => [p.id, p])), empty: !steps.length && !products.length };
}

export const activeOn = (s, date) => (!s.days?.length || s.days.includes(weekday(date))) && (!s.from || date >= s.from) && (!s.until || date <= s.until);
export const doneKey = (date, id) => `${date}|${id}`;
export const isDone = (done, date, id) => done?.[doneKey(date, id)] === true;

export function stepsFor(model, date) { return model.steps.filter(s => activeOn(s, date)); }

// Postęp dnia: doraźne kroki nie są liczone (są widoczne, można je odhaczyć)
export function progress(list, done, date) {
  const req = list.filter(s => !s.asNeeded);
  return { done: req.filter(s => isDone(done, date, s.id)).length, total: req.length };
}

// Pory dnia z grupami (kolejność grup = kolejność pierwszego kroku w porze)
export function byPora(list) {
  return PORY.map(p => {
    const steps = list.filter(s => s.pora === p.id), groups = [];
    for (const s of steps) {
      let g = groups.find(x => x.name === (s.group || ''));
      if (!g) groups.push(g = { name: s.group || '', steps: [] });
      g.steps.push(s);
    }
    return { ...p, steps, groups };
  }).filter(p => p.steps.length);
}

// Postęp kroków przypisanych do slotów planu dnia (Dziś — bez nazw produktów, jak dawki suplementów: D-041)
export function slotProgress(model, done, date) {
  const out = {};
  for (const s of stepsFor(model, date)) {
    if (!s.slot || s.asNeeded) continue;
    const o = (out[s.slot] ||= { done: 0, total: 0 });
    o.total++; if (isDone(done, date, s.id)) o.done++;
  }
  return out;
}

// Opis reguły kroku: „codziennie”, „PN, ŚR”, „doraźnie”, z okresem („do 11.10”, „od 12.10”)
export function ruleText(s) {
  const days = !s.days?.length || s.days.length === 7 ? 'codziennie' : [...s.days].sort((a, b) => a - b).map(d => DAY_SHORT[d - 1]).join(', ');
  const period = [s.from && `od ${shortDate(s.from)}`, s.until && `do ${shortDate(s.until)}`].filter(Boolean).join(' ');
  return [s.asNeeded ? 'doraźnie' : days, period].filter(Boolean).join(' · ');
}

// Produkt: w których krokach i kiedy jest używany
export function productUse(model, pid) {
  return model.steps.filter(s => s.product === pid).map(s => ({ step: s, pora: PORY[PORA_IDX[s.pora]].label, rule: ruleText(s) }));
}

// Tydzień od poniedziałku: postęp każdego dnia i kroki, które nie są codzienne (rotacje, szampony, raz w tygodniu)
export function weekGrid(model, done, monday) {
  return [...Array(7)].map((_, i) => {
    const date = addDays(monday, i), list = stepsFor(model, date);
    return { date, ...progress(list, done, date), special: list.filter(s => !s.asNeeded && s.days?.length && s.days.length < 7) };
  });
}

// Zmiany w planie w najbliższych dniach (koniec lub początek kroku z okresem) — do „Wymaga uwagi”
export function upcomingChanges(model, today, horizon = 14) {
  const end = addDays(today, horizon), out = [];
  for (const s of model.steps) {
    if (s.until && s.until >= today && s.until < end) out.push({ date: addDays(s.until, 1), step: s, kind: 'koniec' });
    if (s.from && s.from > today && s.from <= end) out.push({ date: s.from, step: s, kind: 'start' });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Plik importu planu (format `2027-care`) — tworzony poza repozytorium z dokumentu użytkownika
export const isCarePlan = o => !!o && o.format === '2027-care' && Array.isArray(o.steps) && Array.isArray(o.products);
export function careDefsFromPlan(o) {
  const defs = [];
  for (const p of o.products) { const { id, ...data } = p; defs.push({ id, kind: 'product', data }); }
  for (const s of o.steps) { const { id, ...data } = s; defs.push({ id, kind: 'step', data }); }
  return defs;
}
