// D-114 (System 4.0 „Instrument”): geometria tarczy dnia, zgodność z bieżącym punktem planu, stan przerwy (pigułka „na żywo”).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angleOf, minOfAngle, spans, spanAt, dayEnd, arcPath, polar, C } from '../../src/ui/dial.js';
import { currentSlot } from '../../src/core/calc/now.js';
import { resolveDay } from '../../src/core/resolver.js';
import { restLeft, restStale } from '../../src/ui/live.js';

test('tarcza: północ na dole, 06:00 po lewej, południe u góry, 18:00 po prawej', () => {
  const at = m => polar(100, angleOf(m)).map(v => Math.round(v));
  assert.deepEqual(at(0), [C, C + 100]);
  assert.deepEqual(at(360), [C - 100, C]);
  assert.deepEqual(at(720), [C, C - 100]);
  assert.deepEqual(at(1080), [C + 100, C]);
});

test('tarcza: kąt ↔ minuta doby (odwracalne dla każdej minuty)', () => {
  for (let m = 0; m < 1440; m++) assert.ok(Math.abs(minOfAngle(angleOf(m)) - m) < 1e-6, `minuta ${m}`);
  assert.ok(Math.abs(minOfAngle(angleOf(1439) + 0.25 * 360 / 1440) - 1439.25) < 1e-6);
});

test('tarcza: łuk ponad 180° ma flagę dużego łuku', () => {
  assert.match(arcPath(124, 90, 300), /A124 124 0 1 1 /);
  assert.match(arcPath(124, 90, 200), /A124 124 0 0 1 /);
});

test('tarcza: punkt przez północ (sen 23:00–07:00) i wybór punktu dla minuty doby', () => {
  const list = spans([{ from: '07:00', to: '12:00' }, { from: '12:00', to: '23:00' }, { from: '23:00', to: '07:00' }]);
  assert.deepEqual(list.map(x => [x.a, x.b]), [[420, 720], [720, 1380], [1380, 1860]]);
  assert.equal(spanAt(list, 360).i, 2, '06:00 — sen');
  assert.equal(spanAt(list, 1410).i, 2, '23:30 — sen');
  assert.equal(spanAt(list, 600).i, 0);
  assert.equal(spanAt(list, 720).i, 1, 'granica — punkt, który się zaczyna');
  assert.equal(dayEnd([{ from: '07:00', to: '12:00' }, { from: '23:00', to: '07:00' }]), '23:00', 'koniec dnia = początek snu');
  assert.equal(dayEnd([{ from: '07:00', to: '12:00' }]), '12:00');
});

test('tarcza: ten sam bieżący punkt co karta „Teraz” (currentSlot) w ciągu dnia planu', () => {
  for (const date of ['2026-11-16', '2026-11-18', '2026-11-21', '2026-12-24', '2027-03-21']) {
    const r = resolveDay(date);
    if (r.outside || !r.slots.length) continue;
    const list = spans(r.slots);
    for (let m = list[0].a; m < 1440; m += 7) {
      const hm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const cur = currentSlot(r.slots, hm).current;
      assert.equal(spanAt(list, m)?.s, cur, `${date} ${hm}`);
    }
  }
});

test('przerwa (pigułka „na żywo”): czas do końca i przerwa zakończona dawno', () => {
  const r = { start: 1_000_000, min: 60, max: 90 };
  assert.equal(restLeft(r, 1_000_000 + 15_000), 45);
  assert.equal(restLeft(r, 1_000_000 + 75_000), -15, 'po czasie — wartość ujemna („+0:15”)');
  assert.equal(restStale(r, 1_000_000 + 389_000), false);
  assert.equal(restStale(r, 1_000_000 + 391_000), true, 'ponad 5 min po górnej granicy');
});
