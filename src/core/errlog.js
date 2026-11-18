// Lokalny dziennik błędów (D-115, T7 audytu 10.11): nieobsłużone wyjątki (`error`) i odrzucone obietnice (`unhandledrejection`)
// trafiają do bufora na urządzeniu — magazyn `meta` w IndexedDB (klucz `errlog`, bez zmiany struktury bazy), widoczne w „Dane” →
// „Dziennik błędów” i kopiowane jako tekst dla asystenta. Bez usług zewnętrznych, bez synchronizacji (to nie są dane użytkownika).
// Ten sam błąd powtórzony kolejno — jeden wpis z licznikiem; najwyżej ERRLOG_MAX wpisów (najstarsze wypadają).
export const ERRLOG_KEY = 'errlog';
export const ERRLOG_MAX = 50;

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** @param {string} kind @param {any} err @param {{ src?: string, route?: string, at?: string }} [extra] */
export function entryFrom(kind, err, { src = '', route = '', at = new Date().toISOString() } = {}) {
  const msg = clip(String(err?.message ?? err ?? 'nieznany błąd'), 300);
  const stack = typeof err?.stack === 'string' ? clip(err.stack.split('\n').slice(0, 5).join('\n'), 800) : '';
  return { at, kind, msg, src, route, stack, n: 1 };
}

/** Dopisanie wpisu: kolejny identyczny błąd (komunikat + miejsce) zwiększa licznik ostatniego wpisu. */
export function pushEntry(list, e, max = ERRLOG_MAX) {
  const last = list[list.length - 1];
  if (last && last.msg === e.msg && last.src === e.src && last.kind === e.kind) return [...list.slice(0, -1), { ...last, at: e.at, n: (last.n || 1) + e.n }];
  return [...list, e].slice(-max);
}

// Komunikaty przeglądarki bez znaczenia dla działania aplikacji
const BENIGN = [/^ResizeObserver loop/, /^Script error\.?$/];

let list = [], adapter = null, timer = null;
const listeners = new Set();
const persist = () => {
  if (!adapter || timer) return;
  timer = setTimeout(() => { timer = null; adapter.setMeta(ERRLOG_KEY, list).catch(() => {}); }, 300);
};

/** @param {string} kind @param {any} err @param {{ src?: string }} [o] */
export function recordError(kind, err, { src = '' } = {}) {
  const e = entryFrom(kind, err, { src, route: globalThis.location?.hash?.split('?')[0] || '' });
  if (BENIGN.some(r => r.test(e.msg))) return;
  list = pushEntry(list, e);
  persist();
  listeners.forEach(f => f(list));
}

/** Nasłuch błędów globalnych — jak najwcześniej przy starcie (przed otwarciem bazy; wpisy czekają w pamięci). */
export function installErrorLog(win = globalThis) {
  win.addEventListener('error', ev => {
    if (ev.target && ev.target !== win) return;   // błąd ładowania zasobu (obraz, czcionka) — nie wyjątek w kodzie
    recordError('błąd', ev.error || ev.message, { src: ev.filename ? `${ev.filename.split('/').pop()}:${ev.lineno}:${ev.colno}` : '' });
  });
  win.addEventListener('unhandledrejection', ev => recordError('obietnica', ev.reason));
}

/** Po otwarciu bazy: wczytanie zapisanego dziennika i dopisanie wpisów z bieżącego startu. */
export async function attachErrorLog(ad) {
  adapter = ad;
  let saved = [];
  try { saved = (await ad.getMeta(ERRLOG_KEY)) || []; } catch { /* baza niedostępna — dziennik tylko w pamięci */ }
  list = [...(Array.isArray(saved) ? saved : []), ...list].slice(-ERRLOG_MAX);
  if (list.length) persist();
}

export const errorLog = () => list.slice();
export const onErrorLog = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export async function clearErrorLog() {
  list = [];
  if (timer) { clearTimeout(timer); timer = null; }
  await adapter?.setMeta(ERRLOG_KEY, []);
  listeners.forEach(f => f(list));
}

/** Tekst do schowka (dla asystenta): wersja, urządzenie (bez danych osobowych) i wpisy od najnowszego. */
export function errorLogText(entries, { version = '', ua = '' } = {}) {
  const lines = [`Dziennik błędów 2027 · wersja ${version || '?'} · ${ua}`, `Wpisów: ${entries.length}`, ''];
  for (const e of entries.slice().reverse()) {
    lines.push(`${e.at} · ${e.kind}${e.n > 1 ? ` × ${e.n}` : ''} · ${e.route || '—'}${e.src ? ` · ${e.src}` : ''}`, `  ${e.msg}`);
    if (e.stack) lines.push(...e.stack.split('\n').slice(1).map(l => `    ${l.trim()}`));
  }
  return lines.join('\n');
}
