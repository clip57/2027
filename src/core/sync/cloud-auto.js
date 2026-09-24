// Synchronizacja automatyczna (D-084): harmonogram rund wokół `autoRound` z cloud-local.js. Bez zależności od DOM —
// zegar, widoczność i stan sieci są wstrzykiwane (testy z fałszywym zegarem). Zasady:
//  • po zapisie zmiany: runda „push” po `debounce` od ostatniej zmiany, najpóźniej `maxWait` od pierwszej (grupowanie);
//  • otwarcie / powrót do aplikacji (najwyżej raz na `resumeGap`), powrót sieci, „Synchronizuj teraz”: runda pełna;
//  • zejście do tła: natychmiastowa wysyłka oczekujących zmian (bez gwarancji — iOS może przerwać);
//  • najwyżej jedna runda naraz; wyzwalacze w trakcie rundy łączone w jedną następną (pełna ma pierwszeństwo);
//  • błędy przejściowe (sieć, 5xx, 429, limit czasu): ponowienia z rosnącym odstępem, tylko gdy aplikacja jest na ekranie;
//  • błędy wymagające działania użytkownika (sesja, klucz, RLS, brak tabel, hasło szyfrowania): wstrzymanie do `kick()`.
// Zapis lokalny kończy się przed jakąkolwiek synchronizacją — brak sieci nigdy nie grozi utratą danych.
export const AUTO = {
  debounce: 1500, maxWait: 15000, resumeGap: 60000, bootDelay: 2500, busyRetry: 5000,
  backoff: [15000, 30000, 60000, 120000, 300000, 900000],
};

// Rodzaj błędu: 'busy' (inna karta synchronizuje), 'transient' (ponów sam), 'blocking' (potrzebny użytkownik)
export function classify(e) {
  const code = e?.code, st = e?.status;
  if (code === 'busy') return 'busy';
  if (code === 'network') return 'transient';
  if (code === 'http') return st >= 500 || st === 429 || st === 408 ? 'transient' : 'blocking';
  return 'blocking';
}

export function createAutoSync({ getStore, run, timers = globalThis, now = () => Date.now(), isVisible = () => true,
  onApplied = () => {}, onChange = () => {}, cfg = AUTO } = {}) {
  // phase: 'off' | 'idle' | 'waiting' | 'running' | 'retry' | 'paused'
  const st = { phase: 'idle', error: null, lastOk: 0, lastFull: 0, failures: 0 };
  const listeners = new Set();
  let debounceT = null, retryT = null, firstChange = 0, running = null, queued = null;
  const snapshot = () => ({ ...st, waiting: !!debounceT || !!retryT, queued });
  const emit = () => { const s = snapshot(); onChange(s); for (const f of listeners) f(s); };
  const set = patch => { Object.assign(st, patch); emit(); };
  const rank = m => (m === 'full' ? 2 : 1);
  const clearDebounce = () => { if (debounceT) { timers.clearTimeout(debounceT); debounceT = null; } };
  const clearRetry = () => { if (retryT) { timers.clearTimeout(retryT); retryT = null; } };
  const later = (mode, ms) => { clearRetry(); retryT = timers.setTimeout(() => { retryT = null; request(mode); }, ms); };

  function request(mode) {
    clearDebounce();                       // runda (każda) wysyła także zmiany czekające na odliczenie
    if (mode === 'full') clearRetry();
    if (running) { queued = !queued || rank(mode) > rank(queued) ? mode : queued; return running; }
    return start(mode);
  }

  function start(mode) {
    clearRetry();
    set({ phase: 'running' });
    running = (async () => {
      let r = null;
      try {
        r = await run(getStore(), mode);
        if (r?.off) { set({ phase: 'off', error: null, failures: 0 }); queued = null; return r; }
        set({ phase: 'idle', error: null, failures: 0, lastOk: now(), ...(mode === 'full' && { lastFull: now() }) });
        if (r?.applied > 0) onApplied(r);
      } catch (e) {
        const kind = classify(e);
        if (kind === 'busy') { set({ phase: 'waiting' }); later(queued && rank(queued) > rank(mode) ? queued : mode, cfg.busyRetry); queued = null; }
        else if (kind === 'transient') {
          const failures = st.failures + 1;
          set({ phase: 'retry', error: e, failures });
          // w tle przeglądarka i tak zatrzymuje zegary (iOS) — ponowienie przy powrocie na ekran (resume)
          if (isVisible()) later(queued && rank(queued) > rank(mode) ? queued : mode, cfg.backoff[Math.min(failures, cfg.backoff.length) - 1]);
          queued = null;
        } else { set({ phase: 'paused', error: e }); queued = null; }
      } finally {
        running = null;
        if (queued) { const m = queued; queued = null; request(m); }
      }
      return r;
    })();
    return running;
  }

  return {
    // Zapis zmiany (rekord, import, dopisanie z chmury): odliczanie z grupowaniem. Runda „push” bez oczekujących zmian
    // kończy się bez zapytania — dopisanie zdarzeń pobranych z chmury nie zapętla synchronizacji.
    changed() {
      if (st.phase === 'off' || st.phase === 'paused') return;
      const t = now();
      if (!debounceT) firstChange = t;
      clearDebounce();
      const wait = Math.max(0, Math.min(cfg.debounce, firstChange + cfg.maxWait - t));
      debounceT = timers.setTimeout(() => { debounceT = null; request('push'); }, wait);
      if (st.phase === 'idle') set({ phase: 'waiting' }); else emit();
    },
    // Otwarcie / powrót do aplikacji: pełna runda, najwyżej raz na `resumeGap` (chyba że czeka ponowienie po błędzie)
    resume(force = false) {
      if (st.phase === 'paused') return null;
      if (st.phase === 'retry' || force || !st.lastFull || now() - st.lastFull >= cfg.resumeGap) return request('full');
      return null;
    },
    // Start aplikacji: pełna runda po chwili (nie spowalnia pierwszego widoku)
    boot() { later('full', cfg.bootDelay); },
    // Powrót sieci: ponowienie od razu, licznik błędów od zera
    online() { if (st.phase === 'paused' || st.phase === 'off') return null; st.failures = 0; return request('full'); },
    // Zejście do tła: wyślij oczekujące zmiany od razu
    flush() { if (debounceT) return request('push'); return null; },
    // Zmiana ustawień przez użytkownika (logowanie, hasło, przełącznik, „Synchronizuj teraz”): wznowienie po wstrzymaniu
    kick(mode = 'full') { clearRetry(); set({ phase: st.phase === 'running' ? 'running' : 'idle', error: null, failures: 0 }); return request(mode); },
    // Ręczna runda przejmuje oczekujące zmiany; wynik ręcznej rundy aktualizuje stan automatu
    cancelPending() { clearDebounce(); clearRetry(); if (st.phase === 'waiting' || st.phase === 'retry') set({ phase: 'idle' }); },
    settled(ok, error = null) { set(ok ? { phase: 'idle', error: null, failures: 0, lastOk: now(), lastFull: now() } : { error }); },
    idle: () => running || Promise.resolve(),
    state: snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    dispose() { clearDebounce(); clearRetry(); listeners.clear(); },
  };
}
