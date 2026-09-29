# Plan nauki MPW (D-095) — raport (29.09.2026)

Zakres wg polecenia i decyzji użytkownika (29.09.2026): plan nauki do egzaminu na Maklera Papierów Wartościowych „w takiej samej formie jak CFA”,
obowiązujący od 17.11.2026 do 21.03.2027; do końca planu CFA moduł „na bocznym torze”, potem zajmuje miejsce CFA na liście.

## 1. Dane (`src/data/mpw.json`)
- Źródło: obiekt `D` z `PLAN_NAUKI_MPW.html`, kontrola krzyżowa pole po polu z `MASTER_SCHEDULE_MPW.csv` (354 wiersze — zgodne).
  Ekstrakcja: `SOURCES_DIR=… ONLY=mpw node tools/extract/extract_static.mjs` (blokada innego planu: 354 bloki, 17.11.2026–20.03.2027).
  Wspólna funkcja kontroli CSV dla CFA i MPW (`crossCheck`); `cfa.json` po ponownej ekstrakcji bez zmian.
- Plan: **354 bloki po 53 min, 118 dni × 3** — A 15:30–16:23, B 16:30–17:23, C 17:30–18:23; 312,7 h netto; prawo 131, literatura 66,
  praktyka 157; **6 symulacji** (23.01, 06.02, 21.02, 27.02, 06.03, 13.03 — 15:30–18:30, testy KNF z lat 2023–2026); dni wolne 24–27.12.2026
  i 19–20.02.2027; faza 1 do 18.02 (pierwsze przejście do 15.02), faza 2 od 21.02; **egzamin 21.03.2027, 11:00**.
- `npm run verify`: nowa kontrola `mpw.json` = obiekt `D` z `PLAN_NAUKI_MPW.html` (wymaga `SOURCES_DIR`).

## 2. Model danych (zgoda użytkownika 29.09.2026)
| Typ | Treść | Klucz „ostatni zapis wygrywa” |
|---|---|---|
| `mpw.done` | `{ block: 1–400, done }` | `mpw.done:<nr>` |
| `mpw.err.put` / `mpw.err.del` | `{ id, data }` / `{ id }` | `mpw.err:<id>` |

- Osobne typy, bo numery bloków CFA i MPW się pokrywają, a `cfa.done` przyjmuje tylko bloki CFA. Stan: `mpwDone`, `mpwErrors` (akumulator P1,
  test równoważności `reduce-incremental.test.mjs` rozszerzony o niezależny wzorzec).
- Bez zmian: pozostałe typy i klucze, baza `p2027`, format `2027-sync.json`, synchronizacja plikiem i w chmurze, wynik `reduce()` dla istniejących danych.
- Urządzenie ze starszą wersją zachowa zdarzenia `mpw.*` i pokaże baner „Niepełne przetwarzanie” do czasu aktualizacji (D-056).

## 3. Moduł MPW (`src/modules/mpw.js`) — wspólny widok z CFA (`src/modules/study.js`)
- Kod widoku CFA przeniesiony do `study.js` i sparametryzowany (dane, typy zdarzeń, recall, etykiety, widok „Plan”); `cfa.js` i `mpw.js` to konfiguracje.
  Zachowanie CFA bez zmian (te same klasy, teksty i testy).
- Widoki MPW: **Dzień** (bloki A–C, „Następny”, zaległe z poprzednich dni, „Oznacz cały dzień”; przed 17.11 podgląd pierwszego dnia i „Start planu: …”),
  **Harmonogram** (filtry kategorii i trybu, wyszukiwanie także po punkcie KNF, minione dni zwinięte), **Kalendarz** (symulacje, egzamin, dni wolne),
  **Error log** (osobny od CFA; eksport `error-log-mpw.csv`; bez importu CSV v3, który dotyczy CFA), **Plan** (źródła pierwszego przejścia z postępem,
  kolejność obszarów KNF z priorytetami, symulacje z testem KNF, fazy, dni wolne, statystyki trybów i kategorii).
- W wierszu bloku MPW dodatkowo: punkty KNF, priorytet i zwinięte „Zadania bloku”. Recall 22:00 — tylko CFA (w MPW active recall jest w blokach).
- Punktowe odświeżanie (P2) jak w CFA.

## 4. Miejsce na liście (`registry.js`: `tabUntil` / `tabFrom`, `modulesOn(today)`)
- Do **11.11.2026** (ostatni dzień planu CFA): na pasku zakładek CFA; MPW w „Więcej”, w panelu bocznym za CFA.
- Od **12.11.2026**: MPW na pasku w miejscu CFA; CFA w „Więcej” (pełna historia i error log), w panelu — MPW przed CFA.

## 5. Integracje (godziny planu dnia bez zmian — decyzja użytkownika)
- **Dziś**: w dniach planu MPW karta „Nauka MPW” (3 bloki, godziny z planu MPW, odhaczanie; w dniu symulacji „Symulacja egzaminu MPW”),
  szybki link „Bloki MPW”, znacznik „Symulacja MPW”; od 12.11 kafel „MPW” i karta „Plan MPW” zamiast CFA. Sloty szablonu dnia bez zmian
  (po 11.11 sloty CFA pokazują „Brak bloku CFA”, jak dotąd).
- **Tydzień**: „MPW: 3 bloki” / „Symulacja MPW 15:30”.
- **Wymaga uwagi**: zaległe bloki CFA i recall — do egzaminu CFA (12.11); zaległe bloki MPW — do egzaminu MPW.
- **⌘K**: bloki MPW (temat, źródło, artykuły, punkty KNF) i error log MPW. **Diagnostyka**: bloki MPW odhaczone z przyszłą datą.
- **Przypomnienia `.ics`**: nowy rodzaj „Bloki MPW” (bloki wg godzin planu MPW; symulacja jako jedno wydarzenie 15:30–18:30).
- **Dane**: nazwy typów `mpw.*` w podglądzie importu.

## 6. Poprawki przy okazji (wygląd, bez zmian logiki)
- Widok „Plan” CFA: pasek postępu działu był elementem liniowym — wiersze działów nachodziły na siebie (błąd sprzed D-095); teraz blok.
- Wiersz bloku i nagłówek dnia: łamanie długich ciągów bez spacji (adresy w zadaniach MPW) i stała szerokość pierścienia — bez przewijania przy 320 px.
- Pasek zakładek na telefonie: etykiety w `--text-2` zamiast `--muted` — kontrast AA także nad prześwitującym przyciskiem (wykryte przez a11y na trasie MPW).

## 7. Testy
Nowe: `plan-mpw.test.mjs` (spójność planu, statystyki, fazy, symulacje, typy `mpw.*` i niezależność od CFA, zamiana zakładki 11/12.11, dzień bez zmian
szablonu, Wymaga uwagi, `.ics`, ⌘K, synchronizacja plikiem); E2E `run_mpw` (przed zamianą, zamiana 12.11, Dziś 17.11 i dzień symulacji,
odhaczanie w Dziś i w module, P2, zadania, harmonogram, kalendarz, error log i eksport, plan, tydzień, Wymaga uwagi, `.ics`, 320 px);
a11y: 7 widoków i 2 stany. Zmienione: liczby modułów w nawigacji (12 w panelu, 8 w „Więcej”), etykieta zakładki nauki zależna od daty uruchomienia.

| Zestaw | Wynik |
|---|---|
| `npm test` | 203 testy: 202 zaliczone, 1 pominięty (migracja kopii ZAPASY — wymaga `SOURCES_DIR`), 0 niezaliczonych |
| `npm run e2e` | 1368 / 1368 (nowy blok `run_mpw`: 62 kontrole) |
| `npm run a11y` | 0 naruszeń, brak przewijania w poziomie (także 7 widoków MPW i 2 stany) |
| `npm run e2e:sync` | 23 / 23 |
| `npm run e2e:cloud` | 100 / 100 |

## 8. Ograniczenia
- Plan dnia po zakończeniu CFA (godziny pracy, treningu, obiadu przy blokach 15:30–18:23) — bez zmian do czasu podania nowego rozkładu przez użytkownika.
- `npm run verify` wymaga plików źródłowych — nieuruchomiony w całości; kontrola MPW sprawdzona na dostarczonym pliku.
- Do sprawdzenia na urządzeniach: zakładka MPW po 12.11, karta „Nauka MPW” na telefonie, synchronizacja odhaczeń MPW między urządzeniami.
