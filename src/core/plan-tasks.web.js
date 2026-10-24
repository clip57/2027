// U6: zadania bloków planu MPW w przeglądarce — wczytywane przy pierwszym otwarciu modułu MPW, potem z pamięci karty.
// 2027.html: dane wbudowane w stronę (<script type="application/json" id="plan-mpw">, bez sieci); wariant web: plik `plan-mpw.<skrót>.json`
// obok aplikacji (lista SHELL service workera — działa offline). Nazwy plików wstawia build (`__PLAN_FILES__`). Ten sam interfejs co plan-tasks.js.
/* global __PLAN_FILES__ */
const cache = {}, pending = {};
export const planTasks = id => cache[id] || null;
export function loadPlanTasks(id) {
  if (cache[id]) return Promise.resolve(cache[id]);
  return (pending[id] ||= (async () => {
    const el = globalThis.document?.getElementById(`plan-${id}`);
    const file = typeof __PLAN_FILES__ === 'object' ? __PLAN_FILES__[id] : null;
    if (!el && !file) return null;
    const part = el ? JSON.parse(el.textContent) : await (await fetch(file)).json();
    return (cache[id] = part?.values || null);
  })().finally(() => { delete pending[id]; }));
}
