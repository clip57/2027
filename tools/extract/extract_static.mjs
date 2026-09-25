// Ekstrakcja: TRENING (EX, EX_ROM), CFA (D, plan D-086), ZAPASY (katalog) -> src/data/*.json
// Uruchomienie: SOURCES_DIR=... node tools/extract/extract_static.mjs
// Tylko wybrane części: ONLY=cfa (albo trening, katalog; kilka po przecinku).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SRC = process.env.SOURCES_DIR;
if (!SRC) { console.error('Ustaw SOURCES_DIR'); process.exit(1); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = p => path.join(ROOT, 'src/data', p);
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');
const write = (f, o) => fs.writeFileSync(OUT(f), JSON.stringify(o, null, 1));
const scripts = html => [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const want = part => !process.env.ONLY || process.env.ONLY.split(',').includes(part);

// ---------- TRENING ----------
if (want('trening')) {
  const js = scripts(read('TRENING.html')).join('\n');
  const grab = name => {
    const start = js.indexOf(`const ${name} =`);
    const open = js.indexOf('{', start);
    let depth = 0, i = open;
    for (; i < js.length; i++) { if (js[i] === '{') depth++; else if (js[i] === '}') { depth--; if (!depth) break; } }
    return vm.runInNewContext('(' + js.slice(open, i + 1) + ')');
  };
  const EX = grab('EX'), EX_ROM = grab('EX_ROM');
  const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const days = {};
  for (const [day, list] of Object.entries(EX)) {
    days[day] = list.map((r, i) => ({ id: `ex.${day}.${i + 1}.${slug(r[0])}`, name: r[0], tag: r[1] || null,
      series: { 0: r[2][0], 1: r[2][1], 2: r[2][2] }, reps: r[3], rir: r[4], rest: r[5], note_html: r[6] || null,
      src: `TRENING:EX.${day}[${i}]` }));
  }
  for (const [day, list] of Object.entries(EX_ROM)) {
    days[day] = list.map((r, i) => ({ id: `ex.${day}.${i + 1}.${slug(r[0])}`, name: r[0], raw: r,
      series: { 0: r[1][0], 1: r[1][1], 2: r[1][2] }, src: `TRENING:EX_ROM.${day}[${i}]` }));
  }
  write('training.json', { schema: 1, generated_from: 'TRENING.html (EX, EX_ROM)', days,
    note: 'Opisy techniki (INFO), wizualizacje (VIZ) i treści arkuszy zostaną przeniesione w Etapie 5.' });
  console.log('training.json:', Object.values(days).reduce((a, l) => a + l.length, 0), 'ćwiczeń');
}

// ---------- CFA (D-086/D-087: plan „MASTER SCHEDULE FINAL” od 25.09.2026, v5: 421 bloków; zastępuje v3 z D-006) ----------
if (want('cfa')) {
  const file = process.env.CFA_PLAN || 'PLAN_NAUKI_CFA_LEVEL_I.html';
  const js = scripts(read(file))[0].trim();
  const D = JSON.parse(js.replace(/^const D\s*=\s*/, '').replace(/;\s*$/, ''));
  // Starszy plik (v3: 416 bloków od 21.09; v4: 432 bloki) nie może po cichu nadpisać planu D-087
  if (D.bloki.length !== 421 || D.stat.start !== '2026-09-25' || D.stat.end !== '2026-11-11')
    throw new Error(`${file}: oczekiwano planu D-087 (421 bloków, 25.09–11.11), jest ${D.bloki.length} bloków ${D.stat.start}–${D.stat.end}`);
  // Kontrola krzyżowa z MASTER_SCHEDULE_CFA.csv (jeśli jest w SOURCES_DIR): te same bloki, pole po polu
  const csvFile = process.env.CFA_CSV || 'MASTER_SCHEDULE_CFA.csv';
  if (fs.existsSync(path.join(SRC, csvFile))) {
    const rows = [], text = read(csvFile).replace(/^\uFEFF/, '');
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    const [head, ...body] = rows.filter(r => r.some(x => x !== ''));
    const diff = body.length !== D.bloki.length ? [`liczba wierszy ${body.length}`]
      : body.flatMap((r, i) => head.filter((k, j) => String(D.bloki[i][k]) !== r[j]).map(k => `nr ${i + 1}: ${k}`));
    if (diff.length) throw new Error(`${csvFile} ≠ ${file}: ${diff.slice(0, 5).join('; ')}`);
    console.log(`cfa: ${csvFile} zgodny z ${file} (${body.length} wierszy)`);
  }
  write('cfa.json', { schema: 1, generated_from: 'PLAN_NAUKI_CFA_LEVEL_I.html (MASTER SCHEDULE FINAL v5, 25.09.2026) — obiekt D (D-086, D-087)',
    exam: '2026-11-12', D });
  console.log('cfa.json:', D.bloki.length, 'bloków');
}

// ---------- ZAPASY: katalog ----------
if (want('katalog')) {
  const html = read('ZAPASY_DIETA.html');
  const m = html.match(/const defaultProductsData\s*=\s*(\[[\s\S]*?\n\s*\]);/);
  const def = vm.runInNewContext(m[1]);
  const CANON = { bialko_kfd: 'Białko WPC', skyr: 'Skyr', brokuly: 'Brokuły mrożone' }; // D-020
  const NOTE_FIX = { miod: { note: '1 łyżeczka (6 g)', decision: 'I-5' } };
  const items = def.map(p => {
    const { daily, ...rest } = p;
    const o = { ...rest, kind: p.category === 'Suplementy' ? 'supplement' : 'food', tracked: true,
      daily_v31: daily, src: `ZAPASY:v31/${p.id}` };
    if (CANON[p.id]) { o.name_v31 = p.name; o.name = CANON[p.id]; o.name_decision = 'D-020'; }
    if (NOTE_FIX[p.id]) { o.note_v31 = p.note; o.note = NOTE_FIX[p.id].note; o.note_decision = NOTE_FIX[p.id].decision; }
    return o;
  });
  const NEW = [ // D-015, D-016
    { id: 'chondroityna', name: 'Chondroityna', category: 'Suplementy', unit: 'kaps.', shelfLife: 'long', packSize: 60,
      kind: 'supplement', tracked: true, noShopping: true, decision: 'D-015' },
    { id: 'glukozamina', name: 'Glukozamina', category: 'Suplementy', unit: 'kaps.', shelfLife: 'long', packSize: 90,
      kind: 'supplement', tracked: true, noShopping: true, decision: 'D-015' },
    { id: 'boswellia', name: 'Boswellia Serrata', category: 'Suplementy', unit: 'kaps.', shelfLife: 'long', packSize: 90,
      kind: 'supplement', tracked: true, noShopping: true, decision: 'D-015' },
    { id: 'cynk', name: 'Cynk', category: 'Suplementy', unit: 'kaps.', shelfLife: 'long', packSize: 150,
      kind: 'supplement', tracked: false, noShopping: true, decision: 'D-016' },
  ];
  write('catalog.json', { schema: 1, generated_from: 'ZAPASY_DIETA.html (defaultProductsData) + D-015/D-016/D-020/I-5',
    items: [...items, ...NEW] });
  console.log('catalog.json:', items.length + NEW.length, 'pozycji');
}

// ---------- TRENING: technika (INFO), wizualizacje (VIZ), rozgrzewka/schłodzenie, arkusze ----------
if (want('trening')) {
  const html = read('TRENING.html');
  const js = scripts(html).join('\n');
  const grabObj = name => {
    const start = js.indexOf(`const ${name}`);
    const open = js.indexOf('{', start);
    let depth = 0, i = open, inStr = null;
    for (; i < js.length; i++) {
      const c = js[i];
      if (inStr) { if (c === '\\') i++; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) break; }
    }
    // Piaskownica: funkcje pomocnicze rysowania (arc itp.) zapisujemy jako wywołania, bez wykonywania.
    const sandbox = new Proxy({ FIG: '@FIG@' }, {
      has: () => true,
      get: (t, k) => (k in t ? t[k] : (...args) => ({ fn: String(k), args })),
    });
    return vm.runInNewContext('(' + js.slice(open, i + 1) + ')', sandbox);
  };
  const INFO = grabObj('INFO');
  // VIZ: wykonujemy oryginalne definicje FIG, FLOOR, arc() i VIZ, aby odtworzyć dokładnie te same kształty.
  const piece = re => (js.match(re) || [])[0] || '';
  const vizSrc = [piece(/const FIG\s*=[^;]*;/), piece(/const FLOOR\s*=[^;]*;/), piece(/function arc\([\s\S]*?return p;\}/),
    js.slice(js.indexOf('const VIZ'), js.indexOf('function vizSVG'))].join('\n');
  const VIZ = vm.runInNewContext(vizSrc + '\n;VIZ', {});
  const FIG = vm.runInNewContext(piece(/const FIG\s*=[^;]*;/) + ';FIG', {});

  const noScripts = html.replace(/<script[\s\S]*?<\/script>/g, '');
  const text = frag => frag.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const between = (id) => {
    const m = noScripts.match(new RegExp(`<[^>]*id="${id}"[^>]*>([\\s\\S]*?)<!--\\s*\\/${id}|<[^>]*id="${id}"[^>]*>([\\s\\S]*?)(?=<div[^>]*id="(?:day|warmup|ex|cool)-)`));
    return m ? text(m[1] || m[2]) : null;
  };
  const days = ['pon', 'wt', 'sr', 'pt', 'sob'];
  const warmup = {}, cooldown = {};
  for (const d of days) { warmup[d] = between(`warmup-${d}`); cooldown[d] = between(`cool-${d}`); }
  const sheets = [...noScripts.matchAll(/<div class="sheet"[\s\S]*?<\/div>\s*<\/div>/g)].map(m => text(m[0]));

  const out = JSON.parse(fs.readFileSync(OUT('training.json'), 'utf8'));
  out.info = INFO; out.viz = VIZ; out.fig = FIG; out.warmup = warmup; out.cooldown = cooldown; out.sheets = sheets;
  out.note = 'Technika (info), wizualizacje (viz), rozgrzewka i schłodzenie oraz arkusze przeniesione w Etapie 5.';
  write('training.json', out);
  console.log('training.json +', Object.keys(INFO).length, 'opisów techniki,', Object.keys(VIZ).length, 'wizualizacji,',
    Object.values(warmup).filter(Boolean).length, 'rozgrzewek,', sheets.length, 'arkuszy');
}
