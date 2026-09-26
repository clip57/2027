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

test('treść: dawki, 9 bloków CFA, recall, trening, zakupy w sobotę; godziny lokalne także po zmianie czasu 25.10.2026', () => {
  const mon = unfold(planEvents('2026-09-28', ALL, NOW).join('\r\n'));
  assert.equal((mon.match(/SUMMARY:CFA blok/g) || []).length, 9);
  assert.match(mon, /SUMMARY:CFA Active Recall/);
  assert.match(mon, /SUMMARY:Trening siłowy: UPPER 1/);
  assert.equal((mon.match(/SUMMARY:Suplementy/g) || []).length, scheduleFor('2026-09-28').length);
  const sat = unfold(planEvents('2026-10-03', ['shop'], NOW).join('\r\n'));
  assert.match(sat, /DTSTART;TZID=Europe\/Warsaw:20261003T121300/);
  for (const d of ['2026-10-24', '2026-10-26']) {
    const e = unfold(planEvents(d, ['supp'], NOW).join('\r\n'));
    assert.match(e, new RegExp(`DTSTART;TZID=Europe/Warsaw:${d.replace(/-/g, '')}T070000`), `${d}: 07:00 czasu lokalnego`);
  }
  assert.deepEqual(planEvents('2026-09-24', ALL, NOW), [], 'poza planem (D-088) — brak wydarzeń');
  assert.equal(planEvents('2026-09-28', ['train'], NOW).join('\n'), planEvents('2026-09-28', ['train'], NOW).join('\n'), 'stały wynik (UID)');
});

test('kodowanie tekstu i zawijanie wielobajtowych znaków', () => {
  assert.equal(icsText('a,b;c\\d\ne'), String.raw`a\,b\;c\\d\ne`);
  const long = 'SUMMARY:' + 'ąęść'.repeat(40);
  const f = fold(long);
  assert.equal(f.replace(/\r\n /g, ''), long);
  for (const l of f.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75);
});
