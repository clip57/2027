// Ekran nie gaśnie w trybach skupienia (D-114): Screen Wake Lock — iPhone: aplikacja z ekranu początkowego od iOS 18.4, Safari;
// komputer: Chrome, Safari. Blokada zwalnia się sama po przejściu do innej aplikacji — przy powrocie odnawiana, dopóki tryb trwa.
// Brak obsługi lub odmowa — bez komunikatu (tryb skupienia działa tak samo, ekran gaśnie jak zwykle).
let lock = null, want = false;
export async function keepAwake(on) {
  want = on;
  if (!globalThis.navigator?.wakeLock) return false;
  if (!on) { const l = lock; lock = null; try { await l?.release(); } catch { /* już zwolniona */ } return false; }
  if (lock && !lock.released) return true;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener?.('release', () => { lock = null; });
    if (!want) { const l = lock; lock = null; await l.release(); return false; }   // tryb zakończony w trakcie żądania
    return true;
  } catch { lock = null; return false; }
}
export const awake = () => !!lock && !lock.released;
globalThis.document?.addEventListener('visibilitychange', () => { if (want && document.visibilityState === 'visible') keepAwake(true); });
