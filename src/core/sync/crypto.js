// Szyfrowanie zdarzeń synchronizowanych przez chmurę (D-078, Etap 1). Wyłącznie WebCrypto — bez zależności.
// Hasło szyfrowania → PBKDF2-SHA256 (sól losowa per użytkownik, ≥ 600 000 iteracji) → 256-bitowy klucz główny →
// HKDF-SHA256 → dwa klucze nieeksportowalne: AES-GCM-256 (treść zdarzenia) i HMAC-SHA256 (nieprzezroczysty identyfikator).
// Serwer widzi tylko identyfikator HMAC (deduplikacja bez ujawniania typu ani nazw produktów) i szyfrogram.
const te = new TextEncoder(), td = new TextDecoder();
export const FORMAT = 'p2027.c1';
export const KDF_ITERATIONS = 600000;              // OWASP (PBKDF2-HMAC-SHA256)
export const MIN_ITERATIONS = 310000;              // dolna granica akceptowana od serwera
export const MIN_PASSPHRASE = 12;

export class CryptoError extends Error { constructor(msg, code) { super(msg); this.name = 'CryptoError'; this.code = code; } }

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new CryptoError('Przeglądarka nie udostępnia WebCrypto (wymagane połączenie https).', 'no-webcrypto');
  return s;
};

// base64url bez dopełnienia (bezpieczny w adresach i nagłówkach)
export function b64(bytes) {
  let s = '';
  for (const x of new Uint8Array(bytes)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
export const randomBytes = n => globalThis.crypto.getRandomValues(new Uint8Array(n));

// Klucze z hasła: { enc: AES-GCM, mac: HMAC } — oba nieeksportowalne (skrypt może ich użyć, ale nie może ich odczytać).
export async function deriveKeys(passphrase, salt, iterations = KDF_ITERATIONS) {
  if (typeof passphrase !== 'string' || [...passphrase.normalize('NFC')].length < MIN_PASSPHRASE)
    throw new CryptoError(`Hasło szyfrowania musi mieć co najmniej ${MIN_PASSPHRASE} znaków.`, 'weak-passphrase');
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS)
    throw new CryptoError('Parametry klucza z serwera są niepoprawne (za mało iteracji).', 'bad-params');
  const saltBytes = unb64(salt);
  if (saltBytes.length < 16) throw new CryptoError('Parametry klucza z serwera są niepoprawne (sól).', 'bad-params');
  const base = await subtle().importKey('raw', te.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const master = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations }, base, 256);
  const hk = await subtle().importKey('raw', master, 'HKDF', false, ['deriveKey']);
  const info = label => ({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: te.encode(`${FORMAT} ${label}`) });
  const enc = await subtle().deriveKey(info('enc'), hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const mac = await subtle().deriveKey(info('id'), hk, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
  return { enc, mac };
}

// Nieprzezroczysty identyfikator zdarzenia w chmurze: deterministyczny (ten sam na każdym urządzeniu z tym samym hasłem),
// więc serwer deduplikuje bez znajomości `id` (które zawiera typ zdarzenia i np. nazwę produktu).
export async function cloudId(keys, eventId) {
  return b64(await subtle().sign('HMAC', keys.mac, te.encode(`${FORMAT}|id|${eventId}`)));
}

// Szyfrogram: "p2027.c1.<iv>.<ct>"; dane dodatkowe (AAD) = format + identyfikator w chmurze — szyfrogramu nie da się
// przenieść pod inny identyfikator ani podmienić bez wykrycia.
export async function seal(keys, sid, value) {
  const iv = randomBytes(12);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(`${FORMAT}|${sid}`) }, keys.enc, te.encode(JSON.stringify(value)));
  return `${FORMAT}.${b64(iv)}.${b64(ct)}`;
}

export async function open(keys, sid, blob) {
  const parts = String(blob).split('.');
  if (parts.length !== 4 || `${parts[0]}.${parts[1]}` !== FORMAT) throw new CryptoError('Nieznany format szyfrogramu.', 'bad-format');
  let pt;
  try {
    pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(parts[2]), additionalData: te.encode(`${FORMAT}|${sid}`) }, keys.enc, unb64(parts[3]));
  } catch { throw new CryptoError('Nie można odszyfrować (inne hasło albo uszkodzone dane).', 'decrypt'); }
  return JSON.parse(td.decode(pt));
}

// Weryfikator hasła: szyfrogram stałej wartości. Pozwala wykryć błędne hasło na nowym urządzeniu bez ujawniania klucza.
const VERIFY_SID = 'verify';
export const makeVerifier = keys => seal(keys, VERIFY_SID, { v: FORMAT });
export async function checkVerifier(keys, verifier) {
  try { return (await open(keys, VERIFY_SID, verifier))?.v === FORMAT; } catch { return false; }
}

// Parametry klucza dla nowego konta chmury (pierwsze urządzenie).
export async function newKeyInfo(passphrase, iterations = KDF_ITERATIONS) {
  const salt = b64(randomBytes(16));
  const keys = await deriveKeys(passphrase, salt, iterations);
  return { keys, info: { salt, iterations, verifier: await makeVerifier(keys) } };
}
