// Bieżący punkt planu dnia i upływ czasu w punkcie (D-110; od D-114 wspólne dla „Dziś”, tarczy dnia i pigułki „na żywo”).
export const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);

// Upływ czasu w punkcie planu: ułamek od–do (także przez północ, np. sen 23:00–07:00) i minuty do końca
export function slotClock(s, hhmm) {
  const f = toMin(s.from); let t = toMin(s.to), c = toMin(hhmm);
  if (t <= f) t += 1440;
  if (c < f) c += 1440;
  return { frac: Math.min(1, Math.max(0, (c - f) / (t - f))), left: Math.max(0, t - c) };
}

// Bieżący slot wyznaczany z zegara (tylko dla dzisiejszego dnia): wygrywa ostatni pasujący
export function currentSlot(slots, hhmm) {
  let cur = null;
  for (const s of slots) if (s.from <= hhmm && (s.to > s.from ? hhmm < s.to : true)) cur = s;
  if (!cur && hhmm < slots[0].from) return { current: null, next: slots[0] };
  const i = cur ? slots.indexOf(cur) : -1;
  return { current: cur, next: slots[i + 1] || null };
}

export const minLabel = m => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`);
export const hhmmNow = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
