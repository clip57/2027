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

test('treść: dawki, 9 bloków CFA, recall, trening, zakupy w czwartek (D-097); godziny lokalne także po zmianie czasu 25.10.2026', () => {
  const mon = unfold(planEvents('2026-10-05', ALL, NOW).join('\r\n'));   // 28.09–04.10 z wyjątkami (D-096)
  assert.equal((mon.match(/SUMMARY:CFA blok/g) || []).length, 9);
  assert.match(mon, /SUMMARY:CFA Active Recall/);
  assert.match(mon, /SUMMARY:Trening siłowy: UPPER 1/);
  assert.equal((mon.match(/SUMMARY:Suplementy/g) || []).length, scheduleFor('2026-10-05').length);
  const thu = unfold(planEvents('2026-10-08', ['shop'], NOW).join('\r\n'));
  assert.match(thu, /DTSTART;TZID=Europe\/Warsaw:20261008T190500/);
  assert.match(unfold(planEvents('2027-01-07', ['shop'], NOW).join('\r\n')), /DTSTART;TZID=Europe\/Warsaw:20270107T153000/, 'od 07.01 — 15:30');
  assert.deepEqual(planEvents('2026-10-10', ['shop'], NOW), [], 'sobota — bez zakupów (plan CFA v12)');
  assert.deepEqual(planEvents('2026-10-01', ['shop'], NOW), [], 'tydzień 28.09–04.10 — bez zakupów');
  for (const d of ['2026-10-24', '2026-10-26']) {
    const e = unfold(planEvents(d, ['supp'], NOW).join('\r\n'));
    assert.match(e, new RegExp(`DTSTART;TZID=Europe/Warsaw:${d.replace(/-/g, '')}T070000`), `${d}: 07:00 czasu lokalnego`);
  }
  assert.deepEqual(planEvents('2026-09-24', ALL, NOW), [], 'poza planem (D-088) — brak wydarzeń');
  assert.equal(planEvents('2026-10-05', ['train'], NOW).join('\n'), planEvents('2026-10-05', ['train'], NOW).join('\n'), 'stały wynik (UID)');
  // D-096: UPPER 1 w środę 30.09; D-097: Dzień zero 29.09 — bez wydarzeń
  assert.deepEqual(planEvents('2026-09-29', ALL, NOW), []);
  assert.match(unfold(planEvents('2026-09-30', ['train'], NOW).join('\r\n')), /SUMMARY:Trening siłowy: UPPER 1/);
});

test('kodowanie tekstu i zawijanie wielobajtowych znaków', () => {
  assert.equal(icsText('a,b;c\\d\ne'), String.raw`a\,b\;c\\d\ne`);
  const long = 'SUMMARY:' + 'ąęść'.repeat(40);
  const f = fold(long);
  assert.equal(f.replace(/\r\n /g, ''), long);
  for (const l of f.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75);
});
