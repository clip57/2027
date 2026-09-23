// Migracja kopii ZAPASY v31 (D-027): stany = inwentaryzacja na koniec dnia lastSyncDate; odliczanie od następnego dnia.
// Identyfikatory zdarzeń są deterministyczne — ponowny import tego samego pliku niczego nie dodaje.
import { catalogById, SRC } from '../data.js';
import { isValidDay } from '../dates.js';

export const isZapasyV31 = o => !!o && (o.app === 'Zapasy_Spozywcze' || o.app === 'Spizarnia_Dieta_2027T') && typeof o.stocks === 'object';

export function migrateZapasyV31(o) {
  if (!isValidDay(o.lastSyncDate)) throw new Error('Kopia ZAPASY nie ma poprawnej daty lastSyncDate');
  if (!Array.isArray(o.products)) throw new Error('Kopia ZAPASY nie zawiera listy produktów');
  const date = o.lastSyncDate, tag = `v31:${date}`;
  const ms = String(Date.parse(o.exportDate || date) || 0).padStart(13, '0');
  const ev = [];
  let i = 0;
  const mk = (t, d, id) => ({ id, hlc: `${ms}:${String(i++).padStart(4, '0')}:migr`, dev: 'migr', t, d, at: o.exportDate || date, v: 1 });
  for (const p of o.products) {
    if (!catalogById[p.id]) {
      if (!String(p.id).startsWith('custom_')) throw new Error(`Nieznana pozycja w kopii: ${p.id}`);
      ev.push(mk('cat.upsert', { item: { id: p.id, name: String(p.name), unit: String(p.unit || 'szt.'), category: String(p.category || 'Inne'),
        packSize: Number(p.packSize) || 1, shelfLife: p.shelfLife === 'short' ? 'short' : 'long', daily_v31: Number(p.daily) || 0 } }, `${tag}:cat:${p.id}`));
    }
    const qty = Number(o.stocks[p.id]);
    if (Number.isFinite(qty) && qty >= 0) ev.push(mk('inv.count', { prod: p.id, qty, date, source: 'ZAPASY v31' }, `${tag}:count:${p.id}`));
  }
  for (const s of SRC.seeds.counts) // D-015: stany suplementów czasowych
    ev.push(mk('inv.count', { prod: s.prod, qty: s.qty, date: s.date, source: s.decision }, `seed:${s.decision}:${s.prod}`));
  if (Array.isArray(o.logs) && o.logs.length)
    ev.push(mk('archive', { kind: 'zapasy-v31-logs', data: o.logs.map(l => ({ id: String(l.id), time: String(l.time), desc: String(l.desc) })) }, `${tag}:archive`));
  return ev;
}
