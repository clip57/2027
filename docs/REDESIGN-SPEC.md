# REDESIGN-SPEC — system projektowy aplikacji „2027”

Stan: obowiązuje od Fazy 3 (24.09.2026). Źródło prawdy dla wartości: `src/ui/tokens.css`; dla komponentów: `src/ui/system.css`.
Jeśli ten dokument i kod się różnią — **kod jest źródłem prawdy**, a rozbieżność zgłoś w raporcie.

## 1. Kierunek wizualny
„Personal OS / spokojny premium workspace”. Ciemny grafit (domyślnie) lub ciepła złamana biel; **jeden akcent — indygo**;
duże liczby KPI z krótkim opisem; karty o 2 poziomach głębi; paski i pierścienie postępu **tylko tam, gdzie istnieje
rzeczywisty licznik** (serie, bloki CFA, kroki meal prepu, kcal, zapasy). Kolory domen modułów są wyłącznie sygnaturą
(ikona, cienki pasek, kropka) — nigdy tłem dużych powierzchni.

**Unikaj:** glassmorphismu (wyjątek: przezroczysty dolny pasek na telefonie), neumorfizmu, gradientów dekoracyjnych,
przesadnych cieni, animacji bez funkcji, metryk bez danych, kopiowania referencji 1:1.
Referencje (tylko inspiracja): zrzuty użytkownika — mobile jasny z pomarańczowym akcentem, desktop jasny z niebieskim,
desktop ciemny „LifeOS”; pliki Figma Nucleus OS i OneDay **nie zostały otwarte** (Figma blokuje dostęp automatyczny) —
wymagają weryfikacji, jeśli mają być dalej używane.

## 2. Tokeny (`src/ui/tokens.css`)

### Motyw ciemny (domyślny) i jasny
| Token | Ciemny | Jasny | Użycie |
|---|---|---|---|
| `--bg` | `#0d0f13` | `#f6f5f2` | tło aplikacji |
| `--surface` | `#15181e` | `#ffffff` | karty, panel boczny |
| `--surface-2` | `#1c2028` | `#ffffff` | okna, aktywny segment |
| `--sunken` | `#0a0b0e` | `#efede9` | tory segmentów, pasków, hover |
| `--text` / `--text-2` / `--muted` | `#eceef3` / `#b3b9c5` / `#8f96a3` | `#16171b` / `#4a4f59` / `#676d78` | treść / opisy / metadane |
| `--border` / `--border-strong` | `#262a33` / `#666e7c` | `#e5e2dc` / `#8f8b83` | ramki / pola formularzy (≥ 3:1) |
| `--accent` / `--accent-ink` / `--accent-soft` | `#a5a8ff` / `#0d0f13` / `#23254a` | `#4845d2` / `#ffffff` / `#ecebfb` | interakcja, fokus, aktywna nawigacja |
| `--success` / `--warning` / `--danger` / `--info` | `#7fe0a6` / `#f5bd6b` / `#ff9f97` / `#a5a8ff` | `#11632f` / `#8a4204` / `#9b1c16` / `#4845d2` | stany (zawsze z tekstem/ikoną) |
| Domeny `--cfa` / `--train` / `--regen` | `#8ea2ff` / `#f08c78` / `#c9a0ff` | `#1e40af` / `#8a3324` / `#6b21a8` | sygnatura modułów |
| Makro `--p-col` / `--c-col` / `--f-col` | `#9dbbff` / `#f3c06a` / `#d4b3ff` | `#1d4ed8` / `#92400e` / `#5b21b6` | białko / węglowodany / tłuszcz |
| `--e1` / `--e2` | brak / `0 16px 40px rgb(0 0 0/.5)` | subtelny / `0 12px 32px …` | karta / okno |

Aliasy starych nazw (działają, nie usuwaj do końca Fazy 5): `--paper→--bg`, `--ink→--text`, `--ink-2→--text-2`,
`--line→--border`, `--focus→--accent`, `--ok/--warn/--bad→--success/--warning/--danger`, `--err-ink→--danger`,
`--diet→--success`, `--prep→--warning`, `--r-1→--r-md`, `--r-2→--r-lg`. Pozostałe: `--warn-bg`, `--warn-ink`, `--err-bg`, `--ok-ink`, `--org`.

### Skale
- **Typografia:** `--font` = Inter (lokalnie) → font systemowy Apple → system-ui. Rozmiary: `--fs-xs .75rem`, `--fs-sm .875rem`,
  `--fs-md 1rem`, `--fs-lg 1.125rem`, `--fs-xl 1.375rem`, `--fs-2xl 1.75rem`, `--fs-kpi 2.5rem`.
  Nagłówki: h1 `--fs-2xl`/700/−0.025em; h2 `--fs-lg`/650; h3 `--fs-md`/650. Etykiety sekcji: `--fs-xs`, 600–700, wersaliki, +0.04–0.08em, `--muted`.
  Liczby: `font-variant-numeric: tabular-nums`. Pola formularzy ≥ 16 px (iOS nie powiększa widoku).
- **Odstępy (siatka 4 px):** `--s-1 4` · `--s-2 8` · `--s-3 12` · `--s-4 16` · `--s-5 20` · `--s-6 24` · `--s-8 32` · `--s-10 40` · `--s-12 48`.
- **Promienie (tylko 4):** `--r-sm 8` (pola, drobne) · `--r-md 12` (przyciski, segmenty, wiersze list) · `--r-lg 18` (karty, okna) · `--r-full` (pigułki, kropki).
- **Ruch:** `--dur-1 120ms`, `--dur-2 200ms`, `--ease cubic-bezier(.2,.8,.2,1)`; przy `prefers-reduced-motion: reduce` czasy = 0.
- **Układ:** `--tab-h 60px`, `--side-w 244px`, `--side-w-min 76px`, `--content-max 1180px`.

## 3. Motywy
- Atrybut na `<html>`: `data-theme="dark"` | `"light"`; **brak atrybutu = zgodnie z systemem** (`prefers-color-scheme`).
- Domyślnie **ciemny**. Wybór per urządzenie w `localStorage['p2027.theme']` (`dark`/`light`/`system`) — `src/ui/prefs.js`.
  Skrypt w `<head>` (`src/index.html`) ustawia motyw przed pierwszym renderem (bez błysku jasnego ekranu).
- `applyTheme()` aktualizuje `<meta name="theme-color">` (`#0d0f13` / `#f6f5f2`).
- Przełącznik: panel boczny (ikony, `themeSwitch(true)`) i strona „Więcej” (ikony + etykiety). Przyciski mają `aria-label="Motyw: …"`.
- Nowe kolory **tylko jako tokeny** z wartościami dla obu motywów; kontrast tekstu ≥ 4,5:1, elementów UI ≥ 3:1.

## 4. Nawigacja
**Komputer (≥ 900 px):** panel boczny (`.side`) z grupami (`GROUPS` w `registry.js`):
Dzień (Dziś) · Trening (Trening, Rekompozycja) · Dieta (Dieta, Suplementacja, Zapasy, Meal Prep, Bezpieczeństwo żywności) ·
Nauka (CFA) · System (Dane i synchronizacja). Pozycja = ikona Lucide + nazwa; aktywna: tło `--accent-soft`, ikona w akcencie,
pasek 3 px po lewej, `aria-current="page"`. Zwijanie do 76 px (same ikony, `title` z nazwą), stan w `localStorage['p2027.sidebar']`.
Stopka: przełącznik motywu. Treść: `max-width 1180px`, padding 32/40 px.

**Telefon (< 900 px):** dolny pasek `.tabs` (5 pozycji): **Dziś, Dieta, Trening, CFA, Więcej** (pole `tab: true` w rejestrze).
Ikona 22 px + etykieta; aktywna w kolorze akcentu + znacznik 3 px u góry; wysokość 60 px + `env(safe-area-inset-bottom)`;
przezroczyste tło z rozmyciem. Pasek **chowa się, gdy pole tekstowe ma fokus** (`body.kbd`, obsługa w `boot()` w `app.js`).
Strona „Więcej” (`#/wiecej`): pozostałe moduły w grupach (lista z ikonami w kolorze domeny, wiersz 56 px) + sekcja „Wygląd”.

## 5. Komponenty (`src/ui/system.css`)
| Komponent | Specyfikacja |
|---|---|
| Przycisk | wys. 44 px, `--r-md`; warianty: domyślny (`--surface` + ramka), `.primary` (akcent, `--accent-ink`), `.danger` (tekst `--danger`), `.ghost` (przezroczysty). Aktywny `scale(.98)` |
| Pola | kolor/ramka/promień przez `:where()` (zerowa specyficzność — wymiary ustalone w modułach wygrywają); `accent-color` dla checkbox/radio/range |
| Karty | `.panel, .stat, .hero, .hero-tr, .meal, .ex, .prep-card, .sf-card, .rk-sec, .dash-box, .daycard, .tl-card, .gd-card, .rule, .mv-stage` → `--surface`, `--r-lg`, `--e1`; wiersze list `.slot, .inv-item, .log-item, .hist-item, .safe-card` → `--r-md`. Kolorowe lewe krawędzie domen w modułach zostają |
| KPI (`.stat`) | etykieta wersalikami `--fs-xs --muted`, wartość 1.4 rem / 700 / tabular-nums, opis `--text-2` |
| Segmenty (`.seg`, `.seg-b`) | tor `--sunken` z paddingiem 4 px; opcja wys. 44 px; aktywna `--surface-2` + mały cień |
| Plakietki / filtry | `.chip` (tło `--sunken`, pigułka); `.chip-b`, `.pill-b` aktywne → `--accent-soft` + ramka w akcencie |
| Komunikaty | `.banner` (+ `.warn`, `.err`, `.info`), `--r-md`, ramka w kolorze stanu; `role="status"` / `role="alert"` w modułach |
| Tabele | `table.data`: nagłówki `--muted`; przewijanie tylko w kontenerze `.scroll-x` (fokusowalny, `aria-label`) |
| Okna | `dialog`: `--surface-2`, `--r-lg`, `--e2`. **< 600 px: arkusz od dołu** (pełna szerokość, `max-height 90dvh`, zaokrąglona góra, margines `safe-area-inset-bottom`, animacja 200 ms) |
| Przełącznik motywu | `.theme-switch` / `.ts-b` (tor jak segmenty) |
| Ikony | `icon(name, {size, label})` z `src/ui/icons.js`; bez `label` → `aria-hidden="true"`; rozmiary 14–22 px; dostępne (40): sun, moon, monitor, utensils, dumbbell, graduation-cap, ellipsis, pill, package, chef-hat, shield-check, target, database, cloud-upload, cloud-download, panel-left-close, panel-left-open, chevron-left/right/down, check, x, triangle-alert, info, clock, calendar, flame, timer, play, pause, plus, minus, search, list-checks, book-open, refresh-cw, circle-check, shopping-cart, heart-pulse, zap. Nowa ikona: dopisz nazwę w `tools/icons.mjs` i uruchom `node tools/icons.mjs` |

### Dashboard „Dziś” (Faza 4, klasy `dz-*`)
Nagłówek (`.dz-head`: h1, `.topline` z datą i plakietkami, `.daynav`) → skróty (`.quicklinks`, pigułki z ikonami) →
siatka `.dz-grid`: karta „Teraz” (`.nowcard.dz-now`, pierścień postępu dnia) · kafle `.stats.dz-kpis` (Dieta, Trening,
CFA, Zapasy; paski `.dz-bar`) · kolumna `.dz-aside` (karty `.dz-card`: Suplementy — **tylko liczba dawek i następna pora (D-041, D-064)**,
Meal prep, Zapasy, Plan CFA, Aktywność treningowa — siatka `.dz-grid-dots` 6 tyg. × 7 dni) · plan dnia `.dz-plan` > `.day` > `.slot`.
Punkty podziału: ≥ 1100 px dwie kolumny (boczna 320 px, przyklejona); 600–1099 px karty boczne w 2 kolumnach;
kafle: 2 kolumny, 4 kolumny przy 700–1099 px i ≥ 1440 px; < 600 px jedna kolumna, skróty przewijane poziomo.

## 6. Mobile / iPhone
- Brak przewijania całej strony w poziomie (testowane automatycznie na każdym widoku).
- Cele dotykowe ≥ 44 px (przyciski, segmenty, pasek dolny, przełącznik motywu, wiersze „Więcej”).
- `viewport-fit=cover`; marginesy `env(safe-area-inset-*)` dla paska dolnego, okien i `:root`.
- Jedna kolumna, kolejność od najważniejszego; szczegóły dostępne, nie ukryte na stałe.
- **Do weryfikacji na urządzeniu:** zachowanie arkuszy od dołu z klawiaturą, chowanie paska przy klawiaturze (iOS),
  rozmycie tła paska w PWA, render fontu Inter w PWA offline.

## 7. Dostępność
WCAG 2.1 A/AA (axe-core, `npm run a11y`) w obu motywach — obecnie 0 naruszeń. Widoczny fokus (`:focus-visible` 2 px akcent),
nawigacja klawiaturą (przewijane obszary fokusowalne), `aria-current`, `aria-pressed`, etykiety ikon-przycisków,
stan nigdy tylko kolorem (tekst/ikona obok), `prefers-reduced-motion`.
Zmierzone kontrasty: tekst/tło 16,4 (jasny) i 16,5 (ciemny); akcent na karcie 6,9 / 8,2; `--muted` 4,8 / 6,0; ramka pola 3,4 (jasny) / 3,5 (ciemny) na `--surface`, 3,2 na `--surface-2`.
