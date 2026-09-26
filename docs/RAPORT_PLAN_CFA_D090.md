# Plan CFA v7 i start całego planu 27.09.2026 (D-090) — raport (26.09.2026)

Zakres wg polecenia użytkownika: wgranie nowego planu CFA (`PLAN_NAUKI_CFA_LEVEL_I.html` v7 + `MASTER_SCHEDULE_CFA.csv`),
start całego planu 2027 (CFA, fazy treningu i diety, suplementy, zużycie w Zapasach) od **27.09.2026**, usunięcie dni 25.09 i 26.09,
koniec suplementów czasowych **bez zmian: 21.03.2027**.

## 1. Plan CFA v7
- `cfa.json` wygenerowany skryptem `extract_static.mjs` (`ONLY=cfa`); kontrola krzyżowa z CSV: 409 wierszy, 0 różnic pole po polu.
  Strażnik skryptu odrzuca starsze wersje (v3: 416, v4: 432, v5: 421 bloków).
- **409 bloków: 41 dni × 9 + 5 sobót × 8** (bez bloku E), 46 dni 27.09–11.11.2026; 361,28 h netto + 34 sesje recall (30,03 h,
  bez piątków i sobót). First pass do 05.11. Mocki bez zmian (26.10, 30.10, 03.11, 07.11; sobota z mockiem 07.11 — zwykły układ mocka).
- Kategorie: Curriculum 290, Schweser 71 (49 bloków po jednym readingu + 22 łączące dwa readingi opisowe), praktyka 48 (24 bloki mocków
  + 24 analizy). Tryby PRACTICE i ACTIVE RECALL z v5 nie występują (filtr trybu w harmonogramie pokazuje tylko istniejące).
- Reguły dnia bez zmian: 9 bloków 08:00–17:33, przerwa 12:13–12:20, blok E 12:20, lunch 13:13–13:30; soboty — 12:13–13:13 „Zakupy”.
- **Postęp (`cfa.done`, numer bloku):** bloki 1–35 mają identyczną treść jak w v5 (odcisk treści w teście) — odhaczenia z poprzedniej
  wersji zachowują sens. Limit walidacji 432 bez zmian.

## 2. Start planu 27.09.2026
| Element | Zmiana |
|---|---|
| Start planu (`phases.json` → `start`) | 27.09.2026 (było 25.09) |
| Faza 0 | od 27.09.2026 (było 26.09); Faza 1 12.10, Faza 2 16.11 — bez zmian |
| 25.09 i 26.09 | wyjątki dat usunięte; dni **poza planem** (jak 21–24.09, D-088): bez planu dnia, treningu, dawek, bloków, recall i zużycia |
| 27.09 (niedziela) | pierwszy dzień planu: 9 bloków CFA od 08:00, recall 22:00, dzień sauny zamiast basenu, dieta NT 2332 kcal (wyjątek D-087 bez zmian) |
| Suplementy czasowe | glukozamina, chondroityna, Boswellia **od 27.09.2026 do 21.03.2027** (176 dni); z zapasu z 22.09 zostaje 4 / 4 / 8 kaps. |
| Teksty | Dieta: „Faza 0 · od 27.09”; Rekompozycja: „punkt startowy 27.09.2026”, „Faza 0 (27.09–11.10)” |
| Statystyki treningu | liczone od 27.09 (`TRAIN_FROM` = start planu); wcześniejsze wpisy zostają w dzienniku |

Nie zmieniono: typów zdarzeń, walidacji, `reduce()`, formatu `2027-sync.json`, synchronizacji w chmurze.

**Skutek dla danych:** stany Zapasów z inwentaryzacji sprzed 27.09 są odliczane od 27.09 (zużycie 25–26.09 nie jest już odejmowane).
Trening kalibracyjny LOWER 2 z 26.09 (D-087) zniknął razem z tym dniem — pierwszy trening siłowy: pn 28.09 (UPPER 1).

## 3. Audyt spójności (kod aplikacji, 27.09.2026–31.03.2027)
0 luk w planie dnia; każda dawka w jednym slocie; 409/409 bloków CFA w slotach o godzinach z planu; 34 sesje recall; zakupy w 25
z 26 sobót (bez 07.11 — mock); stany suplementów czasowych nie spadają poniżej zera; dni 01.01–26.09.2026 poza planem bez treningu,
dawek, bloków i zużycia.

## 4. Testy
Zmienione: `plan-cfa.test.mjs` (v7, start 27.09, odcisk bloków 1–35, wyjątek tylko 27.09), `resolver`, `diet-supp`, `consumption`,
`inventory` (4 / 8 kaps. na 21.03), `cfa-pace`, `training`, `week`, `sync-compat`; E2E: 27.09 jako pierwszy dzień, 25–26.09 poza planem,
sobota 03.10, CFA 27.09 (9 bloków), „1 / 409”, Schweser 71, filtr MOCK (24), statystyki „409 (46 dni: 41×9 + 5×8)”; a11y: sobota 03.10.

| Zestaw | Wynik |
|---|---|
| `npm test` | 180 testów: 179 zaliczonych, 1 pominięty (migracja kopii ZAPASY — wymaga `SOURCES_DIR`), 0 niezaliczonych |
| `npm run e2e` | 1167 / 1167 |
| `npm run a11y` | 0 naruszeń, brak przewijania w poziomie |
| `npm run e2e:sync` | 21 / 21 |
| `npm run e2e:cloud` | 100 / 100 |

Wykryte w trakcie: testy zakładały, że bieżący dzień jest w planie — uruchomione 26.09 (dzień poza planem) czekały na plan dnia; teraz
akceptują panel „Poza planem” albo używają jawnej daty. Jeden przebieg `e2e:cloud` trafił na północ czasu warszawskiego (26→27.09,
początek zużycia) i porównał stany z dwóch różnych dni — powtórzony: 100/100.

## 5. Uwagi
- `npm run verify` wymaga wszystkich plików źródłowych (`SOURCES_DIR`) — nieuruchomiony; skrypt zaktualizowany do v7.
- Do sprawdzenia na urządzeniach po aktualizacji: `REDESIGN-TESTING.md` §5 pkt 11.
