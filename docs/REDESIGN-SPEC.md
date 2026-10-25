# REDESIGN-SPEC — system projektowy aplikacji „2027”

Stan: obowiązuje od Fazy 3, zaktualizowany w Fazie 5.0 i Fazie 5 (Trening, CFA, Dieta, Zapasy) — 24.09.2026; **System 2.0 (D-110) — 24.10.2026**. Źródło prawdy dla wartości: `src/ui/tokens.css`; dla komponentów: `src/ui/system.css`.
Jeśli ten dokument i kod się różnią — **kod jest źródłem prawdy**, a rozbieżność zgłoś w raporcie.

## 1. Kierunek wizualny
„Personal OS / spokojny premium workspace”. Ciemny grafit (domyślnie) lub ciepła złamana biel; **jeden akcent — indygo**;
duże liczby KPI z krótkim opisem; karty o 2 poziomach głębi; paski i pierścienie postępu **tylko tam, gdzie istnieje
rzeczywisty licznik** (serie, bloki CFA, kroki meal prepu, kcal, zapasy). Kolory domen modułów są wyłącznie sygnaturą
(ikona, cienki pasek, kropka) — nigdy tłem dużych powierzchni.

**Kierunek od Fazy 5 (D-073): „premium personal OS”** — spokojne karty o jednej skali, zwarte wiersze z najważniejszą informacją
na wierzchu i szczegółami „Więcej”, jedno główne działanie na ekran, wskaźniki postępu wyłącznie z danych (paski zapasu, pasek stanu
magazynu, makro w kcal), kolumna boczna z podsumowaniem na komputerze, siatka akcji z ikonami na telefonie. Inspiracją są zrzuty
użytkownika (LifeOS, mobilne „productivity”); elementy tych projektów bez pokrycia w danych (Focus Score, nastrój, AI chat,
„efficiency”) są świadomie pominięte.

**System 2.0 (D-110, 24.10.2026) — „głębia przez światło”:** ten sam układ informacji i te same klasy, nowocześniejszy materiał.
Tło „aurora” — stała poświata u góry ekranu w kolorze bieżącego modułu (w „Dziś” — bieżącego punktu planu), karty z krawędzią
światła (`--rim`) i miękkim cieniem także w motywie ciemnym, **szkło wyłącznie na elementach pływających** (pasek dolny, panel boczny,
pasek tytułu, okna, liczniki przerwy, przyklejone skróty), duże liczby z ciasnym odstępem liter i pomniejszoną jednostką, pierścienie
i paski z gradientem w kolorze domeny, ruch krótki i sprężysty (`--ease-spring`) z funkcją: wejście ekranu, nacisk, uchwyt arkusza,
znacznik „teraz” (od D-112 bez pulsowania). Plan dnia jako oś czasu z linią wypełnianą upływem czasu. Wszystkie efekty ustępują preferencjom
systemu: mniej ruchu (bez animacji), mniej przezroczystości i więcej kontrastu (bez szkła i poświat), wymuszone kolory.

**Unikaj:** szkła na kartach z treścią (tylko elementy pływające), neumorfizmu, gradientów, które nie niosą głębi ani stanu,
przesadnych cieni, animacji bez funkcji i animacji przezroczystości treści poza wejściem ekranu (kontrast mierzony w trakcie),
metryk bez danych, kopiowania referencji 1:1. Zabarwienia tła pod tekstem najwyżej `--tint` (6 % jasny / 12 % ciemny) — kontrast
`--muted` ≥ 4,5:1.
Referencje (tylko inspiracja): zrzuty użytkownika — mobile jasny z pomarańczowym akcentem, desktop jasny z niebieskim,
desktop ciemny „LifeOS”; pliki Figma Nucleus OS i OneDay **nie zostały otwarte** (Figma blokuje dostęp automatyczny) —
wymagają weryfikacji, jeśli mają być dalej używane.

## 2. Tokeny (`src/ui/tokens.css`)

### Motyw ciemny (domyślny) i jasny
| Token | Ciemny | Jasny | Użycie |
|---|---|---|---|
| `--bg` | `#090a0f` | `#f3f4f7` | tło aplikacji (pod poświatą „aurora”) |
| `--surface` | `#12151c` | `#ffffff` | karty |
| `--surface-2` | `#1a1e27` | `#ffffff` | okna, aktywny segment |
| `--sunken` | `#0c0e14` | `#eceef3` | tory segmentów, pola serii, wnętrza wierszy |
| `--text` / `--text-2` / `--muted` | `#eef0f6` / `#b6bccb` / `#9198a8` | `#12141a` / `#454b57` / `#626977` | treść / opisy / metadane |
| `--border` / `--border-strong` | `#232834` / `#687083` | `#e2e5eb` / `#8a909c` | ramki / pola formularzy (≥ 3:1) |
| `--accent` / `--accent-ink` / `--accent-soft` / `--accent-hi` | `#a5a8ff` / `#090a0f` / `#252856` / `#c0c2ff` | `#4845d2` / `#ffffff` / `#ebebfb` / `#5d5ae6` | interakcja, fokus, aktywna nawigacja; `--accent-hi` — górny kraniec gradientu przycisku głównego |
| `--success` / `--warning` / `--danger` / `--info` | `#7fe0a6` / `#f5bd6b` / `#ff9f97` / `#a5a8ff` | `#11632f` / `#8a4204` / `#9b1c16` / `#4845d2` | stany (zawsze z tekstem/ikoną) |
| Domeny `--cfa` / `--train` / `--regen` | `#8ea2ff` / `#f08c78` / `#c9a0ff` | `#1e40af` / `#8a3324` / `#6b21a8` | sygnatura modułów |
| Makro `--p-col` / `--c-col` / `--f-col` | `#9dbbff` / `#f3c06a` / `#d4b3ff` | `#1d4ed8` / `#92400e` / `#5b21b6` | białko / węglowodany / tłuszcz |
| `--on-success` | `#090a0f` | `#ffffff` | tekst/ikona na wypełnieniu `--success` (odhaczona seria, blok CFA) — ≥ 4,5:1 |
| `--btn` / `--btn-hover` | `#1b1f29` / `#222733` | `#ffffff` / `#f6f7fa` | przycisk domyślny (D-110) |
| `--rail` | `#262b37` | `#dde1e8` | linia osi czasu (plan dnia, Suplementacja) |
| `--glass` / `--glass-border` / `--glass-blur` | `rgb(20 23 31/.82)` / `rgb(255 255 255/.08)` / `blur(22px) saturate(1.6)` | `rgb(255 255 255/.86)` / `rgb(16 18 27/.08)` / `blur(22px) saturate(1.8)` | materiał elementów pływających; krycie dobrane tak, by `--text-2` i `--accent` miały ≥ 4,5:1 nad dowolną treścią |
| `--rim` / `--e3` | `inset 0 1px 0 rgb(255 255 255/.055)` / cień pływający | `inset 0 1px 0 rgb(255 255 255/.9)` / cień pływający | krawędź światła kart / elementy pływające |
| `--aur` / `--tint` / `--glow-a` | `16%` / `12%` / `42%` | `7%` / `6%` / `18%` | natężenie poświaty tła / zabarwienia kart nagłówkowych / poświaty pierścieni i linii |
| `--brand-1` / `--brand-2` / `--brand-arc` / `--brand-arc-2` / `--brand-ink` | jak w jasnym | `#23245a` / `#07080c` / `#a5a8ff` / `#c9a0ff` / `#ffffff` | znak „27” w pierścieniu (jak ikona aplikacji — ciemny w obu motywach) |
| `--e1` / `--e2` | miękki cień (od D-110 także w ciemnym) / głęboki cień okna | subtelny / głęboki cień okna | karta / okno |
| `--e-raise` / `--scrim` | `0 1px 3px rgb(0 0 0/.5)` / `rgb(5 6 10/.6)` | `0 1px 3px rgb(20 20 30/.14)` / `rgb(5 6 10/.45)` | aktywny element toru (segment, motyw) / tło pod oknem |

Akcenty posiłków (lewa krawędź `.meal`, kolor kcal): śniadanie `--warning`, lunch `--success`, przekąska `--org`,
potreningowy `--train`, obiad `--cfa`, kolacja `--regen`, napoje `--text-2` — wszystkie z wariantem obu motywów.
Kontrast par tokenów i identyczność obu bloków motywu ciemnego pilnuje `tests/unit/tokens.test.mjs` (lista par `PAIRS`).

Aliasy starych nazw (działają, nie usuwaj do końca Fazy 5): `--paper→--bg`, `--ink→--text`, `--ink-2→--text-2`,
`--line→--border`, `--focus→--accent`, `--ok/--warn/--bad→--success/--warning/--danger`, `--err-ink→--danger`,
`--diet→--success`, `--prep→--warning`, `--r-1→--r-md`, `--r-2→--r-lg`. Pozostałe: `--warn-bg`, `--warn-ink`, `--err-bg`, `--ok-ink`, `--org`.

### Skale
- **Typografia:** `--font` = Inter (lokalnie) → font systemowy Apple → system-ui. Rozmiary: `--fs-2xs .75rem` (min. 12 px, U-e), `--fs-xs .75rem`, `--fs-sm .875rem`,
  `--fs-md 1rem`, `--fs-lg 1.125rem`, `--fs-xl 1.375rem`, `--fs-2xl 1.75rem`, `--fs-kpi 2.75rem`; `--fs-stat 1.5rem` — wartości kafli KPI (jednostka `.unit` 0,58 em);
  `--fs-display` (płynnie 30–38 px) — h1. Odstępy liter: `--track-tight` −0,025 em, `--track-num` −0,035 em (duże liczby), `--track-caps` 0,08 em (etykiety wersalikami).
  Nagłówki: h1 `--fs-display`/750/−0.032em (`text-wrap: balance`); h2 `--fs-lg`/650; h3 `--fs-md`/650. Etykiety sekcji: `--fs-xs`, 600–700, wersaliki, +0.04–0.08em, `--muted`.
  Liczby: `font-variant-numeric: tabular-nums`. Pola formularzy ≥ 16 px (iOS nie powiększa widoku).
- **Odstępy (siatka 4 px):** `--s-1 4` · `--s-2 8` · `--s-3 12` · `--s-4 16` · `--s-5 20` · `--s-6 24` · `--s-8 32` · `--s-10 40` · `--s-12 48`.
- **Promienie (5 + pochodny, D-110):** `--r-sm 10` (pola, drobne, kafle ikon) · `--r-md 14` (przyciski, segmenty, wiersze list) · `--r-lg 20` (karty) · `--r-xl 28` (okna, pasek dolny, panel boczny, liczniki) · `--r-full` (pigułki, kropki);
  `--r-in` = `--r-md − 4 px` (element wewnątrz toru z paddingiem 4 px). Stan: `system.css` bez literałów kolorów, promieni i rozmiarów pisma;
  `styles.css` (moduły) nadal z literałami promieni/odstępów/pisma — porządkowane w Fazie 5 moduł po module.
- **Ruch (D-110):** `--dur-1 140ms`, `--dur-2 220ms`, `--dur-3 360ms`; `--ease` (wyjście), `--ease-out` (wejście okien i ekranów), `--ease-spring` (nacisk, wskaźniki — `linear()` z lekkim przestrzeleniem, awaryjnie Bézier); przy `prefers-reduced-motion: reduce` czasy = 0, bez wejścia ekranu i pulsowania.
- **Układ:** `--tab-h 64px` (wysokość pływającego paska), `--dock-b` (odstęp paska od dołu: max(8 px, safe-area − 8 px)), `--nav-space` (= pasek + odstęp; miejsce zajmowane od dołu — treść, komunikaty, liczniki), `--appbar-h` (48 px na telefonie), `--side-w 252px`, `--side-w-min 80px`, `--content-max 1180px`.

## 3. Motywy
- Atrybut na `<html>`: `data-theme="dark"` | `"light"`; **brak atrybutu = zgodnie z systemem** (`prefers-color-scheme`).
- Domyślnie **ciemny**. Wybór per urządzenie w `localStorage['p2027.theme']` (`dark`/`light`/`system`) — `src/ui/prefs.js`.
  Skrypt w `<head>` (`src/index.html`) ustawia motyw przed pierwszym renderem (bez błysku jasnego ekranu).
- `applyTheme()` aktualizuje `<meta name="theme-color">` (`#090a0f` / `#f3f4f7`).
- Zmiana motywu przełącznikiem: wybór zapisany od razu, nowy wygląd odsłania się kołem od klikniętego przycisku (View Transitions,
  `switchTheme` w `app.js`; bez obsługi lub przy ograniczeniu ruchu — natychmiast).
- Przełącznik: panel boczny (ikony, `themeSwitch(true)`) i strona „Więcej” (ikony + etykiety). Przyciski mają `aria-label="Motyw: …"`.
- Nowe kolory **tylko jako tokeny** z wartościami dla obu motywów; kontrast tekstu ≥ 4,5:1, elementów UI ≥ 3:1.

## 4. Nawigacja
**Komputer (≥ 900 px):** panel boczny (`.side`) z grupami (`GROUPS` w `registry.js`):
Dzień (Dziś) · Trening (Trening, Rekompozycja) · Dieta (Dieta, Suplementacja, Zapasy, Meal Prep, Bezpieczeństwo żywności) ·
Nauka (CFA) · System (Dane i synchronizacja). Pozycja = ikona Lucide + nazwa; aktywna: tło `--accent-soft`, ikona w akcencie,
pasek 3 px po lewej, `aria-current="page"`. Zwijanie do 76 px (same ikony, `title` z nazwą), stan w `localStorage['p2027.sidebar']`.
Stopka: przełącznik motywu. Treść: `max-width 1180px`, padding 32/40 px.
**D-110:** panel pływa (margines 12 px, `--r-xl`, szkło `--glass`); aktywna pozycja i ikony w kolorze domeny modułu (`--dc`), pasek 3 px
z poświatą; znak „27” w pierścieniu (miniatura ikony aplikacji). Na komputerze karty dostają delikatną poświatę pod kursorem
(`--mx/--my` ustawiane w `app.js`, tylko `hover: hover` i `pointer: fine`).

**Telefon (< 900 px):** dolny pasek `.tabs` (5 pozycji): **Dziś, Dieta, Trening, CFA, Więcej** (pole `tab: true` w rejestrze).
**D-110: pływający pasek** (pigułka 64 px, odsunięta od krawędzi o 12 px i od dołu o `--dock-b`, szkło `--glass`, maks. 34 rem);
ikona 22 px + etykieta; aktywna w kolorze akcentu na „soczewce” `--accent-soft` (`::before`), nacisk `scale(.92)` ze sprężystym powrotem.
**Pasek tytułu `.appbar`** (D-110): po przewinięciu poza h1 strony u góry pojawia się szklany pasek z nazwą modułu (w „Dziś” — h1 dnia);
`aria-hidden` (duplikat nagłówka), bez elementów fokusowalnych; klasa `is-scrolled` na `#app` (`scrolled()` w `app.js`). Pasek **chowa się, gdy pole tekstowe ma fokus** (`body.kbd`, obsługa w `boot()` w `app.js`).
Strona „Więcej” (`#/wiecej`): pozostałe moduły w grupach (lista z ikonami w kolorze domeny — zmienna `--dc` ustawiana przez `h()`
przez `setProperty`, działa od Fazy 5.0; wiersz 56 px) + sekcja „Wygląd”.

**Przewijanie i wejście ekranu (D-110):** nowy moduł lub widok (parametr `v`) otwiera się od góry (wcześniej zostawało przewinięcie
poprzedniego modułu), „Wstecz/Dalej” przywraca pozycję (pamięć per wpis historii — znacznik w `history.state`), filtry i dni w obrębie
widoku nie zmieniają przewinięcia. Nowa treść wchodzi animacją CSS `main[data-enter]` (moduł/widok — od dołu, kolejny/poprzedni dzień
lub miesiąc — z boku), przerysowanie bez opóźnienia. View Transitions **nie są** używane przy zmianie trasy (pomiar: +50–300 ms przy
renderowaniu bez GPU) — tylko przy zmianie motywu.

**Odnośniki w obrębie strony (D-066):** `href="#id"` (bez `/`) nie zmienia trasy — `inPageLink()` w `app.js` przewija
(`scrollIntoView`, płynnie tylko bez `prefers-reduced-motion`) i przenosi fokus na cel (`tabindex="-1"` dla elementów niefokusowalnych).
Trasy modułów zawsze w postaci `#/modul?param=…`.

## 5. Komponenty (`src/ui/system.css`)
| Komponent | Specyfikacja |
|---|---|
| Przycisk | wys. 44 px, `--r-md`, krawędź światła; warianty: domyślny (`--btn` + ramka), `.primary` (gradient `--accent-hi`→`--accent`, `--accent-ink`, poświata), `.danger` (tekst `--danger`), `.ghost` (przezroczysty). Nacisk `scale(.97)` ze sprężystym powrotem |
| Pola | kolor/ramka/promień przez `:where()` (zerowa specyficzność — wymiary ustalone w modułach wygrywają); `accent-color` dla checkbox/radio/range |
| Karty | `.panel, .stat, .hero, .hero-tr, .meal, .ex, .prep-card, .sf-card, .rk-sec, .dash-box, .daycard, .tl-card, .gd-card, .rule, .mv-stage` → `--surface`, `--r-lg`, `--e1`, `border-color: --border`; wiersze list `.slot, .inv-item, .log-item, .hist-item, .safe-card` → `--r-md`. Kolorowe lewe krawędzie (`.meal`, `.daycard`, `.gd-rt`, `.gd-day`) są jawnie przywrócone w `system.css` po wspólnej regule — nowe sygnatury dopisuj tam (test E2E sprawdza `.meal` i `.gd-rt`) |
| KPI (`.stat`) | etykieta wersalikami `--fs-xs --muted`, wartość 1.4 rem / 700 / tabular-nums, opis `--text-2` |
| Segmenty (`.seg`, `.seg-b`) | tor `--sunken` z paddingiem 4 px; opcja wys. 44 px; aktywna `--surface-2` + mały cień. **D-110:** nie łamią się w dwa wiersze — przy braku miejsca przewijają się w poziomie (zanikanie krawędzi sterowane przewijaniem); `.controls` na komputerze układa przełączniki w wierszu (flex) |
| Plakietki / filtry | `.chip` (tło `--sunken`, pigułka); `.chip-b`, `.pill-b` aktywne → `--accent-soft` + ramka w akcencie |
| Komunikaty | `.banner` (+ `.warn`, `.err`, `.info`), `--r-md`, ramka w kolorze stanu; `role="status"` / `role="alert"` w modułach |
| Tabele | `table.data`: nagłówki `--muted`; przewijanie tylko w kontenerze `.scroll-x` (fokusowalny, `aria-label`) |
| Okna | `dialog`: `--surface-2`, `--r-xl`, `--e2`, tło za oknem rozmyte; wejście `dlg-in` (bez przezroczystości). **< 600 px: arkusz od dołu** (pełna szerokość, `max-height 90dvh`, zaokrąglona góra, margines `safe-area-inset-bottom`, wjazd `sheet-up` 360 ms, **uchwyt** i **zamykanie przeciągnięciem w dół** za nagłówek — `dragToClose` w `components.js`). Nagłówek arkusza szklany (przewijana treść pod nim); „✕” okrągły 44 px. Wyszukiwanie ⌘K na komputerze — okno u góry ekranu, pole 52 px |
| Przełącznik motywu | `.theme-switch` / `.ts-b` (tor jak segmenty) |
| Ikony | `icon(name, {size, label})` z `src/ui/icons.js`; bez `label` → `aria-hidden="true"`; rozmiary 14–22 px; dostępne (53; od Fazy 5 także square, copy, skip-forward, calendar-clock, list-todo, undo-2, history, bot, save, receipt, sliders-horizontal, package-check, clock-3): sun, moon, monitor, utensils, dumbbell, graduation-cap, ellipsis, pill, package, chef-hat, shield-check, target, database, cloud-upload, cloud-download, panel-left-close, panel-left-open, chevron-left/right/down, check, x, triangle-alert, info, clock, calendar, flame, timer, play, pause, plus, minus, search, list-checks, book-open, refresh-cw, circle-check, shopping-cart, heart-pulse, zap. Nowa ikona: dopisz nazwę w `tools/icons.mjs` i uruchom `node tools/icons.mjs` |
| Link jako przycisk | `a.btn` — `inline-flex`, wyśrodkowanie, odstęp ikony, bez podkreślenia (od Fazy 5) |
| Tylko dla czytników | `.sr-only` — komunikaty `aria-live` bez widocznego tekstu (licznik przerwy) |
| Pierścień postępu (D-110) | `progressRing()` — łuk w gradiencie (`<linearGradient>` z unikalnym id, kolory `.rg-a`/`.rg-b` z `--ring`), poświata `--glow-a`; kolor ustawia `--ring` na `.ring` (nie `stroke` na `.ring-fg`) |
| Komunikat po akcji | `#toast .banner` — `--r-lg`, cień pływający, wejście sprężyste bez przezroczystości |
| Strzałki rozwijania | `.meal`, `.fold`, `.rk-sec` — kreślona strzałka CSS z obrotem sprężystym (zamiast znaku „▾”) |

### Trening (Faza 5, klasy `tr-*`)
Nagłówek sesji `.hero-tr` (bez dekoracyjnego gradientu): eyebrow (dzień, data, faza), h1 = nazwa sesji, pierścień serii, **karta
„Następna seria” `.tr-next`** (ćwiczenie, seria X z N, plan powtórzeń/RIR/przerwy, ostatni wynik, link „Przejdź do ćwiczenia” → `#ex-<id>`;
po ukończeniu — `.tr-done` z podsumowaniem), czas treningu (przyciski z ikonami play/square), mapa mięśni. Pasek dni `.day-strip`:
wybrany dzień `--accent-soft` + ramka w akcencie (zamiast pełnego odwrócenia kolorów). Karta ćwiczenia `.ex` (`id="ex-<id>"`,
`.is-next` — ramka w kolorze domeny). Wiersz serii: 44 px | kg | powt. | RIR | 44 px (kopiowanie — ikona `copy`); wszystkie cele ≥ 44 px.
**Licznik przerwy `.tr-rest`** (D-068): stały pasek nad dolnym paskiem (telefon) / w prawym dolnym rogu 460 px (≥ 900 px);
ikona, faza („Przerwa · plan 2–3 min” → „Możesz zaczynać” → „Przerwa zakończona”), czas `mm:ss` (tabular-nums), następna seria, pasek
postępu, „+30 s”, „Pomiń” (na < 420 px sama ikona z `aria-label`). Stan gotowości: kolor `--success`. Ukryty przy otwartej klawiaturze
(`body.kbd`); treść `main` dostaje dodatkowy margines dolny (`:has(.tr-rest)`). Ogłoszenia dla czytników wyłącznie przy zmianie fazy
(osobny `.sr-only` z `aria-live`), nie co sekundę.

### CFA (Faza 5, klasy `cf-*`)
Nagłówek `.hero-cfa`: dni do egzaminu, bloki i godziny, **`.cf-pace`**: „Zaległe: N” (link do harmonogramu z filtrem, kolor `--danger`)
albo „Na bieżąco z planem”, „Plan do wczoraj: X / Y”, „Z wyprzedzeniem: Z”. Widok dnia: nawigacja `a.btn.dz-nav` z chevronami
(jak w „Dziś”), **panel `.cf-backlog`** (tylko dzień bieżący: 5 najstarszych zaległych bloków do odhaczenia + „Wszystkie zaległe”),
`.cf-next` i `.cfa-row.is-next` (następny blok dnia). Error log: pole `.cf-search` i filtr `.cf-kinds` (przyciski `aria-pressed`).
Kalendarz: dzień bieżący obrysowany akcentem.

### Dieta (Faza 5, klasy `dt-*`)
Nagłówek `.dt-head` (h1, nagłówek planu z PDF, „obowiązuje dziś” albo link `a.chip.dt-today` „Pokaż plan na dziś”), przełączniki
faza / rodzaj dnia jako segmenty o równych kolumnach. Siatka `.dt-grid`: kolumna boczna `.dt-aside` (kafel `.hero` kcal + makro,
karta `.dt-next` „Następny posiłek” z godziną i „Pokaż skład”, karta `.dt-stock` „Składniki w zapasach” — 3 najpilniejsze + link do
Zapasów) i główna `.dt-main` (nawigacja `.dt-nav` — posiłki z godziną i kcal, na telefonie przyklejona i przewijana w poziomie;
karty `.meal` w kolejności godzin z paskiem udziału makro `.dt-bar`; pozycje: nazwa, ilość, linia `.dt-mac`, przy pilnym braku
`.dt-stock-b`; zwinięte panele `.dt-extra`). ≥ 1100 px: kolumna boczna 340 px po prawej (przyklejona przy wysokości ≥ 940 px).

### Zapasy (Faza 5, klasy `zp-*`)
Nagłówek `.zp-head` (data, faza, rodzaj dnia). Przegląd `.dash` (`.zp-hbar` — udział pilnych/średnich/OK/bez stanu, legenda, najbliższy
brak). Siatka akcji `.actions` z `.zp-act` (ikona nad etykietą, 4 kolumny na telefonie, 7 od 700 px; „Zakupy” jako główna).
Kolumna `.zp-aside` (na telefonie przed listą): `.zp-shop` „Do kupienia” (data i liczba zakupów, 5 najpilniejszych z przyciskiem
„Kupione +ilość”, „Pełny plan zakupów”) i zwinięta `.daycard` „Korekta zużycia dnia”. Lista `.zp-main`: liczniki-filtry `.counters`
(kropka, liczba, etykieta), wyszukiwarka i sortowanie, kategorie `.pills`, wiersze `.inv-item` (nazwa + status, typ + „Wystarczy do” +
relacja do zakupów, pasek `.zp-run` z kreską dnia zakupów `.zp-run-s`, stan + „+ opakowanie” + `.zp-more` „Więcej” z porcjami, tagami,
usunięciem własnej pozycji), zwinięte `.zp-bulk`. Rozwinięcie sekcji przetrwa zapis (stan w pamięci karty).

### Meal Prep, Suplementacja, Bezpieczeństwo, Rekompozycja, Dane (Faza 5, klasy `mp-*`, `sp-*`, `sf-*`, `rk-*`, `dn-*`)
- **Meal Prep:** nagłówek `.hero-tr` (pierścień kroków, następny krok), nawigacja faz `.mp-jump`, karta `.mp-stock` „Składniki na jutro”
  (braki: potrzeba / zostanie, link do Zapasów), `.prep-card.is-next` (karta z następnym krokiem), `.mp-short` na kartach z brakami,
  minutnik 44 px; tabele i „Dlaczego tak” w zwijanych panelach `details.panel.fold`.
- **Suplementacja:** nagłówek `.sp-head` (liczba dawek, „następna pora”, link „do uzupełnienia”), dni w 7 równych kolumnach, oś dnia
  (`.tl-item.is-past` — tło `--sunken`, `.is-next` — ramka w akcencie i znacznik „następna”), `.sp-stock` pod osią (pilne i średnie,
  „Kupione”), tabela „Preparaty” z paskiem `.zp-run`.
- **Bezpieczeństwo:** `.sf-head`, wyszukiwarka 44 px, `.sf-count` z „Wyczyść filtry”, rozwijane „Przechowywanie i opakowanie” 44 px.
- **Rekompozycja:** `.rk-tools` (wyszukiwanie w treści, „Rozwiń / Zwiń wszystko”), `.rk-hits`, spis treści i sekcje zawężone do trafień.
- **Dane:** `.dn-head` (tryb uruchomienia, wersja), karta `.dn-sync` na górze (status niewysłanych zmian z ikoną, ostatnie wysłanie /
  import, przyciski z ikonami; na telefonie przyciski na pełną szerokość), dalej aktualizacja kodu, stan zapisu, kontrola, kopie.
- **Wspólne:** `details.panel.fold` — zwijany panel treści rzadkiej (Dieta, Meal Prep); `.dot-s.s-*` — kropki statusów zapasów.

### Dashboard „Dziś” (Faza 4, klasy `dz-*`; System 2.0 — D-110)
**D-110:** kolejność: nagłówek (telefon: tytuł i strzałki dni w jednym wierszu, etykiety strzałek tylko w `aria-label`) → skróty (jeden
przewijany wiersz) → **„Teraz”** (kolor bieżącego punktu `--dc`/`--hc`, kropka ze stałą poświatą (D-112 — bez pulsowania), pasek upływu czasu punktu `.dz-now-prog` /
`.dz-now-bar` i „zostało N min” `.dz-now-left`; przed pierwszym punktem „za N min · HH:MM”; odliczanie co 30 s przez `ctx.tick`, w miejscu)
→ „Wymaga uwagi” (zwarta lista: ikona poziomu, tekst najwyżej w 2 wierszach, pilne ze znacznikiem `--warning`) → kafle KPI (ikona
i pasek w kolorze domeny, liczba + jednostka `.unit`) → podsumowania (telefon: przewijany poziomo pas kart) → **plan dnia jako oś czasu**
(godzina | linia `--rail` z węzłem w kolorze domeny | karta `.slot-body`; bieżący punkt: większy węzeł z obwódką (D-112 — bez pulsowania), linia wypełniona
do upływu czasu `--el`, karta z poświatą; „Czas własny” — przerywana ramka; minione punkty — tło jak strona). Poświata tła strony
(`data-domain` na `<html>`) — kolor bieżącego punktu planu.

Nagłówek (`.dz-head`: h1, `.topline` z datą i plakietkami, `.daynav`) → skróty (`.quicklinks`, pigułki z ikonami) →
siatka `.dz-grid`: karta „Teraz” (`.nowcard.dz-now`, pierścień postępu dnia) · kafle `.stats.dz-kpis` (Dieta, Trening,
CFA, Zapasy; paski `.dz-bar`) · kolumna `.dz-aside` (karty `.dz-card`: Suplementy — **tylko liczba dawek i następna pora (D-041, D-064)**,
Meal prep, Zapasy, Plan CFA, Aktywność treningowa — siatka `.dz-grid-dots` 6 tyg. × 7 dni) · plan dnia `.dz-plan` > `.day` > `.slot`.
Punkty podziału: ≥ 1100 px dwie kolumny (boczna 320 px; przyklejona tylko przy wysokości okna ≥ 940 px, z `max-height` i przewijaniem
jako zabezpieczeniem — w niższym oknie przewija się ze stroną, żeby żadna karta nie była niedostępna); 600–1099 px karty boczne w 2 kolumnach;
kafle: 2 kolumny, 4 kolumny przy 700–1099 px i ≥ 1440 px; < 600 px jedna kolumna, skróty przewijane poziomo.

## 6. Mobile / iPhone
- Brak przewijania całej strony w poziomie (testowane automatycznie na każdym widoku).
- Cele dotykowe ≥ 44 px (przyciski, segmenty, pasek dolny, przełącznik motywu, wiersze „Więcej”).
- `viewport-fit=cover`; marginesy `env(safe-area-inset-*)` dla paska dolnego, okien i `:root`.
- Kolory PWA (D-067): `theme-color` = `--bg` motywu (skrypt w `<head>` ustawia go przed renderem, `applyTheme()` przy zmianie);
  manifest `background_color`/`theme_color` = `#090a0f` (ekran startowy w motywie domyślnym). Ikony aplikacji (D-110): znak „27”
w pierścieniu postępu na tle „aurora” — `tools/app_icons.py` (Playwright, Inter z `public/fonts`), treść w strefie bezpiecznej ikon maskowalnych. `apple-mobile-web-app-status-bar-style`
  = `default` (bez zmian, decyzja użytkownika).
- Jedna kolumna, kolejność od najważniejszego; szczegóły dostępne, nie ukryte na stałe.
- **Do weryfikacji na urządzeniu:** zachowanie arkuszy od dołu z klawiaturą, chowanie paska przy klawiaturze (iOS),
  rozmycie tła paska w PWA, render fontu Inter w PWA offline, kolor paska statusu i ekranu startowego PWA w obu motywach.

## 7. Dostępność
WCAG 2.1 A/AA (axe-core, `npm run a11y`) w obu motywach, także w stanach interakcji (odhaczone serie/bloki/kroki, rozwinięte sekcje,
okno techniki) — obecnie 0 naruszeń; kontrast par tokenów liczy `tests/unit/tokens.test.mjs` (axe nie ocenia tła z `color-mix()`). Widoczny fokus (`:focus-visible` 2 px akcent),
nawigacja klawiaturą (przewijane obszary fokusowalne), `aria-current`, `aria-pressed`, etykiety ikon-przycisków,
stan nigdy tylko kolorem (tekst/ikona obok), `prefers-reduced-motion`. **D-110:** także `prefers-reduced-transparency` i
`prefers-contrast: more` (bez szkła i poświat, mocniejsze ramki) oraz `forced-colors` (obramowania `CanvasText`, wskaźnik `Highlight`).
Testy axe czekają na koniec animacji czasowych (wejście ekranu i okna); animacje nieskończone (od D-112 żadnych w „Dziś”) i sterowane
przewijaniem (zanikanie krawędzi pasków — oś przewijania) są pomijane w tym oczekiwaniu.
Zmierzone kontrasty: tekst/tło 16,4 (jasny) i 16,5 (ciemny); akcent na karcie 6,9 / 8,2; `--muted` 4,8 / 6,0; ramka pola 3,4 (jasny) / 3,5 (ciemny) na `--surface`, 3,2 na `--surface-2`.
