// Synchronizacja wariant A (D-033): plik 2027-sync.json w iCloud Drive.
// Ten sam plik jest kopią zapasową. Import: walidacja -> podgląd -> kopia -> scalenie (idempotentne).
import { classifyEvent, SCHEMA } from '../storage/validate.js';
import { lwwKey } from '../storage/store.js';
import { migrateZapasyV31, isZapasyV31 } from '../migrate/zapasy-v31.js';
import { isPrivatePack, privatePackEvent } from '../private.js';
import { sha256 } from '../hash.js';
import { cfaProgressEvents } from '../migrate/cfa.js';
export { sha256 };

export const FORMAT = '2027-sync';

const canonical = events => JSON.stringify([...events].sort((a, b) => (a.id < b.id ? -1 : 1)));

export async function exportBundle(store) {
  const events = store.allEvents();
  return { format: FORMAT, schema: SCHEMA, exportedAt: new Date().toISOString(), device: store.device,
    count: events.length, sha256: await sha256(canonical(events)), events };
}

// Rozpoznaje plik: synchronizacja 2027, stara kopia ZAPASY v31 albo pakiet prywatny (D-035).
export async function preview(store, obj) {
  const errors = [];
  let kind, events = [];
  if (obj && obj.format === FORMAT) {
    kind = 'sync';
    if (!Array.isArray(obj.events)) errors.push('Plik nie zawiera listy zdarzeń');
    else {
      if (obj.count !== obj.events.length) errors.push(`Niezgodna liczba zdarzeń (${obj.count} ≠ ${obj.events.length})`);
      if (obj.sha256 !== await sha256(canonical(obj.events))) errors.push('Suma kontrolna się nie zgadza — plik jest uszkodzony lub zmieniony');
      events = obj.events;
    }
  } else if (isZapasyV31(obj)) {
    kind = 'zapasy-v31';
    try { events = migrateZapasyV31(obj); } catch (e) { errors.push(e.message); }
  } else if (isPrivatePack(obj)) {
    kind = 'private';
    try { events = [await privatePackEvent(obj, store)]; } catch (e) { errors.push(e.message); }
  } else if (obj && Array.isArray(obj.wykonane)) {
    kind = 'cfa-progress';
    events = cfaProgressEvents(obj);
  } else {
    return { ok: false, kind: 'unknown', errors: ['Nie rozpoznano pliku. Obsługiwane: kopia 2027 (2027-sync.json), kopia ZAPASY v31, postęp CFA (postep-nauki.json), error log CFA (error-log.csv), pakiet prywatny.'] };
  }
  const pv = previewEvents(store, events, kind, errors);
  // Informacje o pliku (pola istniejące w formacie od początku — bez zmiany formatu)
  if (kind === 'sync') pv.file = { exportedAt: obj.exportedAt || null, device: obj.device || null, schema: obj.schema ?? null };
  return pv;
}

export function previewEvents(store, events, kind, errors = []) {
  const invalid = [], valid = [], future = { count: 0, types: {} };
  for (const e of events) {
    const c = classifyEvent(e);
    if (c === 'ok') valid.push(e);
    else if (c === 'future') { valid.push(e); future.count++; future.types[e.t] = (future.types[e.t] || 0) + 1; } // zachowane, nie blokują importu
    else invalid.push(`${e?.id ?? '?'}: ${c}`);
  }
  if (invalid.length) errors.push(`${invalid.length} uszkodzonych zdarzeń, np. ${invalid[0]}`);
  const fresh = valid.filter(e => !store.events.has(e.id));
  // Konflikt = nowe zdarzenie dotyczy rekordu, który lokalnie ma inną wersję.
  const latest = new Map();
  for (const x of store.allEvents()) { const k = lwwKey(x); if (k && (!latest.has(k) || latest.get(k).hlc < x.hlc)) latest.set(k, x); }
  const conflicts = [];
  for (const e of fresh) {
    const k = lwwKey(e), local = k && latest.get(k);
    if (local) conflicts.push({ key: k, winner: e.hlc > local.hlc ? 'plik' : 'lokalnie', local, incoming: e });
  }
  const byType = fresh.reduce((m, e) => ((m[e.t] = (m[e.t] || 0) + 1), m), {});
  return { ok: errors.length === 0, kind, errors, total: events.length, fresh, known: events.length - fresh.length, conflicts, byType,
    future: { count: fresh.filter(e => classifyEvent(e) === 'future').length, types: future.types } };
}

export async function apply(store, pv) {
  if (!pv.ok) throw new Error('Nie można zastosować importu z błędami');
  const n = await store.appendMany(pv.fresh, `przed importem (${pv.kind})`);
  await store.adapter.setMeta('lastImport', { at: new Date().toISOString(), kind: pv.kind, added: n, file: pv.file || null });
  return n;
}
