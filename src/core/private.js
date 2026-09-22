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
