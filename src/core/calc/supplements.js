// Plan suplementacji: pogrupowany po godzinach, z obsługą dni tygodnia i okresu ważności (D-001, D-015, D-016).
import { SRC, catalogById } from '../data.js';
import { dosesFor, inValidity, doseTime } from '../resolver.js';
import { weekday } from '../dates.js';

export function scheduleFor(date) {
  const doses = dosesFor(date);
  const byTime = new Map();
  for (const d of doses) {
    if (!byTime.has(d.time)) byTime.set(d.time, { time: d.time, situation: d.situation_src, doses: [] });
    byTime.get(d.time).doses.push({ ...d, name: SRC.supplements.supplements[d.supp]?.name || d.supp,
      form: SRC.supplements.supplements[d.supp]?.form || '' });
  }
  return [...byTime.values()].sort((a, b) => (a.time < b.time ? -1 : 1));
}

// Wszystkie preparaty z planem tygodnia i statusem czasowym.
export function supplementOverview(date) {
  const wd = weekday(date);
  const map = new Map();
  for (const d of SRC.supplements.doses) {
    const s = map.get(d.supp) || { id: d.supp, name: SRC.supplements.supplements[d.supp]?.name || d.supp,
      form: SRC.supplements.supplements[d.supp]?.form || '', doses: [], weekdays: new Set(), daily: 0,
      unit: catalogById[d.supp]?.unit || '', tracked: catalogById[d.supp]?.tracked !== false };
    s.doses.push(d);
    d.weekdays.forEach(w => s.weekdays.add(w));
    if (d.weekdays.includes(wd) && inValidity(d, date)) s.daily += d.qty;
    map.set(d.supp, s);
  }
  return [...map.values()].map(({ doses, ...s }) => {
    // Okres preparatu — tylko gdy każda dawka ma okres (D-015); dawki z inną godziną w części okresu (D-097: czwartki od 07.01)
    // nie czynią preparatu czasowym. Godziny: dawki obowiązujące w dniu `date` (bez powtórzeń), a gdy brak — wszystkie.
    const validity = doses.every(d => d.validity) ? { ...doses[doses.length - 1].validity,
      from: doses.map(d => d.validity.from).filter(Boolean).sort()[0], until: doses.map(d => d.validity.until).sort().at(-1) } : null;
    const now = doses.filter(d => inValidity(d, date));
    const times = [...new Set((now.length ? now : doses).map(d => doseTime(d.time, date)))];   // D-099: 20:50 w dni z blokiem J
    return { ...s, times, validity, weekdays: [...s.weekdays].sort(), everyDay: s.weekdays.size === 7, active: inValidity({ validity }, date) };
  });
}
