# Plan CFA V3, kalendarz od 12.10, trening i zakupy (D-101) — raport (13.10.2026)

Rejestr: `docs/DECYZJE_2027.md` → D-101. Dane: `tools/extract/day_plan_d101.py` (idempotentny: `phases.json`, `week.json`, `supplements.json`, `day_template.json`), plan CFA: `tools/extract/extract_static.mjs` (kontrola krzyżowa z `MASTER_CFA_13_10-12_11_V3.csv`: zgodne, 326 wierszy).

## 1. Zlecenie (ostateczny stan po korektach użytkownika 13–15.10.2026)
| Obszar | Decyzja |
|---|---|
| Plan CFA | nowy harmonogram V3 (13.10–11.11), własny zakres niezależny od początku planu |
| Początek planu | **15.10.2026** — pierwszy dzień liczenia wszystkiego poza CFA; dni wcześniejsze (w tym 12–14.10) to historia (poza planem, dane zostają) |
| Trening i dieta | 15.10 dzień nietreningowy (dieta NT); regularny przebieg od **16.10**; brak treningu 03–11.11 (dieta NT); **12–15.11 nominalnie** (wcześniejsza prośba dotyczyła pomyłkowo 12–15.11 zamiast 12–15.10) |
| Fazy | Faza 0 do 22.10 (16–22.10), Faza 1 od 23.10, Faza 2 od 23.11 |
| Zakupy | czwartki 15/22/29.10: 19:05–19:30, mycie głowy 19:30–19:40; 05.11 bez zakupów |
| Dni z blokiem M | posiłek 20:15 w trakcie bloku M; mycie głowy skrócone tuż przed blokiem M (19:33–19:40 po bloku L, 19:30–19:40 bez L) |
| Reszta | bez zmian (Pielęgnacja — plik użytkownika, MPW, suplementy od 15.10) |

## 2. Plan CFA V3 względem v14
| | v14 | V3 |
|---|---|---|
| Okres / bloki | 08.10–11.11, 340 | 13.10–11.11, 326 (30 dni: 3×9 + 16×10 + 2×11 + 9×13) |
| Blok J 21:00–21:53 | poza pt i sob (25) | codziennie poza 15.10, 23.10, 25.10 (27) |
| Bloki K, L, M | brak | K 17:40, L 18:40, M 19:40: 03–11.11 (9 dni), M także 22.10 i 29.10 |
| Kategorie | Curriculum 264, Schweser 47, Practice 29 | Curriculum 265, **Practice 61** (31 practice, 18 mock, 12 analiz), bez Schwesera |
| Mocki | 30.10, 03.11, 07.11 | 06.11, 08.11, 10.11 |
| Koniec first passa | 06.11 | 09.11 |
| Recall | 25 (bez pt, sob) + 6 | 27 (dni z blokiem J, z danych) + 5 = 32 |
Numeracja bloków jest nowa (blok 1 = 13.10 A) — odhaczenia sprzed V3 nie liczą się (`CFA_PLAN_VERSION` = 14).

## 3. Zmiany w kodzie i danych
- `cfa.json` z dostarczonych plików; guard ekstrakcji: 326 bloków, 13.10–11.11. Widok planu CFA: godziny V3 obejmują recall (stat bez `recallH`).
- `phases.json`: `start`/`realStart`/`dietStart` = 15.10, `trainStart` = 16.10, fazy 15.10 / 23.10 / 23.11. `week.json`: usunięte wyjątki sprzed 15.10 i z 12–15.11; dodane 15.10 (dzień nietreningowy, `czwartek_k`), 22.10 i 29.10 (`czwartek_k`), 03–11.11 (bez treningu, NT; 05.11 bez wariantu — bez zakupów). `supplements.json`: preparaty czasowe od 15.10 (165 dni).
- `day_template.json`: wariant `czwartek_k` (zakupy 19:05–19:30, `slot.2035` mycie głowy 19:30–19:40, `slot.1940c` posiłek po saunie 19:40–20:45; w dni z J 20:35).
- `resolver.js`: recall wg `nightRecall` także w dniach przed początkiem planu (13–14.10); bloki K, L, M, J jako dodatkowe sloty (mechanizm D-099); `mycieBeforeM` (mycie głowy tuż przed blokiem M, przycięcie okna treningowego w dni bez treningu); `CFA_PLAN_VERSION` = 14.
- Panel dni poza planem (Dziś): realny początek planu, regularny trening od 16.10, historia i start planu CFA 13.10.

## 4. Testy
- `npm test`: wszystkie jednostkowe przechodzą (207, 1 pominięty); testy struktury planu CFA, dat, wyjątków, zakupów, recall i pierwszego tygodnia przepisane na V3.
- **Nieuruchomione:** E2E i a11y (brak Chromium). Asercje dat i liczb poprawione ręcznie (start 12.10, plan CFA od 13.10, 326 bloków, recall 27, czwartki 15/22/29.10); część testów używa zegara sprzed startu planu i wymaga przeglądu u użytkownika.

## 5. Założenia i uwagi
- **Dni przed 15.10 (historia):** nie są kasowane; w widokach jako „Poza planem”, bez planu dnia, dawek, treningu i zużycia. Bloki i recall CFA 13–14.10 zostają (plan CFA ma własny zakres). Odhaczenia CFA sprzed V3 nie liczą się (nowa numeracja, znacznik 14).
- **Posiłek 20:15 w dni z blokiem M:** zostaje w trakcie bloku (22.10, 29.10, 03–11.11) — decyzja użytkownika; w widoku dnia posiłek i blok M mają nakładające się godziny.
- **Plik Pielęgnacji (nowa wersja użytkownika):** kompatybilny z układem dnia — kroki przypięte do `slot.2035` zachowują slot (mycie głowy przesunięte w czasie, id bez zmian). Kroki przypięte do `slot.2015n` (Prysznic całego ciała, niedziela z basenem) nie mają slotu w niedziele bez basenu: 08.11 (przerwa 03–11.11) oraz święta (jak dotychczas).
