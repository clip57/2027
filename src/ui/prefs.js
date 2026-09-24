// Preferencje interfejsu PER URZĄDZENIE (motyw, zwinięty panel). Celowo poza dziennikiem zdarzeń i plikiem synchronizacji:
// nie są danymi użytkownika i nie powinny nadpisywać wyboru na innym urządzeniu. Brak dostępu do localStorage = wartości domyślne.
const KEY = { theme: 'p2027.theme', side: 'p2027.sidebar' };
const get = (k, d) => { try { return localStorage.getItem(KEY[k]) ?? d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(KEY[k], v); } catch { /* tryb prywatny — tylko bieżąca sesja */ } };

export const THEMES = [['dark', 'Ciemny', 'moon'], ['light', 'Jasny', 'sun'], ['system', 'Systemowy', 'monitor']];
export const themePref = () => get('theme', 'dark');               // domyślnie ciemny
export function applyTheme(pref = themePref()) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', pref === 'light' ? 'light' : 'dark');
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.setAttribute('content', dark ? '#0d0f13' : '#f6f5f2'); m.removeAttribute('media'); });
}
export function setTheme(pref) { set('theme', pref); applyTheme(pref); }
export const sideCollapsed = () => get('side', 'expanded') === 'collapsed';
export const setSideCollapsed = v => set('side', v ? 'collapsed' : 'expanded');
