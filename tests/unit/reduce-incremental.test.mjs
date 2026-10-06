// P1 (D-092): przyrostowe przeliczanie stanu musi dawać wynik IDENTYCZNY z pełnym przeliczeniem i z dotychczasową
// implementacją `reduce()` (kopia wzorcowa poniżej — sprzed P1, bez zmian). Test właściwości na losowych dziennikach:
// wszystkie typy zdarzeń, typy z nowszej wersji, nadpisania LWW, zdarzenia nieuporządkowane i z innych urządzeń.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reduce, reduceInto, lwwKey, Store } from '../../src/core/storage/store.js';
import { isKnownType } from '../../src/core/storage/validate.js';  // używane przez wzorzec
import { MemoryAdapter } from '../../src/core/storage/adapter-memory.js';

// ---- wzorzec: reduce() sprzed P1 (commit 859aace), skopiowany bez zmian
function legacyReduce(events) {
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
    cfaDone: new Set(pick('cfa.done:').filter(e => e.d.done && (e.d.plan ?? 0) >= 13).map(e => e.d.block)),
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

// Pielęgnacja (D-094): wzorzec nowych pól stanu liczony niezależnie (LWW w kolejności HLC, kolejność pierwszego pojawienia się)
const byHlc0 = (a, b) => (a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : 0);
function legacy(events) {
  const out = legacyReduce(events), defs = new Map(), done = {}, mDone = new Map(), mErr = new Map();
  for (const e of [...events].sort(byHlc0)) {
    if (e.t === 'care.def') defs.set(e.d.id, e);
    if (e.t === 'care.done') done[`${e.d.date}|${e.d.step}`] = e.d.done;
    if (e.t === 'mpw.done') mDone.set(e.d.block, e.d.done);                      // plan MPW (D-095)
    if (e.t === 'mpw.err.put' || e.t === 'mpw.err.del') mErr.set(e.d.id, e);
  }
  return { ...out, careDefs: [...defs.values()].filter(e => !e.d.deleted).map(e => ({ ...e.d.data, id: e.d.id, kind: e.d.kind })), careDone: done,
    mpwDone: new Set([...mDone].filter(([, v]) => v).map(([k]) => k)),
    mpwErrors: [...mErr.values()].filter(e => e.t === 'mpw.err.put').map(e => ({ id: e.d.id, ...e.d.data })) };
}

// Deterministyczny generator liczb losowych (powtarzalne przypadki)
const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const DEV = ['dmac', 'dphone', 'dweb'];
function randomEvent(r, i, ms) {
  const pick = a => a[Math.floor(r() * a.length)];
  const day = `2026-10-${String(1 + Math.floor(r() * 9)).padStart(2, '0')}`;
  const kinds = [
    () => ['inv.count', { prod: pick(['jaja', 'mleko', 'ryz']), qty: Math.floor(r() * 30), date: day }],
    () => ['inv.move', { prod: pick(['jaja', 'mleko', 'ryz']), qty: 1 + Math.floor(r() * 5), date: day, kind: pick(['purchase', 'adjust']), note: r() < 0.3 ? 'x' : undefined }],
    () => ['inv.dayshift', { date: day, dir: pick([1, -1]) }],
    () => ['cfa.done', { block: 1 + Math.floor(r() * 12), done: r() < 0.7, ...(r() < 0.85 ? { plan: 13 } : {}) }],   // część zapisów „z v12” — bez znacznika planu (D-098)
    () => ['cfa.err.put', { id: pick(['e1', 'e2', 'e3']), data: { q: 'pytanie', n: Math.floor(r() * 9) } }],
    () => ['cfa.err.del', { id: pick(['e1', 'e2', 'e3']) }],
    () => ['train.set', { date: day, ex: pick(['przysiad', 'wiosla']), set: 1 + Math.floor(r() * 4), done: r() < 0.8, kg: Math.floor(r() * 80), reps: 8, rir: null }],
    () => ['setting', { key: pick(['shopWeekday', 'zapasy.hidden', `cfa.recall:${day}`]), value: Math.floor(r() * 7) }],
    () => ['train.session', { date: day, minutes: Math.floor(r() * 90) }],
    () => ['prep.step', { date: day, card: pick(['a', 'b']), idx: Math.floor(r() * 6), done: r() < 0.6 }],
    () => ['prep.test', { id: pick(['t1', 't2']), date: day, pass: r() < 0.5 }],
    () => ['private.pack', { pack: { format: '2027-private', sections: [], n: i } }],
    () => ['cat.upsert', { item: { id: pick(['custom_a', 'custom_b']), name: 'Pozycja', unit: 'g', n: i } }],
    () => ['cat.delete', { id: pick(['custom_a', 'custom_b']) }],
    () => ['archive', { kind: 'test', data: { i } }],
    () => ['care.def', { id: pick(['s1', 's2', 'p1']), kind: pick(['step', 'product']), data: { text: 'krok', n: i }, deleted: r() < 0.15 ? true : undefined }],
    () => ['care.done', { date: day, step: pick(['s1', 's2']), done: r() < 0.7 }],
    () => ['mpw.done', { block: 1 + Math.floor(r() * 12), done: r() < 0.7 }],
    () => ['mpw.err.put', { id: pick(['e1', 'e2', 'e4']), data: { q: 'pytanie MPW', n: Math.floor(r() * 9) } }],
    () => ['mpw.err.del', { id: pick(['e1', 'e2', 'e4']) }],
    () => ['future.type', { cokolwiek: [1, { a: 2 }] }],
  ];
  const [t, d] = pick(kinds)();
  const dev = pick(DEV);
  return { id: `${t}:${i}`, hlc: `${String(ms).padStart(13, '0')}:${String(Math.floor(r() * 3)).padStart(4, '0')}:${dev}`, dev, t, d, v: 1 };
}
function randomLog(seed, n) {
  const r = rng(seed); let ms = 1790000000000;
  return Array.from({ length: n }, (_, i) => randomEvent(r, i, (ms += Math.floor(r() * 3))));   // także równe znaczniki ms
}
// Porównanie z kolejnością kluczy (JSON) i pełną strukturą (deepStrictEqual, Set)
const canon = s => JSON.stringify(s, (k, v) => (v instanceof Set ? { set: [...v] } : v));
const same = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); assert.equal(canon(a), canon(b), msg); };
const byHlc = (a, b) => (a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : 0);

test('reduce() po P1 = reduce() sprzed P1 (200 losowych dzienników, także nieuporządkowanych)', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const log = randomLog(seed, 20 + (seed % 7) * 40);
    same(reduce(log), legacy(log), `dziennik ${seed}`);
    same(reduce([...log].reverse()), legacy([...log].reverse()), `dziennik ${seed} odwrócony`);
  }
});

test('dokładanie zdarzeń najnowszych = pełne przeliczenie; wcześniejsze stany nie zmieniają się', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const log = randomLog(seed * 7, 60 + seed * 2).sort(byHlc);
    // tylko ściśle rosnące HLC mogą iść ścieżką przyrostową — tak działa zegar lokalny
    const uniq = log.filter((e, i) => i === 0 || e.hlc > log[i - 1].hlc);
    const r = rng(seed); let at = Math.floor(uniq.length * r() * 0.5);
    const acc = reduceInto(uniq.slice(0, at));
    const snaps = [[acc.state, canon(acc.state), at]];
    while (at < uniq.length) {
      const k = 1 + Math.floor(r() * 4);
      assert.equal(acc.append(uniq.slice(at, at + k)), true, 'zdarzenia najnowsze — ścieżka przyrostowa');
      at += k;
      same(acc.state, legacy(uniq.slice(0, at)), `dziennik ${seed}, po ${at} zdarzeniach`);
      snaps.push([acc.state, canon(acc.state), at]);
    }
    for (const [st, c, n] of snaps) assert.equal(canon(st), c, `stan po ${n} zdarzeniach zmienił się po kolejnych zapisach`);
  }
});

test('zdarzenie starsze od najnowszego lub z tym samym HLC — odmowa ścieżki przyrostowej (potrzebne pełne przeliczenie)', () => {
  const log = randomLog(3, 50).sort(byHlc).filter((e, i, a) => i === 0 || e.hlc > a[i - 1].hlc);
  const acc = reduceInto(log.slice(1));
  const before = canon(acc.state);
  assert.equal(acc.append([log[0]]), false);
  assert.equal(acc.append([{ ...log.at(-1), id: 'inny' }]), false, 'równy HLC');
  assert.equal(canon(acc.state), before, 'odmowa nie zmienia stanu');
});

test('Store: record/recordMany przyrostowo, appendMany (import) i zdarzenia starsze — stan zawsze = reduce(wszystkich)', async () => {
  const a = new MemoryAdapter();
  const s = await new Store(a).open();
  const check = msg => same(s.state, legacy(s.allEvents()), msg);
  let full = 0; const orig = s.rebuild.bind(s); s.rebuild = () => { full++; orig(); };
  await s.record('inv.count', { prod: 'jaja', qty: 10, date: '2026-10-05' }); check('inv.count');
  await s.record('train.set', { date: '2026-10-05', ex: 'przysiad', set: 1, done: true, kg: 60, reps: 8, rir: 2 }); check('train.set');
  await s.record('train.set', { date: '2026-10-05', ex: 'przysiad', set: 1, done: false, kg: 60, reps: 8, rir: 2 }); check('nadpisanie LWW');
  await s.recordMany([['cfa.done', { block: 1, done: true, plan: 13 }], ['cfa.done', { block: 2, done: true, plan: 13 }], ['prep.step', { date: '2026-10-05', card: 'a', idx: 0, done: true }]]); check('recordMany');
  await s.record('cfa.done', { block: 1, done: false, plan: 13 }); check('odhaczenie cofnięte');
  assert.equal(full, 0, 'zapisy lokalne bez pełnego przeliczenia');
  // import: zdarzenia z innego urządzenia, w tym starsze od lokalnych i typ z nowszej wersji
  const foreign = randomLog(11, 80).map(e => ({ ...e, id: `obce-${e.id}` }));
  await s.appendMany(foreign, 'test', { backup: false }); check('import');
  assert.equal(full, 1, 'import — pełne przeliczenie');
  await s.record('setting', { key: 'shopWeekday', value: 3 }); check('zapis po imporcie');
  // ponowne otwarcie = to samo
  const s2 = await new Store(a).open();
  same(s2.state, s.state, 'po ponownym otwarciu');
  assert.ok(lwwKey({ t: 'cfa.done', d: { block: 1 } }));
});

test('wydajność: zapis przy dużym dzienniku bez pełnego przeliczenia (30 tys. zdarzeń)', () => {
  const log = randomLog(5, 30000).sort(byHlc).filter((e, i, a) => i === 0 || e.hlc > a[i - 1].hlc);
  const acc = reduceInto(log.slice(0, -50));
  let t = performance.now();
  for (let i = log.length - 50; i < log.length; i++) acc.append([log[i]]);
  const inc = (performance.now() - t) / 50;
  t = performance.now(); legacy(log); const fullMs = performance.now() - t;
  same(acc.state, legacy(log));
  assert.ok(inc < fullMs, `przyrostowo ${inc.toFixed(2)} ms < pełne ${fullMs.toFixed(2)} ms`);
  console.log(`# 30 tys. zdarzeń: pełne przeliczenie ${fullMs.toFixed(1)} ms, dołożenie jednego zdarzenia ${inc.toFixed(2)} ms`);
});
