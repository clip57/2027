// Identyfikatory i zegar hybrydowy (HLC) do scalania zmian między urządzeniami (D-033).
// Znacznik HLC jest porównywalny leksykograficznie: 'ms(13):licznik(4):urządzenie'.
let last = { ms: 0, c: 0 };

export function randomId(len = 10) {
  const a = new Uint8Array(len);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
}

export function hlc(device, nowMs = Date.now()) {
  if (nowMs > last.ms) last = { ms: nowMs, c: 0 };
  else last = { ms: last.ms, c: last.c + 1 };
  return `${String(last.ms).padStart(13, '0')}:${String(last.c).padStart(4, '0')}:${device}`;
}

// Po imporcie cudzych zdarzeń zegar nie może się cofnąć.
export function observe(hlcStr) {
  const [ms, c] = hlcStr.split(':');
  const m = Number(ms), cc = Number(c);
  if (m > last.ms || (m === last.ms && cc > last.c)) last = { ms: m, c: cc };
}

export const _resetClockForTests = () => { last = { ms: 0, c: 0 }; };
