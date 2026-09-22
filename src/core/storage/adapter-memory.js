// Adapter w pamięci — WYŁĄCZNIE do testów. Aplikacja nigdy nie przełącza się na niego automatycznie.
export class MemoryAdapter {
  constructor() { this.events = new Map(); this.meta = new Map(); this.quarantine = []; this.backups = []; this.fail = {}; }
  async open() { if (this.fail.open) throw new Error('open failed (test)'); return { persisted: false }; }
  async getAllEvents() { if (this.fail.read) throw new Error('read failed (test)'); return [...this.events.values()].map(e => structuredClone(e)); }
  async getEvent(id) { const e = this.events.get(id); return e && !this.fail.verify ? structuredClone(e) : undefined; }
  async putEvents(list) {
    if (this.fail.write) throw new Error('QuotaExceededError (test)');
    for (const e of list) this.events.set(e.id, structuredClone(e));
  }
  async putRaw(list) { for (const e of list) this.events.set(e.id ?? `raw-${this.events.size}`, e); } // do testów uszkodzeń
  async getMeta(k) { return this.meta.get(k); }
  async setMeta(k, v) { if (this.fail.write) throw new Error('write failed (test)'); this.meta.set(k, structuredClone(v)); }
  async addQuarantine(item) { this.quarantine.push(item); }
  async getQuarantine() { return [...this.quarantine]; }
  async addBackup(b) { this.backups.push(structuredClone(b)); this.backups = this.backups.slice(-5); }
  async getBackups() { return [...this.backups]; }
  async replaceAllEvents(list) { if (this.fail.write) throw new Error('write failed (test)'); this.events = new Map(list.map(e => [e.id, structuredClone(e)])); }
}
