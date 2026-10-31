// Preferencje interfejsu PER URZĄDZENIE (motyw, zwinięty panel). Celowo poza dziennikiem zdarzeń i plikiem synchronizacji:
// nie są danymi użytkownika i nie powinny nadpisywać wyboru na innym urządzeniu. Brak dostępu do localStorage = wartości domyślne.
const KEY = { theme: 'p2027.theme', side: 'p2027.sidebar', sound: 'p2027.sound', accent: 'p2027.accent', density: 'p2027.density', text: 'p2027.text', start: 'p2027.start' };
const get = (k, d) => { try { return localStorage.getItem(KEY[k]) ?? d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(KEY[k], v); } catch { /* tryb prywatny — tylko bieżąca sesja */ } };

export const THEMES = [['dark', 'Ciemny', 'moon'], ['light', 'Jasny', 'sun'], ['system', 'Systemowy', 'monitor']];
export const themePref = () => get('theme', 'dark');               // domyślnie ciemny
export function applyTheme(pref = themePref()) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', pref === 'light' ? 'light' : 'dark');
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.setAttribute('content', dark ? '#090a0d' : '#f5f7fa'); m.removeAttribute('media'); });
}
export const saveTheme = pref => set('theme', pref);
export function setTheme(pref) { saveTheme(pref); applyTheme(pref); }
export const sideCollapsed = () => get('side', 'expanded') === 'collapsed';
export const setSideCollapsed = v => set('side', v ? 'collapsed' : 'expanded');
// Sygnał dźwiękowy końca odliczania (minutniki, przerwa w Treningu) — domyślnie włączony (D5)
export const soundOn = () => get('sound', 'on') !== 'off';
export const setSound = on => set('sound', on ? 'on' : 'off');

// Ustawienia wyglądu (D-113, strona Ustawienia): akcent, gęstość i rozmiar tekstu — atrybuty data-* na <html> (tokens.css / precision.css);
// odczytywane także w skrypcie startowym index.html (bez mignięcia przy starcie). Wartość domyślna = brak atrybutu.
export const ACCENTS = [['indigo', 'Indygo'], ['teal', 'Turkus'], ['amber', 'Bursztyn']];
export const DENSITIES = [['comfortable', 'Wygodna'], ['compact', 'Zwarta']];
export const TEXT_SIZES = [['normal', 'Standardowy'], ['large', 'Większy']];
const DEFAULTS = { accent: 'indigo', density: 'comfortable', text: 'normal' };
const ALLOWED = { accent: ACCENTS, density: DENSITIES, text: TEXT_SIZES };
export const uiPref = k => { const v = get(k, DEFAULTS[k]); return ALLOWED[k].some(([x]) => x === v) ? v : DEFAULTS[k]; };
export function setUiPref(k, v) {
  if (!ALLOWED[k]?.some(([x]) => x === v)) return;
  set(k, v);
  if (v === DEFAULTS[k]) document.documentElement.removeAttribute(`data-${k}`); else document.documentElement.setAttribute(`data-${k}`, v);
}
// Ekran startowy (otwarcie aplikacji bez adresu trasy) — identyfikator modułu; sprawdzany w app.js z listą modułów
export const startPref = () => get('start', 'dzis');
export const setStartPref = id => set('start', id);
