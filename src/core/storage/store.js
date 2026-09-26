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
    case 'train.set': return `train:${e.d.date}|${e.d.ex}|${e.d.set}`;
    case 'setting': return `setting:${e.d.key}`;
    case 'train.session': return `trainsess:${e.d.date}`;
    case 'prep.step': return `prep:${e.d.date}|${e.d.card}|${e.d.idx}`;
    case 'prep.test': return `preptest:${e.d.id}`;
    case 'private.pack': return 'private.pack';
    case 'cat.upsert': return `cat:${e.d.item.id}`;
    case 'cat.delete': return `cat:${e.d.id}`;
    default: return null; // inv.* i archive są addytywne
  }
}

export function reduce(events) {
  const sorted = [...events].sort((a, b) => (a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : 0));
  const st = { inv: { counts: {}, moves: {}, shifts: [] }, lww: new Map(), superseded: [], archive: [] };
  const unprocessed = { count: 0, types: {} };
  for (const e of sorted) {
    // Zdarzenie z nowszej wersji aplikacji: zachowane w bazie i w eksporcie, ale nie wpływa na stan (jawnie raportowane).
    if (!isKnownType(e.t)) { unprocessed.count++; unprocessed.types[e.t] = (unprocessed.types[e.t] || 0) + 1; continue; }
    if (e.t === 'inv.count') (st.inv.counts[e.d.prod] ||= []).push({ id: e.id, qty: e.d.qty, date: e.d.date, hlc: e.hlc });
    else if (e.t === 'inv.move') (st.inv.moves[e.d.prod] ||= []).push({ id: e.id, qty: e.d.qty, date: e.d.date, kind: e.d.kind, hlc: e.hlc, note: e.d.note });
    else if (e.t === 'inv.dayshift') st.inv.shifts.push({ id: e.id, date: e.d.date, dir: e.d.dir, hlc: e.hlc });
    else if (e.t === 'archive') st.archive.push(e);
    else {
      const k = lwwKey(e);
      if (st.lww.has(k)) st.superseded.push(st.lww.get(k));
      st.lww.set(k, e);
    }
  }
  const pick = prefix => [...st.lww.entries()].filter(([k]) => k.startsWith(prefix)).map(([, e]) => e);
  return {
    inv: st.inv,
    cfaDone: new Set(pick('cfa.done:').filter(e => e.d.done).map(e => e.d.block)),
    cfaErrors: pick('cfa.err:').filter(e => e.t === 'cfa.err.put').map(e => ({ id: e.d.id, ...e.d.data })),
    train: Object.fromEntries(pick('train:').map(e => [`${e.d.date}|${e.d.ex}|${e.d.set}`, e.d])),
    settings: Object.fromEntries(pick('setting:').map(e => [e.d.key, e.d.value])),
    trainSessions: Object.fromEntries(pick('trainsess:').map(e => [e.d.date, e.d])),
    prep: Object.fromEntries(pick('prep:').map(e => [`${e.d.date}|${e.d.card}|${e.d.idx}`, e.d.done])),
    prepTests: Object.fromEntries(pick('preptest:').map(e => [e.d.id, e.d])),
    privatePack: st.lww.get('private.pack')?.d.pack || null,
    catalogUser: pick('cat:').filter(e => e.t === 'cat.upsert').map(e => e.d.item),
    archive: st.archive,
    superseded: st.superseded,
    unprocessed,
  };
}

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
    this.state = reduce(this.events.values());
    return this;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.state = reduce(this.events.values()); this.listeners.forEach(f => f(this.state)); }

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
    this.emit();
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
    this.emit();
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
