// I1: eksport .ics — format RFC 5545, strefa Europe/Warsaw (zmiana czasu 25.10.2026), alarmy, stałe UID.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, fold, icsText, planEvents } from '../../src/core/ics.js';
import { scheduleFor } from '../../src/core/calc/supplements.js';

const NOW = new Date('2026-09-25T12:00:00Z');
const ALL = ['supp', 'cfa', 'train', 'shop'];
const unfold = t => t.replace(/\r\n /g, '');

test('struktura: VCALENDAR, VTIMEZONE Europe/Warsaw z regułami DST, CRLF, linie ≤ 75 oktetów', () => {
  const { text, count } = buildIcs('2026-09-28', 7, ALL, NOW);
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(text.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(text), 'wyłącznie CRLF');
  for (const l of text.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75, l);
  assert.match(text, /TZID:Europe\/Warsaw/);
  assert.match(text, /RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU/);
  const u = unfold(text);
  assert.equal((u.match(/BEGIN:VEVENT/g) || []).length, count);
  assert.equal((u.match(/BEGIN:VALARM/g) || []).length, count, 'każde wydarzenie z przypomnieniem');
  assert.equal((u.match(/BEGIN:/g) || []).length, (u.match(/END:/g) || []).length);
  assert.equal(new Set(u.match(/^UID:.*$/gm)).size, count, 'UID unikalne');
});

test('treść: dawki, bloki CFA (plan 2027, D-116), trening 18:15–19:15, zakupy w czwartek (D-097, D-099, D-103); godziny lokalne także po zmianie czasu 28.03.2027', () => {
  const mon = unfold(planEvents('2027-03-22', ALL, NOW).join('\r\n'));   // poniedziałek po planie MPW: bloki CFA H, I, dodatkowy (D-120: 21:00–21:53) i J (22:00)
  assert.equal((mon.match(/SUMMARY:CFA (blok|— blok)/g) || []).length, 4);
  assert.match(mon, /SUMMARY:CFA blok H: /);
  assert.match(mon, /SUMMARY:CFA — blok dodatkowy: /);
  assert.match(mon, /DTSTART;TZID=Europe\/Warsaw:20270322T210000/);
  assert.match(mon, /DTSTART;TZID=Europe\/Warsaw:20270322T220000/);
  assert.ok(!/T174000/.test(mon), 'D-120: bez bloku 17:40 w oknie treningowym');
  assert.match(mon, /SUMMARY:CFA blok J: /);
  assert.equal((unfold(planEvents('2026-11-23', ALL, NOW).join('\r\n')).match(/SUMMARY:CFA blok/g) || []).length, 3, '23.11 — Dzień zero, pierwszy dzień planu CFA 2027 (D-121): E, F, G');
  for (const d of ['2026-11-20', '2026-11-21', '2026-11-22', '2026-10-18']) assert.deepEqual(planEvents(d, ALL, NOW), [], `${d} — przed startem planu (D-121): bez wydarzeń`);
  assert.ok(!/SUMMARY:CFA Active Recall/.test(mon), 'plan CFA 2027 bez sesji recall');
  assert.match(mon, /SUMMARY:Trening siłowy: UPPER 1/);
  assert.equal((mon.match(/SUMMARY:Suplementy/g) || []).length, scheduleFor('2027-03-22').length);
  const z = unfold(planEvents('2026-11-23', ALL, NOW).join('\r\n'));
  assert.ok(!/SUMMARY:(Suplementy|Trening|Basen|Sauna)/.test(z), '23.11 — Dzień zero: bez dawek i treningu (D-121)');
  assert.deepEqual(planEvents('2026-12-24', ['shop'], NOW), [], '24.12 — bez zakupów (D-103, D-121)');
  assert.deepEqual(planEvents('2026-12-31', ['shop'], NOW), [], '31.12 — bez zakupów (D-109)');
  assert.match(unfold(planEvents('2026-11-26', ['shop'], NOW).join('\r\n')), /DTEND;TZID=Europe\/Warsaw:20261126T203500/, '26.11 — zakupy 19:05–20:35');
  assert.match(unfold(planEvents('2027-01-07', ['shop'], NOW).join('\r\n')), /DTSTART;TZID=Europe\/Warsaw:20270107T153000/, 'od 07.01 — 15:30');
  assert.deepEqual(planEvents('2026-11-28', ['shop'], NOW), [], 'sobota — bez zakupów (plan CFA v12)');
  for (const d of ['2027-03-27', '2027-03-29']) {   // zmiana czasu 28.03.2027
    const e = unfold(planEvents(d, ['supp'], NOW).join('\r\n'));
    assert.match(e, new RegExp(`DTSTART;TZID=Europe/Warsaw:${d.replace(/-/g, '')}T070000`), `${d}: 07:00 czasu lokalnego`);
  }
  assert.deepEqual(planEvents('2026-09-24', ALL, NOW), [], 'poza planem (D-088) — brak wydarzeń');
  assert.equal(planEvents('2026-11-30', ['train'], NOW).join('\n'), planEvents('2026-11-30', ['train'], NOW).join('\n'), 'stały wynik (UID)');
  const t30 = unfold(planEvents('2026-11-30', ['train'], NOW).join('\r\n'));
  assert.match(t30, /SUMMARY:Trening siłowy: UPPER 1/);
  assert.match(t30, /SUMMARY:Sauna/, '30.11 — sauna po treningu');
  for (const d of ['2026-11-23', '2026-12-12', '2026-12-24']) assert.ok(!/SUMMARY:(Trening|Basen|Sauna|2 rundy)/.test(unfold(planEvents(d, ['train'], NOW).join('\r\n'))), `${d}: bez treningu (D-121)`);
  assert.match(unfold(planEvents('2026-11-24', ['train'], NOW).join('\r\n')), /SUMMARY:Trening siłowy: LOWER 1/, '24.11 — pierwszy trening (D-121)');
});

test('B5 (audyt 23.10.2026): „Trening, basen i sauna” — basen w niedzielę, 2 rundy sauny w czwartek, sauna po treningu (plan CFA 2027 bez bloku M — D-116)', () => {
  const tr = d => unfold(planEvents(d, ['train'], NOW).join('\r\n'));
  const sums = d => (tr(d).match(/^SUMMARY:.*$/gm) || []).map(l => l.slice(8));
  assert.deepEqual(sums('2026-11-29'), ['Basen 55 min'], 'niedziela — basen (wariant „basen”)');
  assert.match(tr('2026-11-29'), /DTSTART;TZID=Europe\/Warsaw:20261129T181500/);
  assert.deepEqual(sums('2026-11-26'), ['2 rundy sauny wg protokołu'], 'czwartek — 2 rundy sauny (wariant „czwartek”)');
  assert.match(tr('2026-11-26'), /DTSTART;TZID=Europe\/Warsaw:20261126T175500/);
  assert.deepEqual(sums('2027-01-07'), ['2 rundy sauny wg protokołu'], 'czwartek od 07.01 (wariant „czwartek_st”)');
  assert.deepEqual(sums('2026-11-30'), ['Trening siłowy: UPPER 1', 'Sauna'], 'poniedziałek — trening i sauna po treningu');
  assert.deepEqual(sums('2026-12-01'), ['Trening siłowy: LOWER 1'], 'wtorek — bez sauny');
  for (const d of ['2026-11-23', '2026-12-12', '2026-12-24', '2026-12-25']) assert.deepEqual(sums(d), [], `${d}: dzień bez treningu`);
});

test('kodowanie tekstu i zawijanie wielobajtowych znaków', () => {
  assert.equal(icsText('a,b;c\\d\ne'), String.raw`a\,b\;c\\d\ne`);
  const long = 'SUMMARY:' + 'ąęść'.repeat(40);
  const f = fold(long);
  assert.equal(f.replace(/\r\n /g, ''), long);
  for (const l of f.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75);
});
