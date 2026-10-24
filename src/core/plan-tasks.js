// U6: zadania bloków planu MPW poza pakietem aplikacji. Ten plik działa w Node (testy) — zadania z pełnego pliku planu. Build (tools/build.mjs)
// podmienia go na plan-tasks.web.js: plik obok aplikacji (wariant web, w pamięci service workera) albo dane wbudowane w 2027.html.
// Wspólny interfejs: `planTasks(id)` — { nr: tekst } albo null, dopóki nie wczytano; `loadPlanTasks(id)` — wczytanie (Promise).
import mpw from '../data/mpw.json' with { type: 'json' };
import { lazyPart } from './plan-split.js';

const ALL = { mpw: lazyPart('mpw', mpw)?.values || null };
export const planTasks = id => ALL[id] || null;
export const loadPlanTasks = async id => ALL[id] || null;
