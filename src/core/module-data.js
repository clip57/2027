// T10: pełne dane widoków (Rekompozycja, Bezpieczeństwo żywności). Ten plik działa w Node (testy, narzędzia) — dane z plików źródłowych.
// Build (tools/build.mjs) podmienia go na module-data.web.js: plik obok aplikacji (wariant web, w pamięci service workera) albo dane
// wbudowane w 2027.html. Wspólny interfejs: `moduleData(id)` — dane albo null, dopóki nie wczytano; `loadModuleData(id)` — wczytanie (Promise).
import rekomp from '../data/rekomp.json' with { type: 'json' };
import guide from '../data/guide.json' with { type: 'json' };
import safety from '../data/safety.json' with { type: 'json' };

/** @type {Record<string, any>} */
const ALL = { rekomp, guide, safety };
/** @param {string} id @returns {any} */
export const moduleData = id => ALL[id] || null;
/** @param {string} id @returns {Promise<any>} */
export const loadModuleData = async id => ALL[id] || null;
