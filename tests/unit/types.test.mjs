// D-115 (T3): typy zdarzeń w src/core/types.d.ts (kontrola tsc) muszą być równe EVENT_TYPES z walidacji.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EVENT_TYPES } from '../../src/core/storage/validate.js';

test('EventType w types.d.ts = EVENT_TYPES (validate.js)', () => {
  const d = fs.readFileSync(new URL('../../src/core/types.d.ts', import.meta.url), 'utf8');
  const block = d.split('export type EventType =')[1].split(';')[0];
  const declared = [...block.matchAll(/'([a-z][a-z0-9.]+)'/g)].map(m => m[1]);
  assert.deepEqual([...declared].sort(), [...EVENT_TYPES].sort());
});
