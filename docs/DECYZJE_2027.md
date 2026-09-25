# Projekt „2027” — Rejestr decyzji (dokument kanoniczny)

**Aktualizacja:** 25.09.2026 (D-036 – D-085; D-056 i nowsze wydane 24.09.2026) · Ten plik jest nadrzędnym rejestrem decyzji. Specyfikacje (`SPEC_2027_etap1_v1.1.md` i kolejne) odwołują się do niego.

## Decyzje obowiązujące

| ID | Decyzja |
|---|---|
| D-000 | Audyt Etapu 0 (`AUDYT_2027_etap0.md`) jako punkt odniesienia |
| D-001 | `SUPLEMENTACJA_2027` jest jedynym źródłem prawdy dla suplementów; sprzeczne fragmenty w innych plikach należy ujednolicić |
| D-003 | Gramatury faz to dane logistyczne, przeliczane automatycznie z jednego źródła danych o fazach |
| D-004 | Plan dnia ma warianty dni; godziny niezmienne, zmienia się zawartość slotów |
| D-006 | Źródłem harmonogramu CFA są dane `D` z `Plan_nauki_CFA.html` v3 (22.09.2026); first pass kończy się 05.11 |
| D-007 | PDF-y diety i DOCX suplementacji stają się funkcjonalnymi modułami |
| D-008 | Trwały, wersjonowany, walidowany zapis danych użytkownika z eksportem, importem i ochroną przed utratą |
| D-009 | Zapis lokalny oddzielony od synchronizacji (adapter) |
| D-010 | Responsywność: komputer + iPhone |
| D-011 | Ujednolicenie całego systemu |
| D-012 | Najpierw architektura, potem przebudowa |
| D-013 | Termos: brak progu przy wkładaniu, posiłek prosto z patelni; podczas jedzenia temperatura > 63 °C. Zastępuje D-002 |
| D-014 | Tauryna 2 g o 17:15 codziennie, także w czwartek; teksty TRENING i REKOMPOZYCJI do poprawy; banana w czwartek nie ma |
| D-015 | Glukozamina, chondroityna, Boswellia — do wyczerpania zapasów (ok. 6 miesięcy), potem niekontynuowane. Stan na 22.09.2026: 180 / 180 / 360 tabl.; opakowania 90 / 90 / 60 |
| D-016 | Cynk kontynuowany (czw., nd.); opakowanie 150 tabl.; stan nieodnotowany (duży zapas) |
| D-017 | Fazy kalendarzowe: F0 od 21.09.2026, F1 od 12.10.2026, F2 od 16.11.2026 |
| D-018 | Warianty dnia wg tabeli z SPEC v1.1 sekcja 5; okno 17:45–20:15 wspólne; czwartek 19:45–20:05 = wolne |
| D-019 | Dzień mocka: posiłki i suplementy bez zmian; bloki CFA A–D zastąpione sesjami mocka; bez ostrzeżeń o kolizjach |
| D-020 | Nazwy kanoniczne: Skyr · Białko WPC · Brokuły mrożone (świeże tylko w Tabeli bezpieczeństwa) · Chleb żytni na zakwasie |
| D-021 | Porcje kanoniczne: szczypiorek 5 g · melisa 2 g · cytryna 1/7 szt. · imbir 5 g (2–3 plastry) · wanilia 0,25 ml (5 kropel) |
| D-022 | Obiad gotowany codziennie; pomidorki 80 g; procedury jak w MEAL_PREP (karty nadrzędne nad tabelą naczyń) |
| D-023 | Docelowo aplikacja w przeglądarce z hostingu GitHub; przejściowo Documents by Readdle |
| D-025 | Pielęgnacja poza zakresem |
| D-026 | Jedna warstwa danych i jeden system zapisu; kod modułowy; ewentualny pojedynczy plik HTML wyłącznie jako wynik budowy |
| D-027 | Stan początkowy zapasów = `zapasy_kopia_2026-09-22.json` (51 pozycji, stan na 22.09.2026). Odliczanie dziennego zużycia od 23.09.2026 |
| D-028 | Tabela bezpieczeństwa bez pozycji „Brokuły mrożone”; każde odesłanie z brokułów mrożonych do Tabeli prowadzi do pozycji „Brokuły świeże” |
| D-029 | REKOMPOZYCJA s.8: zdanie o przejściu faz „nie od kalendarza” zmienione na daty kalendarzowe; kryteria zostają jako informacyjna lista kontrolna |
| D-030 | Kreatyna 5 g codziennie o 20:15; w czwartek opis dawki bez odniesienia do banana |
| D-031 | Eksport CFA (postęp i error log) zostanie dostarczony przed Etapami 4–5 |
| D-032 | Wymaganie: aplikacja offline uruchamiana z ekranu początkowego iOS i z Docka macOS, trwały zapis, synchronizacja danych iOS ↔ macOS przez iCloud |
| D-033 | **Synchronizacja: wariant A** — plik synchronizacji w iCloud Drive, eksport i import wykonywane ręcznie w aplikacji, automatyczne scalanie zmian (szczegóły: sekcja „Specyfikacja synchronizacji A”) |
| D-034 | **Zero płatnych usług:** bez Apple Developer Program, CloudKit, backendu i jakichkolwiek płatnych usług synchronizacji. Hosting wyłącznie w bezpłatnym GitHub Pages (repozytorium publiczne). Warianty B i C wykluczone |
| D-036 | Dzień mocka: sloty CFA E i F (13:30–15:23), dla których plan CFA nie ma bloków, wyświetlane jako „Wolne” (zatwierdza I-10) |
| D-037 | Plan dnia zachowuje godzinę obiadu „16:23” z PLAN_DNIA (SUPLEMENTACJA podaje 16:20 — bez zmian) |
| D-038 | Plan dnia 07:00: „Pomiar wagi i ciśnienia na czczo po toalecie.” (zamiast „Pomiar wagi na czczo po toalecie.”) |
| D-039 | Bloki CFA w zakładce Dziś pokazują źródło i zakres do przeczytania, np. „Curriculum 2026 Vol 1 (QM), s. 3–13 (11 s.)” |
| D-040 | Nagłówek dnia pokazuje nazwę treningu: UPPER 1 + sauna · LOWER 1 · Rower + ABS + sauna · Bez treningu, 2 × sauna · UPPER 2 · LOWER 2 + sauna · Basen |
| D-041 | Zakładka Dziś: suplementy wyłącznie z SUPLEMENTACJI (fragmenty o suplementach w tekstach PLAN_DNIA ukryte — usunięcie dublowania, wykonanie D-001); podpunkty slotów jako lista |
| D-042 | Test akceptacyjny Etapu 2 zaliczony na MacBooku, iPhonie i offline (9/9 kroków, 22.09.2026) |
| D-043 | Zakładka Dziś pokazuje bieżący slot („teraz”) i podsumowanie dnia; moduł Dieta domyślnie otwiera fazę i wariant dnia bieżącego; moduł Suplementacja pokazuje stan zapasu preparatów z modułu Zapasy |
| D-044 | Moduł Meal Prep podstawia gramatury z planu diety wg aktywnej fazy i wariantu dnia; pozycje nieobecne w danym wariancie (np. kefir w czwartek) są oznaczane, a nie zastępowane wartością domyślną |
| D-045 | Zdania z wynikami badań w MEAL_PREP są wykrywane wzorcem i przenoszone do pakietu prywatnego; ich treść nie występuje w repozytorium |
| D-046 | Moduł Zapasy odtwarza funkcje pierwotnego ZAPASY_DIETA.html (klasyfikacja wg terminu przydatności 1:1, okna, historia z przywracaniem stanu, kopia, paragon, raport AI); różnice wynikające z architektury opisane w RAPORT_POPRAWKI_ZAPASY.md |
| D-047 | Mapy mięśni w module Trening: dane z free-exercise-db (Unlicense, domena publiczna), rysunek własny; ćwiczenia bez dokładnego odpowiednika oznaczane jako „najbliższy odpowiednik” |
| D-048 | Moduł CFA: postęp i error log w dzienniku zdarzeń; eksport/import CSV w formacie v3 |
| D-049 | Lista zmian treści Etapu 6 zaakceptowana w całości; Q1: usunięte zalecenie powtarzania testu termosu (Bezpieczne v3), zostaje „testu nie trzeba powtarzać” (REKOMPOZYCJA, MEAL_PREP) |
| D-050 | Q2: zastrzeżenia o cynku (wchłanianie na czczo) i kreatynie (wpływ na kreatyninę) zachowane — cynk w sekcji „Pierwotne uzasadnienie”, kreatyna jako neutralna uwaga bez warunku startu |
| D-051 | Pakiet prywatny obejmuje także zdania z sekcji publicznych REKOMPOZYCJI z danymi medycznymi i osobowymi (wyniki badań, opis MRI i rozpoznanie, wiek, wzrost, masa, obwody) — wykrywane ogólnymi wzorcami; nagłówek z danymi osobowymi pominięty |
| D-052 | Schemat ruchu zastąpiony animowaną postacią człowieka (rysunek własny, poglądowy); tor ruchu ze źródła pokazywany jako opis |
| D-053 | A2.9 zaakceptowane: komórki tabel suplementów w REKOMPOZYCJI s.6 zgodne z SUPLEMENTACJĄ; melatonina 1 mg także w s.18 i s.22 (uzupełnienie A2.4, ta sama zmiana) |
| D-054 | Zmiana redakcyjna E-1: odesłanie do pliku Tabeli w poradniku Bezpieczne v3 zastąpione odesłaniem do zakładki „Tabela” modułu |
| D-055 | Dostępność: semantyczne kolory statusów z wariantem jasnym i ciemnym (kontrast WCAG AA), przewijane obszary dostępne z klawiatury; audyt axe-core jako stały test (`npm run a11y`) |
| D-056 | Zgodność w przód: zdarzenia o poprawnej budowie i nieznanym typie (z nowszej wersji) są zachowywane w bazie, imporcie i eksporcie, pomijane w obliczeniach i jawnie raportowane („Niepełne przetwarzanie”); nie trafiają do kwarantanny. Zdarzenia przeniesione do kwarantanny przez starszą wersję są odzyskiwane, gdy obecna wersja je rozpoznaje |
| D-057 | Aktualizacja kodu aplikacji wyłącznie za zgodą użytkownika („Nowa wersja — odśwież”); sprawdzanie aktualizacji przy powrocie aplikacji na ekran; jednorazowe przejście ze starego service workera bez przeładowania otwartej strony. Aktualizacja kodu jest oddzielona od ręcznej synchronizacji danych |
| D-058 | Format pliku 2027-sync.json bez zmian (istniejące: schema, exportedAt, device, count, sha256, identyfikatory zdarzeń, deduplikacja po id); podgląd importu korzysta z istniejących pól exportedAt i device |
| D-059 | Redesign — system projektowy: jedno źródło tokenów (`src/ui/tokens.css`), warstwa komponentów (`src/ui/system.css`); nazwy klas używane przez moduły i testy bez zmian |
| D-060 | Font Inter (OFL) osadzony lokalnie jako podzbiór znaków aplikacji (32 KB, 2 pliki woff2; w wariancie jednoplikowym jako data URI); awaryjnie font systemowy |
| D-061 | Motyw: domyślnie ciemny (potwierdzone przez użytkownika 24.09.2026), przełącznik ciemny / jasny / systemowy; preferencje interfejsu (motyw, zwinięty panel) zapisywane per urządzenie (localStorage), poza dziennikiem zdarzeń i plikiem synchronizacji |
| D-062 | Nawigacja: panel boczny z grupami Dzień / Trening / Dieta / Nauka / System (zgodne z domenami modułów w rejestrze), ikony Lucide (ISC, 40 ikon wbudowanych, 7 KB); telefon: Dziś, Dieta, Trening, CFA + „Więcej” |
| D-063 | Akcent indygo: #4845D2 (jasny, 6,9:1 na karcie) / #A5A8FF (ciemny, 8,2:1) |
| D-064 | Dashboard „Dziś” wyłącznie z istniejących danych (resolver + dziennik zdarzeń); suplementy na dashboardzie tylko jako podsumowanie liczbowe — nazwy dawek wyłącznie w planie dnia (zgodnie z D-041) |
| D-065 | Testy bez plików użytkownika korzystają z danych SYNTETYCZNYCH (`tests/e2e/fixtures.py`): fikcyjne stany zapasów wyliczane wzorem z katalogu, pakiet prywatny wyłącznie z tekstami zastępczymi „[DANE TESTOWE]”; pliki tworzone w katalogu tymczasowym, nigdy w repozytorium; zero danych osobowych/medycznych. Zgoda użytkownika 24.09.2026 |
| D-066 | Odnośniki w obrębie strony (`#id`) przewijają do elementu (`scrollIntoView`, fokus na celu) bez zmiany trasy routera; trasy modułów wyłącznie `#/modul` |
| D-067 | PWA: kolor paska przeglądarki (`theme-color`) i ekranu startowego (manifest) zgodne z motywem domyślnym (ciemny `#0d0f13`); `apple-mobile-web-app-status-bar-style` pozostaje `default` (bez `black-translucent` — decyzja użytkownika 24.09.2026); zachowanie paska statusu do sprawdzenia na iPhonie |
| D-068 | Trening: licznik przerwy między seriami — uruchamiany odhaczeniem serii w dniu bieżącym, czas z planu (`2–3 min` → 2:00 do gotowości, 3:00 do końca), „+30 s” i „Pomiń”; stan wyłącznie interfejsu (pamięć karty), **nie jest zapisywany w dzienniku zdarzeń ani synchronizowany**; bez powiadomień systemowych i dźwięku |
| D-069 | Trening: karta „Następna seria” (pierwsza nieodhaczona seria w kolejności planu, z planem powtórzeń/RIR/przerwy i ostatnim wynikiem) oraz podsumowanie ukończonej sesji (serie, objętość, powtórzenia, czas) — wyłącznie z planu i dziennika `train.set`/`train.session` |
| D-070 | CFA: tempo względem harmonogramu v3 — „zaległe” = bloki z datą wcześniejszą niż dziś i nieodhaczone (bloki dnia bieżącego nie są zaległe); panel zaległych (5 najstarszych) w widoku dnia bieżącego, filtr „tylko zaległe” w harmonogramie, następny blok dnia; error log z filtrem rodzaju błędu i wyszukiwaniem (tylko widok). Bez prognoz i metryk spoza planu |
| D-071 | Dieta: posiłki (karty i nawigacja) w kolejności godzin planu dnia (napoje na końcu; wartości PDF bez zmian), „Następny posiłek” wg godziny (tylko plan obowiązujący dziś), makroskładniki pozycji jako jedna linia, rzadkie sekcje (różnice faz, zamienniki, przyprawy) zwinięte; składniki planu z pilnym/średnim stanem w Zapasach — karta w kolumnie bocznej, przy produkcie tylko stan pilny. Bez odhaczania zjedzonych posiłków (wymagałoby nowego typu zdarzenia) |
| D-072 | Zapasy: przegląd (pasek stanu magazynu z liczników statusów, najbliższy brak), siatka 7 akcji z ikonami (wszystkie funkcje D-046 zachowane), karta „Do kupienia” (5 najpilniejszych pozycji listy zakupów, „Kupione” = istniejące zdarzenie `inv.move` purchase na wyliczoną ilość), zwarte wiersze pozycji (status, wystarczy do, pasek zapasu z dniem zakupów, stan, „+ opakowanie”; porcje, tagi i usuwanie w „Więcej”), korekta dnia i operacje zbiorcze zwinięte; na komputerze lista + przyklejona kolumna zakupów |
| D-073 | Nowy kierunek wizualny „premium personal OS” (inspiracja: zrzuty użytkownika; strona Figma niedostępna w środowisku) realizowany w ramach istniejącego systemu tokenów: bez glassmorphismu, gradientów i metryk bez danych; kierunek obowiązuje w dalszych modułach Fazy 5 |
| D-074 | Meal Prep: „Składniki na jutro” — stan na koniec dziś porównany ze zużyciem jutra wg planu (tylko produkty użyte w kartach), oznaczenie kart z brakami, wyróżniona karta z następnym krokiem; tabele i „Dlaczego tak” zwinięte |
| D-075 | Suplementacja: minione pory dnia przygaszone (tło, bez przezroczystości tekstu), następna pora wyróżniona; karta „Zapas suplementów” (status v31 < 10 / < 20 dni) z „Kupione +opakowanie” (`inv.move` purchase) pod osią dnia; pasek zapasu w tabeli preparatów |
| D-076 | Bezpieczeństwo i Rekompozycja: nagłówki jak w pozostałych modułach, „Wyczyść filtry”; w Rekompozycji wyszukiwanie w treści planu (bez pakietu prywatnego) i „Rozwiń / Zwiń wszystko”. Zapasy → Bezpieczeństwo: link „Przechowywanie” wyłącznie przy identycznej nazwie pozycji w Tabeli bezpieczeństwa (15 z 55 — bez zgadywania powiązań, `product_links` nie zmieniane) |
| D-078 | **Synchronizacja przez chmurę — kierunek zaakceptowany:** Supabase (plan Free, bez karty); IndexedDB pozostaje źródłem prawdy; ręczna synchronizacja `2027-sync.json` zostaje jako mechanizm awaryjny. **Zmienia D-033** (dotąd wyłącznie ręczna) i **D-034** (dopuszczony bezpłatny zewnętrzny backend; nadal zero płatnych usług). Synchronizowane są zdarzenia (nie stan), scalanie = suma po `id`, konflikty — `reduce()` bez zmian. Wdrażane etapami (`docs/SYNC_CHMURA.md`); automatyczne wyzwalanie dopiero po przetestowaniu rdzenia |
| D-079 | Chmura: szyfrowanie po stronie urządzenia — PBKDF2-SHA256 (600 000 iteracji) → HKDF → AES-GCM-256 (treść) i HMAC-SHA256 (identyfikator `sid`); serwer nie zna treści, typów ani `id` zdarzeń (także pakietu prywatnego); brak odzyskiwania hasła szyfrowania (z założenia) |
| D-080 | Chmura: logowanie e-mailem i hasłem konta (konto zakładane w panelu, rejestracja wyłączona) zamiast kodu z e-maila — wbudowana poczta Supabase wysyła 2 e-maile/godz. wyłącznie do członków zespołu; brak logowania przez Google/Apple (przekierowania w PWA na iOS) |
| D-081 | Chmura (Etap 2): **Project URL i Publishable Key wpisywane lokalnie na każdym urządzeniu** (Dane → Synchronizacja w chmurze), zapis w `meta` IndexedDB — nie w repozytorium, paczce ani `2027-sync.json`. Klucz publiczny z założenia; ochrona: RLS (`schema.sql`, kontrola `check.sql`), wyłączona rejestracja, szyfrowanie na urządzeniu. Aplikacja odrzuca `sb_secret_…` i `service_role`. | 24.09.2026 |
| D-082 | Chmura (Etap 2): hasło konta i hasło szyfrowania **nie są zapisywane**; na urządzeniu zostają sesja (tokeny) i nieeksportowalne `CryptoKey` przypisane do konta. Pierwsze urządzenie wymaga powtórzenia hasła szyfrowania. „Wyloguj” usuwa sesję i klucze (kursor zostaje); inne konto lub inny projekt zeruje stan synchronizacji; „Odłącz to urządzenie” usuwa całą konfigurację. Dane lokalne nigdy nie są usuwane. | 24.09.2026 |
| D-083 | Chmura (Etap 2): synchronizacja **wyłącznie przyciskiem „Synchronizuj teraz”** (zgodnie z D-033 — bez synchronizacji przy starcie, w tle ani zegarem); jedna runda naraz (Web Locks między kartami); sekcja w Dane pod ręczną synchronizacją plikiem, która pozostaje bez zmian. | 24.09.2026 |
| D-084 | Chmura: **synchronizacja automatyczna** (decyzja użytkownika 25.09.2026; zmienia D-083 dla chmury — synchronizacja plikiem pozostaje ręczna, D-033): po zapisie zmiany wysyłka po 1,5 s ciszy (najpóźniej 15 s od pierwszej zmiany, seria = jedno wysłanie); pełna runda przy otwarciu aplikacji, powrocie do niej (najwyżej raz na 60 s), powrocie sieci i przyciskiem „Synchronizuj teraz” (ręczne wymuszenie); wysyłka przy zejściu do tła. Jedna runda naraz (Web Locks), ponowienia z rosnącym odstępem tylko przy aplikacji na ekranie, wstrzymanie przy błędach wymagających działania (jeden baner na sesję, poza Dane). Przełącznik „Synchronizuj automatycznie” per urządzenie (domyślnie włączony). Lżejsze pobieranie (indeks numerów, treść tylko nowych wierszy), zapis stanu tylko przy zmianie. Bez zmian: szyfrowanie, RLS, `reduce()`, model danych, historia. | 25.09.2026 |
| D-085 | Chmura: **automatyczne pobieranie zmian** (decyzja użytkownika 25.09.2026; uzupełnia D-084): lekkie sprawdzanie „czy w chmurze jest nowszy wiersz niż kursor” (zwykły GET PostgREST — bez Realtime, WebSocketu i SDK), pełna runda tylko po wykryciu nieznanego wiersza. Interwał: komputer 30 s, telefon 60 s, po 5 min bez interakcji co 5 min; przy powrocie do okna (`focus`) od razu, najwyżej raz na 10 s. Wstrzymane w tle, offline, po wylogowaniu, przy wyłączonym przełączniku i przy błędach (wtedy działają ponowienia D-084). Osobny przełącznik „Automatyczne pobieranie zmian” per urządzenie, domyślnie włączony, aktywny tylko przy włączonej synchronizacji automatycznej. Koszt: ok. 1000 zapytań/dzień na widocznym komputerze, ~30 MB/mies.; serwer widzi czas sprawdzeń (kiedy aplikacja jest otwarta), treść nadal zaszyfrowana. Bez zmian: wysyłanie (D-084), model danych, szyfrowanie, RLS, ochrona wpisywania. | 25.09.2026 |
| D-077 | Dane: synchronizacja (status niewysłanych zmian, ostatnie wysłanie/import, „Wyślij do iCloud”, „Pobierz z iCloud”) jako pierwsza sekcja; mechanizm, teksty rozróżniające kod/dane i format pliku bez zmian |
| D-035 | **Treści wrażliwe: wariant 1** — „pakiet prywatny” importowany z pliku; nie trafia do repozytorium |

## Decyzje zastąpione

| ID | Treść | Zastąpiona przez |
|---|---|---|
| D-002 | Termos: pakowanie 85 °C, drugi próg 63 °C | D-013 |
| D-005 | Mock CFA jako wyjątek (ogólnie) | D-019 |

## Interpretacje przyjęte (bez sprzeciwu użytkownika)

| ID | Interpretacja |
|---|---|
| I-1 | „Przekraczać 63 °C” = > 63 °C |
| I-2 | Kolagen i witamina C w czwartek o 17:15 (wynika z D-001) |
| I-3 | MEAL_PREP: Contigo #1 = herbata, #2 = kawa; szpinak w 520 ml |
| I-4 | 4 i 6 kostek lodu w MEAL_PREP to dwa różne kroki — bez zmian |
| I-5 | Miód: „1 łyżeczka (6 g)” wg PDF |
| I-6 | Nazwy z PDF (Białko KFD, Skyr naturalny) zostają w PDF-ach jako aliasy; w aplikacji nazwy kanoniczne |
| I-7 | Fazy liczone z kalendarza; daty faz trzymane jako dane konfiguracyjne |
| I-8 | Notatki w ZAPASY „Świeże (limit zamrażarki / lodówki)” to etykiety kategorii trwałości, nie sprzeczność — bez zmian |
| I-9 | Suplementy z D-015: stan na koniec 22.09, odliczanie od 23.09 (jak w D-027) → ostatni dzień przyjmowania **21.03.2027** (dokładnie 180 dni) |

## Specyfikacja synchronizacji A (D-033)

1. **Model danych:** każda zmiana danych użytkownika to zdarzenie z identyfikatorem unikalnym, identyfikatorem urządzenia i znacznikiem czasu (zegar hybrydowy). Usunięcia to zdarzenia-nagrobki, nie fizyczne kasowanie.
2. **Plik:** `2027-sync.json` w folderze iCloud Drive „2027”. Zawiera wersję schematu, identyfikator urządzenia, datę, sumę kontrolną, pełny dziennik zdarzeń i pakiet prywatny (D-035).
3. **Eksport:** przycisk „Wyślij do iCloud” → systemowe okno udostępniania → „Zachowaj w Plikach” → iCloud Drive/2027. Wariant zapasowy: pobranie pliku. Obsługę okna udostępniania z plikiem w aplikacjach z ekranu początkowego (iOS) i z Docka (macOS) zweryfikuję na urządzeniach w teście akceptacyjnym.
4. **Import:** przycisk „Pobierz z iCloud” → wybór pliku → walidacja → podgląd („nowe zdarzenia: N, konflikty: M”) → potwierdzenie → automatyczna kopia stanu lokalnego → scalenie.
5. **Scalanie:** suma zbiorów zdarzeń. Import jest idempotentny: ten sam plik wczytany dwa razy niczego nie zmienia. Przy dwóch zmianach tego samego rekordu wygrywa późniejsza, a przy remisie rozstrzyga identyfikator urządzenia (deterministycznie). Przegrana zmiana zostaje w historii i można ją przywrócić.
6. **Sygnalizacja:** status „ostatni eksport / ostatni import” oraz znacznik „masz niewysłane zmiany”.
7. **Kopia zapasowa:** ten sam format pliku; synchronizacja i kopia to jeden mechanizm.

## Pakiet prywatny (D-035)

- **Zawartość domyślna:** REKOMPOZYCJA sekcja 1 (diagnoza: antropometria, BIA, wyniki badań krwi, opis MRI, historia treningowa) oraz wszystkie inne fragmenty z wynikami badań.
- Pozostałe treści (plan diety, suplementacja, trening, meal prep, CFA, bezpieczeństwo) są częścią publicznego kodu aplikacji. Użytkownik może rozszerzyć pakiet przed pierwszą publikacją.
- Pakiet jest plikiem `2027-prywatne.json`, importowanym raz. Potem podróżuje w pliku synchronizacji, więc na drugim urządzeniu wystarczy zwykły import synchronizacji.
- Aplikacja bez pakietu działa w pełni; w miejscach treści prywatnych pokazuje „treść w pakiecie prywatnym — zaimportuj”.

## Propozycje oczekujące na decyzję

- G-20: dziennik kolana i monitoring (waga, sen, obwody) — czy mają trafić do aplikacji.
- D-031: pliki eksportu CFA (postęp, error log) nie zostały dostarczone — funkcje importu są gotowe.
