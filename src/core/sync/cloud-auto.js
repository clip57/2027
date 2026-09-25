// Synchronizacja automatyczna (D-084) i automatyczne pobieranie zmian (D-085): harmonogram rund wokół `autoRound` /
// `autoCheck` z cloud-local.js. Bez zależności od DOM — zegar, widoczność, sieć i rodzaj urządzenia są wstrzykiwane
// (testy z fałszywym zegarem). Zasady:
//  • po zapisie zmiany: runda „push” po `debounce` od ostatniej zmiany, najpóźniej `maxWait` od pierwszej (grupowanie);
//  • otwarcie / powrót do aplikacji (najwyżej raz na `resumeGap`), powrót sieci, „Synchronizuj teraz”: runda pełna;
//  • zejście do tła: natychmiastowa wysyłka oczekujących zmian (bez gwarancji — iOS może przerwać);
//  • D-085: lekkie sprawdzenie („check”: czy w chmurze jest nowszy wiersz) co `poll.desktop` / `poll.mobile`, po
//    `poll.idleAfter` bez interakcji co `poll.idle`; przy powrocie do okna (focus) od razu, najwyżej raz na `poll.focusGap`.
//    Sprawdzanie tylko gdy aplikacja jest widoczna, jest sieć i nic nie jest wstrzymane; pełna runda tylko po wykryciu zmiany;
//  • najwyżej jedna runda naraz; wyzwalacze w trakcie rundy łączone w jedną następną (pełna > push > check);
//  • błędy przejściowe (sieć, 5xx, 429, limit czasu): ponowienia z rosnącym odstępem, tylko gdy aplikacja jest na ekranie;
//  • błędy wymagające działania użytkownika (sesja, klucz, RLS, brak tabel, hasło szyfrowania): wstrzymanie do `kick()`.
// Zapis lokalny kończy się przed jakąkolwiek synchronizacją — brak sieci nigdy nie grozi utratą danych.
export const AUTO = {
  debounce: 1500, maxWait: 15000, resumeGap: 60000, bootDelay: 2500, busyRetry: 5000,
  backoff: [15000, 30000, 60000, 120000, 300000, 900000],
  poll: { desktop: 30000, mobile: 60000, idle: 300000, idleAfter: 300000, focusGap: 10000 },
};

// Rodzaj błędu: 'busy' (inna karta synchronizuje), 'transient' (ponów sam), 'blocking' (potrzebny użytkownik)
export function classify(e) {
  const code = e?.code, st = e?.status;
  if (code === 'busy') return 'busy';
  if (code === 'network') return 'transient';
  if (code === 'http') return st >= 500 || st === 429 || st === 408 ? 'transient' : 'blocking';
  return 'blocking';
}

export function createAutoSync({ getStore, run, check = null, timers = globalThis, now = () => Date.now(), isVisible = () => true,
  isOnline = () => true, isMobile = () => false, onApplied = () => {}, onChange = () => {}, cfg = AUTO } = {}) {
  // phase: 'off' | 'idle' | 'waiting' | 'running' | 'retry' | 'paused'
  const st = { phase: 'idle', error: null, lastOk: 0, lastFull: 0, failures: 0 };
  const listeners = new Set();
  let debounceT = null, retryT = null, pollT = null, firstChange = 0, running = null, queued = null;
  let pollOff = !check, lastCheck = 0, lastActivity = now(), pollEvery = 0;
  const interval = () => (now() - lastActivity >= cfg.poll.idleAfter ? cfg.poll.idle : isMobile() ? cfg.poll.mobile : cfg.poll.desktop);
  const snapshot = () => ({ ...st, waiting: !!debounceT || !!retryT, queued, polling: !!pollT, pollEvery, idle: now() - lastActivity >= cfg.poll.idleAfter });
  const emit = () => { const s = snapshot(); onChange(s); for (const f of listeners) f(s); };
  const set = patch => { Object.assign(st, patch); emit(); };
  const rank = m => (m === 'full' ? 2 : m === 'push' ? 1 : 0);
  const clearDebounce = () => { if (debounceT) { timers.clearTimeout(debounceT); debounceT = null; } };
  const clearRetry = () => { if (retryT) { timers.clearTimeout(retryT); retryT = null; } };
  const clearPoll = () => { if (pollT) { timers.clearTimeout(pollT); pollT = null; } };
  const later = (mode, ms) => { clearRetry(); retryT = timers.setTimeout(() => { retryT = null; request(mode); }, ms); };
  // Sprawdzanie dozwolone: włączone, widoczna aplikacja, sieć, nic nie wstrzymane / nie ponawiane, brak trwającej rundy
  const canPoll = () => !pollOff && (st.phase === 'idle' || st.phase === 'waiting') && isVisible() && isOnline();

  // Interwał widoczny w interfejsie („sprawdzanie zmian co 30 s”) — powiadomienie tylko przy zmianie
  const setEvery = ms => { if (pollEvery !== ms) { pollEvery = ms; emit(); } };
  function schedulePoll() {
    clearPoll();
    if (running) return;
    if (!canPoll()) { setEvery(0); return; }
    const every = interval();
    const due = Math.max(0, lastCheck + every - now());
    pollT = timers.setTimeout(() => { pollT = null; if (canPoll() && !running) request('check'); else schedulePoll(); }, due);
    setEvery(every);
  }

  function request(mode) {
    if (mode !== 'check') clearDebounce();  // runda (push/full) wysyła także zmiany czekające na odliczenie
    if (mode === 'full') clearRetry();
    if (running) { queued = !queued || rank(mode) > rank(queued) ? mode : queued; return running; }
    return start(mode);
  }

  function start(mode) {
    if (mode === 'check') clearPoll(); else { clearRetry(); set({ phase: 'running' }); }   // sprawdzenie bez „w toku” (co 30 s)
    running = (async () => {
      let r = null;
      try {
        r = mode === 'check' ? await check(getStore()) : await run(getStore(), mode);
        if (mode === 'check' && r?.off) { pollOff = true; setEvery(0); return r; }   // pobieranie wyłączone: bez sprawdzeń
        if (r?.off) { set({ phase: 'off', error: null, failures: 0 }); queued = null; return r; }
        if (mode !== 'push') lastCheck = now();
        set({ phase: 'idle', error: null, failures: 0, lastOk: now(), ...((mode === 'full' || r?.changed) && { lastFull: now() }) });
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
        if (queued === 'check' && mode !== 'push') queued = null;   // runda pełna / sprawdzenie właśnie się odbyło
        if (queued) { const m = queued; queued = null; request(m); } else schedulePoll();
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
      schedulePoll();
      return null;
    },
    // Widoczność strony: w tle bez sprawdzeń (i wysyłka oczekujących zmian), po powrocie — resume + sprawdzanie
    visibility(visible) {
      if (visible) return this.resume();
      clearPoll(); setEvery(0);
      return this.flush();
    },
    // Powrót do okna (np. MacBook: okno było widoczne, praca na innym urządzeniu) — sprawdzenie od razu, ≤ 1 na focusGap
    focus() {
      lastActivity = now();
      if (running || debounceT || retryT || !canPoll()) return null;
      if (now() - lastCheck < cfg.poll.focusGap) { schedulePoll(); return null; }
      return request('check');
    },
    // Interakcja użytkownika (klawiatura, mysz, dotyk, przewijanie): koniec bezczynności = z powrotem krótszy interwał
    activity() {
      const wasIdle = now() - lastActivity >= cfg.poll.idleAfter;
      lastActivity = now();
      if (wasIdle && !running) schedulePoll();
    },
    // Start aplikacji: pełna runda po chwili (nie spowalnia pierwszego widoku)
    boot() { later('full', cfg.bootDelay); },
    // Powrót sieci: ponowienie od razu, licznik błędów od zera; utrata sieci: bez sprawdzeń
    online() { if (st.phase === 'paused' || st.phase === 'off') return null; st.failures = 0; return request('full'); },
    offline() { clearPoll(); setEvery(0); },
    // Zejście do tła: wyślij oczekujące zmiany od razu
    flush() { if (debounceT) return request('push'); return null; },
    // Zmiana ustawień przez użytkownika (logowanie, hasło, przełączniki, „Synchronizuj teraz”): wznowienie po wstrzymaniu
    kick(mode = 'full') { clearRetry(); pollOff = !check; set({ phase: st.phase === 'running' ? 'running' : 'idle', error: null, failures: 0 }); return request(mode); },
    // Ręczna runda przejmuje oczekujące zmiany; wynik ręcznej rundy aktualizuje stan automatu
    cancelPending() { clearDebounce(); clearRetry(); if (st.phase === 'waiting' || st.phase === 'retry') set({ phase: 'idle' }); },
    settled(ok, error = null) {
      if (ok) { lastCheck = now(); set({ phase: 'idle', error: null, failures: 0, lastOk: now(), lastFull: now() }); schedulePoll(); }
      else set({ error });
    },
    idle: () => running || Promise.resolve(),
    state: snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    dispose() { clearDebounce(); clearRetry(); clearPoll(); listeners.clear(); },
  };
}
