// Sygnał końca odliczania (D5, F-T1 — audyt 31.10.2026): krótki dźwięk z Web Audio (bez plików — działa w obu wariantach buildu)
// i wibracja tam, gdzie przeglądarka ją obsługuje. Safari wymaga odblokowania dźwięku gestem użytkownika: `unlockAudio()` wołamy
// w obsłudze dotknięcia, które uruchamia odliczanie (Start minutnika, odhaczenie serii, „Odczekaj”). Wyłączenie — preferencja urządzenia.
import { soundOn } from './prefs.js';

let ac = null;
export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac ||= new AC();
    if (ac.state === 'suspended') ac.resume().catch(() => {});
  } catch { ac = null; }
}

// Trzy krótkie tony 880 Hz (≈ 0,9 s) — głośność umiarkowana, narastanie i wygaszanie bez trzasków.
export function signal({ tones = 3 } = {}) {
  if (!soundOn()) return false;
  try { navigator.vibrate?.([180, 90, 180, 90, 180]); } catch { /* brak wibracji */ }
  if (!ac || ac.state === 'closed') return false;
  try {
    const t0 = ac.currentTime + 0.02;
    for (let i = 0; i < tones; i++) {
      const t = t0 + i * 0.3, osc = ac.createOscillator(), g = ac.createGain();
      osc.type = 'sine'; osc.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(g).connect(ac.destination);
      osc.start(t); osc.stop(t + 0.22);
    }
    return true;
  } catch { return false; }
}

// Minutniki globalne: czas liczony od znacznika końca (poprawny po wygaszeniu ekranu), sygnał także po przejściu do innego widoku.
// Stan w pamięci karty (nie w dzienniku zdarzeń) — po przeładowaniu strony minutniki znikają.
const RUN = new Map();   // key -> { end, sec, label, to }
export function startCountdown(key, sec, label, onEnd) {
  stopCountdown(key);
  unlockAudio();
  const end = Date.now() + sec * 1000;
  const to = setTimeout(() => { const r = RUN.get(key); if (r) r.done = true; signal(); onEnd?.(label); }, sec * 1000);
  RUN.set(key, { end, sec, label, to, done: false });
}
export function stopCountdown(key) { const r = RUN.get(key); if (r) { clearTimeout(r.to); RUN.delete(key); } }
// null = nie działa; { left (s, ≥ 0), done }
export function countdown(key) { const r = RUN.get(key); return r ? { left: Math.max(0, Math.ceil((r.end - Date.now()) / 1000)), done: r.done, sec: r.sec } : null; }
