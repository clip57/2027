# Plan CFA v14 — 340 bloków od 08.10, blok J (D-099) — raport (08.10.2026)

Rejestr: `docs/DECYZJE_2027.md` → D-099. Źródła od użytkownika: `PLAN_NAUKI_CFA_LEVEL_I_340_BLOKOW.html` + `MASTER_SCHEDULE_CFA_340_BLOKOW.csv` (kontrola krzyżowa `extract_static.mjs`: zgodne, 340 wierszy).

## 1. Zmiany w planie (v13 → v14)
| | v13 | v14 |
|---|---|---|
| Bloki / dni | 342 / 38 × 9 | 340 / 35 (25 × 10 + 10 × 9) |
| Okres | 05.10–11.11 | 08.10–11.11 |
| Blok J | brak | 21:00–21:53 w dni poza pt i sob (25 bloków) |
| Koniec first passa | 05.11 | 06.11 |
| Practice / mixed practice | 31 / 7 (26.10 D–I, 27.10 A) | 29 / 5 (27.10 I–J, 28.10 A–C) |
| Recall | 28 sesji | 25 × 22:00 + 6 końcowych A–F z 12.11 = 31 |
| Godziny netto | 302,1 h | 300,33 h (+ recall 27,38 h) |
Bez zmian: Curriculum 264 bloki i 3269 s., Schweser 47 (93 readingi dokładnie raz), 3 mocki (30.10, 03.11, 07.11), egzamin 12.11.
**Numeracja:** bloki 1–192 są w v14 identyczne z v13 (ten sam odcisk `4074b224fed2dee1`), więc odhaczenia z v13 zostają w mocy; od bloku 193 przebieg się różni.

## 2. Zmiany w kodzie
- `src/data/cfa.json` z dostarczonych plików; guard `extract_static.mjs`: 340 bloków, 08.10–11.11.
- `resolver.js`: blok o literze bez slotu w szablonie (tu J) dostaje własny slot `slot.cfa.J` 21:00–21:53 (`extra: true`). `jEvening` układa wieczór w dni z J wg polecenia użytkownika (08.10.2026): powrót do domu 20:15–20:25, mycie 20:25–20:35, przygotowanie kolacji 20:35–20:50, **kolacja 20:50–21:00**, blok J, przygotowanie posiłków **21:53–22:00**; chondroityna z kolacją o 20:50 (`dosesFor`, więc także Suplementy i ICS). Piątki, soboty, dni poza planem — bez zmian. Niedziela (basen): powrót 19:30–19:35 i reszta o 10 min wcześniej; czwartek: „Zakupy” 19:05–20:25 — rozszerzenie reguły, nie wprost z polecenia.
- `CFA_PLAN_VERSION` bez zmian (13).
- Resolver czyta start planu z `cfa.json`: 30.09–07.10 to dni projektu bez bloków i recallu CFA.

## 3. Testy
- `npm test`: 209 przechodzi, 1 pominięty (m.in. test układu wieczoru w 25 dniach z J: brak luk, kolacja 20:50–21:00, chondroityna 20:50). Nowe: test slotu J (resolver), odcisk bloków 1–192 (zastąpił test D-098 z v13), rozszerzone testy planu (A–J, recall 25 + 6, mixed practice, Schweser „READING a + b”).
- **Nieuruchomione:** `npm run e2e`, `npm run a11y` (brak Chromium), `npm run verify`.
- **E2E wymaga przeglądu:** zegar testu (`CLOCK` = 05.10) jest przed startem planu CFA. Poprawiłem oczywiste liczby (340, 35 dni, 31 sesji, 25 sesji recall, 5 bloków mixed practice, widok CFA od 08.10), ale asercje zależne od „dziś” (kafle Dziś, zaległe bloki, `due` przed 06.10, plan dnia 05.10 z 9 blokami A–I) pozostają do przeniesienia na datę w planie.

## 4. Otwarte
- **Niedziela i czwartek z blokiem J:** polecenie dotyczyło „Powrotu do domu” (20:15–20:25). W niedzielę (po basenie, 19:30–19:45) i w czwartek (powrót w slocie zakupów) zastosowałem tę samą regułę: skrócenie slotu z posiłkiem potreningowym o 10 min i przesunięcie reszty. Do potwierdzenia, czy w te dni 10 min ma pochodzić z innego slotu.
- **Sesje końcowe 12.11 (A–F, 08:00–14:23):** dane w `cfa.json` (`recallSessions`), ale widoku dnia 12.11 nie ma (poza okresem planu). Warto sprawdzić w źródle, czy godziny nie kolidują z egzaminem tego dnia.
