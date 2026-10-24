// Import postępu i error logu z pliku planu CFA (D-031; format `postep-nauki.json` bez zmian w planie D-086).
// Deterministyczne id — import jest idempotentny.
import { CFA_PLAN_VERSION } from '../storage/validate.js';
import { SRC } from '../data.js';
import { ymd, shortDate, longDate } from '../dates.js';

// R2 (audyt 23.10.2026): numery bloków w pliku postępu dotyczą planu, z którego plik zapisano — w innym planie oznaczają inne bloki (wcześniej
// import znakował je bieżącą wersją planu bez sprawdzenia). Rozpoznanie pliku (pola `wersja` / `version`, `zapis`, `wykonane`):
//  • 'current'    — wersja planu w pliku = bieżący plan (`D.version`);
//  • 'previous'   — poprzednia wersja planu (`D.previousVersion`): numery przeliczane na bieżący plan wg `D.progressRequirements` (blok bieżącego
//                   planu jest wykonany, gdy wykonano wszystkie odpowiadające mu bloki poprzedniej wersji; zapas: `previousVersionBlock`);
//  • 'unverified' — plik bez oznaczenia wersji, zapisany po powstaniu bieżącego planu i z numerami z jego zakresu — import z ostrzeżeniem;
//  • 'foreign'    — inna wersja planu, zapis sprzed powstania bieżącego planu, brak daty albo numery spoza planu — import zablokowany.
const labelOf = o => [o?.wersja, o?.version].find(v => typeof v === 'string' && v.trim()) ?? null;
const savedOn = o => (typeof o?.zapis === 'string' && !Number.isNaN(Date.parse(o.zapis)) ? ymd(new Date(o.zapis)) : null);

function previousMap(D) {
  const req = D.progressRequirements || (D.bloki.every(b => Number.isInteger(b.previousVersionBlock)) ? Object.fromEntries(D.bloki.map(b => [b.nr, [b.previousVersionBlock]])) : null);
  return req && Object.keys(req).length ? req : null;
}

export function cfaProgressPlan(o, D = SRC.cfa.D) {
  const label = labelOf(o), saved = savedOn(o), n = D.bloki.length, made = D.finalization?.date || D.stat.start;
  if (label && label === D.version) return { status: 'current', label };
  const req = label && D.previousVersion && label === D.previousVersion ? previousMap(D) : null;
  if (req) return { status: 'previous', label, req };
  const foreign = text => ({ status: 'foreign', label, text });
  if (label) return foreign(`Plik postępu pochodzi z planu „${label}”, a bieżący plan CFA to „${D.version}”. Numery bloków w tych planach oznaczają inne bloki — import zablokowany, żeby nie oznaczyć niewłaściwych bloków.`);
  if (!saved) return foreign('Plik postępu nie ma oznaczenia wersji planu ani daty zapisu — nie można sprawdzić, z którego planu CFA pochodzi. Import zablokowany.');
  if (saved < made) return foreign(`Plik postępu zapisano ${longDate(saved)}, przed powstaniem bieżącego planu CFA (${longDate(made)}) — numery bloków dotyczą starszego planu. Import zablokowany.`);
  const out = o.wykonane.filter(x => Number.isInteger(x) && (x < 1 || x > n));
  if (out.length) return foreign(`Plik postępu zawiera numery bloków spoza bieżącego planu CFA (1–${n}), np. ${out[0]} — pochodzi z innego planu. Import zablokowany.`);
  return { status: 'unverified', label: null, saved };
}

// Numery bloków bieżącego planu z pliku (po przeliczeniu z poprzedniej wersji) — bez powtórzeń, rosnąco
function blocksFrom(o, p, D) {
  const n = D.bloki.length, list = o.wykonane.filter(x => Number.isInteger(x));
  if (p.status === 'previous') {
    const had = new Set(list);
    return D.bloki.map(b => b.nr).filter(nr => (p.req[nr] || []).length > 0 && p.req[nr].every(x => had.has(x)));
  }
  return [...new Set(list.filter(x => x >= 1 && x <= n))].sort((a, b) => a - b);
}

// Opis do podglądu importu: skąd plik i które bloki zostaną oznaczone (dzień i litera pierwszego i ostatniego) — użytkownik sprawdza przed scaleniem
export function cfaProgressNotice(o, D = SRC.cfa.D) {
  const p = cfaProgressPlan(o, D);
  if (p.status === 'foreign') return { level: 'err', text: p.text, blocked: true };
  const nrs = blocksFrom(o, p, D), by = Object.fromEntries(D.bloki.map(b => [b.nr, b]));
  const at = nr => `nr ${nr} (${shortDate(by[nr].data)} ${by[nr].blok})`;
  const which = nrs.length ? `Bloki do oznaczenia: ${nrs.length} — od ${at(nrs[0])} do ${at(nrs[nrs.length - 1])}.` : 'Plik nie zawiera wykonanych bloków bieżącego planu.';
  const head = p.status === 'current' ? `Postęp z bieżącego planu CFA (${D.version}).`
    : p.status === 'previous' ? `Postęp z poprzedniej wersji planu (${p.label}) — przeliczony na bieżący plan (${D.version}) według planu: blok jest wykonany, gdy wykonano odpowiadające mu bloki poprzedniej wersji.`
      : `Plik bez oznaczenia wersji planu (zapisany ${shortDate(p.saved)}). Numery bloków zostaną przypisane do bieżącego planu CFA (${D.version}, ${shortDate(D.stat.start)}–${shortDate(D.stat.end)}) — importuj tylko postęp zapisany z tego planu.`;
  return { level: p.status === 'unverified' ? 'warn' : 'info', text: `${head} ${which}`, status: p.status };
}

export function cfaProgressEvents(o, D = SRC.cfa.D) {
  if (!o || !Array.isArray(o.wykonane)) throw new Error('To nie jest plik postep-nauki.json');
  const p = cfaProgressPlan(o, D);
  if (p.status === 'foreign') throw new Error(p.text);
  const at = typeof o.zapis === 'string' ? o.zapis : new Date(0).toISOString();
  const ms = String(Date.parse(at) || 0).padStart(13, '0');
  return blocksFrom(o, p, D).map((n, i) => ({
    id: `cfa-json:${ms}:${n}`, hlc: `${ms}:${String(i % 10000).padStart(4, '0')}:migr`, dev: 'migr', t: 'cfa.done',
    d: { block: n, done: true, plan: CFA_PLAN_VERSION }, at, v: 1 }));
}

export function parseCsv(text) {
  const s = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ';') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x !== ''));
}

export async function cfaErrorLogEvents(text, sha256) {
  const rows = parseCsv(text);
  const head = rows.shift()?.join(';');
  if (head !== 'egzamin;data;temat_zrodlo;rodzaj_bledu;prawidlowa_regula') throw new Error('To nie jest plik error-log.csv z planu CFA');
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const [egz, data, temat, rodzaj, regula] = rows[i];
    const h = (await sha256(`${i}|${rows[i].join('|')}`)).slice(0, 16);
    out.push({ id: `cfa-csv:${h}`, hlc: `0000000000000:${String(i).padStart(4, '0')}:migr`, dev: 'migr', t: 'cfa.err.put',
      d: { id: `csv_${h}`, data: { egz, data, temat, rodzaj, regula } }, at: new Date(0).toISOString(), v: 1 });
  }
  return out;
}
