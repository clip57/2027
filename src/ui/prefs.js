// Preferencje interfejsu PER URZĄDZENIE (motyw, zwinięty panel). Celowo poza dziennikiem zdarzeń i plikiem synchronizacji:
// nie są danymi użytkownika i nie powinny nadpisywać wyboru na innym urządzeniu. Brak dostępu do localStorage = wartości domyślne.
const KEY = { theme: 'p2027.theme', side: 'p2027.sidebar', sound: 'p2027.sound', accent: 'p2027.accent', density: 'p2027.density', text: 'p2027.text', start: 'p2027.start',
  oled: 'p2027.oled', sfx: 'p2027.sfx', tabs: 'p2027.tabs', cards: 'p2027.cards' };
const get = (k, d) => { try { return localStorage.getItem(KEY[k]) ?? d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(KEY[k], v); } catch { /* tryb prywatny — tylko bieżąca sesja */ } };

export const THEMES = [['dark', 'Ciemny', 'moon'], ['light', 'Jasny', 'sun'], ['system', 'Systemowy', 'monitor']];
export const themePref = () => get('theme', 'dark');               // domyślnie ciemny
export function applyTheme(pref = themePref()) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', pref === 'light' ? 'light' : 'dark');
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  // D-114: głęboka czerń (OLED) — atrybut data-oled działa tylko w motywie ciemnym (tokens.css); kolor paska = --bg
  if (oledOn()) root.setAttribute('data-oled', ''); else root.removeAttribute('data-oled');
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.setAttribute('content', !dark ? '#f5f7fa' : oledOn() ? '#000000' : '#090a0d'); m.removeAttribute('media'); });
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

// D-114 (System 4.0): głęboka czerń w motywie ciemnym (ekrany OLED) i dźwięki interfejsu (odhaczenie, ukończony dzień) — domyślnie wyłączone;
// sygnał minutników ma osobny przełącznik (soundOn, domyślnie włączony)
export const oledOn = () => get('oled', '0') === '1';
export function setOled(on) { set('oled', on ? '1' : '0'); applyTheme(); }
export const sfxOn = () => get('sfx', 'off') === 'on';
export const setSfx = on => set('sfx', on ? 'on' : 'off');

// D-114 etap 2: własny pasek dolny — 4 moduły (identyfikatory po przecinku); nieprawidłowa lista = domyślne zakładki z rejestru.
// Karty w „Dziś” — lista ukrytych kart (identyfikatory). Preferencje urządzenia (telefon i komputer mogą mieć inne).
export function tabsPref(valid) {
  const ids = String(get('tabs', '') || '').split(',').filter(Boolean);
  return ids.length === 4 && new Set(ids).size === 4 && ids.every(id => valid.includes(id)) ? ids : null;
}
export const setTabsPref = ids => set('tabs', ids ? ids.join(',') : '');
export const DZ_CARDS = [['supp', 'Suplementy'], ['care', 'Pielęgnacja'], ['prep', 'Meal prep'], ['inv', 'Zapasy'], ['plan', 'Plan nauki'], ['act', 'Aktywność treningowa']];
export const hiddenCards = () => new Set(String(get('cards', '') || '').split(',').filter(Boolean));
export const setHiddenCards = ids => set('cards', [...ids].join(','));
