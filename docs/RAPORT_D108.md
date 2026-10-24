# Raport D-108 — ryzyka R1–R4 i ulepszenia U1–U8 z audytu 23.10.2026 (24.10.2026)

Zlecenie użytkownika (24.10.2026): „Zrób wszystkie ulepszenia U1–U8 oraz napraw wszystkie ryzyka R1–R4”. Źródło listy:
`docs/RAPORT_AUDYT_2026-10-23.md` §4–§5. Decyzje D1–D3 (MPW a plan dnia od 16.11, egzamin CFA 12.11 w „Dziś”, święta i zakupy) — **bez zmian**,
czekają na decyzję użytkownika.

**Bez zmian:** dane planu (`src/data/*.json` — podział planów robi build, pliki źródłowe nienaruszone), typy zdarzeń, klucze LWW, `reduce()` i wynik
dla istniejących danych, format `2027-sync.json`, wyzwalacze i interwały synchronizacji (D-084/D-085), logika `sw.js` (lista `SHELL` dostała plik
zadań MPW), szablon godzin dnia.

## 1. Ryzyka

| # | Ryzyko | Rozwiązanie | Pliki |
|---|---|---|---|
| R1 | Wiersz z chmury odrzucony przez walidację tej wersji (znany typ, treść spoza zakresu — np. z nowszej wersji o szerszej walidacji) trafiał do „widzianych” i przepadał — po aktualizacji aplikacji nie wracał | Odszyfrowany wiersz o poprawnej kopercie, którego treści ta wersja nie przyjmuje, trafia do **kwarantanny** (`Store.quarantine`, źródło `cloud`, bez powtórzeń po `id`, zapis przed przesunięciem kursora). Po aktualizacji aplikacji wraca przy otwarciu bazy — istniejące odzyskiwanie z kwarantanny (D-056). Komunikat „Synchronizuj teraz” rozróżnia wpisy nieczytelne (inne hasło, uszkodzone) od odłożonych do kwarantanny; Diagnostyka liczy tylko wpisy nieodzyskane. Wiersze nieczytelne — jak dotąd pomijane | `core/sync/cloud.js`, `core/storage/store.js`, `core/sync/cloud-local.js`, `core/calc/diagnostics.js`, `modules/dane.js` |
| R2 | Import `postep-nauki.json` znakował numery bloków bieżącą wersją planu CFA bez sprawdzenia, z którego planu pochodzi plik | Rozpoznanie pliku (`cfaProgressPlan`): wersja = bieżący plan → import; **poprzednia wersja** (`D.previousVersion`, V43) → numery przeliczone na V44 według planu (`progressRequirements`); inna wersja, zapis sprzed powstania planu (16.10), brak daty lub numery spoza planu → **import zablokowany** z wyjaśnieniem; plik bez wersji z okresu planu → import z ostrzeżeniem. Podgląd importu pokazuje, które bloki zostaną oznaczone (pierwszy i ostatni: numer, dzień, litera) | `core/migrate/cfa.js`, `core/sync/bundle.js`, `modules/dane.js` |
| R3 | Meal Prep: klucz kroku `blok × 100 + krok`, walidacja `prep.step` `idx < 200` — karta z trzecim blokiem kroków byłaby niezapisywalna | Limit `PREP_IDX_LIMIT` = 10 000 (100 bloków × 100 kroków; poszerzenie — istniejące zdarzenia bez zmian). Klucz z jednej funkcji `PREP_IDX`. Test: wszystkie karty planu — klucze unikalne i w limicie | `core/storage/validate.js`, `modules/mealprep.js` |
| R4 | Kopia przed pobraniem z chmury „raz dziennie” liczona wg daty UTC | Doba lokalna (`ymd`) — 28.09 23:30 i 29.09 00:30 czasu polskiego to dwie doby | `core/sync/cloud.js` |

## 2. Ulepszenia

| # | Ulepszenie | Rozwiązanie | Pliki |
|---|---|---|---|
| U1 | Po 11.11 plan dnia miał 9 slotów „Brak bloku CFA — Poza okresem planu nauki” dziennie | Slot nauki bez bloku poza planem CFA → **„Czas własny”** (lżejszy wygląd, bez koloru domeny; dawki i podpunkty bez zmian). Slot, w którego czasie wypadają bloki MPW A–C, nazywa je z godzinami: „Nauka MPW — Blok A 15:30–16:23 — w karcie „Nauka MPW”” (bloki, treść i odhaczanie nadal w karcie — D-095). Wieczór 22:00 poza planem CFA: „Wieczór wolny” bez opisu. Godziny slotów bez zmian — nowy rozkład popołudnia to decyzja D1 | `core/resolver.js` (`ownTime`), `modules/dzis.js`, `ui/styles.css` |
| U2 | CI uruchamiał tylko testy jednostkowe | Workflow **„Testy 2027”** (`.github/workflows/testy.yml`): jednostkowe, `plan_check`, `verify_all.py --data-only`, budowa, test dymny CFA, E2E, a11y, Trening, synchronizacja plikiem i w chmurze (Playwright + Chromium, dane syntetyczne). Uruchamiany przy pushu poza `main` i w PR; publikacja na `main` (`pages.yml`) wywołuje go jako warunek — błąd testów zatrzymuje wdrożenie | `.github/workflows/testy.yml`, `.github/workflows/pages.yml` |
| U3 | Brak skrótów dla MPW, Kalendarza, Pielęgnacji; `g c` do CFA także po 12.11 | Nowe: `g k` Kalendarz, `g p` Pielęgnacja, `g e` MPW, **`g n` — bieżący plan nauki** tak jak zakładka (CFA do 11.11, od 12.11 MPW); `g c` — zawsze CFA. Lista skrótów (`?`) z nazwami z rejestru modułów | `ui/search.js` |
| U4 | Trening: pasek dni zawsze z bieżącego tygodnia, bez przełączania tygodni | Pasek z **tygodnia wybranego dnia** (z datą każdego dnia), „Poprzedni / Następny tydzień” (w granicach planu; ← → na komputerze), „Ten tydzień”; wybrany dzień wyśrodkowany w pasku na telefonie (bez przewijania strony) | `modules/trening.js`, `ui/styles.css` |
| U5 | Komentarze z nieaktualnymi datami; `PRZEKAZANIE.md` §4 p. 2 | Komentarze opisują źródło dat (`phases.json`, `week.json`, `supplements.json`) z obecnymi wartościami; `PRZEKAZANIE.md` — punkt `UPGRADE` oznaczony jako wykonany | `core/resolver.js`, `modules/dieta.js`, `modules/kalendarz.js`, `core/calc/{training,consumption,diagnostics}.js`, `modules/mealprep.js`, `docs/PRZEKAZANIE.md` |
| U6 | Pakiet JS 1,5 MB — plan CFA (0,75 MB) ładowany także po zakończeniu CFA | Build podaje plany nauki **bez pól, których aplikacja nie używa** (analityka planu V44: katalog readingów, przydział banku pytań, strony, powiązania; zadania bloków CFA — niewyświetlane), a **zadania bloków MPW wczytuje dopiero moduł MPW**: wariant web — plik `plan-mpw.<skrót>.json` (lista `SHELL`, działa offline), `2027.html` — dane wbudowane w stronę. Pakiet: **1531 KB → 1023 KB** (+ 119 KB zadań MPW na żądanie), `2027.html` 1711 KB → 1324 KB. Resolver i wszystkie widoki dostają plan synchronicznie jak dotąd (część stała zawiera daty, godziny, tematy i źródła bloków) | `core/plan-split.js`, `core/plan-tasks.js`, `core/plan-tasks.web.js`, `tools/build.mjs`, `modules/mpw.js`, `modules/study.js` |
| U7 | CSP produkcyjna dopuszczała `http://localhost:*` (tylko dla testów `e2e:cloud`) | Lokalny serwer testowy w CSP tylko w buildzie `BUILD_LOCAL_API=1`; `tests/e2e/cloud_sync.py` sam buduje wariant testowy i na końcu przywraca zwykły build | `tools/build.mjs`, `tests/e2e/cloud_sync.py` |
| U8 | Kopie automatyczne w Dane można było tylko pobrać (import pliku scala zdarzenia — nie cofa stanu) | Opis działania kopii i przycisk **„Przywróć stany Zapasów”**: podgląd pozycji, których stan się zmieni („Banan · 5 g → 1000 g”), zapis jako jedna operacja (`op` — „Cofnij” w Zapasach cofa całość), stany z chwili kopii z odliczeniem zużycia z planu do dziś; pozostałe dane bez zmian | `core/calc/inventory.js` (`restoreRows`), `modules/dane.js`, `ui/system.css` |

### Uwagi do decyzji użytkownika
- **U1 a D-095:** sloty planu dnia w czasie bloków MPW A–C mają teraz tytuł „Nauka MPW” i godziny bloków (wcześniej „Brak bloku CFA”). Bloki,
  ich treść i odhaczanie zostają w karcie „Nauka MPW” — godziny slotów się nie zmieniają. Kolizje popołudnia (D1) nadal czekają na decyzję.
- **12.11 (egzamin CFA, D2):** dzień nadal bez egzaminu w planie dnia — sloty nauki pokazują „Czas własny” (wcześniej „Brak bloku CFA”).
- **R3:** urządzenie ze starszą wersją aplikacji odrzuciłoby krok Meal Prep o kluczu ≥ 200 — dziś żadna karta takiego nie ma (maks. 102); dzięki R1
  wiersz z chmury nie przepadnie, tylko poczeka w kwarantannie do aktualizacji.

## 3. Testy

Nowe testy — sprawdzone na kodzie sprzed zmian: R1, R3, R4 i U1 zawodzą; R2 (blokada pliku z innego planu) i U6 (strażnik pól) to nowe funkcje.

| Test | Co sprawdza |
|---|---|
| `tests/unit/cloud-sync.test.mjs` | R1: wiersz spoza walidacji → kwarantanna raz (także po przerwanej rundzie), komunikat; odzyskanie po „aktualizacji” przy otwarciu bazy, Diagnostyka bez wpisów odzyskanych. R4: doba lokalna (Europe/Warsaw) |
| `tests/unit/sync.test.mjs`, `plan-cfa.test.mjs` | R2: plik z innej wersji, sprzed powstania planu, bez daty, z numerami spoza planu — zablokowany; bieżący — opis bloków; bez wersji — ostrzeżenie; V43 → V44 (nr 236 → 210) |
| `tests/unit/mealprep.test.mjs` | R3: klucze kroków wszystkich kart unikalne i w limicie; trzeci blok kroków zapisywalny |
| `tests/unit/resolver.test.mjs`, `plan-mpw.test.mjs` | U1: każdy dzień 12.11–28.03 — „Czas własny” bez nakładania na bloki MPW, „Nauka MPW” z godzinami każdego bloku A–C; bloki MPW nadal poza slotami (D-095) |
| `tests/unit/inventory.test.mjs` | U8: przywrócenie z kopii — stan z zużyciem do dziś, tylko pozycje zmienione, jedna operacja cofana „Cofnij” |
| `tests/unit/plan-split.test.mjs` (nowy) | U6: usuwane pola i zadania nieużywane w kodzie aplikacji (poza modułem podziału), plan w pakiecie = pełny plan bez tych pól, pola R2 zostają, zadania MPW — komplet, ten sam interfejs w Node i w przeglądarce |
| `tests/e2e/e2e.py` → `run_d108` (oba warianty buildu) | U7 CSP; U6 zadania MPW wczytane dopiero w module (web — 1 zapytanie, `2027.html` — 0); U4 tygodnie (← na komputerze, „Ten tydzień”, pierwszy tydzień planu); U3 skróty (`g n` przed i po 12.11, lista); U1 „Czas własny” i „Teraz”; R2 blokada i opis bloków; U8 opis, podgląd, przywrócenie i „Cofnij”; axe na nowych widokach i oknach |

## 4. Wyniki (24.10.2026, bez plików użytkownika — dane syntetyczne)

Uzupełniane po zakończeniu pełnej regresji (osobny commit).

## 5. Ograniczenia
- U6: plany CFA i MPW (część stała) nadal są w pakiecie — resolver potrzebuje ich synchronicznie dla każdego dnia (także historii w Kalendarzu);
  na żądanie wczytywane są zadania bloków MPW. Pole planu potrzebne w przyszłości = usunięcie go z listy `DROP` (test wskaże użycie).
- U8: przywracane są tylko stany Zapasów; pozycja bez stanu w kopii zostaje bez zmian (brak zdarzenia „bez stanu” — jak „Cofnij”, B1).
- U2: pierwsze uruchomienie workflow „Testy 2027” na GitHubie — wynik w §4.
