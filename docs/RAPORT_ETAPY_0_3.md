# Audyt 25.09.2026 — Etapy 0–3: raport wdrożenia (D-088, D-089)

Zakres wg decyzji użytkownika (25.09.2026): **Etap 0** — plan od 25.09 (dni 21–24.09 poza planem), po sprawdzeniu ciągłości dat,
zużycia, synchronizacji i analizy danych; **Etapy 1–3 w całości bez I6, z I11**; **Etap 4 (P1, P2, D2, I9, I12) wstrzymany — nie wdrożono.**
Kolejność pracy: Etap 0 → testy → Etap 1 → testy → Etap 2 → testy → Etap 3 → testy końcowe → przegląd diffu.
Żadna funkcja nie wymagała zmiany modelu danych, synchronizacji ani zasad bezpieczeństwa (I11 — istniejący typ `setting`).

## 1. Etap 0 — start planu 25.09.2026 (D-088)

**Zmiany:** `phases.json` → `start: 2026-09-25`; `resolver.js` → `PLAN_START`, `inPlan()`; dzień przed startem = „poza planem”
(`dayPlan` zwraca dzień wolny bez sesji, sauny, recall, dawek). Dieta 25.09 = **NT** (wyjątek dnia; 2332 kcal). Zużycie w Zapasach
(`consumption.js`) = 0 przed startem. Statystyki i historia treningu, „ostatni wynik” oraz siatka aktywności liczą od `TRAIN_FROM` = 25.09.
Widoki: „Dziś” dla 21–24.09 — panel „Poza planem” z przejściem do 25.09 (bez przycisku „Poprzedni dzień” w dniu 25.09);
Trening — komunikat i brak licznika; Suplementacja — komunikat, 0 dawek.

**Kontrola bezpieczeństwa decyzji (przed wdrożeniem dalszych etapów):**

| Obszar | Wynik |
|---|---|
| Ciągłość dat i resolver | 730 dni (2026–2027) rozwiązuje się bez błędu; 0 luk między punktami planu dnia; 267 dni poza planem — żaden bez treningu/dawek/bloków; test ciągłości 01.01–24.09.2026 (`resolver.test.mjs`) |
| Zużycie zapasów | 0 dni ze zużyciem przed 25.09; każdy dzień od 25.09 do 31.03.2027 ma zużycie; inwentaryzacja z 22.09 odliczana od 25.09 (`inventory.test.mjs`) |
| Synchronizacja | typy zdarzeń, walidacja, `reduce()`, format `2027-sync.json` i chmura bez zmian; zdarzenia z 21–24.09 przechodzą przez eksport → import na drugim urządzeniu → identyczny stan, import idempotentny (`sync-compat.test.mjs`) |
| Odtworzenie i analiza | nic nie jest usuwane ani przenoszone do kwarantanny; zdarzenia sprzed startu zostają w dzienniku i w eksporcie (filtr działa tylko w widokach i obliczeniach planu); Diagnostyka w Dane pokazuje ich liczbę |

**Skutek dla Twoich danych:** stany Zapasów liczone z inwentaryzacji sprzed 25.09 (np. kopii z 22.09) nie odejmują już zużycia 23–24.09,
więc mogą być wyższe niż dotąd o zużycie tych dwóch dni. Jeśli chcesz stan dokładny — wpisz aktualny stan w Zapasach albo wczytaj nową
kopię JSON (import jest bezpieczny i idempotentny).

## 2. Etap 1 — poprawki (B1–B9)

| ID | Zmiana |
|---|---|
| B1 | Meal Prep: parametr `?d=` i nawigacja dni; karty „Wieczór poprzedniego dnia” (21:45–21:55) liczone z planu **na jutro** i pokazane po „Wieczorze” (kolejność dnia); odhaczenia pod datą strony. Wieczór 11.10 → płatki 85 g (Faza 1) |
| B2 | Błąd w oknie (np. „Podaj nazwę pozycji.”) widoczny w oknie; błędy zapisu w oknach Zapasów nie zamykają okna |
| B3 | Wspólny arkusz `sheet()` (`components.js`): nazwa dostępna (`aria-labelledby`), usunięcie z DOM także po Esc; Zapasy i Trening |
| B4 | Komunikaty po akcji w stałym obszarze nad dolnym paskiem (`#toast`, `aria-live`, 6 s, nie blokuje dotyku) |
| B5 | Fokus wraca na ten sam element po zapisie (przodek z `id` + pozycja), bez przewijania |
| B6 | 320 px: pasek dolny, legenda mięśni i przełącznik motywu bez przewijania w poziomie (sprawdzane w E2E na wszystkich trasach) |
| B7 | Zapasy: „✓ Wystarczy do zakupów (sob 17.10) · zapas pilny — na liście zakupów” zamiast sprzecznych sygnałów; klasyfikacja v31 bez zmian |
| B8 | `Store.recordMany()` — wiele zdarzeń w jednej transakcji i jednym przeliczeniu (plan zakupów, paragon, zeruj, lista fabryczna, przywrócenie stanu, „Oznacz cały dzień” w CFA). Te same typy i treści zdarzeń |
| B9 | Dokumentacja: D-083 przeniesiona do zastąpionych, REDESIGN-STATUS, CLAUDE.md (pułapki) |

## 3. Etap 2 — UX/UI, bezpieczeństwo, diagnostyka

| ID | Zmiana |
|---|---|
| U-a | „Dziś”: minione punkty dnia zwinięte („Minione punkty (N)”), plan zaczyna się od „teraz” |
| U-b | CFA → Harmonogram od dziś; minione dni zwinięte i budowane dopiero po rozwinięciu (bez filtrów „zaległe”/wyszukiwania) |
| U-c | Zapasy: wyszukiwanie podczas pisania (bez przerysowania — klawiatura na iPhonie zostaje), filtr „Do zakupów”, edycja własnej pozycji, „Opakowanie 1000 g” |
| U-d | Emoji w przyciskach Zapasów → ikony Lucide |
| U-e | Najmniejszy tekst 12 px (`--fs-2xs`) |
| U-f | Cele dotykowe ≥ 44 px (strzałki kart „Dziś”, odnośniki dni, spis treści, kalendarz, kroki Meal Prep, 7 dni Suplementacji) |
| U-g | Zapasy: podpowiedź „Stan = ilość na koniec dzisiejszego dnia” (`aria-describedby`) |
| U-h | Dane: ostrzeżenie o usuwaniu danych karty Safari po 7 dniach; ostrzeżenie o jawnym pliku synchronizacji (+ zalecenie Zaawansowanej ochrony danych iCloud) |
| U-i | „Przejdź do treści” (pierwszy element po Tab) |
| S1 | CSP w wariancie web (`<meta>`): skrypty i style tylko z tej samej domeny + skrót SHA-256 skryptu motywu; połączenia: ta sama domena, `https://*.supabase.co`, `localhost` (testy). Wariant `2027.html` bez CSP (wszystko wbudowane) |
| I8 | Dane → „Diagnostyka danych” (tylko odczyt): ujemne stany, pozycje bez inwentaryzacji > 14 dni, pozycje bez stanu, bloki CFA odhaczone z przyszłą datą, kwarantanna, zdarzenia z nowszej wersji, wpisy sprzed startu planu, zaległa wysyłka do chmury |

## 4. Etap 3 — funkcje (I1–I5, I7, I11; bez I6)

| ID | Zmiana |
|---|---|
| I1 | Dane → „Przypomnienia w kalendarzu”: plik `.ics` (RFC 5545) na 7/14/30/60 dni — pory suplementów, bloki CFA i recall, trening/basen/sauna, zakupy w sobotę; alarmy; strefa Europe/Warsaw z regułami czasu letniego; stałe UID (ponowny import aktualizuje, nie dubluje) |
| I2 | „Dziś” → „Wymaga uwagi”: braki przed zakupami, suplementy do uzupełnienia (tylko liczba — D-041), zaległe bloki CFA, nieodhaczone recall, koniec preparatów czasowych (14 dni), niewysłane zmiany / chmura, zdarzenia z nowszej wersji |
| I3 | „Dziś” → „Tydzień”: 7 dni z resolvera (trening, dieta i kcal, bloki, recall, zakupy, wyjątki; dni poza planem) |
| I4 | Wyszukiwanie w całej aplikacji (⌘K / Ctrl+K / „/”, przycisk w panelu i w „Więcej”): moduły, Zapasy, suplementy, ćwiczenia (najbliższy dzień sesji), bloki CFA, error log, Bezpieczeństwo, Rekompozycja; bez polskich znaków |
| I5 | Skróty: ⌘K, /, ← → (dni/tygodnie), g + litera (moduły), ? (lista skrótów) — tylko poza polami i oknami |
| I7 | Zapasy → Paragon: tekst („banan 1,2 kg”, „kefir 2 × 400 ml”, „płatki owsiane 2” = 2 opakowania) z podglądem i listą pominiętych; dotychczasowy JSON działa |
| I11 | CFA: odhaczanie recall 22:00 (dzień, pasek postępu, statystyka w „Plan”, znacznik w „Dziś”) — zdarzenie `setting` z kluczem `cfa.recall:RRRR-MM-DD` (bez nowego typu, synchronizowane jak każde ustawienie) |

## 5. Testy

Nowe testy jednostkowe: `diagnostics`, `attention`, `week`, `recall`, `ics`, `search`, `receipt`, `storage` (`recordMany`),
`sync-compat` (D-088), `training`/`resolver`/`inventory`/`plan-cfa` (D-088). Nowe bloki E2E: `run_audit_fixes` (Etap 1, w tym 320 px
na wszystkich trasach), `run_etap2`, `run_etap3` (zegar 11.10.2026 20:00). a11y: nowe widoki i stany (tydzień, dzień poza planem,
minione punkty, minione dni harmonogramu, komunikat po akcji, filtr zakupów, recall, wyszukiwanie, podgląd paragonu, błąd w oknie).

Zmiany w testach wymuszone przez zmiany struktury (zasada 9): licznik `.counters .counter` 3 → 4 (filtr „Do zakupów”); przycisk
„↩ Przywróć ten stan” → „Przywróć ten stan”; skrót fazy Meal Prep wybierany po `href`, nie po kolejności; oczekiwanie na
`.dz-plan-h` zamiast pierwszego `.slot` (U-a); `wait_for_function` → `wait_js` i axe przez CDP (CSP, S1).

**Wyniki (konfiguracja B — bez plików użytkownika, dane syntetyczne; każdy etap testowany osobno, końcowa regresja na kompletnym kodzie):**

| Etap | `npm test` | `npm run e2e` | `npm run a11y` | `npm run e2e:sync` | `npm run e2e:cloud` |
|---|---|---|---|---|---|
| 0 | 162 / 163 (+1 pominięty) | 1070 / 1070 | 0 naruszeń | 21 / 21 | 100 / 100 |
| 1 | 164 / 165 (+1) | 1101 / 1101 | 0 | 21 / 21 | 100 / 100 |
| 2 | 176 / 177 (+1) | 1138 / 1138 | 0 | 21 / 21 | 100 / 100 |
| 3 — końcowa | **178 / 179 (+1)** | **1171 / 1171** | **0 naruszeń, brak przewijania w poziomie** | **21 / 21** | **100 / 100** |

Pominięty: migracja kopii ZAPASY (wymaga `SOURCES_DIR`). Po drodze wykryte i naprawione: po S1 (CSP) narzędzia testowe
`wait_for_function`/`add_script_tag` → `wait_js`/CDP; po U-a testy czekające na pierwszy slot; kontrast `⌘K` i podpisów wyników
wyszukiwania na tle `--sunken` (jasny motyw); komunikat „Hasło szyfrowania poprawne” znikał przy przerysowaniu w tle po
automatycznej synchronizacji — komunikat sekcji chmury trwa teraz 10 s (tylko widok, bez zmian w synchronizacji); Esc w polu
wyszukiwania tylko czyścił tekst. Zrzuty 375 / 1440 px w obu motywach: Dziś, Tydzień, Meal Prep, Zapasy, Dane, CFA, wyszukiwanie,
paragon, harmonogram, dzień poza planem — bez przewijania w poziomie. Przegląd diffu: brak `innerHTML`, kluczy, adresów projektu.

## 6. Ograniczenia i kontrola ręczna
- Safari/WebKit nie jest dostępny w środowisku — do sprawdzenia na iPhonie (Safari i PWA) i MacBooku: import `.ics` do Kalendarza
  (Udostępnij / „Dodaj wszystkie”), alarmy; komunikaty nad dolnym paskiem; klawiatura przy wyszukiwaniu w Zapasach; CSP w Safari
  (brak błędów, działająca chmura); skróty na Macu; U-e (12 px) — czytelność i układ.
- `npm run verify` i test migracji kopii ZAPASY wymagają plików użytkownika — nieuruchomione (pominięte).
- Etap 4 nie wdrożony (decyzja użytkownika).
