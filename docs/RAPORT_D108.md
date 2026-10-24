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
| R3 | Meal Prep: klucz kroku `blok × 100 + krok`, walidacja `prep.step` `idx < 200` — karta z trzecim blokiem kroków byłaby niezapisywalna | Klucz z jednej funkcji `prepKey`: bloki 0–1 **bez zmian** (`blok × 100 + krok` — wszystkie dotychczasowe karty i zapisane odhaczenia), dalsze bloki — karta `<id>.b<blok>` i numer kroku, więc `idx` jest zawsze < 200. **Walidacja `prep.step` bez zmian** (`PREP_IDX_LIMIT` = 200) — każda wersja aplikacji, także starsza na innym urządzeniu, przyjmuje każdy zapis (decyzja użytkownika 24.10: „zrób tak, żeby było dobrze”; pierwsza wersja poprawki podnosiła limit do 10 000, co rozjeżdżało walidację między wersjami). Test: klucze wszystkich kart unikalne i w walidacji; karta z 5 blokami | `modules/mealprep.js`, `core/storage/validate.js` |
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

### Decyzje użytkownika (24.10.2026, po pierwszej wersji raportu)
- **U1:** zostaje „Nauka MPW” w slotach w czasie bloków MPW A–C (bloki, treść i odhaczanie w karcie „Nauka MPW”, D-095; godziny slotów bez zmian).
  Kolizje popołudnia (D1) — decyzja później.
- **D2 (12.11, egzamin CFA):** zostaje „Czas własny” w slotach nauki — bez osobnego wpisu egzaminu w planie dnia.
- **R3:** „zrób tak, żeby było dobrze” — klucze kroków zawsze w dotychczasowej walidacji (tabela wyżej), bez zmiany limitu.
- **D3:** wprowadzone jako D-109 (`docs/RAPORT_D109.md`): Sylwester bez zakupów, zakupy 17.12 → 07.01, Nowy Rok bez treningu (MPW zostaje), 06.01 bez zmian.

## 3. Testy

Nowe testy — sprawdzone na kodzie sprzed zmian: R1, R3, R4 i U1 zawodzą; R2 (blokada pliku z innego planu) i U6 (strażnik pól) to nowe funkcje.

| Test | Co sprawdza |
|---|---|
| `tests/unit/cloud-sync.test.mjs` | R1: wiersz spoza walidacji → kwarantanna raz (także po przerwanej rundzie), komunikat; odzyskanie po „aktualizacji” przy otwarciu bazy (szczegóły sesji z polem nowszej wersji), Diagnostyka bez wpisów odzyskanych. R4: doba lokalna (Europe/Warsaw) |
| `tests/unit/sync.test.mjs`, `plan-cfa.test.mjs` | R2: plik z innej wersji, sprzed powstania planu, bez daty, z numerami spoza planu — zablokowany; bieżący — opis bloków; bez wersji — ostrzeżenie; V43 → V44 (nr 236 → 210) |
| `tests/unit/mealprep.test.mjs` | R3: klucze kroków wszystkich kart unikalne i w walidacji `idx < 200`, bloki 0–1 bez zmian, karta z 5 blokami (dalsze bloki jako `<id>.b<blok>`) |
| `tests/unit/resolver.test.mjs`, `plan-mpw.test.mjs` | U1: każdy dzień 12.11–28.03 — „Czas własny” bez nakładania na bloki MPW, „Nauka MPW” z godzinami każdego bloku A–C; bloki MPW nadal poza slotami (D-095) |
| `tests/unit/inventory.test.mjs` | U8: przywrócenie z kopii — stan z zużyciem do dziś, tylko pozycje zmienione, jedna operacja cofana „Cofnij” |
| `tests/unit/plan-split.test.mjs` (nowy) | U6: usuwane pola i zadania nieużywane w kodzie aplikacji (poza modułem podziału), plan w pakiecie = pełny plan bez tych pól, pola R2 zostają, zadania MPW — komplet, ten sam interfejs w Node i w przeglądarce |
| `tests/e2e/e2e.py` → `run_d108` (oba warianty buildu) | U7 CSP; U6 zadania MPW wczytane dopiero w module (web — 1 zapytanie, `2027.html` — 0); U4 tygodnie (← na komputerze, „Ten tydzień”, pierwszy tydzień planu); U3 skróty (`g n` przed i po 12.11, lista); U1 „Czas własny” i „Teraz”; R2 blokada i opis bloków; U8 opis, podgląd, przywrócenie i „Cofnij”; axe na nowych widokach i oknach |

## 4. Wyniki (24.10.2026, bez plików użytkownika — dane syntetyczne)

| Zestaw | Wynik |
|---|---|
| `npm test` | 243 / 244 (1 pominięty — wymaga kopii ZAPASY z `SOURCES_DIR`) |
| `npm run build` | `app.*.js` **1023 KB** (przed zmianą 1531 KB) + `plan-mpw.*.json` 119 KB wczytywany w module MPW; `dist/single/2027.html` 1324 KB (było 1711 KB) |
| `npm run e2e` | **1483 / 1483** (w tym 55 kontroli `run_d108`). Pierwszy przebieg: 1482 / 1483 — axe uruchomiony w trakcie animacji otwierania okna na telefonie (200 ms od przezroczystości 0) zgłaszał za niski kontrast; test czeka teraz na koniec animacji (`47e943e`) |
| `npm run a11y` | 0 naruszeń, brak przewijania w poziomie |
| `npm run e2e:trening` | 0 błędów |
| `npm run e2e:sync` | 23 / 23 |
| `npm run e2e:cloud` | 100 / 100 (build testowy z CSP dla lokalnego serwera; po teście zwykły build — CSP bez `localhost`) |
| `node tools/verify/plan_check.mjs`, `python3 tests/e2e/cfa_smoke.py` | 0 błędów (3 znane ostrzeżenia planu — D-101) |
| `python3 tools/verify/verify_all.py --data-only` | 13 kontroli, 0 błędów, 1 pominięta (źródła) |
| CI „Testy 2027” (GitHub, ubuntu-latest, U2) | [run #2](https://github.com/clip57/2027/actions/runs/40089601985) (`47e943e`) — **wszystkie kroki zaliczone** (≈ 12 min: jednostkowe, kontrola planu i danych, budowa, Chromium, CFA, E2E, a11y, Trening, synchronizacja plikiem i w chmurze); [run #1](https://github.com/clip57/2027/actions/runs/40089440266) (`181fc55`) — E2E 1482 / 1483, ten sam efekt animacji (okno przywracania U8) |
| Zrzuty (375 / 1280 px, jasny i ciemny) | Trening (tydzień, przyciski tygodni), „Dziś” po 11.11 („Czas własny”, „Nauka MPW”) — bez przewijania w poziomie; przewinięcie paska dni nie przesuwa strony (sprawdzone po zapisie serii) |

## 5. Ograniczenia
- U6: plany CFA i MPW (część stała) nadal są w pakiecie — resolver potrzebuje ich synchronicznie dla każdego dnia (także historii w Kalendarzu);
  na żądanie wczytywane są zadania bloków MPW. Pole planu potrzebne w przyszłości = usunięcie go z listy `DROP` (test wskaże użycie).
- U8: przywracane są tylko stany Zapasów; pozycja bez stanu w kopii zostaje bez zmian (brak zdarzenia „bez stanu” — jak „Cofnij”, B1).
- U2: pełne testy wydłużają publikację na `main` o ok. 12 min (wdrożenie dopiero po zaliczeniu). GitHub ostrzega, że akcje `checkout@v4`,
  `setup-node@v4`, `setup-python@v5` działają na Node 20 (wycofywany) — dziś tylko ostrzeżenie, bez wpływu na wynik; te same wersje w `pages.yml`.
