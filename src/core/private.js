// Pakiet prywatny (D-035): treści wrażliwe spoza repozytorium, importowane z pliku.
// Treść jest wyłącznie tekstem (bez HTML) — renderowana przez textContent, więc nie może wstrzyknąć kodu.
import { sha256 } from './hash.js';

export const isPrivatePack = o => !!o && o.format === '2027-private' && Array.isArray(o.sections);

export async function privatePackEvent(o, store) {
  for (const s of o.sections) {
    if (typeof s.id !== 'string' || typeof s.title !== 'string' || !Array.isArray(s.blocks)) throw new Error('Pakiet prywatny: niepoprawna sekcja');
  }
  const h = (await sha256(JSON.stringify(o))).slice(0, 16);
  return { ...store.makeEvent('private.pack', { pack: o }), id: `private:${h}` };
}

// Zgodność zaimportowanego pakietu z bieżącą wersją aplikacji i planu (D-091): wszystkie znaczniki {private:N} z danych
// Rekompozycji i Meal Prep mają swój fragment, sekcje s1 i s21 są obecne, metadane `plan.start` = start planu.
// Tylko odczyt — nic nie zmienia; stary pakiet działa dalej, a Diagnostyka podpowiada aktualizację.
const REQUIRED = ['rek-s1', 'rek-s21', 'mp-why', 'rek-priv'];
export const markersIn = obj => [...new Set([...JSON.stringify(obj).matchAll(/\{private:(\d+)\}/g)].map(m => Number(m[1])))].sort((a, b) => a - b);

export function packStatus(pack, { start, markers }) {
  if (!pack) return { imported: false };
  const by = Object.fromEntries((pack.sections || []).map(s => [s.id, s]));
  const missingSections = REQUIRED.filter(id => !by[id]);
  const missing = Object.fromEntries(Object.entries(markers).map(([id, want]) => {
    const have = new Set((by[id]?.blocks || []).map(b => b.marker));
    return [id, want.filter(m => !have.has(m))];
  }).filter(([, list]) => list.length));
  return { imported: true, created: pack.created || null, planStart: pack.plan?.start || null,
    current: pack.plan?.start === start, missingSections, missing, ok: !missingSections.length && !Object.keys(missing).length };
}
