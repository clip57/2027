# Raport D-110 — audyt designu i System 2.0 (24.10.2026)

> **D-112 (25.10.2026):** pulsowanie znacznika „teraz” usunięte, przewijanie i przeciąganie arkusza poprawione po kontroli na iPhonie — `docs/RAPORT_D112.md`.

Polecenie użytkownika (24.10.2026): „Zrób bardzo szeroko zakrojony audyt w całej aplikacji do poprawy jej designu żeby był bardziej
nowoczesny, futurystyczny, a jednocześnie praktyczny. Chcę żebyś użył maksimum możliwości swoich do tego i wprowadził jak najbardziej
zaawansowane możliwie rozwiązania.”

Zakres: wygląd i interakcja wszystkich 13 modułów, powłoki aplikacji (nawigacja, okna, komunikaty) i ikony aplikacji. **Bez zmian:** dane,
typy zdarzeń, `reduce()`, synchronizacja (plik i chmura), treści merytoryczne, klasy CSS używane przez testy, funkcje modułów.

## 1. Metoda audytu
- Zrzuty „przed” (wariant `2027.html`, dane syntetyczne D-065, zegar 19.10.2026 10:40): 24 widoki + 4 stany (okno techniki, licznik
  przerwy, wyszukiwanie ⌘K, komunikat po akcji) × 390 / 1280 px × motyw ciemny / jasny = 112 zrzutów; całe strony dla telefonu i komputera.
- Przegląd całej warstwy stylów (`tokens.css`, `styles.css` 949 wierszy, `system.css` 553 wiersze) i kodu powłoki (`app.js`, `components.js`).
- Pomiary w przeglądarce: przewinięcie po zmianie modułu, czas przerysowania trasy, kontrast kandydatów palety (skrypt WCAG dla par
  i dla tła zabarwionego kolorem domeny 6–18 %), krycie szkła nad najgorszym tłem.

## 2. Wyniki audytu (stan przed zmianą)
| # | Obszar | Problem | Waga |
|---|---|---|---|
| A1 | Nawigacja | po przejściu do innego modułu zostawało przewinięcie poprzedniego (np. Dieta przewinięta o 1500 px → Trening otwierał się w połowie) | wysoka (praktyczność) |
| A2 | Dziś — telefon | plan dnia ok. 3,5 ekranu poniżej góry: „Wymaga uwagi” (cały pierwszy ekran), „Teraz”, 4 kafle, 6 kart podsumowań jedna pod drugą | wysoka |
| A3 | Dziś — „Teraz” | brak informacji, ile czasu zostało w bieżącym punkcie; „punkt 7 z / 33” łamany | średnia |
| A4 | Dziś — „Wymaga uwagi” | każdy sygnał jako osobny zabarwiony kafel, do 4 wierszy tekstu; karta dominuje ekran | średnia |
| A5 | Dziś — plan dnia | lista oddzielnych kart z grubą krawędzią — brak ciągłości czasu; bieżący punkt tylko obramowany | średnia |
| A6 | Kafle KPI | wartość i jednostka tą samą wielkością („0 / 11 bloków” w dwóch wierszach na telefonie), brak znaku domeny | niska |
| A7 | Przełączniki | „Widok” CFA/MPW łamany w dwa nierówne wiersze (telefon i komputer — `.controls` w 2 kolumnach) | średnia |
| A8 | Nagłówek „Dziś” — telefon | strzałki dni jako dwa przyciski na całą szerokość (~60 px wysokości), skróty łamane | niska |
| A9 | Głębia | motyw ciemny płaski (`--e1` przezroczysty), wnętrza kart jako czarne „dziury” (`--sunken` #0a0b0e) | średnia |
| A10 | Pasek dolny | klasyczny pasek na całą szerokość, wskaźnik aktywnej sekcji — kreska 3 px | niska |
| A11 | Okna | brak uchwytu i zamykania przeciągnięciem na telefonie, tło za oknem nierozmyte, wyszukiwanie ⌘K jako zwykły arkusz | niska |
| A12 | Pierścienie, paski | jednolity kolor, brak związku z modułem w „Teraz” (pierścień w kolorze treningu w każdym punkcie) | niska |
| A13 | Kalendarz | dni poza planem jako ciężkie przerywane pola | niska |
| A14 | Tydzień, Pielęgnacja → tydzień | 7 kolumn od 1100 px — kolumny ~100 px, każdy wiersz łamany w 2–3 linie | średnia |
| A15 | Statystyki Treningu | wykres skalowany do szerokości — podpisy osi ~20 px, wykres ~370 px wysokości | niska |
| A16 | Trening — telefon | zakres tygodnia i „Poprzedni / Następny” w dwóch wierszach | niska |
| A17 | Spójność | strzałki rozwijania jako znak „▾” obok ikon Lucide | niska |
| A18 | Ikona aplikacji | napis „2027” i kolorowe kropki — bez związku z wyglądem aplikacji | niska |
| A19 | Panel boczny | przyklejony do krawędzi, aktywna pozycja zawsze w akcencie (bez koloru modułu) | niska |
| A20 | Wejście ekranu | zmiana modułu bez żadnego przejścia (skok treści) | niska |

## 3. Kierunek: System 2.0 — „głębia przez światło”
1. **Światło zamiast ozdób:** tło „aurora” — stała poświata u góry ekranu w kolorze bieżącego modułu (w „Dziś” — bieżącego punktu planu);
   karty z krawędzią światła (`--rim`) i miękkim cieniem także w motywie ciemnym; karty nagłówkowe z poświatą w kolorze modułu.
2. **Szkło tylko na elementach pływających** (nigdy na kartach z treścią): pasek dolny, panel boczny, pasek tytułu, nagłówek arkusza,
   liczniki przerwy, przyklejone skróty. Krycie dobrane tak, by `--text-2` i `--accent` miały ≥ 4,5:1 nad dowolną treścią
   (najgorszy przypadek: ciemny 0,82 nad wypełnieniem akcentu — 6,7:1; jasny 0,86 nad tekstem — akcent 5,1:1).
3. **Liczby jako główny element:** duże cyfry z ciasnym odstępem liter, jednostka pomniejszona, etykiety wersalikami z ikoną domeny.
4. **Czas jako oś:** plan dnia jako oś czasu, upływ bieżącego punktu (linia i pasek), odliczanie.
5. **Ruch z funkcją:** wejście ekranu, sprężysty nacisk, uchwyt arkusza, pulsujący znacznik „teraz”, odsłonięcie motywu; bez animacji
   przezroczystości treści poza wejściem ekranu.
6. **Preferencje systemu przed efektami:** mniej ruchu → bez animacji; mniej przezroczystości / więcej kontrastu → bez szkła i poświat;
   wymuszone kolory → obramowania systemowe.
7. **Granice kontrastu:** zabarwienie pod tekstem ≤ `--tint` (6 % jasny, 12 % ciemny) — `--muted` ≥ 5,0:1; poświata tła `--aur` (7 % / 16 %).

## 4. Wdrożone zmiany
### Tokeny (`src/ui/tokens.css`)
- Paleta: jasny chłodny (`--bg #f3f4f7`, `--sunken #eceef3`, `--text #12141a`, `--text-2 #454b57`, `--muted #626977`, ramki `#e2e5eb` / `#8a909c`),
  ciemny głębszy (`--bg #090a0f`, `--surface #12151c`, `--surface-2 #1a1e27`, `--sunken #0c0e14` — jaśniejsze wnętrza kart zamiast „dziur”,
  `--text #eef0f6`, `--text-2 #b6bccb`, `--muted #9198a8`); akcent i domeny bez zmian.
- Nowe: `--accent-hi`, `--btn`, `--btn-hover`, `--rail`, `--glass`, `--glass-border`, `--glass-blur`, `--rim`, `--e3`, `--aur`, `--tint`, `--glow-a`,
  `--brand-1/2`, `--brand-arc/-2`, `--brand-ink`, `--r-xl`, `--dur-3`, `--ease-out`, `--ease-spring` (`linear()` z przestrzeleniem, awaryjnie Bézier),
  `--fs-display`, `--track-*`, `--dock-b`, `--nav-space`, `--appbar-h`; promienie 10 / 14 / 20 / 28.
- Bloki preferencji: `prefers-reduced-motion` (czasy 0), `prefers-reduced-transparency` i `prefers-contrast: more` (`--glass` = powierzchnia,
  bez rozmycia i poświat).
- `tests/unit/tokens.test.mjs`: +7 par kontrastu (przycisk `--btn` z tekstem, opisem, metadanymi i `--danger`; `--accent-ink` na `--accent-hi`;
  `--accent` na `--accent-soft`; `--text-2` na `--bg`) — razem 30 par w obu motywach.

### Powłoka aplikacji (`src/app.js`, `src/ui/system.css`, `src/ui/components.js`, `src/ui/prefs.js`, `src/index.html`, manifest)
- **A1:** `navigate()` — nowy moduł lub widok (`v`) od góry, „Wstecz/Dalej” przywraca przewinięcie (pamięć per wpis historii, znacznik
  `history.state.p2027`), filtry i dni w obrębie widoku bez zmiany przewinięcia.
- **A20:** wejście ekranu `main[data-enter]` (moduł/widok — od dołu, kolejny/poprzedni dzień lub miesiąc — z boku), przerysowanie bez opóźnienia.
- **A10:** pływający szklany pasek dolny (pigułka 64 px nad wskaźnikiem Home, „soczewka” aktywnej sekcji, sprężysty nacisk); odstępy
  treści, komunikatów i liczników od dołu przez `--nav-space`.
- Pasek tytułu `.appbar` (telefon): szklany, pojawia się po przewinięciu poza nagłówek strony (`aria-hidden`, bez fokusu).
- **A19:** pływający szklany panel boczny, aktywna pozycja i ikony w kolorze domeny modułu, znak „27” w pierścieniu; poświata pod kursorem
  na kartach (komputer).
- **A11:** okna z rozmytym tłem i wejściem bez przezroczystości; arkusz na telefonie z uchwytem i **zamykaniem przeciągnięciem w dół**
  (`dragToClose`; poniżej progu wraca na miejsce); okrągłe „✕”; ⌘K na komputerze u góry ekranu z dużym polem.
- Zmiana motywu z odsłonięciem kołem od przycisku (View Transitions; wybór zapisany od razu).
- Komunikat po akcji: pływająca karta z wejściem sprężystym.
- `theme-color` i manifest: `#090a0f` / `#f3f4f7`.
- **A18:** nowa ikona aplikacji — „27” w pierścieniu postępu na tle „aurora” (`tools/app_icons.py`: SVG → Playwright → PNG 180/192/512 +
  maskowalna 512, paleta 256 kolorów z ditheringiem; treść w strefie bezpiecznej).

### Komponenty wspólne
- Przyciski: krawędź światła, główny z gradientem `--accent-hi → --accent` i poświatą, sprężysty nacisk; pola z „halo” fokusu.
- **A7:** segmenty bez łamania wierszy (przewijanie w poziomie), `.controls` w wierszu na komputerze.
- Zanikanie krawędzi przewijanych pasków (segmenty, skróty, dni, filtry, pas podsumowań) **tylko gdy jest co przewinąć** — animacja
  sterowana przewijaniem (`animation-timeline: scroll(self inline)`, zarejestrowane `--fade-l/--fade-r`); bez obsługi — bez maski.
- **A12:** pierścienie postępu z gradientem i poświatą w kolorze domeny (`--ring`), paski z połyskiem.
- **A17:** kreślone strzałki rozwijania (posiłki, zwijane panele, sekcje Rekompozycji).
- **A15:** wykresy z wysokością ≤ 260 px.

### Moduły
- **Dziś (A2–A6, A8):** „Teraz” przed „Wymaga uwagi”; karta „Teraz” w kolorze bieżącego punktu z pulsującą kropką, paskiem upływu
  czasu i „zostało N min” (przed pierwszym punktem „za N min”), odliczanie co 30 s w miejscu (`ctx.tick`); „Wymaga uwagi” jako zwarta
  lista (tekst ≤ 2 wiersze, pilne ze znacznikiem); kafle KPI z ikoną i paskiem w kolorze domeny, jednostka pomniejszona (tekst kafla
  bez zmian); podsumowania jako przewijany pas kart na telefonie; plan dnia jako **oś czasu** (węzły w kolorze domeny, linia bieżącego
  punktu wypełniana upływem czasu `--el`, karta z poświatą, plakietka „teraz” w kolorze domeny); nagłówek na telefonie: tytuł i strzałki
  w jednym wierszu; skróty w jednym przewijanym wierszu; poświata tła w kolorze bieżącego punktu.
- **Trening (A16):** pasek dni z wybranym dniem w gradiencie akcentu, karty ćwiczeń z odznaką numeru, odhaczona seria z połyskiem
  (kolor tła bez zmian — kontrast mierzony testem), pola serii jako wnętrza `--sunken`, „Następna seria” w kolorze domeny, szklany
  licznik przerwy; tydzień na telefonie w jednym wierszu (strzałki bez etykiet, nazwa w `aria-label`).
- **Dieta:** duża liczba kcal, paski makro z połyskiem, „Następny posiłek” z poświatą akcentu, nawigacja posiłków jako karty.
- **Zapasy:** pasek stanu magazynu z odstępami i poświatą segmentów, siatka akcji z podświetleniem, pozycje pilne z czerwonym zabarwieniem od lewej.
- **CFA / MPW:** wiersze bloków w kolorze domeny, litera bloku w kolorze CFA, ukończone — zielone zabarwienie.
- **Kalendarz (A13), Tydzień (A14), Pielęgnacja:** dni poza planem lekkie, dzień bieżący z poświatą akcentu; tydzień w 7 kolumnach od 1500 px
  (wcześniej siatka kart ≥ 200 px).
- **Suplementacja, Meal Prep, Bezpieczeństwo, Rekompozycja, Dane, Więcej:** wspólne komponenty (oś dnia z węzłami, szklane przyklejone
  skróty pod paskiem tytułu, ikony modułów w „Więcej” z gradientem domeny).

## 5. Rozważone i odrzucone / ograniczone
- **View Transitions przy zmianie trasy** — wdrożone, zmierzone i wycofane: przerysowanie czekało na przechwycenie starego obrazu
  (+50–300 ms przy renderowaniu bez GPU — testy CI i automatyczne odczytywały stary widok; ryzyko niestabilności). Zastąpione wejściem
  ekranu animacją CSS; View Transitions zostały tylko przy zmianie motywu.
- **Animowany kolor poświaty przy zmianie modułu** (`@property --amb` + `transition`) — całoekranowe przemalowywanie przez 0,6 s
  przy każdej zmianie modułu; kolor zmienia się od razu.
- **Animowane liczniki KPI, „pękanie” odhaczonych serii** — tekst zmieniający się w trakcie (czytniki ekranu, testy) i animacja
  powtarzana przy każdym punktowym odświeżeniu; pominięte.
- **Przesuwanie palcem między dniami** — konflikt z przewijanymi w poziomie paskami i gestem „wstecz” Safari; zostają strzałki i ← →.
- **Zwijanie „Wymaga uwagi” do 3 sygnałów** — testy i czytniki czytają całą listę; zamiast tego zwarta lista z tekstem ≤ 2 wiersze.

## 6. Zmienione pliki
`src/ui/tokens.css`, `src/ui/system.css`, `src/ui/styles.css` (pierścienie, odstępy od paska dolnego), `src/ui/components.js`
(pierścień z gradientem, `dragToClose`), `src/ui/prefs.js` (`saveTheme`, kolory paska przeglądarki), `src/app.js` (`navigate`, pasek tytułu,
`switchTheme`, poświata kursora, `data-domain`), `src/modules/dzis.js` (`slotClock`, karta „Teraz”, kafle KPI, `--el`, kolejność),
`src/modules/mealprep.js` i `src/modules/pielegnacja.js` (nazwa strzałek dni w `aria-label` — na telefonie strzałki bez etykiet),
`src/index.html` i `public/manifest.webmanifest` (kolory), `public/icons/*.png` + `tools/app_icons.py` (nowe), testy:
`tests/unit/tokens.test.mjs` (+7 par), `tests/unit/day-clock.test.mjs` (nowy), `tests/e2e/e2e.py` (`run_d110`; oczekiwanie na koniec
animacji pomija animacje sterowane przewijaniem; motyw systemowy — oczekiwanie na zastosowanie zamiast stałych 200 ms; próg 43,5 px),
`tests/e2e/a11y.py` (oczekiwanie na koniec animacji przed axe), `tests/e2e/cloud_sync.py` (próg 43,5 px).
Dokumentacja: `REDESIGN-SPEC.md`, `REDESIGN-DECISIONS.md` (C10), `REDESIGN-TESTING.md`, `REDESIGN-STATUS.md`, `DECYZJE_2027.md` (D-110), `CLAUDE.md`.
Bez zmian: `src/core/**`, `src/data/**`, `tools/build.mjs` (w tym `sw.js`), typy zdarzeń, klasy CSS używane przez testy.

## 7. Testy
Przebieg na końcowym buildzie (24.10.2026, oba warianty buildu, dane syntetyczne D-065, bez plików użytkownika):

| Zestaw | Wynik |
|---|---|
| `npm test` (jednostkowe) | 247 testów: 246 zaliczonych, 1 pominięty (migracja kopii ZAPASY — wymaga plików użytkownika), 0 niezaliczonych; nowe: `day-clock.test.mjs` (3), +7 par w `tokens.test.mjs` |
| `node tools/verify/plan_check.mjs` | 0 błędów, 3 znane ostrzeżenia (D-101) |
| `verify_all.py --data-only` | OK |
| `python3 tests/e2e/cfa_smoke.py` | 0 błędów |
| `npm run e2e` | 1517 / 1517 (w tym 28 kontroli `[D-110]` w `run_d110`: przewinięcie po zmianie modułu i powrót „Wstecz”, wejście ekranu, pasek tytułu, poświata `data-domain`, „Teraz” przed „Wymaga uwagi”, odliczanie i `--el`, zamykanie arkusza przeciągnięciem, pierścień z gradientem, poświata kursora, preferencje ruchu i przezroczystości) |
| `npm run a11y` | 0 naruszeń axe (wszystkie widoki i stany × 390 / 1280 px × jasny / ciemny), bez przewijania w poziomie |
| `npm run e2e:trening` | 0 błędów |
| `npm run e2e:sync` | 23 / 23 |
| `npm run e2e:cloud` | 100 / 100 |

Zmiany w testach (bez osłabiania sprawdzeń treści): oczekiwanie na koniec animacji pomija animacje sterowane przewijaniem
(`a.timeline !== document.timeline` — w `getAnimations()` są zawsze „w toku”); motyw systemowy — oczekiwanie na zastosowanie zamiast
stałych 200 ms; próg elementów dotykowych 43,5 px zamiast 44 (`e2e.py` ×2, `cloud_sync.py`) — w trakcie animacji wejścia
`getBoundingClientRect()` zwraca 43,9999 px dla elementu 44 px; elementy poniżej 44 px nadal są wykrywane.

**Pomiar praktyczności (A2, „Dziś” na telefonie, te same dane i zegar, cała strona):**

| Szerokość | Początek „Planu dnia” — przed | po | Karta „Teraz” — przed | po |
|---|---|---|---|---|
| 375 px | 2427 px (2,99 ekranu) | 1470 px (1,81 ekranu) | 798 px | 208 px |
| 390 px | 2388 px | 1458 px | 777 px | 208 px |

„Teraz” jest teraz na pierwszym ekranie; plan dnia o ok. 1,2 ekranu wyżej (podsumowania w przewijanym pasie, zwarta lista
„Wymaga uwagi”, nagłówek w jednym wierszu).

**CI i poprawka po przebiegu (24.10.2026):** „Testy 2027” dla `c80d6ea` — zielone. Kolejny przebieg (`b47a566`, tylko dokumentacja)
— 1516/1517: „Dane: synchronizacja jako pierwsza sekcja” odczytała `['Stan zapisu', 'Aktualizacja aplikacji']`. Przyczyna (sprzed D-110):
`renderDane` wstawiał stronę z pustym miejscem na synchronizację i wypełniał je dopiero po `await cloudSection(ctx)` — sekcja
wskakiwała nad „Stan zapisu” (skok układu widoczny także dla użytkownika), a test czytał stronę w tej chwili. Odtworzone lokalnie przy
6-krotnym spowolnieniu CPU (3 / 20 przejść). Poprawka w `src/modules/dane.js`: sekcja chmury liczona przed wstawieniem treści —
pierwsza sekcja pojawia się razem z resztą (0 / 20); test bez zmian.

## 8. Weryfikacja ręczna (urządzenia — poza zasięgiem testów automatycznych; środowisko nie ma WebKit)
iPhone (Safari i aplikacja z ekranu początkowego): pływający pasek dolny nad wskaźnikiem Home (nie zasłania treści, chowa się przy
klawiaturze), pasek tytułu po przewinięciu, arkusze — uchwyt i zamykanie przeciągnięciem, szkło (rozmycie) w PWA, oś czasu i odliczanie
w „Teraz”, Ustawienia → Dostępność → „Ogranicz przezroczystość” / „Zwiększ kontrast” / „Ogranicz ruch” — aplikacja bez szkła / bez animacji.
**Ikona na ekranie początkowym:** iOS zostawia starą ikonę do ponownego dodania aplikacji, a **usunięcie aplikacji z ekranu początkowego
usuwa jej bazę danych** (osobną od Safari). Nowa ikona nie jest potrzebna do działania — jeśli ma się pojawić: najpierw „Synchronizuj teraz”
(chmura) albo eksport pliku synchronizacji w Dane, dopiero potem usunięcie i ponowne dodanie, potem synchronizacja lub import.
MacBook (Safari i Chrome): pływający panel boczny, poświata pod kursorem, odsłonięcie motywu, ⌘K u góry ekranu.
