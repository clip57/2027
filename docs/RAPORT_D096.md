# Plan MPW v8, weekendy i przesunięty tydzień (D-096) — raport (29.09.2026)

Zakres wg polecenia i odpowiedzi użytkownika (29.09.2026).

## 1. Plan MPW v8 (`src/data/mpw.json`)
- Źródło: `PLAN_NAUKI_MPW.html` v8 — kontrola krzyżowa z `MASTER_SCHEDULE_MPW.csv` v7: 392 wiersze, zgodne pole po polu.
  Strażnik ekstrakcji: 392 bloki, 16.11.2026–20.03.2027.
- **392 bloki, 119 dni**: 114 dni × 3 (A 15:30, B 16:30, C 17:30) + 5 dni × 10 — w 6–7.03, 13–14.03 i 20.03 dodatkowo P1–P7
  „powtórka całości” 8:00–15:23 (godziny slotów A–G). Start 16.11 (poniedziałek), 5 symulacji (21.02, 27.02, 06.03, 13.03, 17.03),
  dni wolne 24–27.12 i 19–20.02, egzamin 21.03.2027 11:00. Prawo — pierwsze przejście także w fazie 2 (do 20.03).
- Zakładka MPW od 12.11 bez zmian (D-095). Numery bloków inne niż w v3 — postęp MPW nie był jeszcze zapisywany (plan startuje 16.11).

## 2. Weekendy 8:00–15:23 (sloty A–G, system blokowy CFA)
Dane: `week.json` → `blocks` (data → rodzaj, tytuł), generowane funkcją `apply_week_d096` w `tools/extract/day_plan_d096.py`
(stosowaną w `extract_schedule_safety.py` po D-087 i D-094). Resolver: `dayBlocks(date)`; tytuł w slotach A–G (do 15:23),
sloty H–I jak dotąd.

| Weekendy | Wpis w slotach A–G | Zakupy w sobotę |
|---|---|---|
| Zjazdy: 14–15.11, 5–6.12, 9–10.01, 6–7.02, 20–21.02 | „Wycena przedsiębiorstwa i modelowanie finansowe - studia” (zjazd 1–5) | **nie** (studia 8:00–15:23; slot E zostaje) |
| 21–22.11, 28–29.11 | „Przygotowywanie do rozmowy kwalifikacyjnej” | tak (12:13–13:13, bez bloku E) |
| Pozostałe 12.12.2026–14.03.2027: 12–13.12, 19–20.12, 2–3.01, 16–17.01, 23–24.01, 30–31.01, 13–14.02, 27–28.02 | „Pisanie pracy magisterskiej” | tak |
| 6–7.03, 13–14.03, 20.03 | bloki MPW P1–P7 (plan MPW ma pierwszeństwo — decyzja użytkownika) | nie (blok P5 12:20–13:13) |
| 21.03 | „Egzamin MPW” — start 11:00 | — |
| 26–27.12, 27–28.03 | „Wolne” — dzień całkowicie wolny | nie |

- Widok „Tydzień”: linia weekendu (np. „Studia 8:00–15:23”); nagłówek „Dziś”: znacznik rodzaju dnia.
- Bloki MPW A–C (15:30–18:23) nadal w karcie „Nauka MPW” (D-095); w dni z P1–P7 karta pokazuje 10 bloków, a sloty A–G — „MPW blok P1…P7”.

## 3. Święta (26–27.12.2026, 27–28.03.2027) — decyzja: całkowicie wolne
Wyjątki dat (`week.json` → `exceptions`): bez treningu, sauny i basenu (typ dnia „wolny”), dieta NT, bez wariantu dnia (bez zakupów w sobotę i bez
układu „basen” w niedzielę). Dawki suplementów bez zmian (wg dni tygodnia; kreatyna w niedzielę o 19:30 wypada w oknie treningowym „Wolne”).

## 4. Tydzień 28.09–04.10.2026 — tylko ten tydzień
| Dzień | Plan | Dieta |
|---|---|---|
| pn 28.09, wt 29.09 | bez treningu | NT |
| śr 30.09 | UPPER 1 + sauna | T |
| czw 01.10 | LOWER 1 | T |
| pt 02.10 | Rower + ABS + sauna | T |
| sob 03.10 | 2 × sauna (bez treningu), zakupy bez zmian | NT |
| nd 04.10 | basen (bez zmian) | T |

UPPER 2 i LOWER 2 w tym tygodniu nie występują. Od 05.10 plan tygodnia bez zmian (test). Recall CFA bez zmian. Zapasy (zużycie), Meal Prep,
Trening, Dieta, ⌘K i `.ics` korzystają z `dayPlan`/`resolveDay` — uwzględniają wyjątki automatycznie.

## 5. Testy
- Nowe: `resolver.test.mjs` (tydzień 28.09–04.10, weekendy D-096), `consumption.test.mjs` (dieta tygodnia 28.09 i świąt),
  `plan-mpw.test.mjs` (v8: 392 bloki, P1–P7 w godzinach A–G, 5 symulacji, sloty), E2E `run_mpw` (v8 i weekendy: zjazd bez zakupów,
  praca magisterska z zakupami, święta, P1–P7, Tydzień), a11y: 4 nowe widoki.
- Testy ogólnej logiki, które używały tygodnia 28.09 jako „zwykłego” tygodnia (kcal, sauna, posiłek po saunie, serie, zużycie, `.ics`, ⌘K,
  zegar E2E i a11y), przeniesione na tydzień 05.10 (bez wyjątków) — zasada z CLAUDE.md; liczby slotów w sobotę/niedzielę z uwzględnieniem D-096.

| Zestaw | Wynik |
|---|---|
| `npm test` | 206 testów: 205 zaliczonych, 1 pominięty (migracja kopii ZAPASY — wymaga `SOURCES_DIR`), 0 niezaliczonych |
| `npm run e2e` | 1382 / 1382 |
| `npm run a11y` | 0 naruszeń, brak przewijania w poziomie |
| `npm run e2e:sync` | 23 / 23 |
| `npm run e2e:cloud` | 100 / 100 |

## 6. Ograniczenia
- Plan dnia po 11.11 w dni powszednie bez zmian (sloty CFA „Brak bloku CFA”, bloki MPW w karcie) — do czasu nowego rozkładu dnia.
- W niedziele świąteczne pielęgnacja przypięta do slotu 20:15 (wariant „basen”) nie ma znacznika w slocie — kroki są w module Pielęgnacja.
- `npm run verify` wymaga plików źródłowych — nieuruchomiony w całości; kontrola MPW v8 sprawdzona na dostarczonym pliku.
