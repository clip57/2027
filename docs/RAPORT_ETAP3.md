# Raport Etapu 3 — Dziś, Dieta, Suplementacja (22.09.2026)

## Wykonane
**Rdzeń (testowalny bez interfejsu)**
- `core/calc/diet.js`: `dietSummary(faza, wariant)` (posiłki, sumy, procenty z PDF wraz z metodą liczenia, przyprawy, zamienniki) i `phaseDiff` (co zmienia się między fazami).
- `core/calc/supplements.js`: `scheduleFor(data)` (dawki pogrupowane po porach, z dniami tygodnia i okresem ważności) oraz `supplementOverview(data)` (częstotliwość, dawka dzienna, status czasowy, śledzenie stanu).
- `dzis.js: currentSlot()` — bieżący i następny slot z zegara.

**Moduł Dziś (docelowy)**
- Karta „teraz” z bieżącym slotem, następnym punktem dnia i skokiem do niego (tylko dla dzisiejszej daty).
- Podsumowanie dnia: dieta (kcal + makro), trening (nazwa sesji + liczba serii w aktualnej fazie), CFA (liczba bloków, minuty, recall), sauna.
- Plan dnia z Etapu 2 (sloty, podpunkty, bloki CFA ze źródłem i stronami, suplementy) — bez zmian merytorycznych, z wyróżnieniem bieżącego slotu.
- Skróty do jadłospisu i suplementacji danego dnia.

**Moduł Dieta**
- Przełączniki fazy (0/1/2) i rodzaju dnia (T/NT); domyślnie stan dzisiejszy.
- Sumy dzienne z udziałami procentowymi oraz wyjaśnienie, że procenty liczone są od kcal z makroskładników (4/4/9), a suma z tabeli jest wyższa — obie wartości pochodzą ze źródła.
- Posiłki jako rozwijane sekcje: pozycja, gramatura (z jednostką), kcal i makro.
- Tabela różnic między fazami, zamienniki i przyprawy.

**Moduł Suplementacja**
- Wybór dnia z najbliższego tygodnia; plan pogrupowany po porach z sytuacją (posiłek), nazwą, dawką, postacią i uwagami (np. „na czczo”, w czwartek „bez banana”).
- Przegląd preparatów: pory, dni tygodnia, dawka dzienna, okres ważności oraz **stan i prognoza z modułu Zapasy** (dla nieśledzonego cynku jawna informacja).
- Ostrzeżenie o zakończeniu preparatów czasowych 21.03.2027 z licznikiem dni.

## Zachowane bez zmian
Architektura warstw, magazyn zdarzeń, synchronizacja, migracje, moduł Dane, format danych użytkownika. Żadna migracja nie jest potrzebna.

## Problem wykryty i naprawiony
Wariant jednoplikowy przestał się uruchamiać: w podstawianiu kodu do szablonu HTML `String.replace` interpretował sekwencję `$&` obecną w kodzie jako wzorzec i obcinał skrypt. Podstawianie odbywa się teraz funkcją, a skrypt budowania sprawdza kompletność wbudowanego kodu i arkusza stylów.

## Testy
| Zestaw | Wynik |
|---|---|
| Weryfikacja danych ze źródłami | 407 / 0 błędów |
| Jednostkowe | 48 / 48 (nowe: zestawienie diety i zgodność z PDF, różnice faz, plan suplementów dla poniedziałku/czwartku/po 21.03.2027, przegląd preparatów) |
| E2E (web i pojedynczy plik × 390 / 1280 px) | 220 / 0 błędów (nowe: podsumowanie dnia, karta „teraz”, przełączanie fazy i wariantu diety, NT z „Posiłkiem po saunie”, cynk tylko w czwartek i niedzielę, stan magazynu w suplementach) |

## Następny krok
Etap 4: Meal Prep i Zapasy (ilości z diety, progi D-013, dziennik zapasów, lista zakupów, przeniesienie wartości badań z tekstów MEAL_PREP do pakietu prywatnego).
