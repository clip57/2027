// Synchronizacja przez chmurę — rdzeń bez interfejsu (D-078, Etap 1). IndexedDB pozostaje źródłem prawdy;
// chmura przechowuje zaszyfrowane kopie zdarzeń. Scalanie = suma zbiorów po `id` (jak import 2027-sync.json),
// konflikty rozstrzyga niezmieniony `reduce()`. Ręczna synchronizacja plikiem działa niezależnie.
import { classifyEvent } from '../storage/validate.js';
import { cloudId, seal, open, newKeyInfo, deriveKeys, checkVerifier, MIN_ITERATIONS, KDF_ITERATIONS } from './crypto.js';
import { CloudError } from './cloud-api.js';

// Stan synchronizacji per urządzenie — w magazynie `meta` (bez zmiany struktury bazy; nie trafia do 2027-sync.json)
export const META = { cursor: 'cloud.cursor', acked: 'cloud.acked', lastSync: 'cloud.lastSync', lastBackup: 'cloud.lastBackup' };
export const PULL_PAGE = 1000;     // wiersze na stronę pobierania
export const PUSH_BATCH = 250;     // wiersze na jedno wstawienie
// Zapas kursora: numery kolejne nadaje serwer w chwili wstawienia, ale transakcje mogą się zatwierdzić w innej kolejności
// (dwa urządzenia jednocześnie). Każde pobranie czyta ponownie ostatnie OVERLAP numerów — nie pomija „spóźnionych” wierszy.
// Musi być ≥ PUSH_BATCH × liczba urządzeń wysyłających równocześnie (3 × 250).
export const OVERLAP = 1000;

// Klucze dla zalogowanego użytkownika: pierwsze urządzenie tworzy parametry (sól, iteracje, weryfikator),
// kolejne pobierają je i sprawdzają hasło weryfikatorem.
export async function setupKeys(client, passphrase, { iterations = KDF_ITERATIONS } = {}) {
  const user = await client.user();
  if (!user?.id) throw new CloudError('Nie zalogowano do chmury.', 'signed-out');
  let info = await client.getKeyInfo();
  if (!info) {
    const created = await newKeyInfo(passphrase, iterations);
    try { await client.putKeyInfo(user.id, created.info); return { keys: created.keys, created: true }; }
    catch (e) { if (e.code !== 'conflict') throw e; info = await client.getKeyInfo(); }   // inne urządzenie było szybsze
  }
  if (!info || !(info.iterations >= MIN_ITERATIONS)) throw new CloudError('Parametry szyfrowania w chmurze są niepoprawne.', 'bad-params');
  const keys = await deriveKeys(passphrase, info.salt, info.iterations);
  if (!await checkVerifier(keys, info.verifier)) throw new CloudError('Nieprawidłowe hasło szyfrowania.', 'bad-passphrase');
  return { keys, created: false };
}

// Jedna runda: pobierz → zastosuj → wyślij brakujące. Wynik opisuje, co się stało (do raportu w interfejsie).
export async function syncOnce({ store, client, keys, now = () => new Date(), overlap = OVERLAP }) {
  if (!store?.health?.ok) throw new CloudError('Baza lokalna jest niedostępna — synchronizacja wstrzymana.', 'store');
  const user = await client.user();
  if (!user?.id) throw new CloudError('Nie zalogowano do chmury.', 'signed-out');
  const meta = store.adapter;
  const cursor = Number(await meta.getMeta(META.cursor)) || 0;
  const acked = new Set((await meta.getMeta(META.acked)) || []);   // `id` zdarzeń potwierdzonych w chmurze
  const out = { pulled: 0, applied: 0, pushed: 0, rejected: [], cursor, backup: false };

  // ---------- 1. pobieranie (z zapasem kursora); deduplikacja po `id`
  const incoming = new Map();
  let after = Math.max(0, cursor - overlap), maxSeq = cursor;
  for (;;) {
    const rows = await client.pullEvents(after, PULL_PAGE);
    for (const row of rows) {
      after = row.seq; maxSeq = Math.max(maxSeq, row.seq);
      let e;
      try { e = await open(keys, row.sid, row.blob); }
      catch (err) { out.rejected.push({ seq: row.seq, reason: err.code || 'decrypt' }); continue; }
      // identyfikator w chmurze musi wynikać z `id` zdarzenia (ochrona przed podmianą wierszy)
      if (!e || typeof e.id !== 'string' || await cloudId(keys, e.id) !== row.sid) { out.rejected.push({ seq: row.seq, reason: 'id-mismatch' }); continue; }
      const c = classifyEvent(e);   // 'future' = typ z nowszej wersji: przyjmowany i zachowywany (D-056)
      if (c !== 'ok' && c !== 'future') { out.rejected.push({ seq: row.seq, reason: c }); continue; }
      out.pulled++; acked.add(e.id);
      if (!store.events.has(e.id)) incoming.set(e.id, e);
    }
    if (rows.length < PULL_PAGE) break;
  }
  if (incoming.size) {
    // Kopia przed dopisaniem zdarzeń z chmury — najwyżej raz dziennie (pełna kopia przy każdej rundzie byłaby zbędna)
    const day = now().toISOString().slice(0, 10);
    out.backup = (await meta.getMeta(META.lastBackup)) !== day;
    out.applied = await store.appendMany([...incoming.values()], 'przed pobraniem z chmury', { backup: out.backup });
    if (out.backup) await meta.setMeta(META.lastBackup, day);
  }
  // kursor przesuwany dopiero po zapisaniu pobranych zdarzeń (przerwanie = powtórzenie, bez utraty)
  await meta.setMeta(META.cursor, maxSeq);
  await meta.setMeta(META.acked, [...acked]);
  out.cursor = maxSeq;

  // ---------- 2. wysyłka zdarzeń, których chmura jeszcze nie potwierdziła (także zdarzeń nieznanych typów — D-056)
  const pending = store.allEvents().filter(e => !acked.has(e.id));
  for (let i = 0; i < pending.length; i += PUSH_BATCH) {
    const batch = pending.slice(i, i + PUSH_BATCH);
    const rows = await Promise.all(batch.map(async e => { const sid = await cloudId(keys, e.id); return { sid, blob: await seal(keys, sid, e) }; }));
    await client.pushEvents(user.id, rows);
    batch.forEach(e => acked.add(e.id));
    await meta.setMeta(META.acked, [...acked]);   // po każdej partii — przerwana wysyłka wznawia się od miejsca przerwania
    out.pushed += batch.length;
  }
  await meta.setMeta(META.lastSync, now().toISOString());
  return out;
}

// Wyłączenie synchronizacji na tym urządzeniu: czyści wyłącznie stan chmury w `meta` (dane lokalne bez zmian).
export async function forgetCloudState(store) {
  for (const k of Object.values(META)) await store.adapter.setMeta(k, null);
}
