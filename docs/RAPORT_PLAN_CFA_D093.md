# Plan CFA v9 od 28.09.2026 (D-093) — raport (27.09.2026)

Zakres wg polecenia użytkownika: wgranie nowego planu CFA (`PLAN_NAUKI_CFA_LEVEL_I.html` v9 + `MASTER_SCHEDULE_CFA.csv`).
Decyzja użytkownika (27.09.2026): **zmienia się tylko plan CFA** — start całego planu 2027 (Faza 0, trening, dieta, suplementy,
zużycie w Zapasach) zostaje **27.09.2026** (D-090).

## 1. Plan CFA v9
- `cfa.json` wygenerowany skryptem `extract_static.mjs` (`ONLY=cfa`); kontrola krzyżowa z CSV: 400 wierszy, 0 różnic pole po polu.
  Strażnik skryptu odrzuca starsze wersje (v3: 416, v4: 432, v5: 421, v7: 409 bloków).
- **400 bloków: 40 dni × 9 + 5 sobót × 8**, 45 dni **28.09–11.11.2026**; 353,33 h netto + 33 sesje recall (29,15 h; bez piątków i sobót).
  First pass do 05.11. Materiał i kolejność bez zmian — w źródle: „zmieniły się wyłącznie daty i struktura dnia”.
- Kategorie: Curriculum 290, Schweser 66 (39 bloków po jednym readingu + 27 łączących dwa readingi), praktyka 44.
- **Mocki: 3** (30.10, 03.11, 07.11); analiza pogłębiona nazajutrz — 2 bloki (A–B). Dawny mock z 26.10 zastąpiony przez
  **mixed practice** — 11 bloków (cały 26.10 i A–B 27.10), tryb **PRACTICE** (w aplikacji już obsługiwany: filtr trybu, znacznik `m-pr`).
- Reguły dnia bez zmian: 9 bloków 08:00–17:33, przerwa 12:13–12:20, blok E 12:20, lunch 13:13–13:30; soboty — 12:13–13:13 „Zakupy”;
  recall 22:00 poza pulą bloków.
- **Postęp (`cfa.done`, numer bloku):** bloki 1–158 mają identyczną treść jak w v7 (odcisk treści w teście), bloki 1–35 — jak w v4, v5, v7.
  Odhaczenia z v7 zachowują sens (ten sam materiał, data późniejsza o dzień). Limit walidacji 432 bez zmian.

## 2. Skutki w aplikacji
| Element | Stan |
|---|---|
| 27.09.2026 (niedziela) | pierwszy dzień planu 2027 bez zmian (sauna, dieta NT 2332 kcal, Faza 0, suplementy); **bez bloków CFA i bez recall** — sloty CFA „Brak bloku CFA · Poza okresem planu nauki”, kafelek CFA w „Dziś”: „poza planem” |
| 28.09.2026 | pierwszy dzień planu CFA: 9 bloków od 08:00, recall 22:00 |
| 26.10.2026 | zwykły dzień (mixed practice w blokach A–I) zamiast dnia mocka |
| Recall | 33 sesje (dni planu CFA bez piątków i sobót) |
| Moduł CFA | tempo, zaległe, harmonogram, kalendarz (3 mocki), statystyki planu — z danych `cfa.json`, bez zmian w kodzie |
| Odhaczony recall 27.09 (jeśli był) | zostaje w dzienniku (`setting`), nie jest liczony — 27.09 nie jest dniem planu CFA |

Nie zmieniono: kodu aplikacji, typów zdarzeń, walidacji, `reduce()`, formatu `2027-sync.json`, synchronizacji, `phases.json`,
`week.json`, `supplements.json`, `rekomp.json`. Pakiet prywatny nie wymaga aktualizacji (stan „aktualny” zależy od startu planu 27.09).

## 3. Testy
Zmienione: `plan-cfa.test.mjs` (v9, CFA od 28.09 przy starcie planu 27.09, mixed practice, 3 mocki, odcisk bloków 1–158),
`resolver.test.mjs` (bloki i recall od 28.09, 33 sesje, dzień mocka 30.10), `cfa-pace.test.mjs`; E2E: 27.09 bez CFA, 28.09 — 9 bloków,
„1 / 400”, Schweser 66, MOCK 18, PRACTICE 11, kalendarz 3 mocki, statystyki „400 (45 dni: 40×9 + 5×8)”, recall 33, część CFA testu
funkcji na zegarze 29.09; kafelek CFA w „Dziś” sprawdzany na jawnej dacie (wcześniej zależał od dnia uruchomienia); a11y: odhaczony
blok 28.09, dzień mocka 30.10. `verify_all.py`: kontrola CFA dla v9 (część CFA uruchomiona z plikami v9 — 5/5; pełny `npm run verify`
wymaga wszystkich plików źródłowych).

| Zestaw | Wynik |
|---|---|
| `npm test` | 188 testów: 187 zaliczonych, 1 pominięty (migracja kopii ZAPASY — wymaga `SOURCES_DIR`), 0 niezaliczonych |
| `npm run e2e` | 1217 / 1217 |
| `npm run a11y` | 0 naruszeń, brak przewijania w poziomie |
| `npm run e2e:sync` | 21 / 21 |
| `npm run e2e:cloud` | 100 / 100 |

## 4. Do sprawdzenia na urządzeniach
- „Dziś” 27.09: bez bloków CFA; od 28.09: bloki od 08:00. Moduł CFA: „0 / 400” (lub liczba odhaczonych dotąd bloków).
