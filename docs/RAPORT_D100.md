# Kalendarz od 08.10, start diety, treningu i planu 12.10, fazy przesunięte (D-100) — raport (09.10.2026)

Rejestr: `docs/DECYZJE_2027.md` → D-100. Dane: `tools/extract/day_plan_d100.py` (idempotentny: `phases.json`, `week.json`, `supplements.json`).

## 1. Decyzje użytkownika (08.10.2026)
| Obszar | Decyzja |
|---|---|
| Kalendarz | dni do 07.10 włącznie (w tym Dzień zero 29.09) usunięte „jakby ich nie było”; kalendarz od 08.10.2026 |
| Dieta | start **12.10** (kolejno 09.10, 10.10, ostatecznie 12.10); 08–11.10 oznaczone jako bez diety |
| Trening | start 12.10: normalny poniedziałek (UPPER 1 + sauna, dieta T); 08–11.10 bez treningu, sauny i basenu |
| Realny początek planu | **12.10.2026** |
| Fazy diety i treningu | Faza 1 od **19.10** (było 12.10), Faza 2 od **23.11** (było 16.11) |
| 07–11.11 | bez treningu, dieta NT (jak w czwartek) |
| CFA, MPW, szablon dnia | bez zmian |
| Pielęgnacja | tylko daty kroków w pliku użytkownika (patrz pkt 4) |

## 2. Zmiany w kodzie i danych
- `phases.json`: `start` 08.10, `realStart`/`dietStart`/`trainStart` 12.10, brak `zero`, fazy 08.10 / 19.10 / 23.11. `week.json`: usunięte wyjątki 30.09–03.10, dodane 08–11.10 (bez treningu i diety; 08.10 zachowuje wariant czwartkowy z zakupami, 11.10 bez basenu) i 07–11.11; 12.10 bez wyjątku (normalny poniedziałek). `supplements.json`: okres preparatów czasowych od 08.10 (172 dni; zapas 180 kaps. starcza z nadwyżką).
- `resolver.js`: `PLAN_REAL_START`, `DIET_START`, `TRAIN_START`; flaga `noDiet` (dni przed startem diety): bez posiłków i kcal w planie dnia, bez zużycia żywności (`consumption.js`), `preStart`. `TRAIN_FROM` = start treningów (12.10).
- Widoki: Dziś (KPI „Bez diety”, komunikat „Przed startem planu”, panel poza planem z realnym początkiem), Tydzień, Kalendarz (nagłówek od 12.10, znaczniki „Przed startem planu”, „Bez diety”), Dieta (podpowiedzi faz z danych), Trening (komunikaty), Rekompozycja (realny początek planu), Mealprep (w dniach bez diety tylko wieczorne przygotowanie przed 12.10; wcześniej bez kart), Suplementy (komunikat), Diagnostyka (statystyki treningu od 12.10).
- Teksty faz: `rekomp.json`, `rekomp_common.py` i reguły `UPGRADE` pakietu prywatnego: Faza 0 (12.10–18.10), Faza 1 (19.10–22.11), Faza 2 (od 23.11); reguły obejmują też pakiety zaktualizowane wcześniejszą wersją (Faza 0 od 10.10).

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
