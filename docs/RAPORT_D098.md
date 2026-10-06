# Plan CFA v13 od zera (D-098) — raport (06.10.2026)

Rejestr: `docs/DECYZJE_2027.md` → D-098. Źródło: `PLAN_NAUKI_CFA_LEVEL_I.html` („MASTER SCHEDULE FINAL”, bez oznaczenia wersji — w repozytorium v13), dostarczony 06.10.2026.

## 1. Decyzja użytkownika
| Pytanie | Odpowiedź |
|---|---|
| Co zrobić z odhaczeniami bloków CFA z v12? | **Zacząć od zera** (blok 1 = 05.10) |

## 2. Co się zmieniło w planie (v12 → v13)
| | v12 | v13 |
|---|---|---|
| Bloki / dni | 387 / 43 × 9 | 342 / 38 × 9 |
| Okres | 30.09–11.11 | 05.10–11.11 |
| First pass (strony na blok) | 285 bloków (11,5) | 264 bloki (12,4) |
| Schweser / practice | 66 / 36 | 47 / 31 |
| Analiza po mocku | 3 bloki | 2 bloki (G, H); blok I to nauka |
| Mixed practice | 26.10 A–H, 27.10 A | 26.10 D–I, 27.10 A |
| Recall 22:00 | 31 sesji | 28 sesji |
| Godziny netto | 341,85 h | 302,1 h |
Bez zmian: mocki 30.10, 03.11, 07.11; koniec first passa 05.11; egzamin 12.11; 93 readingi Schwesera dokładnie raz (nowość: bloki łączone „READING a + b”).
Żaden z 30 pierwszych bloków nie pokrywa się z v12 (start od QM s. 3, blok 1 = s. 3–14), więc numery bloków v12 i v13 nie są porównywalne.

## 3. Zmiany w kodzie
- `src/data/cfa.json` — wygenerowany `extract_static.mjs` z dostarczonego pliku; guard: 342 bloki, 05.10–11.11.
- `validate.js`: `CFA_PLAN_VERSION = 13`, pole `plan` w `cfa.done` (opcjonalne). `store.js`: `cfaDone` liczy tylko `plan ≥ 13`.
- `cfa.js` + `study.js`: zapis odhaczeń z `plan` (`doneExtra`); `migrate/cfa.js`: import `postep-nauki.json` też ze znacznikiem.
- Rozwiązanie nie zapisuje zdarzeń kasujących, więc nie ma wyścigu między urządzeniami; stare zapisy zostają w bazie i eksporcie.
- Resolver bez zmian: 30.09–04.10 to dni projektu bez bloków i recallu CFA (start czytany z `cfa.json`).

## 4. Testy
- `npm test`: 208 przechodzi, 1 pominięty (stan sprzed zmian: 207 + 1 pominięty; doszedł test D-098). `npm run build` przechodzi.
- Zaktualizowane: `plan-cfa`, `cfa-pace`, `resolver`, testy zapisujące `cfa.done` (znacznik `plan: 13`), generator w `reduce-incremental` (część zapisów bez znacznika).
- **Nieuruchomione:** `npm run e2e` i `npm run a11y` (brak Chromium w środowisku); asercje w `tests/e2e/*.py` poprawione ręcznie (30.09 → 05.10, 387 → 342, 31 → 28 sesji, 302,1 h).
- **Nieuruchomione:** `npm run verify` (wymaga `SOURCES_DIR` z plikami użytkownika) oraz kontrola krzyżowa z `MASTER_SCHEDULE_CFA.csv` (pliku nie dostarczono).

## 5. Do sprawdzenia przez użytkownika
- Po wdrożeniu: licznik CFA = `0 / 342`, dziś (06.10) 9 bloków zaległych z 05.10, 30.09–04.10 bez bloków.
- Recall (ustawienia `cfa.recall:<data>`) jest zapisany po dacie, nie po bloku — jeśli recall z 05.10 był odhaczony w v12, pozostanie odhaczony.
- Urządzenie z kodem sprzed D-098, które jeszcze synchronizuje, zapisuje odhaczenia bez `plan` — nie liczą się w v13 (po aktualizacji aplikacji na wszystkich urządzeniach problem znika).
