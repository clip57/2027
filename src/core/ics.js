// Eksport planu do kalendarza (I1, audyt 25.09.2026): plik iCalendar (RFC 5545) z przypomnieniami (VALARM) — dawki
// suplementów, bloki CFA i recall, trening, sobotnie zakupy. Generowany lokalnie z resolvera; bez serwera i bez kont.
// Godziny w strefie Europe/Warsaw (TZID + VTIMEZONE z regułami czasu letniego) — zmiana czasu 25.10.2026 bez przesunięć.
// UID stały dla dnia i punktu planu: ponowny import po zmianie planu aktualizuje wydarzenia zamiast je dublować.
import { resolveDay, cfaSourceLine } from './resolver.js';
import { scheduleFor } from './calc/supplements.js';
import { SRC } from './data.js';
import { addDays } from './dates.js';

export const ICS_KINDS = [['supp', 'Suplementy (pory dawek)'], ['cfa', 'Bloki CFA i recall'], ['train', 'Trening, basen i sauna'], ['shop', 'Zakupy w sobotę']];
const KEY = Object.fromEntries(SRC.dayTemplate.slots.map(s => [s.id, s.key]));
const TZ = ['BEGIN:VTIMEZONE', 'TZID:Europe/Warsaw',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE'];

// Tekst: ukośnik, średnik, przecinek i nowa linia poprzedzone „\” (RFC 5545 §3.3.11)
export const icsText = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// Zawijanie linii do 75 oktetów UTF-8 (kontynuacja = CRLF + spacja), bez dzielenia znaków wielobajtowych
export function fold(line) {
  const enc = new TextEncoder(), out = [];
  let cur = '', size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; size = 0; }
    cur += ch; size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const local = (date, hhmm) => `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
const stamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function event({ uid, date, from, to, summary, desc, alarm, now }) {
  const endDate = to <= from ? addDays(date, 1) : date;   // punkt przechodzący przez północ
  return ['BEGIN:VEVENT', `UID:${uid}@p2027`, `DTSTAMP:${stamp(now)}`,
    `DTSTART;TZID=Europe/Warsaw:${local(date, from)}`, `DTEND;TZID=Europe/Warsaw:${local(endDate, to)}`,
    `SUMMARY:${icsText(summary)}`, desc && `DESCRIPTION:${icsText(desc)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(summary)}`, `TRIGGER:${alarm}`, 'END:VALARM', 'END:VEVENT'].filter(Boolean);
}
const plus = (hhmm, min) => { const t = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) + min; return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

export function planEvents(date, kinds, now = new Date()) {
  const r = resolveDay(date), ev = [];
  if (r.outside) return ev;
  if (kinds.includes('supp')) for (const g of scheduleFor(date)) {
    ev.push(event({ uid: `${date}-supp-${g.time.replace(':', '')}`, date, from: g.time, to: plus(g.time, 5), now, alarm: 'PT0M',
      summary: `Suplementy ${g.time}`, desc: `${g.situation}\n${g.doses.map(d => `${d.name} — ${d.label}${d.note ? ` (${d.note})` : ''}`).join('\n')}` }));
  }
  for (const s of r.slots) {
    if (kinds.includes('cfa') && s.role === 'cfa' && s.cfa?.length)
      ev.push(event({ uid: `${date}-${s.id}`, date, from: s.from, to: s.to, now, alarm: '-PT2M', summary: s.title.startsWith('Mock') ? s.title : `${s.title}: ${s.cfa[0].temat}`,
        desc: s.cfa.map(b => `${b.temat}\n${cfaSourceLine(b)}`).join('\n\n') }));
    if (kinds.includes('cfa') && s.role === 'recall' && s.recall)
      ev.push(event({ uid: `${date}-${s.id}`, date, from: s.from, to: s.to, now, alarm: '-PT5M', summary: 'CFA Active Recall', desc: s.desc }));
    if (kinds.includes('train') && s.role === 'activity' && KEY[s.id] === 'main' && r.dayType !== 'free' && s.title !== 'Wolne')
      ev.push(event({ uid: `${date}-${s.id}`, date, from: s.from, to: s.to, now, alarm: '-PT30M', summary: s.title, desc: [r.sessionLabel, s.desc].filter(Boolean).join('\n') }));
    if (kinds.includes('shop') && s.id === 'slot.1213z')
      ev.push(event({ uid: `${date}-${s.id}`, date, from: s.from, to: s.to, now, alarm: '-PT15M', summary: 'Zakupy', desc: 'Lista „Do kupienia” w module Zapasy.' }));
  }
  return ev.flat();   // lista linii (bez zawijania)
}

export function buildIcs(from, days, kinds, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//2027//Plan dnia//PL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Plan 2027', 'X-WR-TIMEZONE:Europe/Warsaw', ...TZ];
  let n = 0;
  for (let i = 0; i < days; i++) { const ev = planEvents(addDays(from, i), kinds, now); n += ev.filter(l => l === 'BEGIN:VEVENT').length; lines.push(...ev); }
  lines.push('END:VCALENDAR');
  return { text: lines.map(fold).join('\r\n') + '\r\n', count: n };
}
