# Raport D-109 — święta i zakupy (punkt D3 audytu 23.10.2026) — 24.10.2026

Decyzja użytkownika (24.10.2026, do punktu D3 z `docs/RAPORT_AUDYT_2026-10-23.md`): „usuń zakupy w sylwestra i tak: ma być bez zakupów do 7 stycznia,
1 stycznia pomiń trening ale zostaw MPW, 6 stycznia zostaw rower z sauną”. Punkt D1 (bloki MPW a plan dnia od 16.11) — decyzja później;
D2 (egzamin CFA 12.11) — bez zmian („Czas własny” w slotach nauki, D-108).

## 1. Zmiany planu

| Dzień | Było | Jest |
|---|---|---|
| czw 31.12.2026 (Sylwester) | 2 rundy sauny 17:55–19:05, zakupy 19:05–20:35 | 2 rundy sauny jak dotąd, potem powrót do domu z posiłkiem 20:15 (wariant `czwartek_bz`, jak 24.12) — **bez zakupów** |
| zakupy w okresie świąt | 17.12, 31.12, 07.01 (24.12 bez zakupów — D-103) | **17.12, potem 07.01** (15:30–16:00, wariant od 07.01 bez zmian) — 21 dni bez zakupów |
| pt 01.01.2027 (Nowy Rok) | UPPER 2, dieta treningowa, bloki MPW A–C | **bez treningu**, dieta nietreningowa (NT) — jak inne dni wyjątkowo bez treningu (D-103b); bloki MPW A–C bez zmian; piątek nie ma sauny |
| śr 06.01.2027 (Trzech Króli) | rower 55 min + ABS, sauna | bez zmian |

Dieta NT w dzień bez treningu wynika z reguły planu (D-018: typ dnia → wariant diety) i z wcześniejszych dni wyjątkowo bez treningu (01–02.11, D-103b).
Dawki: kreatyna z posiłkiem 20:15 (jak w inne dni bez treningu); wszystkie dawki w slotach planu dnia (test „każda dawka w dokładnie jednym slocie”).

Wprowadzenie: `tools/extract/day_plan_d109.py` (wyjątki dat w `src/data/week.json`; uruchamiać po pozostałych skryptach planu dnia, idempotentny).
Pakiet prywatny: bez zmian (teksty nie odnoszą się do 31.12 ani 01.01).

## 2. Skutki w aplikacji (bez zmian kodu)
- „Dziś”, Tydzień, Kalendarz, `.ics` (zakupy, trening): z planu dnia — 31.12 bez zakupów, 01.01 bez treningu.
- Zapasy, „Wymaga uwagi”, Suplementacja: najbliższe zakupy po 17.12 → 07.01 (21 dni); prognozy „skończy się przed zakupami” liczone do 07.01.
- Zużycie w Zapasach: 01.01 z dietą NT.

**Do rozważenia (bez zmian w tej decyzji):** lista „Do kupienia” liczy zapas na 14 dni (produkty trwałe) i 7 dni (świeże) od dnia zakupów —
17.12 nie obejmie całej przerwy do 07.01. Aplikacja pokaże w „Wymaga uwagi”, które produkty skończą się przed 07.01. Jeśli lista ma przed dłuższą
przerwą sama liczyć zapas trwałych produktów do następnych zakupów — osobna decyzja.

## 3. Testy
- `tests/unit/plan-cfa.test.mjs`: 31.12 — 2 × sauna, dieta NT, wariant `czwartek_bz`, bez zakupów; zakupy 17.12 i 07.01, żadnych 18.12–06.01;
  01.01 — dzień wolny, NT, bloki MPW A–C, bez treningu; 06.01 jak zwykła środa; lista wyjątków dat.
- `tests/unit/inventory.test.mjs`: najbliższe zakupy z 23.12 i po 17.12 → 07.01.
- `tests/unit/week.test.mjs`, `care.test.mjs`: Tydzień (zakupy w czwartki bez 31.12), opis slotu „Powrót do domu” (czw, 24.12–31.12).
- `tests/e2e/e2e.py` → `run_d108`: „Dziś” 31.12 (sauna, bez zakupów, notatka) i 01.01 (bez treningu, 3 bloki MPW), Trening 01.01 — oba warianty buildu.

Wyniki pełnej regresji — `docs/RAPORT_D108.md` §4 (wspólny przebieg D-108 i D-109).
