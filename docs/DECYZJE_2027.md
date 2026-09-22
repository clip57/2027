# Projekt „2027” — Rejestr decyzji (dokument kanoniczny)

**Aktualizacja:** 22.09.2026 (D-036 – D-042) · Ten plik jest nadrzędnym rejestrem decyzji. Specyfikacje (`SPEC_2027_etap1_v1.1.md` i kolejne) odwołują się do niego.

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

Brak.
