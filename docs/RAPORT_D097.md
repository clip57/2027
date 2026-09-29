# Zakupy w czwartki, plan CFA v12, Dzień zero, Kalendarz (D-097) — raport (29.09.2026)

Zakres wg polecenia i odpowiedzi użytkownika (29.09.2026). Rejestr: `docs/DECYZJE_2027.md` → D-097.

## 1. Decyzje użytkownika (odpowiedzi na pytania)
| Pytanie | Odpowiedź |
|---|---|
| Posiłek po saunie i kreatyna w czwartek (do 06.01) | bez zmian, o 20:15 (w czasie slotu zakupów 19:05–20:35) |
| Czwartek od 07.01 | sauna po bloku C: transport 18:53–19:05, sauna 19:05–20:15, od 20:15 bez zmian |
| Suplementy w Dniu zero | bez suplementów |
| Zakupy w tygodniu 28.09–04.10 | pominięte (czwartek 01.10 — LOWER 1, bez wariantu) |

## 2. Zmiany w danych i kodzie
- **Plan dnia** (`tools/extract/day_plan_d097.py`, wpięte w `extract_schedule_safety.py` i `extract_supplements.py`):
  wariant „czwartek” (sloty `slot.1745c` transport, `slot.1755c` sauna, `slot.1905c` zakupy z `shop: true`) — dzień tygodnia 4 do 06.01;
  wariant „czwartek_st” (wyjątki dat 07.01–25.03: `slot.1530j` zakupy, `slot.1600j/1700j/1800j` bloki MPW z `mpwSlot`, obiad `slot.1653j`, sauna `slot.1905j`);
  wariant „zakupy” w soboty usunięty; wyjątki 27–29.09 usunięte.
- **Przesunięcie bloków MPW** w czwartki od 07.01 o 30 min: `week.json` → `mpwShift`, stosowane w `src/core/data.js` (`mpwBloki`, pole `godz_src` z godziną źródłową); `mpw.json` bez zmian.
- **Suplementy przed sauną** w czwartki od 07.01 o 17:45 (dawki rozdzielone w `supplements.json`, `validity.decision = "D-097"`); `supplementOverview` łączy okresy tylko, gdy każda dawka ma okres (inaczej tauryna wyglądałaby na preparat czasowy).
- **Dzień zero** (`phases.json` → `start` = `zero` = 2026-09-29, `end` = 2027-03-28; Faza 0 od 30.09): `resolver.js` — `DAY_ZERO`, `PLAN_END`, `isZero`, `dayPlan()` zwraca `zero: true, outside: true`, `dosesFor()` pusty; `consumption.js` bez zużycia; w „Dziś” panel `.dz-zero`; Trening/Suplementacja/Pielęgnacja — komunikaty dla dnia zero i dni po końcu planu.
- **Plan CFA v12** (`cfa.json`): 387 bloków, 43 dni × 9 (także soboty), 30.09–11.11; strażnik w `extract_static.mjs` (387 bloków, 30.09–11.11).
- **Zapasy:** `nextShopping(data, godz, min)` w `calc/inventory.js` — pierwszy slot `shop` z planu dnia (35 dni naprzód; zapas: kolejny czwartek), zwraca `{date, inDays, from, to}`; Tydzień (`week.js`: `shopping` = godzina slotu), `.ics` (rodzaj „Zakupy w czwartek”).
- **Pielęgnacja:** reguła `cycle: {on, off}` liczona od daty „od” (`calc/care.js` → `inCycle`), pola w oknie edycji kroku. Treść planu — wyłącznie w pliku użytkownika.
- **„Wymaga uwagi”** — nowy wygląd (`.dz-at-item`, `.dz-at-ic`, `.dz-at-go`, stan pusty `.dz-attn-empty`).
- **Moduł Kalendarz** (`src/modules/kalendarz.js`, `registry.js`, trasa `#/kalendarz?m=RRRR-MM`, zakres 2026-09…2027-03, klasy `kl-`): znaczniki dnia z `resolveDay` (`dayMarks`), komórka = link `#/dzis?d=`.

## 3. Testy (stan na commit `b3b4edc`)
| Zestaw | Wynik |
|---|---|
| `npm test` | 208: 207 zaliczonych, 1 pominięty (migracja kopii ZAPASY — `SOURCES_DIR`) |
| `npm run a11y` | 0 naruszeń, brak przewijania w poziomie (dodane: Kalendarz ×2, Dzień zero, czwartki 08.10 i 07.01) |
| Test dymny w przeglądarce (poza repozytorium) | 16 widoków × 390/1280 px bez błędów; klik w Kalendarzu otwiera dzień |
| `npm run e2e`, `e2e:sync`, `e2e:cloud` | **nieuruchomione po D-097** — zob. `docs/PRZEKAZANIE.md` §4 |

## 4. Ograniczenia i sprawy do potwierdzenia z użytkownikiem
- 24.12 i 31.12 to czwartki — plan pokazuje saunę i zakupy (wariant „czwartek”); nie potwierdzone przez użytkownika.
- Niespójności pliku źródłowego CFA v12 (dane bez zmian, testy dostosowane): 47 bloków FI ma w zadaniach „10 s.” przy zakresie 11 stron;
  pokrycie mocków (`mockCov`) liczone względem 290 bloków Curriculum, a v12 ma 285.
- Niedziele świąteczne bez wariantu „basen” — kroki pielęgnacji przypięte do `slot.2015n` nie mają znacznika w slocie.
