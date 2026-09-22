// Adapter IndexedDB — magazyn docelowy (D-008). Wszystkie zapisy w transakcjach; wynik
// każdego zapisu jest potwierdzany odczytem w Store.record().
const DB = 'p2027', VERSION = 1;

const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = tx => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('Transakcja przerwana')); });

export class IdbAdapter {
  async open() {
    if (!globalThis.indexedDB) throw new Error('Ta przeglądarka nie udostępnia IndexedDB');
    this.db = await new Promise((res, rej) => {
      const r = indexedDB.open(DB, VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        db.createObjectStore('events', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'k' });
        db.createObjectStore('quarantine', { autoIncrement: true });
        db.createObjectStore('backups', { keyPath: 'at' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('Baza jest zablokowana przez inną kartę aplikacji'));
    });
    this.db.onversionchange = () => this.db.close();
    let persisted = false;
    try { persisted = await navigator.storage?.persisted?.() || await navigator.storage?.persist?.() || false; } catch { /* brak API */ }
    return { persisted };
  }
  store(name, mode = 'readonly') { const tx = this.db.transaction(name, mode); return [tx, tx.objectStore(name)]; }
  async getAllEvents() { const [, s] = this.store('events'); return req(s.getAll()); }
  async getEvent(id) { const [, s] = this.store('events'); return req(s.get(id)); }
  async putEvents(list) { const [tx, s] = this.store('events', 'readwrite'); list.forEach(e => s.put(e)); await done(tx); }
  async replaceAllEvents(list) { const [tx, s] = this.store('events', 'readwrite'); s.clear(); list.forEach(e => s.put(e)); await done(tx); }
  async getMeta(k) { const [, s] = this.store('meta'); return (await req(s.get(k)))?.v; }
  async setMeta(k, v) { const [tx, s] = this.store('meta', 'readwrite'); s.put({ k, v }); await done(tx); }
  async addQuarantine(item) { const [tx, s] = this.store('quarantine', 'readwrite'); s.add(item); await done(tx); }
  async getQuarantine() { const [, s] = this.store('quarantine'); return req(s.getAll()); }
  async addBackup(b) {
    const [tx, s] = this.store('backups', 'readwrite'); s.put(b);
    const keys = await req(s.getAllKeys());
    keys.sort().slice(0, Math.max(0, keys.length - 5)).forEach(k => s.delete(k));
    await done(tx);
  }
  async getBackups() { const [, s] = this.store('backups'); return req(s.getAll()); }
}
