# Raport D-114 — System 4.0 „Instrument”, etap 1: fundament i prototyp

Decyzja użytkownika (18.11.2026) do `docs/RAPORT_AUDYT_2026-11-10.md`: „Zajmij się na razie tylko designem. Akceptuję wszystkie rekomendacje
z nim związane. „Instrument” niech będzie głównym motywem.” Zapis decyzji: `docs/DECYZJE_2027.md` (D-114), `docs/REDESIGN-DECISIONS.md` (C14).

Zgodnie z przyjętym procesem (§6.7 audytu) etap 1 to **fundament i prototyp dwóch ekranów — „Dziś” (tarcza, pigułka, gesty) i tryb skupienia
Treningu** — do sprawdzenia przed przebudową pozostałych modułów. **Stan: etap 1 zaakceptowany 18.11.2026; etap 2 (wszystkie moduły) wykonany — gałąź robocza `claude/eager-newton-j2309e`, bez publikacji na `main`.**

## 1. Zakres

| Część | Co zrobione |
|---|---|
| Warstwy kaskady | `@layer legacy, instrument` w `tools/build.mjs`: style do D-113 w `legacy` (kolejność plików bez zmian), nowy system w `src/ui/instrument.css`, zawsze nad `legacy` — bez wyścigu specyficzności. Sprawdzone przed zmianami wyglądu: **92 z 96 zrzutów (24 widoki × 390 / 1280 px × ciemny / jasny) identyczne piksel w piksel**; 4 różnice — numer wersji w „Dane”. |
| Tokeny 4.0 (`tokens.css`) | Kolory zapisane w **OKLCH** (te same 73 kolory — każdy przelicza się dokładnie na dotychczasowy kolor 8-bitowy); w motywie ciemnym jaśniejsze, bardziej nasycone kolory danych (domeny, stany), w granicach gamutu sRGB. **Skala pisma 8 stopni** `--t-1…--t-8` (12–48 px; `--fs-*` jako aliasy — 43 wartości zastąpione skalą tam, gdzie używano tokenów), `--t-giant` (tryb skupienia). **4 promienie** 6 / 10 / 14 / 20 px. Linie i podziałki przyrządów `--hair`, `--tick`, `--tick-hi`; tarcza `--face`; poświata danych `--lum` (1 ciemny, 0 jasny). Ruch: `--dur-1…--dur-4`, `--ease-emph`. |
| Głęboka czerń (OLED) | Ustawienia → „Głęboka czerń (OLED)” (preferencja urządzenia `p2027.oled`, atrybut `data-oled`, tylko motyw ciemny): czarne tło i pasek przeglądarki, powierzchnie lekko uniesione; stosowana przed pierwszym renderem (`index.html`). |
| Tarcza dnia | `src/ui/dial.js`: pierścień 24 h — północ na dole, 06:00 po lewej, południe u góry, 18:00 po prawej (dzień idzie jak słońce). Łuki punktów planu w kolorach domen (minione przygaszone, „czas własny” neutralnie), upływ bieżącego punktu jako jasny łuk, wewnętrzny łuk postępu dnia, wskazówka „teraz”, podziałka godzin. W środku: dzień, godzina, „punkt N z M”. **Dotknięcie lub przeciągnięcie po pierścieniu** — podgląd punktu (godziny, tytuł, „za … / minął”); **klawiatura** (rola slider): ← → punkty, Home / End, Enter — punkt w planie (przewinięcie i rozbłysk), Esc — powrót do „teraz”. Odświeżanie w miejscu co 30 s (`ctx.tick`), bez animacji ciągłych; „włączenie przyrządu” raz na uruchomienie. W dniu innym niż dziś — tarcza jako podgląd planu dnia (bez wskazówki). |
| „Teraz” w „Dziś” | Tarcza + odczyt (etykieta, tytuł, pasek upływu, „zostało …”, następny punkt, „Pokaż w planie”). **M8:** bez pierścienia postępu dnia (postęp pokazuje tarcza). Telefon — tarcza nad odczytem; od 600 px — obok. |
| Pigułka „na żywo” | `src/ui/live.js`, element `#live` poza `#app`: **przerwa między seriami → działający minutnik → bieżący punkt planu**; w każdym module, ukryta tam, gdzie moduł pokazuje to samo (punkt planu w „Dziś”, pasek przerwy w Treningu, minutnik na stronie, z której go uruchomiono) i w trybie skupienia. Przerwa: „+30 s”, „Zakończ przerwę”, sygnał końca także poza Treningiem; odliczanie w tytule karty. Stan przerwy wspólny z Treningiem (`restNow` / `setRest`). Telefon — nad paskiem dolnym; komputer — prawy dolny róg. |
| Gesty | `src/ui/gestures.js` (`swipeRow`): **przesunięcie wiersza dawki w planie dnia** — w prawo „Przyjęte”, w lewo cofnięcie; karta serii w trybie skupienia — w prawo „Seria wykonana”. Zdarzenia dotyku z decyzją w pierwszym ruchu (poziomo — gest, pionowo — przewijanie; D-112), warstwa akcji pod wierszem, ignorowana krawędź ekranu (gest „wstecz”). Każdy gest ma odpowiednik przyciskiem. |
| Ruch jako odpowiedź | `src/ui/motion.js`: jednorazowe animacje tylko tego, co się zmieniło — liczba w kaflu „przeskakuje” po zmianie, zatwierdzenie dawki, rozbłysk punktu planu; przygotowane `sweep` (łuk / pasek od poprzedniej wartości) i `flip` (lista z kluczami) dla etapu 2. Treść od razu ma wartość końcową (czytniki ekranu i testy), animacja jest tylko wizualna. Ograniczenie ruchu — bez animacji. |
| Tryb skupienia Treningu | `#/trening?v=fokus` (przycisk „Tryb skupienia” przy następnej serii), `src/modules/trening_focus.js`: pełny ekran bez nawigacji (`html[data-focus]`), podziałka sesji (kreska na serię), ćwiczenie i plan, **jedna seria naraz**: duże cyfry ciężaru i powtórzeń (pole + kroki ±; seria kroków = jeden zapis po chwili), RIR 0–4, podpowiedź z poprzedniej serii / ostatniej sesji (szara, zapisuje się dopiero po potwierdzeniu), „Seria wykonana” albo przesunięcie karty → **przerwa z pierścieniem** (+30 s, Pomiń) i następna seria; poprzednia / następna seria (← → na komputerze), technika ćwiczenia, ekran podsumowania sesji. **Ekran nie gaśnie** (Screen Wake Lock, `src/ui/wakelock.js`, odnawiany po powrocie do aplikacji). Wyjście: ✕ albo Esc. Zapisy `train.set` identyczne jak w widoku sesji. |
| Dźwięki interfejsu | `sfx()` w `signal.js`: krótkie kliknięcie przy odhaczeniu i dwa tony przy ukończonej sesji — Ustawienia → „Dźwięki interfejsu” (`p2027.sfx`, domyślnie wyłączone); sygnał minutników — jak dotąd, osobno. |
| Drobne z audytu | **M1** Bezpieczeństwo: etykiety faktów karty bez nachodzenia przy 390 px. **M2** Statystyki i Historia z nagłówkiem `h1`. **M3** Statystyki: bez tygodni sprzed startu treningów, zamiast pustych wykresów — opis. **M4** ikony Lucide zamiast emoji w Treningu (arkusze, rozgrzewka / schłodzenie, ostrzeżenia, poziomy kolana jako kolorowe kropki) i Rekompozycji (kłódka, ramki). **M8** — jw. |

## 2. Dane i zgodność

- **Bez nowych typów zdarzeń, bez zmian `reduce()`, bazy, synchronizacji i formatu `2027-sync.json`.** Tryb skupienia zapisuje te same
  zdarzenia `train.set` co widok sesji (bieżący stan serii czytany z magazynu w chwili zapisu, zapisy w kolejce).
- Nowe preferencje urządzenia (localStorage, poza dziennikiem): `p2027.oled`, `p2027.sfx`.
- Stan przerwy i minutników — jak dotąd tylko w pamięci karty (nie w dzienniku); od D-114 wspólny dla Treningu i pigułki.
- Bieżący punkt planu: `slotClock` / `currentSlot` przeniesione do `src/core/calc/now.js` (re-eksport w `dzis.js` — bez zmian zachowania).

## 3. Wpływ na pozostałe moduły (etap 2 dopiero przebuduje ich układ)

Wspólne tokeny działają w całej aplikacji od razu: ostrzejsze rogi (promienie 6 / 10 / 14 / 20 px), skala pisma (dawne `--fs-stat` 24 → 22 px,
`--fs-kpi` 44 → 48 px), jaśniejsze kolory danych w motywie ciemnym, pigułka „na żywo”, ikony zamiast emoji. Układ Meal Prep, Pielęgnacji,
Rekompozycji, Danych, Kalendarza, Diety, Zapasów, Suplementacji i nauki — bez zmian w tym etapie.

## 4. Testy

| Zestaw | Wynik |
|---|---|
| Jednostkowe (`npm test`) | 275 / 275 (+ 1 pominięty — migracja kopii ZAPASY wymaga `SOURCES_DIR`) (nowe: `instrument.test.mjs` — geometria tarczy, zgodność z bieżącym punktem planu, przerwa; `tokens.test.mjs` — OKLCH, OLED, gamut) |
| E2E (`npm run e2e`, z `run_d114`: 71 kontroli w obu wariantach) | **1650 / 1650**; blok `run_d114` ponownie po ostatniej poprawce (zatwierdzenie serii z wartości w polach) — 71 / 71 |
| `npm run a11y` | 0 naruszeń (bez przewijania w poziomie) |
| `npm run e2e:trening` | 0 błędów (118 kontroli) |
| `npm run e2e:sync` | 23 / 23 |
| `npm run e2e:cloud` | 100 / 100 |
| `plan_check` · `verify_all --data-only` · `cfa_smoke` | 0 błędów (3 ostrzeżenia jak dotąd) · 0 błędów (1 kontrola źródłowa pominięta — brak `SOURCES_DIR`) · 0 błędów |
| Regresja wizualna warstw (zrzuty piksel w piksel, 96 renderów) | 92 identyczne, 4 — numer wersji w „Dane” |

Testy wykryły w trakcie pracy i naprawione przed commitem: przesłonięcie funkcji pomocniczej w tarczy (wariant web bez „Dziś”), kolizję pigułki z paskiem
minutnika Pielęgnacji i komunikatami na komputerze (pigułka przeniesiona do lewego dolnego rogu kolumny treści i chowana przy pasku modułu),
wskazówkę widoczną w dniu innym niż dziś (`hidden` na SVG), układ „Dziś” innego dnia na telefonie (`grid-area` bez nazwanych obszarów).

CI: przebieg 20 „Testy 2027” zatrzymał się na instalacji Chromium — `ubuntu-latest` to od listopada 2026 Ubuntu 26.04, nieobsługiwane przez
Playwright 1.56 (błąd niezależny od zmian; dotyczyłby też publikacji z `main`). Poprawka: `runs-on: ubuntu-24.04` w `testy.yml` (`c1f03de`) — przebieg 21 „Testy 2027” na tym obrazie: **wszystkie kroki zaliczone**.

Zmienione oczekiwania testów (świadome zmiany): D-110 „pierścień »Teraz« z gradientem” → tarcza z upływem punktu (M8; gradient pierścienia sprawdzany
w Treningu); kolor tła motywu jasnego porównywany po przeliczeniu na sRGB (tokeny w OKLCH). Poprawiony test zależny od daty uruchomienia
(zakładka „CFA” / „MPW” — teraz wg zegara testu; od 12.11 dawał fałszywy błąd niezależnie od zmian).

**Etap 2 (pełna regresja na buildzie etapu 2, 18.11.2026):** jednostkowe 275 / 275 · E2E **1696 / 1696** (z `run_d114b`: 46 kontroli w obu wariantach) ·
a11y 0 naruszeń · Trening 0 błędów · `e2e:sync` 23 / 23 · `e2e:cloud` 100 / 100 · `plan_check`, `verify_all --data-only` (13 kontroli, 1 źródłowa pominięta), `cfa_smoke` — 0 błędów ·
porządki legacy: 120 zrzutów piksel w piksel — 115 identycznych, różnice tylko numer wersji w „Dane” i szum wygładzania paska górnego.
Wykryte w trakcie i naprawione: cel dotykowy zakładki widoku < 44 px (CFA „Dzień” / „Error log” — `min-width: 44px`), odświeżanie punktowe harmonogramu CFA
różne od pełnego przerysowania (gesty dołączane teraz obserwatorem dodanych węzłów, jednakowo w obu ścieżkach), gesty w testach pod pigułką / paskiem.

## 5. Ograniczenia

- Testy w Chromium (brak WebKit w środowisku): gesty dotyku, tarcza i tryb skupienia wymagają sprawdzenia na iPhonie (Safari i aplikacja z ekranu początkowego).
- Blokada wygaszania ekranu: iPhone — aplikacja z ekranu początkowego od iOS 18.4 (wcześniej i w razie odmowy ekran gaśnie jak zwykle, bez komunikatu).
- Haptyka niedostępna dla przeglądarek na iPhonie (oficjalnie) — gesty bez wibracji; dźwięki interfejsu opcjonalne.
- Pigułka „na żywo” na telefonie zajmuje pas nad paskiem dolnym (treść i komunikaty przesunięte wyżej); minutniki i przerwa — w pamięci karty (po przeładowaniu znikają, jak dotąd).
- Gest przesunięcia w prototypie: dawki w planie dnia i karta serii; pozostałe listy (zakupy, kroki, bloki) — etap 2.

## 6. Etap 2 (akceptacja prototypu 18.11.2026: „Akceptuję, przejdź do etapu 2”)

| Część | Co zrobione |
|---|---|
| Jedna anatomia strony | Dawne karty-bohaterowie (Trening, CFA / MPW, Meal Prep, Pielęgnacja, Rekompozycja) są nagłówkiem strony: tytuł krojem tytułowym, nadtytuł w kolorze modułu (`--mod` z `data-domain`), przyrząd (pierścień) po prawej, linia pod nagłówkiem; pola robocze w nagłówku (następna seria, czas treningu, następny krok) — jako karty. Przełącznik widoków każdego modułu („Widok”) — jednolity pasek zakładek z podkreśleniem w kolorze modułu (`segmented()` dodaje `.is-view`; etykieta tylko dla czytników ekranu). |
| Płaskie listy | Bloki nauki (CFA, MPW, karta MPW w „Dziś”) — wiersze rozdzielone linią zamiast kart w karcie, następny blok ze znacznikiem; „Składniki na jutro” w Meal Prep — wiersze z linią zamiast żółtej krawędzi przy każdym. |
| Gesty na listach | Przesunięcie w prawo zaznacza, w lewo cofa — dawki (Suplementacja), bloki nauki, serie (Trening), kroki Meal Prep i Pielęgnacji, lista w trybie zakupów. Reguły `SWIPE_RULES` w `gestures.js` (wiersz → kontrolka; gest wywołuje tę samą kontrolkę, więc te same zapisy), dołączane po przerysowaniu (`app.js`), do każdego później dodanego fragmentu (obserwator `MutationObserver` na `#app` w `app.js` — także odświeżanie punktowe P2) i w oknach (`sheet()`). |
| Tryby skupienia | Wspólna powłoka `src/ui/focus.js` (pasek, podziałka, pierścień minutnika, klawiatura). **Nauka** (`#/cfa?v=fokus`, `#/mpw?v=fokus`, `study_focus.js`; przycisk „Tryb skupienia” przy następnym bloku dnia): jeden blok naraz — temat, źródło, zadania bloku, minutnik 53 min (ten sam co w widoku dnia, widoczny w pigułce po wyjściu), „Blok wykonany”, poprzedni / następny. **Gotowanie** (`#/mealprep?v=fokus`, przycisk „Tryb gotowania”): krok po kroku, minutnik przy kroku z czasem, zapis `prep.step` jak w karcie. Ekran nie gaśnie w każdym trybie skupienia. |
| Wykresy interaktywne | `charts.js` (`barChart`, `lineChart`, `areaChart`): wartość pod kursorem (komputer) i pod palcem (telefon: przesunięcie poziome — odczyt, pionowe — przewijanie); serie nazwane (plan / wykonane, stan / prognoza). |
| Własny pasek i pulpit | Ustawienia → „Pasek i pulpit”: cztery zakładki paska dolnego (pozostałe moduły w „Więcej”, „Domyślne” przywraca zakładki z rejestru — CFA / MPW wg daty) i karty widoczne w „Dziś” (preferencje urządzenia `p2027.tabs`, `p2027.cards`). |
| Dane | Na komputerze (≥ 1100 px) dwie kolumny sekcji (synchronizacja plikiem obok chmury) — bez pustej połowy ekranu. |
| Porządki w `legacy` | Usunięte **389 deklaracji zawsze nadpisanych** przez późniejszą regułę z tym samym selektorem (skrypt na drzewie CSS; bez wartości zapasowych w tej samej regule i bez par skrót / właściwość szczegółowa). Sprawdzone zrzutami: 115 ze 120 identycznych piksel w piksel, różnice — numer wersji w „Dane” i szum wygładzania w pasku górnym. Źródło stylów `legacy` 217 → 207 KB. Pełne przeniesienie reguł modułów z `legacy` do `instrument` (cel ok. 35–45 % mniej CSS) — dalej moduł po module, przy kolejnych zmianach. |
| Strażnik wizualny | `tools/visual/snap.py` (wszystkie widoki, 390 / 1280 px, motywy, dane syntetyczne, stały zegar) i `tools/visual/compare.py` (piksel w piksel) — zmiana stylów bez zmiany wyglądu = 0 różnic. Katalogi zrzutów poza repozytorium. |

Testy etapu 2: blok `run_d114b` w `e2e.py` (anatomia, tryby skupienia Nauki i gotowania, gesty na listach, odczyt wykresu, pasek dolny, karty „Dziś”, Dane, dostępność) — wyniki pełnej regresji w §4.

## 7. Dalej (poza etapem 2)

- Publikacja na `main` — na polecenie użytkownika (potem kontrola na iPhonie: tarcza, gesty, tryby skupienia, blokada ekranu, pigułka).
- Przenoszenie pozostałych reguł modułów z `legacy` do `instrument` przy kolejnych zmianach (strażnik: `tools/visual`).
- Wybór zakresu na wykresach (4 tyg. / 3 mies. / rok) i „Horyzont” (oś czasu od minuty do dekady) — drugi krok z audytu, po silniku planów.
- Tryb skupienia Zakupów — dziś tryb zakupów jest oknem z gestami; pełny ekran po sprawdzeniu w sklepie.
