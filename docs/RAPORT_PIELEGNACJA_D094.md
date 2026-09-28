# Moduł „Pielęgnacja” i niedziela z basenem (D-094) — raport (28.09.2026)

Zakres wg decyzji użytkownika (27–28.09.2026): nowy moduł „Pielęgnacja” (pielęgnacja skóry i włosów: co, kiedy, czym, jak często,
czy wykonane, jakie produkty w użyciu) w istniejącej architekturze; plan **wyłącznie w danych użytkownika** (bez treści w repozytorium);
dwa nowe typy zdarzeń; zmiana planu dnia w niedziele.

## 1. Prywatność
- Dokument źródłowy zawiera leki na receptę i dane zdrowotne, a repozytorium jest publiczne — **w repozytorium nie ma żadnej treści
  planu** (nazw produktów, kroków). Są tylko: kod modułu, logika reguł i syntetyczne dane testowe „[DANE TESTOWE] …” (`fixtures.py`).
- Plan użytkownika trafia do aplikacji z pliku `2027-pielegnacja.json` (tworzony poza repozytorium, przekazany użytkownikowi) —
  import w module Dane. Dalej: dziennik zdarzeń na urządzeniu, plik `2027-sync.json` (jawny — ostrzeżenie w Dane obejmuje plan),
  zaszyfrowana chmura.
- Imię i nazwisko: nie występują w repozytorium ani w historii commitów; plik importu nie zawiera metadanych dokumentu.

## 2. Model danych (zgoda użytkownika 28.09.2026)
| Typ | Treść | Klucz „ostatni zapis wygrywa” |
|---|---|---|
| `care.def` | `{ id, kind: 'step' \| 'product', data, deleted? }` | `care.def:<id>` |
| `care.done` | `{ date, step, done }` | `care.done:<data>\|<krok>` |

- Walidacja w `validate.js`; stan: `careDefs` (definicje bez usuniętych), `careDone` — w akumulatorze `Reducer` (P1), przyrostowo.
- Bez zmian: pozostałe typy, klucze, baza `p2027`, format `2027-sync.json`, synchronizacja (plik i chmura), wynik `reduce()` dla
  istniejących danych (test `reduce-incremental.test.mjs` rozszerzony o nowe typy z niezależnym wzorcem).
- Urządzenia ze starszą wersją zachowają zdarzenia `care.*` i pokażą baner „Niepełne przetwarzanie” do czasu aktualizacji (D-056).
- Import (`bundle.js`, rodzaj `care`): każda definicja jako `care.def` o identyfikatorze z treści — ponowny import tego samego pliku
  niczego nie dodaje; zmieniona definicja = nowa wersja.

## 3. Reguły harmonogramu (`src/core/calc/care.js`)
Krok: pora (rano / w ciągu dnia / wieczór), grupa, kolejność, czynność, produkt, dni tygodnia, okres od–do, doraźnie (bez liczenia
postępu), ostrzeżenie, czas odczekania, powiązanie ze slotem planu dnia. Produkt: nazwa, obszar, status (w użyciu / w zapasie /
skończony), data otwarcia, notatka. Funkcje: kroki dnia, postęp, pory i grupy, postęp slotów, opis reguły, użycie produktu, tydzień,
zapowiedź zmian (14 dni).

## 4. Moduł (`src/modules/pielegnacja.js`, klasy `pg-`, kolor `--care`)
- **Dzień**: lista kontrolna wg pór i grup, postęp (pierścień), odhaczanie punktowe (P2: tylko nagłówek i licznik pory; fokus zostaje),
  ostrzeżenia, doraźne kroki (bez liczenia), licznik „Odczekaj N min” (stan tylko interfejsu, jak przerwa w Treningu), nawigacja dni.
- **Tydzień**: 7 dni — postęp i kroki nie codzienne (szampony, odżywki, aktywa, raz w tygodniu).
- **Produkty**: wg obszaru, status, data otwarcia, gdzie i jak często używany; filtr statusu; edycja w oknie.
- **Plan**: pełna rutyna z edycją (dodaj / zmień / usuń krok i produkt), eksport do pliku w formacie importu.
- Pusty stan bez planu: instrukcja importu w Dane lub ręcznego dodania kroków.
- Rejestr: grupa „Dzień”, ikona `sparkles`; na telefonie w „Więcej”.

## 5. Integracje
- **Dziś**: przy slotach, do których przypięte są kroki planu (np. 07:00, 20:35, 20:45, 21:45, 22:53 i w niedzielę 20:15) — „Pielęgnacja N / M” z odnośnikiem (bez nazw produktów,
  jak dawki suplementów — D-041); karta „Pielęgnacja” w podsumowaniu; szybki link.
- **Wymaga uwagi**: zmiana w planie pielęgnacji w ciągu 14 dni (np. koniec kroku z okresem).
- **Dane**: rodzaj importu „Plan pielęgnacji”, nazwy typów w podglądzie, ostrzeżenie o jawnym pliku, Diagnostyka (kroki z usuniętym produktem).
- **⌘K**: kroki i produkty z danych na urządzeniu.

## 6. Niedziela z basenem — plan dnia (wariant „basen”, `tools/extract/day_plan_d094.py`)
18:15–19:30 basen · 19:30–19:45 powrót do domu, posiłek potreningowy 19:30 · 19:45–20:15 relaks · 20:15–20:45 prysznic całego ciała
i pielęgnacja ciała (zamiast prysznica na siłowni, sauny/wolnego, chłodzenia, powrotu z posiłkiem 20:15 i mycia głowy); od 20:45 bez zmian.
Wyjątek 27.09.2026 (dzień sauny) — bez wariantu. Dieta („następny posiłek”) korzysta z godzin planu dnia — w niedzielę 19:30.
**Kreatyna** (decyzja użytkownika 28.09.2026): w niedzielę razem z posiłkiem potreningowym o **19:30**, w pozostałe dni bez zmian 20:15
(ilość i opis dawki bez zmian; funkcja `apply_supplements_d094` w `day_plan_d094.py`, stosowana w `extract_supplements.py`).
Wyjątek 27.09.2026 (miniony dzień sauny) — dawka niedzielna 19:30 wypada tam w slocie sauny (dzień przed wprowadzeniem wariantu).

## 7. Plan użytkownika (`2027-pielegnacja.json`, poza repozytorium)
44 produkty, 58 kroków (102 definicje); nazw produktów celowo nie podano w tym raporcie (D-035). Według odpowiedzi użytkownika:
rotacja aktywów — dzień 1 = poniedziałek; dwa szampony lecznicze 28.09–11.10 dwa razy w tygodniu (PN i PT oraz ŚR i SO), od 12.10
raz w tygodniu (PN oraz SO), w ŚR i PT sam szampon podstawowy; pozycje „1×/tydz.” — niedziela, „2×/tydz.” — środa i niedziela,
pozostałe dni — zamienniki; preparat na klatkę i plecy do 26.12, od 27.12 preparat fazy podtrzymania; preparaty na skórę głowy
codziennie (także w niedzielę) po 20:45; prysznic całego ciała i kąpiel regeneracyjna w niedzielę 20:15.
Decyzja użytkownika (28.09.2026): kroki „po kąpieli” (preparat na klatkę i plecy, antyperspiranty) i pielęgnacja końcowa — codziennie
o 22:53 (wieczorna toaleta, razem z jamą ustną); „po goleniu” — doraźnie. O 21:45 — oczyszczanie twarzy i rotacja aktywów.

## 8. Testy
Nowe: `care.test.mjs` (walidacja typów, stan, reguły, tydzień, zapowiedź zmian, import), rozszerzony `reduce-incremental.test.mjs`
(losowe zdarzenia `care.*`, niezależny wzorzec), test wariantu niedzielnego w `plan-cfa.test.mjs`; E2E `run_care` (pusty stan, import,
odhaczanie punktowe, trwałość, licznik, reguły dni i okresu, Tydzień, Produkty, Plan — dodanie, usunięcie, eksport, Dziś, niedziela,
Wymaga uwagi, ⌘K, 320 px); a11y: 4 widoki modułu + niedziela, 4 stany (odhaczony krok, licznik, okna edycji); `e2e:sync`: plan
i odhaczenia z komputera na telefon, zmiana produktu z telefonu na komputer. Zmienione: liczby modułów w nawigacji (11 w panelu,
7 w „Więcej”), 32 punkty planu w niedzielę, testy szablonu dnia (soboty 33, niedziele 32, pozostałe 34).

| Zestaw | Wynik |
|---|---|
| `npm test` | 194 testy: 193 zaliczone, 1 pominięty (migracja kopii ZAPASY — wymaga `SOURCES_DIR`), 0 niezaliczonych |
| `npm run e2e` | 1306 / 1306 |
| `npm run a11y` | 0 naruszeń, brak przewijania w poziomie (także 4 widoki modułu i 4 nowe stany) |
| `npm run e2e:sync` | 23 / 23 |
| `npm run e2e:cloud` | 100 / 100 |

## 9. Ograniczenia
- Powiązanie produktów z Zapasami (stany, zakupy) — osobny, późniejszy krok (decyzja użytkownika).
- `npm run verify` wymaga plików źródłowych — nieuruchomiony; dodano kontrolę wariantu niedzielnego.
- Do sprawdzenia na urządzeniach: import planu, odhaczanie na telefonie, licznik „Odczekaj”, niedzielny plan dnia.
