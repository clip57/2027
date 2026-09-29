// Magazyn zdarzeń: jedyna droga zapisu danych użytkownika (D-008, D-026).
// Zasady: (1) każdy zapis potwierdzany odczytem; (2) błąd zapisu = wyjątek + trwały stan „błąd zapisu”,
// nigdy ciche przełączenie na pamięć; (3) zdarzenia niepoprawne trafiają do kwarantanny;
// (4) przed operacjami zbiorczymi automatyczna kopia (maks. 5).
import { validateEvent, classifyEvent, isKnownType, SCHEMA } from './validate.js';
import { hlc, observe, randomId } from '../ids.js';

export class StorageError extends Error { constructor(msg, cause) { super(msg); this.name = 'StorageError'; this.cause = cause; } }

// Klucz „ostatni zapis wygrywa” (LWW) dla typów, które opisują stan jednego rekordu.
export function lwwKey(e) {
  switch (e.t) {
    case 'cfa.done': return `cfa.done:${e.d.block}`;
    case 'cfa.err.put': case 'cfa.err.del': return `cfa.err:${e.d.id}`;
    case 'mpw.done': return `mpw.done:${e.d.block}`;
    case 'mpw.err.put': case 'mpw.err.del': return `mpw.err:${e.d.id}`;
    case 'train.set': return `train:${e.d.date}|${e.d.ex}|${e.d.set}`;
    case 'setting': return `setting:${e.d.key}`;
    case 'train.session': return `trainsess:${e.d.date}`;
    case 'prep.step': return `prep:${e.d.date}|${e.d.card}|${e.d.idx}`;
    case 'prep.test': return `preptest:${e.d.id}`;
    case 'private.pack': return 'private.pack';
    case 'cat.upsert': return `cat:${e.d.item.id}`;
    case 'cat.delete': return `cat:${e.d.id}`;
    case 'care.def': return `care.def:${e.d.id}`;
    case 'care.done': return `care.done:${e.d.date}|${e.d.step}`;
    default: return null; // inv.* i archive są addytywne
  }
}

// Stan z dziennika: zdarzenia w kolejności HLC; LWW dla rekordów, sumowanie dla zapasów i archiwum.
// Akumulator (P1, D-092): ten sam kod dla pełnego przeliczenia i dla dołożenia zdarzeń nowszych niż wszystkie dotychczasowe.
// Grupa LWW = przedrostek klucza (część przed „:”) — kolejność wpisów w grupie jest taka sama jak w jednej wspólnej mapie,
// więc wynik jest identyczny z pełnym `reduce()` (test równoważności w tests/unit/reduce-incremental.test.mjs).
const group = k => { const i = k.indexOf(':'); return i < 0 ? k : k.slice(0, i); };
const vals = m => [...(m?.values() || [])];
// Grupy mapowane na obiekt (klucz rekordu → wartość): klucz obiektu odpowiada 1:1 kluczowi LWW, więc przy dołożeniu zdarzeń
// wystarczy kopia poprzedniego obiektu z podmienionymi kluczami (nowy klucz na końcu — jak w mapie LWW).
const OBJ = {
  train: ['train', e => `${e.d.date}|${e.d.ex}|${e.d.set}`, e => e.d],
  setting: ['settings', e => e.d.key, e => e.d.value],
  trainsess: ['trainSessions', e => e.d.date, e => e.d],
  prep: ['prep', e => `${e.d.date}|${e.d.card}|${e.d.idx}`, e => e.d.done],
  preptest: ['prepTests', e => e.d.id, e => e.d],
  'care.done': ['careDone', e => `${e.d.date}|${e.d.step}`, e => e.d.done],
};
const DERIVE = {
  'cfa.done': m => ({ cfaDone: new Set(vals(m).filter(e => e.d.done).map(e => e.d.block)) }),
  'cfa.err': m => ({ cfaErrors: vals(m).filter(e => e.t === 'cfa.err.put').map(e => ({ id: e.d.id, ...e.d.data })) }),
  // Plan MPW (D-095): postęp i error log jak w CFA, osobne typy (numery bloków obu planów się pokrywają)
  'mpw.done': m => ({ mpwDone: new Set(vals(m).filter(e => e.d.done).map(e => e.d.block)) }),
  'mpw.err': m => ({ mpwErrors: vals(m).filter(e => e.t === 'mpw.err.put').map(e => ({ id: e.d.id, ...e.d.data })) }),
  ...Object.fromEntries(Object.entries(OBJ).map(([g, [field, key, val]]) => [g, m => ({ [field]: Object.fromEntries(vals(m).map(e => [key(e), val(e)])) })])),
  'private.pack': m => ({ privatePack: m?.get('private.pack')?.d.pack || null }),
  cat: m => ({ catalogUser: vals(m).filter(e => e.t === 'cat.upsert').map(e => e.d.item) }),
  // Pielęgnacja (D-094): definicje kroków i produktów bez usuniętych, w kolejności pierwszego pojawienia się
  'care.def': m => ({ careDefs: vals(m).filter(e => !e.d.deleted).map(e => ({ ...e.d.data, id: e.d.id, kind: e.d.kind })) }),
};
const INV = { 'inv.count': 'counts', 'inv.move': 'moves' };

export class Reducer {
  constructor() {
    this.counts = {}; this.moves = {}; this.shifts = []; this.archive = []; this.superseded = [];
    this.groups = new Map(); this.unprocessed = { count: 0, types: {} }; this.max = '';
    this.state = null; this.dirty = new Set(); this.dirtyProds = { counts: new Set(), moves: new Set() }; this.touched = new Map();
  }

  // Zdarzenia MUSZĄ przychodzić w kolejności HLC (pełne przeliczenie sortuje; `append` sprawdza).
  add(e) {
    if (e.hlc > this.max) this.max = e.hlc;
    // Zdarzenie z nowszej wersji aplikacji: zachowane w bazie i w eksporcie, ale nie wpływa na stan (jawnie raportowane).
    if (!isKnownType(e.t)) { this.unprocessed.count++; this.unprocessed.types[e.t] = (this.unprocessed.types[e.t] || 0) + 1; this.dirty.add('unprocessed'); return; }
    const inv = INV[e.t];
    if (inv) {
      const row = e.t === 'inv.count' ? { id: e.id, qty: e.d.qty, date: e.d.date, hlc: e.hlc }
        : { id: e.id, qty: e.d.qty, date: e.d.date, kind: e.d.kind, hlc: e.hlc, note: e.d.note };
      (this[inv][e.d.prod] ||= []).push(row); this.dirtyProds[inv].add(e.d.prod); this.dirty.add('inv');
    } else if (e.t === 'inv.dayshift') { this.shifts.push({ id: e.id, date: e.d.date, dir: e.d.dir, hlc: e.hlc }); this.dirty.add('inv'); }
    else if (e.t === 'archive') { this.archive.push(e); this.dirty.add('archive'); }
    else {
      const k = lwwKey(e), g = group(k);
      let m = this.groups.get(g);
      if (!m) this.groups.set(g, m = new Map());
      if (m.has(k)) { this.superseded.push(m.get(k)); this.dirty.add('superseded'); }
      m.set(k, e); this.dirty.add(g);
      if (this.state && OBJ[g]) (this.touched.get(g) || this.touched.set(g, []).get(g)).push(e);
    }
  }

  // Nowy obiekt stanu; przeliczane są tylko zmienione części, pozostałe przechodzą bez zmian z poprzedniego stanu.
  // Tablice i obiekty stanu nie są współdzielone z akumulatorem — wcześniejszy stan nie zmienia się po kolejnym zapisie.
  snapshot() {
    const prev = this.state, full = !prev, d = this.dirty, out = { ...prev };
    if (full || d.has('inv')) {
      const part = (key) => {
        const o = full ? {} : { ...prev.inv[key] };
        for (const p of full ? Object.keys(this[key]) : this.dirtyProds[key]) o[p] = this[key][p].slice();
        return o;
      };
      out.inv = { counts: part('counts'), moves: part('moves'), shifts: this.shifts.slice() };
    }
    for (const [g, fn] of Object.entries(DERIVE)) {
      if (!full && !d.has(g)) continue;
      const t = !full && OBJ[g] && this.touched.get(g);
      if (t) { const [field, key, val] = OBJ[g], o = { ...prev[field] }; for (const e of t) o[key(e)] = val(e); out[field] = o; }
      else Object.assign(out, fn(this.groups.get(g)));
    }
    if (full || d.has('archive')) out.archive = this.archive.slice();
    if (full || d.has('superseded')) out.superseded = this.superseded.slice();
    if (full || d.has('unprocessed')) out.unprocessed = { count: this.unprocessed.count, types: { ...this.unprocessed.types } };
    this.dirty = new Set(); this.dirtyProds = { counts: new Set(), moves: new Set() }; this.touched = new Map();
    return (this.state = full ? order(out) : out);
  }

  // Dołożenie zdarzeń bez pełnego przeliczenia — tylko gdy każde jest nowsze od wszystkich dotychczasowych
  // (zapis lokalny: zegar HLC po `observe` zawsze idzie naprzód). W przeciwnym razie `false` — potrzebne pełne przeliczenie.
  append(list) {
    const sorted = [...list].sort(byHlc);
    if (!this.state || (sorted.length && sorted[0].hlc <= this.max)) return false;
    for (const e of sorted) this.add(e);
    this.snapshot();
    return true;
  }
}

const byHlc = (a, b) => (a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : 0);
// Kolejność pól stanu jak dotąd (czytelność w narzędziach deweloperskich)
const FIELDS = ['inv', 'cfaDone', 'cfaErrors', 'train', 'settings', 'trainSessions', 'prep', 'prepTests', 'privatePack', 'catalogUser', 'archive', 'superseded', 'unprocessed', 'careDefs', 'careDone', 'mpwDone', 'mpwErrors'];
const order = s => Object.fromEntries(FIELDS.map(f => [f, s[f]]));

export function reduceInto(events) {
  const r = new Reducer();
  for (const e of [...events].sort(byHlc)) r.add(e);
  r.snapshot();
  return r;
}

export function reduce(events) { return reduceInto(events).state; }

export class Store {
  constructor(adapter) { this.adapter = adapter; this.events = new Map(); this.listeners = new Set();
    this.health = { ok: false, persisted: false, error: null, quarantined: 0 }; }

  async open() {
    try {
      const { persisted } = await this.adapter.open();
      this.device = await this.adapter.getMeta('device');
      if (!this.device) { this.device = 'd' + randomId(8); await this.adapter.setMeta('device', this.device); }
      const raw = await this.adapter.getAllEvents();
      let q = 0;
      for (const e of raw) {
        const c = classifyEvent(e);
        // 'ok' i 'future' (poprawna koperta, typ z nowszej wersji) zostają w bazie. Do kwarantanny trafiają
        // wyłącznie zdarzenia uszkodzone (ich surowa kopia jest zachowana w magazynie kwarantanny).
        if (c !== 'ok' && c !== 'future') { q++; await this.adapter.addQuarantine({ at: new Date().toISOString(), reason: c, raw: e }); continue; }
        this.events.set(e.id, e); observe(e.hlc);
      }
      if (q) await this.adapter.replaceAllEvents([...this.events.values()]);
      // Odzyskiwanie: zdarzenia, które starsza wersja przeniosła do kwarantanny, a które ta wersja rozpoznaje
      // (albo które mają poprawną kopertę), wracają do bazy. Kopia w kwarantannie pozostaje nienaruszona.
      const restore = [];
      for (const item of await this.adapter.getQuarantine()) {
        const e = item?.raw, c = classifyEvent(e);
        if ((c === 'ok' || c === 'future') && !this.events.has(e.id)) { restore.push(e); this.events.set(e.id, e); observe(e.hlc); }
      }
      if (restore.length) await this.adapter.putEvents(restore);
      this.health = { ok: true, persisted, error: null, quarantined: q, restored: restore.length };
    } catch (err) {
      this.health = { ok: false, persisted: false, error: `Nie można otworzyć bazy danych: ${err.message}`, quarantined: 0 };
      throw new StorageError(this.health.error, err);
    }
    this.rebuild();
    return this;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  // Pełne przeliczenie stanu z całego dziennika (otwarcie, import, synchronizacja, zdarzenia starsze od najnowszego).
  rebuild() { this.reducer = reduceInto(this.events.values()); this.state = this.reducer.state; }
  // `fresh` — zdarzenia właśnie dopisane lokalnie: przyrostowo, gdy wszystkie są najnowsze (P1); inaczej pełne przeliczenie.
  emit(fresh) {
    if (fresh && this.reducer?.append(fresh)) this.state = this.reducer.state;
    else this.rebuild();
    this.listeners.forEach(f => f(this.state));
  }

  makeEvent(t, d, id) {
    return { id: id || `${t}:${randomId(12)}`, hlc: hlc(this.device), dev: this.device, t, d, at: new Date().toISOString(), v: SCHEMA };
  }

  // Zapis pojedynczej zmiany z weryfikacją odczytem.
  async record(t, d) {
    if (!this.health.ok) throw new StorageError(this.health.error || 'Zapis wyłączony: baza nie jest dostępna');
    const e = this.makeEvent(t, d);
    const err = validateEvent(e);
    if (err) throw new StorageError(`Odrzucono niepoprawne dane: ${err}`);
    await this.writeVerified([e]);
    this.events.set(e.id, e);
    this.emit([e]);
    return e;
  }

  // Zapis wielu zmian naraz ([[typ, treść], …]): te same zdarzenia co przy kolejnych `record()`, ale jedna transakcja,
  // jedna weryfikacja i jedno przeliczenie stanu (B8). Wszystkie albo żadne — błąd walidacji dowolnej treści odrzuca całość.
  async recordMany(list) {
    if (!this.health.ok) throw new StorageError(this.health.error || 'Zapis wyłączony: baza nie jest dostępna');
    if (!list.length) return [];
    const evs = list.map(([t, d]) => this.makeEvent(t, d));
    for (const e of evs) { const err = validateEvent(e); if (err) throw new StorageError(`Odrzucono niepoprawne dane: ${err}`); }
    await this.writeVerified(evs);
    for (const e of evs) this.events.set(e.id, e);
    this.emit(evs);
    return evs;
  }

  async writeVerified(list) {
    try {
      await this.adapter.putEvents(list);
      for (const e of list) {
        const back = await this.adapter.getEvent(e.id);
        if (!back || back.hlc !== e.hlc || JSON.stringify(back.d) !== JSON.stringify(e.d)) throw new Error(`Weryfikacja zapisu nie powiodła się (${e.id})`);
      }
      await this.adapter.setMeta('lastWrite', new Date().toISOString());
    } catch (err) {
      this.health = { ...this.health, ok: false, error: `Dane NIE zostały zapisane: ${err.message}. Wyeksportuj kopię i odśwież aplikację.` };
      this.listeners.forEach(f => f(this.state));
      throw new StorageError(this.health.error, err);
    }
  }

  async backup(reason) {
    await this.adapter.addBackup({ at: new Date().toISOString(), reason, events: [...this.events.values()] });
  }

  // Dołączenie wielu zdarzeń (import/synchronizacja) — atomowo, po kopii zapasowej.
  // `backup: false` — bez kopii (synchronizacja z chmurą robi ją najwyżej raz dziennie); domyślnie jak dotąd: z kopią.
  async appendMany(list, reason, { backup = true } = {}) {
    if (!this.health.ok) throw new StorageError(this.health.error || 'Zapis wyłączony');
    for (const e of list) { const c = classifyEvent(e); if (c !== 'ok' && c !== 'future') throw new StorageError(`Odrzucono import: ${c} (${e?.id})`); }
    const fresh = list.filter(e => !this.events.has(e.id));
    if (!fresh.length) return 0;
    if (backup) await this.backup(reason);
    await this.writeVerified(fresh);
    for (const e of fresh) { this.events.set(e.id, e); observe(e.hlc); }
    this.emit();
    return fresh.length;
  }

  allEvents() { return [...this.events.values()]; }
}
