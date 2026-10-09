# Kalendarz od 08.10, start diety i treningu 10.10, fazy przesunięte (D-100) — raport (08.10.2026)

Rejestr: `docs/DECYZJE_2027.md` → D-100. Dane: `tools/extract/day_plan_d100.py` (idempotentny: `phases.json`, `week.json`, `supplements.json`).

## 1. Decyzje użytkownika (08.10.2026)
| Obszar | Decyzja |
|---|---|
| Kalendarz | dni do 07.10 włącznie (w tym Dzień zero 29.09) usunięte „jakby ich nie było”; kalendarz od 08.10.2026 |
| Dieta | start **10.10** (pierwotnie 09.10 — zmiana użytkownika); 08–09.10 oznaczone jako bez diety |
| Trening | start 10.10; UPPER 1 + sauna w sobotę 10.10, poniedziałek 12.10 — 2 × sauna; 08–09.10 bez treningu |
| Realny początek planu | **10.10.2026** |
| Fazy diety i treningu | Faza 1 od **19.10** (było 12.10), Faza 2 od **23.11** (było 16.11) |
| 07–11.11 | bez treningu, dieta NT (jak w czwartek) |
| CFA, MPW, szablon dnia | bez zmian |
| Pielęgnacja | tylko daty kroków w pliku użytkownika (patrz pkt 4) |

## 2. Zmiany w kodzie i danych
- `phases.json`: `start` 08.10, `realStart`/`dietStart`/`trainStart` 10.10, brak `zero`, fazy 08.10 / 19.10 / 23.11. `week.json`: usunięte wyjątki 30.09–03.10, dodane 08.10, 09.10, 10.10, 12.10, 07–11.11. `supplements.json`: okres preparatów czasowych od 08.10 (172 dni; zapas 180 kaps. starcza z nadwyżką).
- `resolver.js`: `PLAN_REAL_START`, `DIET_START`, `TRAIN_START`; flaga `noDiet` (dni przed startem diety): bez posiłków i kcal w planie dnia, bez zużycia żywności (`consumption.js`), `preStart`. `TRAIN_FROM` = start treningów (10.10).
- Widoki: Dziś (KPI „Bez diety”, komunikat „Przed startem planu”, panel poza planem z realnym początkiem), Tydzień, Kalendarz (nagłówek od 10.10, znaczniki „Przed startem planu”, „Bez diety”), Dieta (podpowiedzi faz z danych), Trening (komunikaty), Rekompozycja (realny początek planu), Mealprep (w dniach bez diety tylko wieczorne przygotowanie przed 10.10; 08.10 bez kart), Suplementy (komunikat), Diagnostyka (statystyki treningu od 10.10).
- Teksty faz: `rekomp.json`, `rekomp_common.py` i reguły `UPGRADE` pakietu prywatnego: Faza 0 (10.10–18.10), Faza 1 (19.10–22.11), Faza 2 (od 23.11).

## 3. Testy
- `npm test`: wszystkie jednostkowe przechodzą (209, 1 pominięty); testy dat i faz przepisane na nowy kalendarz, nowe: dzień bez diety, pierwszy tydzień, 07–11.11, okres suplementów.
- **Nieuruchomione:** E2E i a11y (brak Chromium). Poprawione oczywiste asercje (start, fazy, Dzień zero, Rekompozycja, suplementy). **Do przeglądu:** część CFA/zaległe bloki w `e2e.py` używa zegara z przed startu planu CFA (08.10) i daty `due`; wymaga przeniesienia na datę w planie.
- `npm run verify` i kontrola krzyżowa danych źródłowych nieuruchomione (pliki źródłowe poza repozytorium).

## 4. Pielęgnacja (poza repozytorium)
Plik `2027-pielegnacja.json` jest danymi prywatnymi (D-035), więc zmiany dat zostały zrobione na pliku użytkownika i przekazane osobno razem z listą zmian. Kod modułu bez zmian; logika `from/until/cycle` sprawdzona na zmienionym pliku (rotacje bez luk w miejscach zmian).

## 5. Do wykonania po stronie użytkownika
- Zaimportować nowy `2027-pielegnacja.json` (Dane → Pielęgnacja).
- Zaktualizować prywatny pakiet treści: `python3 tools/extract/private_pack_lib.py <stary> <nowy>` (reguły D-100 podmieniają daty faz; kontrola znaczników).
- Przejrzeć E2E/a11y u siebie (zegar testu).
