// Synchronizacja przez chmurę — rdzeń bez interfejsu (D-078, Etap 1). IndexedDB pozostaje źródłem prawdy;
// chmura przechowuje zaszyfrowane kopie zdarzeń. Scalanie = suma zbiorów po `id` (jak import 2027-sync.json),
// konflikty rozstrzyga niezmieniony `reduce()`. Ręczna synchronizacja plikiem działa niezależnie.
import { classifyEvent } from '../storage/validate.js';
import { cloudId, seal, open, newKeyInfo, deriveKeys, checkVerifier, MIN_ITERATIONS, KDF_ITERATIONS } from './crypto.js';
import { CloudError } from './cloud-api.js';

// Stan synchronizacji per urządzenie — w magazynie `meta` (bez zmiany struktury bazy; nie trafia do 2027-sync.json)
// `seen` = numery kolejne z okna zapasu kursora, których treść urządzenie już ma (pobrane, wysłane lub odrzucone).
export const META = { cursor: 'cloud.cursor', acked: 'cloud.acked', lastSync: 'cloud.lastSync', lastBackup: 'cloud.lastBackup', seen: 'cloud.seen' };
export const PULL_PAGE = 1000;     // wiersze na stronę pobierania (także indeksu)
export const PUSH_BATCH = 250;     // wiersze na jedno wstawienie
export const FETCH_CHUNK = 200;    // numery kolejne w jednym zapytaniu o treść (długość adresu)
export const BULK_FRESH = 400;     // powyżej tylu nowych wierszy treść pobierana stronami (mniej zapytań), nie po numerach
// Zapas kursora: numery kolejne nadaje serwer w chwili wstawienia, ale transakcje mogą się zatwierdzić w innej kolejności
// (dwa urządzenia jednocześnie). Każde pobranie sprawdza ponownie ostatnie OVERLAP numerów — nie pomija „spóźnionych” wierszy.
// Musi być ≥ PUSH_BATCH × liczba urządzeń wysyłających równocześnie (3 × 250). Od D-084 okno czytane jest jako lekki
// indeks (same numery), a treść pobierana tylko dla numerów, których urządzenie jeszcze nie widziało.
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

const chunks = (list, n) => { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; };

// Jedna runda. `mode: 'full'` — pobierz → zastosuj → wyślij brakujące; `mode: 'push'` — tylko wyślij brakujące (runda po
// zapisie zmiany, D-084: bez pobierania, zwykle jedno zapytanie). Wynik opisuje, co się stało (do raportu w interfejsie).
export async function syncOnce({ store, client, keys, now = () => new Date(), overlap = OVERLAP, mode = 'full' }) {
  if (!store?.health?.ok) throw new CloudError('Baza lokalna jest niedostępna — synchronizacja wstrzymana.', 'store');
  const user = await client.user();
  if (!user?.id) throw new CloudError('Nie zalogowano do chmury.', 'signed-out');
  const meta = store.adapter;
  const cursor = Number(await meta.getMeta(META.cursor)) || 0;
  const acked = new Set((await meta.getMeta(META.acked)) || []);   // `id` zdarzeń potwierdzonych w chmurze
  const seenBefore = (await meta.getMeta(META.seen)) || [];
  const seen = new Set(seenBefore);
  const out = { mode, pulled: 0, applied: 0, pushed: 0, rejected: [], cursor, backup: false };
  const ackedSize = acked.size;
  let maxSeq = cursor;

  if (mode === 'full') {
    // ---------- 1. pobieranie: lekki indeks od (kursor − zapas), treść tylko dla numerów niewidzianych; deduplikacja po `id`
    const incoming = new Map();
    const take = async rows => {
      for (const row of rows) {
        maxSeq = Math.max(maxSeq, row.seq);
        if (seen.has(row.seq)) continue;
        seen.add(row.seq);
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
    };
    const index = [];
    for (let after = Math.max(0, cursor - overlap); ;) {
      const rows = await client.pullIndex(after, PULL_PAGE);
      for (const r of rows) { index.push(r.seq); after = r.seq; }
      if (rows.length < PULL_PAGE) break;
    }
    const unseen = index.filter(q => !seen.has(q));
    const holes = unseen.filter(q => q <= cursor), fresh = unseen.filter(q => q > cursor);
    for (const part of chunks(holes, FETCH_CHUNK)) await take(await client.pullBySeq(part));
    if (fresh.length > BULK_FRESH) {
      // wiele nowych wierszy (np. pierwsza synchronizacja): stronami — kilka zapytań zamiast wielu
      for (let after = cursor; ;) {
        const rows = await client.pullEvents(after, PULL_PAGE);
        if (rows.length) after = rows[rows.length - 1].seq;
        await take(rows);
        if (rows.length < PULL_PAGE) break;
      }
    } else for (const part of chunks(fresh, FETCH_CHUNK)) await take(await client.pullBySeq(part));
    if (index.length) maxSeq = Math.max(maxSeq, index[index.length - 1]);
    if (incoming.size) {
      // Kopia przed dopisaniem zdarzeń z chmury — najwyżej raz dziennie (pełna kopia przy każdej rundzie byłaby zbędna)
      const day = now().toISOString().slice(0, 10);
      out.backup = (await meta.getMeta(META.lastBackup)) !== day;
      out.applied = await store.appendMany([...incoming.values()], 'przed pobraniem z chmury', { backup: out.backup });
      if (out.backup) await meta.setMeta(META.lastBackup, day);
    }
    // kursor przesuwany dopiero po zapisaniu pobranych zdarzeń (przerwanie = powtórzenie, bez utraty)
    if (maxSeq !== cursor) await meta.setMeta(META.cursor, maxSeq);
    if (acked.size !== ackedSize) await meta.setMeta(META.acked, [...acked]);   // zapis tylko przy zmianie (lista rośnie do ~1,5 MB)
    out.cursor = maxSeq;
  }

  // ---------- 2. wysyłka zdarzeń, których chmura jeszcze nie potwierdziła (także zdarzeń nieznanych typów — D-056)
  const pending = store.allEvents().filter(e => !acked.has(e.id));
  for (const batch of chunks(pending, PUSH_BATCH)) {
    const rows = await Promise.all(batch.map(async e => { const sid = await cloudId(keys, e.id); return { sid, blob: await seal(keys, sid, e) }; }));
    const inserted = await client.pushEvents(user.id, rows);
    // numery własnych wierszy znane od razu — następne pobranie nie ściąga ich treści z powrotem
    if (Array.isArray(inserted)) for (const r of inserted) if (Number.isFinite(r?.seq)) seen.add(r.seq);
    batch.forEach(e => acked.add(e.id));
    await meta.setMeta(META.acked, [...acked]);   // po każdej partii — przerwana wysyłka wznawia się od miejsca przerwania
    out.pushed += batch.length;
  }
  // okno „widzianych” numerów: tylko to, co może jeszcze wrócić w indeksie (zapis tylko przy zmianie)
  let top = maxSeq; for (const q of seen) if (q > top) top = q;   // bez rozwijania zbioru w argumenty (limit argumentów w WebKit)
  const seenNow = [...seen].filter(q => q > top - overlap).sort((x, y) => x - y);
  if (seenNow.length !== seenBefore.length || seenNow.some((q, i) => q !== seenBefore[i])) await meta.setMeta(META.seen, seenNow);
  if (mode === 'full' || out.pushed) await meta.setMeta(META.lastSync, now().toISOString());
  return out;
}

// Liczba zdarzeń czekających na wysłanie (bez połączenia z siecią)
export async function pendingCount(store) {
  const acked = new Set((await store.adapter.getMeta(META.acked)) || []);
  let n = 0; for (const id of store.events.keys()) if (!acked.has(id)) n++;
  return n;
}

// Wyłączenie synchronizacji na tym urządzeniu: czyści wyłącznie stan chmury w `meta` (dane lokalne bez zmian).
export async function forgetCloudState(store) {
  for (const k of Object.values(META)) await store.adapter.setMeta(k, null);
}
