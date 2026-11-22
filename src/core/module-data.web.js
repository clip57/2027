// T10: pełne dane widoków w przeglądarce — wczytywane przy pierwszym wejściu do modułu, potem z pamięci karty.
// 2027.html: dane wbudowane w stronę (<script type="application/json" id="data-<id>">, bez sieci); wariant web: plik `data-<id>.<skrót>.json`
// obok aplikacji (lista SHELL service workera — działa offline). Nazwy plików wstawia build (`__DATA_FILES__`). Ten sam interfejs co module-data.js.
/* global __DATA_FILES__ */
/** @type {Record<string, any>} */
const cache = {};
/** @type {Record<string, Promise<any>>} */
const pending = {};
/** @param {string} id @returns {any} */
export const moduleData = id => cache[id] || null;
/** @param {string} id @returns {Promise<any>} */
export function loadModuleData(id) {
  if (cache[id]) return Promise.resolve(cache[id]);
  return (pending[id] ||= (async () => {
    const el = globalThis.document?.getElementById(`data-${id}`);
    const file = typeof __DATA_FILES__ === 'object' ? __DATA_FILES__[id] : null;
    if (!el && !file) return null;
    const data = el ? JSON.parse(el.textContent || 'null') : await (await fetch(file)).json();
    return (cache[id] = data || null);
  })().finally(() => { delete pending[id]; }));
}
