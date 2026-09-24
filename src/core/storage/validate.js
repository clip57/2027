// Walidacja zdarzeń (schemat 1). Każde zdarzenie z pliku lub bazy przechodzi tę kontrolę;
// zdarzenia niepoprawne trafiają do kwarantanny zamiast psuć stan (D-008).
import { isValidDay } from '../dates.js';

export const SCHEMA = 1;
const isStr = v => typeof v === 'string' && v.length > 0 && v.length < 5000;
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isId = v => isStr(v) && /^[A-Za-z0-9_.:\-|]{1,200}$/.test(v);
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const plain = (v, depth = 0) => depth < 8 && (v === null || ['string', 'number', 'boolean'].includes(typeof v) ||
  (Array.isArray(v) && v.length < 10000 && v.every(x => plain(x, depth + 1))) ||
  (isObj(v) && Object.keys(v).length < 500 && Object.values(v).every(x => plain(x, depth + 1))));

const PAYLOAD = {
  'inv.count': d => isId(d.prod) && isNum(d.qty) && d.qty >= 0 && isValidDay(d.date),
  'inv.dayshift': d => isValidDay(d.date) && (d.dir === 1 || d.dir === -1),
  'inv.move': d => isId(d.prod) && isNum(d.qty) && d.qty !== 0 && isValidDay(d.date) && ['purchase', 'adjust'].includes(d.kind),
  'cat.upsert': d => isObj(d.item) && isId(d.item.id) && d.item.id.startsWith('custom_') && isStr(d.item.name) && isStr(d.item.unit) && plain(d.item),
  'cat.delete': d => isId(d.id) && d.id.startsWith('custom_'),
  'cfa.done': d => Number.isInteger(d.block) && d.block >= 1 && d.block <= 416 && typeof d.done === 'boolean',
  'cfa.err.put': d => isId(d.id) && isObj(d.data) && plain(d.data),
  'cfa.err.del': d => isId(d.id),
  'train.set': d => isValidDay(d.date) && isId(d.ex) && Number.isInteger(d.set) && d.set >= 1 && d.set <= 10 && typeof d.done === 'boolean' &&
    ['kg', 'reps', 'rir'].every(k => d[k] == null || isNum(d[k])) && (d.opt == null || typeof d.opt === 'boolean'),
  'setting': d => isId(d.key) && plain(d.value),
  'train.session': d => isValidDay(d.date) && ['minutes'].every(k => d[k] == null || (isNum(d[k]) && d[k] >= 0 && d[k] < 1440))
    && ['start', 'end'].every(k => d[k] == null || isStr(d[k])) && (d.note == null || typeof d.note === 'string'),
  'prep.step': d => isValidDay(d.date) && isId(d.card) && Number.isInteger(d.idx) && d.idx >= 0 && d.idx < 200 && typeof d.done === 'boolean',
  'prep.test': d => isId(d.id) && isValidDay(d.date) && typeof d.pass === 'boolean' && (d.value == null || isStr(d.value)),
  'private.pack': d => isObj(d.pack) && d.pack.format === '2027-private' && plain(d.pack),
  'archive': d => isId(d.kind) && plain(d.data),
};
export const EVENT_TYPES = Object.keys(PAYLOAD);

// Koperta zdarzenia (wspólna dla wszystkich wersji aplikacji). Poprawna koperta + nieznany typ = zdarzenie
// z nowszej wersji: ZACHOWUJEMY je (nie kasujemy, nie przenosimy do kwarantanny), tylko nie przetwarzamy.
export function validateEnvelope(e) {
  if (!isObj(e)) return 'zdarzenie nie jest obiektem';
  if (!isId(e.id)) return 'brak lub błędne id';
  if (!isStr(e.hlc) || !/^\d{13}:\d{4}:[A-Za-z0-9_-]+$/.test(e.hlc)) return 'błędny znacznik czasu (hlc)';
  if (!isId(e.dev)) return 'brak identyfikatora urządzenia';
  if (typeof e.t !== 'string' || !/^[a-z][a-z0-9.]{0,40}$/.test(e.t)) return 'błędny typ zdarzenia';
  if (!isObj(e.d)) return 'niepoprawna treść zdarzenia';
  return null;
}
// Treść typu z nowszej wersji: wystarczy, że to czysty JSON (bez limitu głębokości typów znanych).
const jsonLike = (v, depth = 0) => depth < 64 && (v === null || ['string', 'number', 'boolean'].includes(typeof v) ||
  (Array.isArray(v) && v.every(x => jsonLike(x, depth + 1))) || (isObj(v) && Object.values(v).every(x => jsonLike(x, depth + 1))));
export const isKnownType = t => Object.prototype.hasOwnProperty.call(PAYLOAD, t);

// 'ok' — znany typ, poprawna treść; 'future' — poprawna koperta, typ z nowszej wersji; inaczej: opis błędu.
export function classifyEvent(e) {
  const env = validateEnvelope(e);
  if (env) return env;
  if (!isKnownType(e.t)) return jsonLike(e.d) ? 'future' : 'niepoprawna treść zdarzenia';
  return PAYLOAD[e.t](e.d) ? 'ok' : `niepoprawna treść zdarzenia ${e.t}`;
}

export function validateEvent(e) {
  if (!isObj(e)) return 'zdarzenie nie jest obiektem';
  if (!isId(e.id)) return 'brak lub błędne id';
  if (!isStr(e.hlc) || !/^\d{13}:\d{4}:[A-Za-z0-9_-]+$/.test(e.hlc)) return 'błędny znacznik czasu (hlc)';
  if (!isId(e.dev)) return 'brak identyfikatora urządzenia';
  if (!PAYLOAD[e.t]) return `nieznany typ zdarzenia: ${String(e.t).slice(0, 40)}`;
  if (!isObj(e.d) || !PAYLOAD[e.t](e.d)) return `niepoprawna treść zdarzenia ${e.t}`;
  return null;
}
