// Ekstrakcja: TRENING (EX, EX_ROM), CFA v3 (D), ZAPASY (katalog) -> src/data/*.json
// Uruchomienie: SOURCES_DIR=... node tools/extract/extract_static.mjs
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

// ---------- TRENING ----------
{
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

// ---------- CFA v3 ----------
{
  const js = scripts(read('Plan_nauki_CFA.html'))[0].trim();
  const D = JSON.parse(js.replace(/^const D\s*=\s*/, '').replace(/;\s*$/, ''));
  write('cfa.json', { schema: 1, generated_from: 'Plan_nauki_CFA.html v3 (22.09.2026) — obiekt D', exam: '2026-11-12', D });
  console.log('cfa.json:', D.bloki.length, 'bloków');
}

// ---------- ZAPASY: katalog ----------
{
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
{
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
