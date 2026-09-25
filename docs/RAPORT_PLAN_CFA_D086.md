# Plan CFA „MASTER SCHEDULE FINAL” i start planu 25.09.2026 (D-086) — raport (25.09.2026)

Zakres wg polecenia użytkownika: nowy harmonogram CFA z plików `PLAN_NAUKI_CFA_LEVEL_I.html` i `MASTER_SCHEDULE_CFA.csv`,
nowy rozkład dnia (blok E 12:20–13:13, przerwy 12:13–12:20 i 13:13–13:30, bez długiej przerwy i spaceru; druga kawa 12:20
i lunch 13:20 zostają), start całego planu 25.09.2026 (Faza 0 od 25.09; Fazy 1 i 2 bez zmian), koniec suplementów czasowych
25.03.2027. Pozostałe funkcje i założenia planu bez zmian. Niespójności — sekcja 5, **do akceptacji** (niczego tam nie zmieniono).

## 1. Źródło i jego kontrola
- `cfa.json` wygenerowany skryptem `tools/extract/extract_static.mjs` (`ONLY=cfa`) z obiektu `D` w `PLAN_NAUKI_CFA_LEVEL_I.html`.
  Skrypt odrzuca plik, który nie jest planem D-086 (432 bloki, 25.09–11.11), i porównuje go **pole po polu** z
  `MASTER_SCHEDULE_CFA.csv` (432 wiersze × 13 kolumn: 0 różnic; próba z jedną zmienioną komórką — skrypt przerywa pracę).
- `npm run verify` (u użytkownika, z `SOURCES_DIR`) sprawdza teraz także `cfa.json` = obiekt `D` z HTML (432 bloki, 48 dni, first pass 04.11).

## 2. Stary i nowy plan CFA
| | v3 (D-006, do 24.09) | D-086 |
|---|---|---|
| Okres | 21.09–11.11 (52 dni) | **25.09–11.11 (48 dni)**, egzamin 12.11 bez zmian |
| Bloki | 416 = 52 × 8 (A–H) | **432 = 48 × 9 (A–I)** |
| Godziny netto | 367,47 h | 381,60 h |
| Recall 22:00 (bez pt i sob) | 38 sesji, 33,57 h | 34 sesje, 30,03 h |
| Curriculum / Schweser | 290 / 75 | 290 / 75 — **ta sama treść i kolejność** |
| Praktyka | 51 (mocki 24, analiza 24, Ethics 3) | 67 (+16 bloków **PRACTICE** — mixed practice w ostatnim tygodniu) |
| First pass do | 05.11 | 04.11 |
| Mocki | 26.10, 30.10, 03.11, 07.11 | bez zmian; pokrycie Curriculum 81,7 / 90,0 / 98,3 / 100% |

Bloki nr 1–279 mają identyczną treść (źródło, strony, temat, tryb) w obu planach — zmieniają się tylko data, godzina i litera.
Postęp (`cfa.done`) jest zapisany numerem bloku, więc ewentualne odhaczenia z 21–24.09 zachowują sens (te same strony).

## 3. Zmiany w aplikacji
**Dane**
- `src/data/cfa.json` — plan D-086.
- `src/data/day_template.json` — 34 sloty (było 32): 12:13–12:20 „Przerwa kognitywna”, 12:20–13:13 „CFA blok E” z „Druga kawa (12:20)”,
  13:13–13:30 „Przerwa na lunch” z lunchem 13:20 (465 kcal w F0/T; glukozamina i witamina C 13:20 bez zmian), bloki F 13:30,
  G 14:30 (zielona herbata 15:00), H 15:30, I 16:40 (pre-trening 17:15). „Długa przerwa” i „Spacer regeneracyjny” usunięte.
  Pozostałe godziny bez zmian. Zmiana zapisana jako funkcja decyzji `tools/extract/day_plan_d086.py`, stosowana przez
  `extract_schedule_safety.py` po odczycie `PLAN_DNIA.html` — ponowna ekstrakcja daje ten sam wynik (sprawdzone na danych sprzed zmiany).
- `src/data/phases.json` — start planu i Faza 0 od 25.09.2026; F1 12.10 i F2 16.11 bez zmian.
- `src/data/supplements.json`, `src/data/rekomp.json` — glukozamina, chondroityna, Boswellia do 25.03.2027 (dane i 3 zdania planu);
  te same zmiany w `extract_supplements.py` i `rekomp_common.py`.

**Kod**
- `validate.js`: numer bloku `cfa.done` 1–432 (stała `CFA_BLOCKS`; było 416 — bloków 417–432 nie dałoby się odhaczyć);
  `migrate/cfa.js`: import `postep-nauki.json` do 432. Typy zdarzeń, klucze i `reduce()` bez zmian.
- `cfa.js`: „Bloki: 432 (48 dni × 9)” liczone z danych (było „× 8” na sztywno); oznaczenie trybu PRACTICE (`.mode.m-pr`, token `--org`).
- `dieta.js`: „Faza 0 · od 25.09”; `rekompozycja.js`: „punkt startowy 25.09.2026”.
- Widoki liczą wszystko z danych, więc bez zmian w kodzie pokazują: 9 bloków dnia, „477 min + 53 min recall”, 34 sesje recall,
  „0 / 432 bloków · 0 / 381,6 h”, kalendarz 25.09–11.11, dni 21–24.09 jako „przed startem planu” („Brak bloku CFA”, bez recall).

**Dni 21–24.09** (przed nowym startem): dieta, suplementy i trening jak dotąd wg Fazy 0 (tak działało już przed 21.09);
zużycie w Zapasach dla tych dni bez zmian.

## 4. Audyt i testy
**Audyt na kodzie aplikacji** (resolver, zapasy, suplementy; 192 dni 21.09.2026–31.03.2027): 0 luk między slotami, każda dawka
w dokładnie jednym slocie, pory posiłków i kaw w swoich slotach, 48 dni CFA, 432 bloki w planie dnia (każdy w slocie o godzinach
z planu; sesje mocka S1/S2 w slotach A/C), 34 sesje recall. Plan sam ze sobą: strony każdego z 10 tomów Curriculum ciągłe od
`od` do `do` (3269 stron, bez luk i powtórzeń), limit stron w każdym bloku, 93 readingi Schwesera dokładnie raz i zawsze po
Curriculum swojego działu, statystyki (`stat`, `faza`, `fpEnd`, `mockCov`, `prac`) zgodne z blokami, analiza mocka G–I tego dnia
i A–C nazajutrz.

**Nowe testy**
- `tests/unit/plan-cfa.test.mjs` (11): struktura planu, 9 bloków dziennie i godziny liter = sloty szablonu, statystyki, fazy
  planu, strony Curriculum, readingi Schwesera, mocki i pokrycie, wspólny start 25.09, szablon dnia D-086, zakres `cfa.done`
  1–432 (zapis i import), suplementy do 25.03.2027. Sprawdzone mutacjami: przywrócenie 416, starego szablonu dnia lub daty
  21.03 — testy nie przechodzą.
- `resolver.test.mjs`: fazy od 25.09, 34 sloty, bloki 25.09–11.11 i ich sloty, dni przed startem, recall 34, dawki 13:20 w slocie 13:13.
- E2E: plan dnia 25.09 (9 bloków A–I, przerwy, druga kawa w E, lunch, brak spaceru), 24.09 „przed startem planu”, dzień mocka
  (analiza G–I), CFA 9 bloków / „1 / 432”, tryb PRACTICE (16), statystyki planu, Dieta „od 25.09”, Rekompozycja „25.09.2026”,
  Suplementacja „do 2027-03-25”.

**Wyniki:** zob. sekcja 6.

## 5. Niespójności — decyzje użytkownika (25.09.2026) i wdrożenie
**P-1. Suplementy czasowe** — decyzja: przyjmowanie od 25.09.2026 do 25.03.2027. Wdrożone jako `validity.from = 2026-09-25`
(`dosesFor`, `supplementOverview`; przed 25.09 bez dawek i bez zużycia w Zapasach), w Suplementacji „od 2026-09-25 do 2027-03-25”.
Uwaga: 25.09–25.03 to 182 dni; przy stanie z 22.09 (180 / 180 / 360) model Zapasów pokazuje zapas do **23.03** — na 24–25.03
brakuje 2 kaps. glukozaminy, 2 Boswellii i 4 chondroityny (widoczne w Zapasach; inwentaryzacja lub zakup to koryguje).

**P-2. Rekompozycja — daty zamiast tygodni** — wdrożone: „Faza 0 (25.09–11.10)”, „Faza 1 (12.10–15.11)”, „Faza 2 (od 16.11)”
(sekcje 3 i 4), tabela fazowania: kolumna „Okres” z datami, „Sukces = ukończenie Fazy 0 bez objawów”, „Ukończona Faza 0 · ≥80% sesji”
(te same zmiany w `rekomp_common.py`, żeby ponowna ekstrakcja je odtworzyła).

**P-3. Dzień mocka** — wdrożone: slot E (12:20–13:13) = „Mock CFA — sesja 2”, „Kontynuacja sesji (10:45–13:00)”
(`week.json`: `mock.replace.E = S2`); „Wolne” zostaje tylko slot F (D-036 zaktualizowana).

**P-4. „Przerwa na lunch”** — potwierdzone.

**P-5. Harmonogram CFA** — naprawione: `bl.map(b => blockRow(b))`; test E2E: w harmonogramie brak wyróżnienia „następny blok”.

**Uwagi informacyjne (bez propozycji zmian)**
- Kroki: cel 8–10 tys. dziennie (Rekompozycja §15) bez zmian; 50-minutowy spacer w południe był dotąd jego częścią.
- Wszystkie urządzenia (Mac, Safari, PWA) należy zaktualizować przed odhaczaniem bloków 417–432 (10–11.11): starsza wersja
  odrzuca takie zdarzenia (w chmurze pomija je trwale, import pliku przerywa).
- Treści pakietu prywatnego (poza repozytorium) nie były sprawdzane.

## 6. Wyniki testów (build `0.2.0+abe3ccf553`, po wdrożeniu P-1…P-5)
| Zestaw | Uruchomione | Zaliczone | Niezaliczone | Pominięte |
|---|---|---|---|---|
| `npm test` | 158 | 157 | 0 | 1 (migracja kopii ZAPASY — wymaga `SOURCES_DIR`) |
| `npm run e2e` | 1014 kontroli (było 962) | 1014 | 0 | 0 bloków |
| `npm run e2e:sync` | 21 | 21 | 0 | 0 |
| `npm run e2e:cloud` | 100 | 100 | 0 | — |
| `npm run a11y` | 0 naruszeń, brak przewijania w poziomie (oba motywy, 390/1280 px) | | | |
| `npm run verify` | nie uruchomiony — wymaga plików użytkownika; nowy fragment CFA sprawdzony osobno na przesłanym HTML (zgodny) | | | |

Po wdrożeniu P-1 przebieg E2E wykazał 12 błędów testów (oczekiwany stan glukozaminy liczony od 23.09 zamiast od 25.09;
tytuł slotu porównywany razem ze znacznikiem „teraz” w dniu bieżącym) — poprawione w testach, kolejny przebieg 1014/1014.
Pierwszy przebieg E2E: 8 błędów w dwóch nowych kontrolach (błąd testu: „381,60 h” zamiast wyświetlanego „381,6 h”; tekst
nagłówka Rekompozycji czytany po `text-transform: uppercase`) — poprawione w teście, drugi przebieg 1010/1010.
Zrzuty 375/390/1280/1440 px, motyw ciemny i jasny: plan dnia 25.09 (11:20–14:23) i harmonogram PRACTICE — bez przewijania
w poziomie, oznaczenie PRACTICE czytelne w obu motywach.

## 7. Zmienione pliki
Dane: `src/data/cfa.json`, `day_template.json`, `phases.json`, `supplements.json`, `rekomp.json`.
Kod: `src/core/storage/validate.js`, `src/core/migrate/cfa.js`, `src/core/resolver.js` (komentarz), `src/modules/cfa.js`,
`dieta.js`, `rekompozycja.js`, `src/ui/styles.css`.
Narzędzia: `tools/extract/extract_static.mjs`, `extract_schedule_safety.py`, `day_plan_d086.py` (nowy), `extract_supplements.py`,
`rekomp_common.py`, `tools/verify/verify_all.py`.
Testy: `tests/unit/plan-cfa.test.mjs` (nowy), `resolver.test.mjs`, `cfa-pace.test.mjs`, `diet-supp.test.mjs`, `consumption.test.mjs`,
`tests/e2e/e2e.py`, `a11y.py`.
Dokumentacja: `docs/DECYZJE_2027.md` (D-086; D-006 → zastąpione; D-017, D-036, I-9; propozycje P-1…P-4), `REDESIGN-DECISIONS.md`,
`REDESIGN-TESTING.md` (klasy, kontrola ręczna nr 11), `REDESIGN-STATUS.md`, `CLAUDE.md`, ten raport.
