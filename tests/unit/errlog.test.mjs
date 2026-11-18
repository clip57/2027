// D-115 (T7): lokalny dziennik błędów — scalanie powtórzeń, limit, przycinanie, tekst dla asystenta, zapis w meta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { entryFrom, pushEntry, errorLogText, ERRLOG_MAX, ERRLOG_KEY, attachErrorLog, recordError, errorLog, clearErrorLog } from '../../src/core/errlog.js';

test('powtórzony błąd = jeden wpis z licznikiem; inny błąd = nowy wpis', () => {
  let l = [];
  l = pushEntry(l, entryFrom('błąd', new Error('A'), { src: 'app.js:1:1', at: 't1' }));
  l = pushEntry(l, entryFrom('błąd', new Error('A'), { src: 'app.js:1:1', at: 't2' }));
  l = pushEntry(l, entryFrom('błąd', new Error('B'), { src: 'app.js:2:1', at: 't3' }));
  assert.equal(l.length, 2);
  assert.equal(l[0].n, 2); assert.equal(l[0].at, 't2');
  assert.equal(l[1].msg, 'B');
});

test('limit wpisów — najstarsze wypadają', () => {
  let l = [];
  for (let i = 0; i < ERRLOG_MAX + 7; i++) l = pushEntry(l, entryFrom('błąd', `e${i}`));
  assert.equal(l.length, ERRLOG_MAX);
  assert.equal(l[0].msg, 'e7');
});

test('przycinanie komunikatu i stosu, obietnica bez Error', () => {
  const e = entryFrom('obietnica', { message: 'x'.repeat(500), stack: Array.from({ length: 20 }, (_, i) => `at f${i}`).join('\n') });
  assert.equal(e.msg.length, 300);
  assert.equal(e.stack.split('\n').length, 5);
  assert.equal(entryFrom('obietnica', undefined).msg, 'nieznany błąd');
});

test('tekst dla asystenta: od najnowszego, z licznikiem', () => {
  const l = [entryFrom('błąd', 'stary', { at: '2026-11-01T10:00:00Z', route: '#/dzis' }), { ...entryFrom('obietnica', 'nowy', { at: '2026-11-02T10:00:00Z' }), n: 3 }];
  const t = errorLogText(l, { version: '1.0', ua: 'test' });
  assert.ok(t.indexOf('nowy') < t.indexOf('stary'));
  assert.match(t, /obietnica × 3/);
});

test('zapis w meta po dołączeniu bazy, czyszczenie', async () => {
  const meta = new Map();
  const ad = { getMeta: async k => meta.get(k), setMeta: async (k, v) => { meta.set(k, v); } };
  meta.set(ERRLOG_KEY, [entryFrom('błąd', 'z poprzedniego startu', { at: 't0' })]);
  recordError('błąd', new Error('przed otwarciem bazy'));
  await attachErrorLog(ad);
  assert.deepEqual(errorLog().map(e => e.msg), ['z poprzedniego startu', 'przed otwarciem bazy']);
  await new Promise(r => setTimeout(r, 350));
  assert.equal(meta.get(ERRLOG_KEY).length, 2);
  await clearErrorLog();
  assert.deepEqual(meta.get(ERRLOG_KEY), []);
  assert.equal(errorLog().length, 0);
});
