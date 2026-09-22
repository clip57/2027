# Raport Etapu 2 — Rdzeń (22.09.2026)

## Wykonane
- **Dane źródłowe** (`src/data`, 10 plików): dieta 6 × plan (249 pozycji), suplementy (17 dawek), katalog (55 pozycji), trening (32 ćwiczenia), CFA v3 (416 bloków), Tabela bezpieczeństwa (70 + termos D-013), szablon dnia (32 sloty), tydzień, fazy, stany startowe D-015.
- **Rdzeń** (`src/core`): daty lokalne, resolver dnia, zużycie z fazy i typu dnia, stany/prognozy/statusy/lista zakupów (reguły v31), magazyn zdarzeń IndexedDB (zapis weryfikowany odczytem, kwarantanna, kopie przed importem, brak cichego trybu pamięci), synchronizacja plikiem (suma kontrolna, scalanie, konflikty), migracje: ZAPASY v31, postęp CFA (JSON), error log CFA (CSV), pakiet prywatny.
- **Interfejs (szkielet):** nawigacja iPhone/komputer, podgląd dnia z resolvera, moduł „Dane i synchronizacja”, zaślepki pozostałych modułów.
- **Budowa:** `dist/web` (GitHub Pages, service worker, manifest, ikony, praca offline) i `dist/single/2027.html` z tych samych źródeł; workflow publikacji.
- **Pakiet prywatny:** generator poza repozytorium (REKOMPOZYCJA s.1 i s.21), kontrola kompletności tekstu, blokada zapisu w repozytorium.
- **Decyzje:** D-036 (E/F „Wolne” w dniu mocka), D-037 (obiad 16:23).

## Testy
| Zestaw | Wynik |
|---|---|
| Weryfikacja danych ze źródłami | 407 kontroli, 0 błędów |
| Jednostkowe (logika, zapis, synchronizacja, migracja Twojej kopii) | 40/40 (bez plików prywatnych: 39 + 1 pominięty) |
| E2E Chromium: web i pojedynczy plik × 390 px i 1280 px | 144 kontrole, 0 błędów |
| Skan repozytorium pod kątem danych zdrowotnych | czysty |

Błędy wykryte przez testy i naprawione: awaria resolvera w niedziele, utrata precyzji ułamków, pomylone „wystarczy do”/„dzień braku”, podwójne liczenie bloków mocka, brakujący nawias, komunikat po imporcie znikający przed przeczytaniem, tabela rozpychająca widok na iPhonie, komentarz HTML w pakiecie prywatnym.

## Niewykonane / nieprzetestowane
- Zachowanie na fizycznym iPhonie i Macu (okno udostępniania do iCloud Drive, instalacja z ekranu/Docka, trwałość danych w Safari, Readdle) — `docs/TEST_AKCEPTACYJNY.md`.
- Workflow GitHub Actions — napisany, nieuruchomiony (wymaga Twojego repozytorium).
- Teksty „przed → po” dla MEAL_PREP, REKOMPOZYCJI i Bezpieczne v3 — Etapy 4 i 6.
- Opisy techniki ćwiczeń (INFO, VIZ) — Etap 5.

## Wykryte problemy do kolejnych etapów
- Tekst slotu „Pobudka” (PLAN_DNIA) zawiera własną listę suplementów obok listy wyliczonej z SUPLEMENTACJI — Etap 3 musi usunąć dublowanie (D-001).
- Wartości badań występują też poza pakietem prywatnym w tekstach MEAL_PREP (np. ferrytyna) — do przeniesienia do pakietu przy budowie modułu Meal Prep (Etap 4).
- Plan CFA v3: zapis ignoruje błąd, brak importu CSV, pozostałości trybów LAW — nieistotne, bo nowy moduł korzysta tylko z danych.

## Ryzyka
- Safari może ograniczać trwałość danych stron nieuruchamianych z ekranu początkowego — regularny eksport jest jedyną pełną ochroną.
- Wspólne pochodzenie wszystkich stron GitHub Pages jednego konta.
- Plik pojedynczy w Readdle: działanie IndexedDB niesprawdzone na urządzeniu.

## Następny krok
Etap 3 — moduły Dziś, Dieta, Suplementacja (docelowy projekt wizualny), po Twoim poleceniu i wyniku testu akceptacyjnego.
