# Plan CFA v5, soboty z zakupami i wyjątki 25–27.09.2026 (D-087) — raport (25.09.2026)

Zakres wg polecenia użytkownika: wgranie najnowszej wersji planu CFA (`PLAN_NAUKI_CFA_LEVEL_I.html` v5 + `MASTER_SCHEDULE_CFA.csv`),
soboty z zakupami 12:13–13:13, wyjątki dni 25, 26 i 27.09.2026, suplementy czasowe 25.09.2026–21.03.2027, Faza 0 od 26.09.2026.
Pozostałe zasady bez zmian (D-086 obowiązuje w pozostałym zakresie).

## 1. Plan CFA v5
- `cfa.json` wygenerowany skryptem `extract_static.mjs` (`ONLY=cfa`); kontrola krzyżowa z CSV: 421 wierszy × 13 kolumn, 0 różnic.
  Skrypt odrzuca starsze wersje (v3: 416, v4: 432 bloki).
- 421 bloków: 41 dni × 9, 6 sobót × 8 (bez bloku E 12:20–13:13), 25.09 × 4 (F–I od 13:30); 371,88 h netto + 34 sesje recall
  (30,03 h). First pass do 05.11. Mocki bez zmian (26.10, 30.10, 03.11, 07.11); sobota z mockiem (07.11) ma zwykły układ mocka.
- Praktyka: 56 bloków (mocki 24, analiza 24, mixed practice 5, Ethics i wzory 3).
- Curriculum (290 bloków, 3269 stron) i Schweser (75 bloków, 93 readingi) — ta sama treść i kolejność co w v4; bloki nr 1–207
  identyczne jak w opublikowanej wersji D-086, więc odhaczenia z dziś zachowują sens.
- Limit walidacji `cfa.done` zostaje 432 (nie zmniejszany — zdarzenia z dłuższego planu nie mogą trafić do kwarantanny).
- Widok CFA → Plan: „421 (48 dni: 41×9 + 6×8 + 1×4)” (z pola `stat.uklad`).

## 2. Plan dnia
| Dzień | Zmiana |
|---|---|
| Soboty (poza 07.11) | 12:13–13:13 „Zakupy” (zadanie: „Zakupy według listy „Do kupienia” w module Zapasy”, druga kawa 12:20) zamiast przerwy 12:13–12:20 i bloku E; przerwa na lunch 13:13–13:30 bez zmian; 33 sloty |
| 25.09 (pt) | bloki CFA F–I od 13:30, wcześniejsze sloty CFA „Wolne — brak bloku w planie CFA tego dnia”; okno 17:45–20:15 (dojazd, rozgrzewka, trening, prysznic, sauna, chłodzenie) „Wolne”; Trening: „Dzień bez treningu.” |
| 26.09 (sob) | LOWER 2 + sauna jak zwykle, z opisem „Trening kalibracyjny: technika i obciążenie wszystkich nowych ćwiczeń na nogi” (plan dnia i Trening); zakupy 12:13–13:13 |
| 27.09 (nd) | zamiast basenu dzień sauny jak czwartek: „Bez treningu, 2 × sauna”, dieta NT (2332 kcal), „Posiłek po saunie”, zużycie w Zapasach wg NT (bez banana), uwaga o kreatynie „dziś bez banana”; cynk i recall jak w niedzielę |

Mechanizm: `week.json` → `exceptions` (wyjątki dat) i `days.6.variant = "zakupy"`; `day_template.json` → `variants.zakupy`
(slot `slot.1213z` zastępuje `slot.1213` i `slot.1220`); w kodzie `dayPlan(date)` i `templateFor(date)` w `resolver.js`, używane
przez plan dnia, zużycie (`consumption.js`), Trening (sesja, pasek dni, historia) i Suplementację. Zmiany zapisane jako funkcje
decyzji w `tools/extract/day_plan_d087.py` (stosowane przez `extract_schedule_safety.py`).

## 3. Fazy i suplementy
- Faza 0 od 26.09.2026 (F1 12.10, F2 16.11 bez zmian); 25.09 = „przed startem planu” (jadłospis Fazy 0 T, jak dotąd dla dni przed startem).
  Rekompozycja: „punkt startowy 26.09.2026”, „Faza 0 (26.09–11.10)”; Dieta: „Faza 0 · od 26.09”.
- Glukozamina, chondroityna, Boswellia: od 25.09.2026 do 21.03.2027 (178 dni). Zapas z 22.09 (180 / 180 / 360) wystarcza —
  w dniu 21.03.2027 zostaje 2 / 2 / 4 kaps. Teksty Rekompozycji: „21.03.2027”.

## 4. Audyt (kod aplikacji, 19.09.2026–31.03.2027, 194 dni)
0 luk w planie dnia; każda dawka w jednym slocie; pory posiłków w swoich slotach; 421/421 bloków CFA w slotach o godzinach z planu,
0 kolizji bloku z innym slotem (w tym z zakupami); 34 sesje recall; zakupy w 27 z 28 sobót (bez 07.11 — mock); stany suplementów
czasowych nie spadają poniżej zera. Plan sam ze sobą: strony Curriculum ciągłe, readingi Schwesera po jednym razie i po Curriculum
działu, statystyki (`stat`, `faza`, `fpEnd`, `mockCov`, `prac`) zgodne z blokami.

## 5. Testy
Nowe/zmienione: `plan-cfa.test.mjs` (v5: 421 bloków, układ dni, soboty z zakupami, wyjątki 25–27.09, zapas suplementów),
`resolver.test.mjs`, `diet-supp`, `consumption`, `inventory` (lista zakupów na tydzień bez wyjątków), `cfa-pace`; E2E: 25.09,
26.09, 27.09, 28.09 w „Dziś”, Trening 25–27.09, Suplementacja 27.09, CFA 4 bloki / „1 / 421”, statystyki, PRACTICE 5;
a11y: dodany widok soboty (`#/dzis?d=2026-09-26`).

Wyniki (build `0.2.0+de9f6feba7`):

| Zestaw | Wynik |
|---|---|
| `npm test` | 160 uruchomionych, 159 zaliczonych, 0 niezaliczonych, 1 pominięty (migracja kopii ZAPASY — wymaga `SOURCES_DIR`) |
| `npm run e2e` | 1054 / 1054 kontroli |
| `npm run e2e:sync` | 21 / 21 |
| `npm run e2e:cloud` | 100 / 100 |
| `npm run a11y` | 0 naruszeń, brak przewijania w poziomie (21 widoków, oba motywy) |
| `npm run verify` | nie uruchomiony — wymaga plików użytkownika; fragment CFA sprawdzony na przesłanym HTML v5 (zgodny) |

Zrzuty 375 i 1440 px (ciemny, jasny): sobota 26.09 — slot „Zakupy” w kolorze modułu Zapasy, bez przewijania w poziomie.

## 6. Uwagi
- Druga kawa (12:20) w soboty jest w slocie zakupów (godzina bez zmian).
- Dieta 25.09 bez zmian (piątek — T), bo polecenie zmieniało dietę tylko 27.09.
- Trening 26.09 pokazuje ćwiczenia LOWER 2; ćwiczenia spoza Fazy 0 można zapisać jako opcjonalne (jak dotąd).
