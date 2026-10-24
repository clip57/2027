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

test('treść: dawki, 11 bloków CFA (A–I, M, J), recall, trening 18:15–19:15, zakupy w czwartek (D-097, D-099, D-101, D-103); godziny lokalne także po zmianie czasu 25.10.2026', () => {
  const mon = unfold(planEvents('2026-10-19', ALL, NOW).join('\r\n'));   // poniedziałek F0 w planie CFA V44 (bloki M 19:40–20:33 i J 21:00–21:53)
  assert.equal((mon.match(/SUMMARY:CFA blok/g) || []).length, 11);
  assert.match(mon, /SUMMARY:CFA blok M: /);
  assert.match(mon, /SUMMARY:CFA blok J: /);
  assert.match(unfold(planEvents('2026-10-23', ALL, NOW).join('\r\n')), /SUMMARY:CFA blok I: /, 'piątek 23.10 (bez J i M): A–I, K, L');
  assert.equal((unfold(planEvents('2026-10-23', ALL, NOW).join('\r\n')).match(/SUMMARY:CFA blok/g) || []).length, 11);
  for (const d of ['2026-10-16', '2026-10-17']) assert.deepEqual(planEvents(d, ALL, NOW), [], `${d} — poza planem (D-103c): bez wydarzeń (bloki CFA tylko w module CFA)`);
  assert.equal((unfold(planEvents('2026-10-18', ALL, NOW).join('\r\n')).match(/SUMMARY:CFA blok/g) || []).length, 11, '18.10 — A–I, M, J');
  assert.match(mon, /SUMMARY:CFA Active Recall/);
  assert.match(mon, /SUMMARY:Trening siłowy: UPPER 1/);
  assert.equal((mon.match(/SUMMARY:Suplementy/g) || []).length, scheduleFor('2026-10-19').length);
  const zl = unfold(planEvents('2026-10-22', ['shop'], NOW).join('\r\n'));   // D-103: czwartek bez sauny — zakupy 17:45–18:40
  assert.match(zl, /DTSTART;TZID=Europe\/Warsaw:20261022T174500/);
  assert.match(zl, /DTEND;TZID=Europe\/Warsaw:20261022T184000/);
  assert.deepEqual(planEvents('2026-12-24', ['shop'], NOW), [], '24.12 — bez zakupów (D-103)');
  assert.deepEqual(planEvents('2026-10-15', ALL, NOW), [], '15.10 — usunięty z kalendarza (D-103b): bez wydarzeń');
  assert.deepEqual(planEvents('2026-11-05', ['shop'], NOW), [], '05.11 — bez zakupów (D-101)');
  assert.match(unfold(planEvents('2026-11-12', ['shop'], NOW).join('\r\n')), /DTEND;TZID=Europe\/Warsaw:20261112T203500/, '12.11 — zakupy jak dotąd (19:05–20:35)');
  assert.match(unfold(planEvents('2027-01-07', ['shop'], NOW).join('\r\n')), /DTSTART;TZID=Europe\/Warsaw:20270107T153000/, 'od 07.01 — 15:30');
  assert.deepEqual(planEvents('2026-10-17', ['shop'], NOW), [], 'sobota — bez zakupów (plan CFA v12)');
  assert.deepEqual(planEvents('2026-10-08', ['shop'], NOW), [], 'dni do 11.10 wykreślone z kalendarza (D-101)');
  for (const d of ['2026-10-24', '2026-10-26']) {
    const e = unfold(planEvents(d, ['supp'], NOW).join('\r\n'));
    assert.match(e, new RegExp(`DTSTART;TZID=Europe/Warsaw:${d.replace(/-/g, '')}T070000`), `${d}: 07:00 czasu lokalnego`);
  }
  assert.deepEqual(planEvents('2026-09-24', ALL, NOW), [], 'poza planem (D-088) — brak wydarzeń');
  assert.equal(planEvents('2026-10-19', ['train'], NOW).join('\n'), planEvents('2026-10-19', ['train'], NOW).join('\n'), 'stały wynik (UID)');
  // D-101: dni do 11.10 — bez wydarzeń; trening zaczyna się 12.10 (UPPER 1 jak w nominalnym poniedziałku); 03–11.11 bez treningu; 12–14.11 nowy trening
  for (const d of ['2026-09-29', '2026-09-30', '2026-10-07', '2026-10-11']) assert.deepEqual(planEvents(d, ALL, NOW), [], d);
  assert.match(unfold(planEvents('2026-10-19', ['train'], NOW).join('\r\n')), /SUMMARY:Trening siłowy: UPPER 1/);
  const t19 = unfold(planEvents('2026-10-19', ['train'], NOW).join('\r\n'));
  assert.match(t19, /DTEND;TZID=Europe\/Warsaw:20261019T191500/, 'trening do 19:15 w dni z blokiem M (D-103)');
  assert.ok(!/SUMMARY:Sauna/.test(t19), 'bez sauny w dni z blokiem M');
  for (const d of ['2026-10-17', '2026-11-01', '2026-11-02']) assert.ok(!/SUMMARY:(Trening|Basen)/.test(unfold(planEvents(d, ['train'], NOW).join('\r\n'))), `${d}: wyjątkowo bez treningu (D-103b)`);
  assert.ok(!/SUMMARY:Trening/.test(unfold(planEvents('2026-10-16', ['train'], NOW).join('\r\n'))), '16.10 — bez treningu (D-103)');
  for (const d of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-23']) assert.ok(!/SUMMARY:Trening/.test(unfold(planEvents(d, ['train'], NOW).join('\r\n'))), `${d}: bez treningu (D-101)`);
  for (const d of ['2026-11-03', '2026-11-05', '2026-11-07', '2026-11-11']) assert.ok(!/SUMMARY:Trening/.test(unfold(planEvents(d, ['train'], NOW).join('\r\n'))), `${d}: bez treningu`);
  assert.match(unfold(planEvents('2026-11-13', ['train'], NOW).join('\r\n')), /SUMMARY:Trening siłowy: UPPER 2/, '13.11 — nominalny piątek');
  assert.match(unfold(planEvents('2026-11-14', ['train'], NOW).join('\r\n')), /SUMMARY:Trening siłowy: LOWER 2/, '14.11 — nominalna sobota');
});

test('B5 (audyt 23.10.2026): „Trening, basen i sauna” — basen w niedzielę, 2 rundy sauny w czwartek, sauna po treningu; bez sauny w dni z blokiem M', () => {
  const tr = d => unfold(planEvents(d, ['train'], NOW).join('\r\n'));
  const sums = d => (tr(d).match(/^SUMMARY:.*$/gm) || []).map(l => l.slice(8));
  assert.deepEqual(sums('2026-10-25'), ['Basen 55 min'], 'niedziela — basen (wariant „basen”)');
  assert.match(tr('2026-10-25'), /DTSTART;TZID=Europe\/Warsaw:20261025T181500/);
  assert.deepEqual(sums('2026-11-12'), ['2 rundy sauny wg protokołu'], 'czwartek — 2 rundy sauny (wariant „czwartek”)');
  assert.match(tr('2026-11-12'), /DTSTART;TZID=Europe\/Warsaw:20261112T175500/);
  assert.deepEqual(sums('2027-01-07'), ['2 rundy sauny wg protokołu'], 'czwartek od 07.01 (wariant „czwartek_st”)');
  assert.deepEqual(sums('2026-11-16'), ['Trening siłowy: UPPER 1', 'Sauna'], 'poniedziałek — trening i sauna po treningu');
  assert.deepEqual(sums('2026-11-17'), ['Trening siłowy: LOWER 1'], 'wtorek — bez sauny');
  assert.deepEqual(sums('2026-10-26'), ['Trening siłowy: UPPER 1'], 'dzień z blokiem M — bez sauny (D-103)');
  for (const d of ['2026-10-22', '2026-12-25', '2026-11-01']) assert.deepEqual(sums(d), [], `${d}: dzień bez treningu`);
});

test('kodowanie tekstu i zawijanie wielobajtowych znaków', () => {
  assert.equal(icsText('a,b;c\\d\ne'), String.raw`a\,b\;c\\d\ne`);
  const long = 'SUMMARY:' + 'ąęść'.repeat(40);
  const f = fold(long);
  assert.equal(f.replace(/\r\n /g, ''), long);
  for (const l of f.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75);
});
