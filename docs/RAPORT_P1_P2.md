# Etap 4 audytu: P1 i P2 (D-092) — raport (27.09.2026)

Zakres wg decyzji użytkownika: wdrożyć **P1** (przyrostowe przeliczanie stanu) i **P2** (punktowe odświeżanie najczęstszych akcji).
**D2, I9, I12 — niewdrożone.** Bez zmian: typy zdarzeń, walidacja, wynik `reduce()`, format `2027-sync.json`, synchronizacja
(plik i chmura), baza `p2027`, wygląd i teksty.

## 1. P1 — przyrostowe przeliczanie stanu (`src/core/storage/store.js`)
- `reduce()` działa teraz na akumulatorze `Reducer` (jeden kod dla pełnego przeliczenia i dla dokładania zdarzeń):
  zdarzenia w kolejności HLC; rekordy LWW trzymane w grupach wg przedrostka klucza (kolejność jak w dotychczasowej wspólnej mapie);
  zapasy i archiwum dopisywane.
- **Zapis lokalny** (`record`, `recordMany`): nowe zdarzenia są dokładane do stanu, jeśli każde ma HLC wyższy od wszystkich dotychczasowych
  (zegar lokalny po `observe` zawsze idzie naprzód). Przeliczane są tylko zmienione części stanu (np. po odhaczeniu serii — tylko `train`).
- **Pełne przeliczenie jak dotąd:** otwarcie bazy, import pliku i synchronizacja w chmurze (`appendMany`), każde zdarzenie starsze od
  najnowszego lub z tym samym HLC.
- Wcześniejsze obiekty stanu nie są modyfikowane (każdy zapis daje nowy obiekt stanu; niezmienione części są współdzielone).
- **Równoważność:** `tests/unit/reduce-incremental.test.mjs` porównuje wynik z **kopią wzorcową `reduce()` sprzed P1** (bez zmian, z commitu
  `859aace`) na 200 losowych dziennikach (wszystkie typy zdarzeń, typy z nowszej wersji, nadpisania LWW, zdarzenia nieuporządkowane,
  równe znaczniki czasu) — porównanie pełnej struktury i kolejności kluczy; dokładanie po 1–4 zdarzenia na 150 dziennikach; brak zmian
  wcześniejszych stanów; odmowa ścieżki przyrostowej dla zdarzeń starszych; `Store` (zapis, zapis zbiorczy, import, ponowne otwarcie).

## 2. P2 — punktowe odświeżanie (`src/ui/patch.js` + moduły)
Pomocnik `region(build)` (fragment budowany funkcją, podmieniany w miejscu wyznaczonym niewidoczną kotwicą), `swap()` i `holdFocus()`
(fokus przechodzi na odpowiednik przycisku w nowym fragmencie — jak `restoreFocus` po pełnym przerysowaniu). Stan pochodny w modułach
przeniesiony do zmiennych przeliczanych przed odświeżeniem, więc przyciski w niezmienionych fragmentach działają na bieżącym stanie.

| Moduł | Akcje punktowe | Odświeżane fragmenty | Nadal pełne przerysowanie |
|---|---|---|---|
| CFA — Dzień | odhaczenie bloku (też zaległego), recall 22:00, „Oznacz cały dzień”, „Wyczyść dzień” | nagłówek (postęp, tempo), „Zaległe z poprzednich dni”, panel dnia | — |
| CFA — Harmonogram | odhaczenie bloku | wiersz bloku, licznik jego dnia, nagłówek, „tylko zaległe (N)”, „Minione dni” | przy filtrach „tylko niewykonane” / „tylko zaległe” (zmienia się skład listy); kalendarz, error log, plan |
| Trening | odhaczenie i cofnięcie serii | nagłówek sesji (postęp, następna seria / podsumowanie), karta ćwiczenia, wyróżnienie następnego ćwiczenia, licznik przerwy | serie opcjonalne, „Skopiuj z poprzedniej serii”, czas treningu (rzadkie) |
| Zapasy | stan pozycji, + opakowanie, ± porcja, „Kupione”, „Cofnij” zmiany jednej pozycji | przegląd, narzędzia („Cofnij”), „Do kupienia”, liczniki filtrów, karta pozycji; skład i kolejność listy (filtr, sortowanie) jak po pełnym przerysowaniu — przestawiana tylko zmieniona karta | korekta zużycia dnia, operacje zbiorcze, dodanie/edycja/usunięcie pozycji, paragon, plan zakupów, kopia |

Przy okazji (bez zmiany wyniku): „Cofnij” w Zapasach wyznacza ostatnią zmianę jednym przejściem zamiast sortowania całego dziennika;
podsumowanie sesji w Treningu liczone z wpisów tego dnia; „ostatnio” (wyniki z dni wcześniejszych) liczone raz na widok.

## 3. Pomiary (Chromium, 390 px, CPU spowolnione 4×, dziennik syntetyczny)
Czas od kliknięcia do zaktualizowanego widoku (z klatką). Dziennik ~3 mies.: 6,7 tys. zdarzeń; ~12 mies.: 26,5 tys.

| Akcja | Przed (3 / 12 mies.) | Po P1+P2 (3 / 12 mies.) |
|---|---|---|
| CFA dzień: odhaczenie bloku | 182 / 318 ms | 65 / 58 ms |
| CFA harmonogram: odhaczenie bloku (3,5 tys. węzłów) | 550 / 698 ms | 52 / 43 ms |
| Trening: odhaczenie serii | 224 / 366 ms | 71 / 68 ms |
| Zapasy: + opakowanie (2,1 tys. węzłów) | 380 / 625 ms | 102 / 102 ms |

Przeliczenie stanu po zapisie (Node, 30 tys. zdarzeń): pełne ~18 ms → przyrostowe ~0,1 ms. Czas akcji przestał rosnąć z długością
dziennika. Pomiary mają rozrzut rzędu ±20 ms między przebiegami.

## 4. Testy
- Nowe: `tests/unit/reduce-incremental.test.mjs` (5 testów, opis w p. 1); E2E `run_p2` (2 warianty × 14 przypadków): po każdej akcji
  punktowej widok porównywany z pełnym przerysowaniem tej samej trasy — tekst, stany przycisków (`aria-pressed`, nazwa dostępna), klasy
  i kolejność kart, wartości pól — oraz fokus na przycisku i brak przebudowy `<main>`. Test sprawdzony celowym uszkodzeniem
  (pominięcie odświeżenia nagłówka CFA i liczników Zapasów → 8 błędów).

| Zestaw | Wynik |
|---|---|
| `npm test` | 188 testów: 187 zaliczonych, 1 pominięty (migracja kopii ZAPASY — wymaga `SOURCES_DIR`), 0 niezaliczonych |
| `npm run e2e` | 1205 / 1205 (w tym 30 kontroli `run_p2`) |
| `npm run a11y` | 0 naruszeń, brak przewijania w poziomie |
| `npm run e2e:sync` | 21 / 21 |
| `npm run e2e:cloud` | 100 / 100 |
| `npm run build` | `dist/web` + `dist/single/2027.html` bez błędów |

## 5. Ograniczenia i uwagi
- Punktowe odświeżanie obejmuje najczęstsze akcje; pozostałe działają jak dotąd (pełne przerysowanie).
- Zmiany z innych urządzeń i kart (synchronizacja) nadal przerysowują widok w całości (`softRender`) — rzadkie, bez zmian.
- `npm run verify` wymaga plików źródłowych (`SOURCES_DIR`) — nieuruchomiony (dane bez zmian).
- Do sprawdzenia na urządzeniach: odhaczanie bloków, serii i zmiany stanów w Zapasach (szybkość, pozycja przewinięcia, fokus).
