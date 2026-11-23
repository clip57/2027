// D-120, D-121: eksport planów CFA i MPW do CSV w układzie plików źródłowych użytkownika (MASTER_SCHEDULE_CFA_451.csv, MASTER_SCHEDULE_MPW.csv) — z datami
// i godzinami bloków wg decyzji (`week.studyMoves`, `week.mpwShift`), czyli tak, jak pokazuje je aplikacja. Kolumny: kolejność pól z pliku planu
// (bez pól dodanych przez aplikację: `zakres`, `topic`, `fid`). Odsyłacze „#nr · DD.MM.RRRR” do bloków MPW w kolumnie `powiazane_bloki_mpw` — z nową datą.
// Do tego plik zmian (numer bloku, plan, było → jest). Użycie: node tools/export_plans_csv.mjs <katalog wyjściowy> — pliki poza repozytorium.
import fs from 'node:fs';
import path from 'node:path';
import { SRC } from '../src/core/data.js';
import cfaJson from '../src/data/cfa.json' with { type: 'json' };
import mpwJson from '../src/data/mpw.json' with { type: 'json' };

const out = process.argv[2];
if (!out) { console.error('Użycie: node tools/export_plans_csv.mjs <katalog wyjściowy>'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });

// kolejność kolumn: scalenie kolejności pól wszystkich bloków (pola puste w danym wierszu nie występują w JSON)
function columns(rows, skip) {
  const after = new Map(), seen = [];
  for (const r of rows) {
    const keys = Object.keys(r).filter(k => !skip.includes(k));
    keys.forEach((k, i) => { if (!seen.includes(k)) seen.push(k); if (i) (after.get(k) || after.set(k, new Set()).get(k)).add(keys[i - 1]); });
  }
  const order = [], done = new Set();
  const visit = k => { if (done.has(k)) return; done.add(k); for (const p of after.get(k) || []) visit(p); order.push(k); };
  seen.forEach(visit);
  return order;
}
const cell = v => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const write = (file, cols, rows) => {
  fs.writeFileSync(path.join(out, file), '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n') + '\r\n', 'utf8');
  console.log(`${file}: ${rows.length} wierszy, ${cols.length} kolumn`);
};
const dmy = d => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

// MPW — kolumny pliku MASTER_SCHEDULE_MPW.csv (D-116: plan_d116.py)
const MPW_COLS = ['nr', 'data', 'dzien', 'blok', 'godz', 'egzamin', 'kategoria', 'tryb', 'zrodlo', 'do_przeczytania', 'objetosc_zrodla', 'temat', 'zadania', 'knf', 'priorytet'];
const mpw = SRC.mpw.D.bloki;
write('MASTER_SCHEDULE_MPW_D121.csv', MPW_COLS, mpw);

// CFA — kolumny z pliku planu, odsyłacze do bloków MPW z nową datą
const moved = new Map(mpw.filter(b => b.data_src).map(b => [b.nr, b]));
const cfa = SRC.cfa.D.bloki.map(b => (b.powiazane_bloki_mpw ? { ...b, powiazane_bloki_mpw: b.powiazane_bloki_mpw.replace(/#(\d+) · (\d\d\.\d\d\.\d{4})/g,
  (m, nr, d) => (moved.has(Number(nr)) && dmy(moved.get(Number(nr)).data_src) === d ? `#${nr} · ${dmy(moved.get(Number(nr)).data)}` : m)) } : b));
write('MASTER_SCHEDULE_CFA_451_D121.csv', columns(cfaJson.D.bloki, ['zakres', 'topic']), cfa);

// zmiany względem planu z pliku
const changes = [];
for (const [plan, raw, now] of [['CFA', cfaJson.D.bloki, cfa], ['MPW', mpwJson.D.bloki, mpw]]) {
  now.forEach((b, i) => {
    const r = raw[i];
    if (r.data !== b.data || r.godz !== b.godz) changes.push({ plan, nr: b.nr, blok: b.blok, tryb: b.tryb, data_bylo: r.data, godz_bylo: r.godz, data_jest: b.data, dzien_jest: b.dzien, godz_jest: b.godz,
      powod: b.godz_src && !SRC.week.studyMoves[plan.toLowerCase()][b.nr] ? 'D-097: czwartek z zakupami (+30 min)' : 'D-120, D-121 (od 23.11.2026)' });
  });
}
write('ZMIANY_GODZIN_D121.csv', ['plan', 'nr', 'blok', 'tryb', 'data_bylo', 'godz_bylo', 'data_jest', 'dzien_jest', 'godz_jest', 'powod'], changes);
