// Import postępu i error logu z pliku CFA v3 (D-031). Deterministyczne id — import jest idempotentny.
export function cfaProgressEvents(o) {
  if (!o || !Array.isArray(o.wykonane)) throw new Error('To nie jest plik postep-nauki.json');
  const at = typeof o.zapis === 'string' ? o.zapis : new Date(0).toISOString();
  const ms = String(Date.parse(at) || 0).padStart(13, '0');
  return o.wykonane.filter(n => Number.isInteger(n) && n >= 1 && n <= 416).map((n, i) => ({
    id: `cfa-json:${ms}:${n}`, hlc: `${ms}:${String(i % 10000).padStart(4, '0')}:migr`, dev: 'migr', t: 'cfa.done',
    d: { block: n, done: true }, at, v: 1 }));
}

export function parseCsv(text) {
  const s = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ';') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x !== ''));
}

export async function cfaErrorLogEvents(text, sha256) {
  const rows = parseCsv(text);
  const head = rows.shift()?.join(';');
  if (head !== 'egzamin;data;temat_zrodlo;rodzaj_bledu;prawidlowa_regula') throw new Error('To nie jest plik error-log.csv z planu CFA');
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const [egz, data, temat, rodzaj, regula] = rows[i];
    const h = (await sha256(`${i}|${rows[i].join('|')}`)).slice(0, 16);
    out.push({ id: `cfa-csv:${h}`, hlc: `0000000000000:${String(i).padStart(4, '0')}:migr`, dev: 'migr', t: 'cfa.err.put',
      d: { id: `csv_${h}`, data: { egz, data, temat, rodzaj, regula } }, at: new Date(0).toISOString(), v: 1 });
  }
  return out;
}
