// Szyfrowanie synchronizacji w chmurze (D-078, Etap 1) — WebCrypto w Node, dane fikcyjne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveKeys, cloudId, seal, open, makeVerifier, checkVerifier, newKeyInfo, b64, unb64, randomBytes,
  KDF_ITERATIONS, MIN_ITERATIONS, FORMAT } from '../../src/core/sync/crypto.js';

const PASS = 'testowe hasło szyfrowania 2027';   // fikcyjne
const salt = b64(new Uint8Array(16).fill(7));
const keysP = deriveKeys(PASS, salt, MIN_ITERATIONS);
const ev = { id: 'inv.move:abc123', hlc: '1790000000000:0000:dA', dev: 'dA', t: 'inv.move', d: { prod: 'banan', qty: 120, date: '2026-09-28', kind: 'purchase' }, at: '2026-09-28T10:00:00Z', v: 1 };

test('base64url tam i z powrotem', () => {
  const x = randomBytes(33);
  assert.deepEqual(unb64(b64(x)), x);
  assert.match(b64(x), /^[A-Za-z0-9_-]+$/);
});

test('szyfrowanie i odszyfrowanie zdarzenia; szyfrogram bez treści jawnej', async () => {
  const keys = await keysP, sid = await cloudId(keys, ev.id);
  const blob = await seal(keys, sid, ev);
  assert.ok(blob.startsWith(`${FORMAT}.`));
  for (const s of ['banan', 'inv.move', 'purchase', 'abc123']) assert.ok(!blob.includes(s), s);
  assert.deepEqual(await open(keys, sid, blob), ev);
});

test('identyfikator w chmurze: deterministyczny, nieprzezroczysty, zależny od hasła', async () => {
  const keys = await keysP;
  const a = await cloudId(keys, ev.id), b = await cloudId(keys, ev.id);
  assert.equal(a, b);
  assert.ok(!a.includes('inv') && a.length === 43);
  const other = await deriveKeys('inne testowe hasło 2027', salt, MIN_ITERATIONS);
  assert.notEqual(await cloudId(other, ev.id), a);
});

test('losowy wektor IV: ten sam obiekt daje różne szyfrogramy', async () => {
  const keys = await keysP, sid = await cloudId(keys, ev.id);
  assert.notEqual(await seal(keys, sid, ev), await seal(keys, sid, ev));
});

test('AAD: szyfrogramu nie da się przenieść pod inny identyfikator ani zmienić', async () => {
  const keys = await keysP, sid = await cloudId(keys, ev.id), blob = await seal(keys, sid, ev);
  await assert.rejects(open(keys, await cloudId(keys, 'inny:id'), blob), { code: 'decrypt' });
  const parts = blob.split('.'); const ct = unb64(parts[3]); ct[0] ^= 1;
  await assert.rejects(open(keys, sid, [parts[0], parts[1], parts[2], b64(ct)].join('.')), { code: 'decrypt' });
  await assert.rejects(open(keys, sid, 'xyz'), { code: 'bad-format' });
});

test('inne hasło nie odszyfruje; weryfikator wykrywa błędne hasło', async () => {
  const keys = await keysP, sid = await cloudId(keys, ev.id), blob = await seal(keys, sid, ev);
  const wrong = await deriveKeys('zupełnie inne hasło', salt, MIN_ITERATIONS);
  await assert.rejects(open(wrong, sid, blob), { code: 'decrypt' });
  const v = await makeVerifier(keys);
  assert.equal(await checkVerifier(keys, v), true);
  assert.equal(await checkVerifier(wrong, v), false);
});

test('ograniczenia: krótkie hasło, za mało iteracji, zła sól', async () => {
  await assert.rejects(deriveKeys('krótkie', salt), { code: 'weak-passphrase' });
  await assert.rejects(deriveKeys(PASS, salt, 1000), { code: 'bad-params' });
  await assert.rejects(deriveKeys(PASS, b64(new Uint8Array(4)), MIN_ITERATIONS), { code: 'bad-params' });
  assert.ok(KDF_ITERATIONS >= 600000);
});

test('newKeyInfo: losowa sól 16 B, parametry do zapisu w chmurze bez klucza', async () => {
  const { keys, info } = await newKeyInfo(PASS, MIN_ITERATIONS);
  assert.equal(unb64(info.salt).length, 16);
  assert.deepEqual(Object.keys(info).sort(), ['iterations', 'salt', 'verifier']);
  assert.equal(await checkVerifier(keys, info.verifier), true);
});
