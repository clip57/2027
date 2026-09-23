// Plan suplementacji: pogrupowany po godzinach, z obsługą dni tygodnia i okresu ważności (D-001, D-015, D-016).
import { SRC, catalogById } from '../data.js';
import { dosesFor } from '../resolver.js';
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
      form: SRC.supplements.supplements[d.supp]?.form || '', times: [], weekdays: new Set(), daily: 0,
      unit: catalogById[d.supp]?.unit || '', validity: null, tracked: catalogById[d.supp]?.tracked !== false };
    s.times.push(d.time);
    d.weekdays.forEach(w => s.weekdays.add(w));
    if (d.weekdays.includes(wd) && (!d.validity || date <= d.validity.until)) s.daily += d.qty;
    if (d.validity) s.validity = d.validity;
    map.set(d.supp, s);
  }
  return [...map.values()].map(s => ({ ...s, weekdays: [...s.weekdays].sort(),
    everyDay: s.weekdays.size === 7, active: !s.validity || date <= s.validity.until }));
}
