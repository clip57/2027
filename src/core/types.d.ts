// Typy rdzenia dla kontroli `tsc --noEmit` (D-115, T3) — tylko deklaracje, nic nie trafia do buildu.
// EventType musi być równy EVENT_TYPES z storage/validate.js (pilnuje tego tests/unit/types.test.mjs).

/** Typ zdarzenia znany tej wersji aplikacji (§3.1: bez zmian istniejących typów). */
export type EventType =
  | 'inv.count'
  | 'inv.dayshift'
  | 'inv.move'
  | 'cat.upsert'
  | 'cat.delete'
  | 'cfa.done'
  | 'cfa.err.put'
  | 'cfa.err.del'
  | 'mpw.done'
  | 'mpw.err.put'
  | 'mpw.err.del'
  | 'train.set'
  | 'setting'
  | 'train.session'
  | 'train.detail'
  | 'prep.step'
  | 'prep.test'
  | 'private.pack'
  | 'archive'
  | 'care.def'
  | 'care.done';

/** Koperta zdarzenia w dzienniku (validateEnvelope). Typ spoza EventType = zdarzenie z nowszej wersji (D-056). */
export interface StoredEvent {
  id: string;
  hlc: string;
  dev: string;
  t: EventType | (string & {});
  d: Record<string, any>;
  at?: string;
  v?: number;
}

/** Kontekst przekazywany modułom przez app.js (render). Pola pomocnicze — luźno (index signature). */
export interface Ctx {
  store: import('./storage/store.js').Store;
  today: string;
  params: URLSearchParams;
  rerender: (keepY?: boolean) => void;
  flash: (text: string, cls?: string, opts?: { action?: { label: string, run: () => any, aria?: string, icon?: string } }) => any;
  tick?: (fn: () => void) => void;
  [key: string]: any;
}
