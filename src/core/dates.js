// Daty lokalne (bez UTC) — naprawia klasę błędu z CFA v1/v2 (toISOString = wczoraj w Polsce).
// Format dnia: 'RRRR-MM-DD'. Dzień tygodnia: 1 = poniedziałek … 7 = niedziela.
const pad = n => String(n).padStart(2, '0');

export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const today = (now = new Date()) => ymd(now);
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
export const weekday = s => { const w = parse(s).getDay(); return w === 0 ? 7 : w; };
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const isValidDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parse(s)) === s;
export function* range(from, to) { for (let d = from; d <= to; d = addDays(d, 1)) yield d; }

const DAY_PL = ['', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
const DAY_SHORT = ['', 'pn', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];
const MON_PL = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
export const dayName = s => DAY_PL[weekday(s)];
export const dayShort = s => DAY_SHORT[weekday(s)];
export const longDate = s => { const d = parse(s); return `${d.getDate()} ${MON_PL[d.getMonth()]} ${d.getFullYear()}`; };
export const shortDate = s => { const d = parse(s); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`; };
