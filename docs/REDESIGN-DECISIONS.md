# REDESIGN-DECISIONS — decyzje obowiązujące przy redesignie

Źródło: `docs/DECYZJE_2027.md` (pełny rejestr D-001…D-077, brzmienie nadrzędne) oraz historia projektu.
Kolumna „Potwierdzenie” mówi, gdzie decyzja jest widoczna w kodzie/testach. Pozycje oznaczone **[do weryfikacji]**
nie mają pełnego potwierdzenia w kodzie lub u użytkownika.

## A. Decyzje merytoryczne, których redesign nie może naruszyć
| ID | Treść (skrót) | Potwierdzenie |
|---|---|---|
| D-001 | SUPLEMENTACJA_2027 jedynym źródłem prawdy o suplementach | `src/data/supplements.json`, `resolver.js` (`dosesFor`) |
| **D-041** | **Zakładka Dziś: suplementy wyłącznie z SUPLEMENTACJI; fragmenty o suplementach w tekstach PLAN_DNIA ukryte — usunięcie dublowania; podpunkty slotów jako lista.** | `day_template.json` (`items[].kind = supp` ukryte), test jednostkowy „żaden widoczny podpunkt slotu nie powtarza suplementów”, E2E „chondroityna tylko 2 razy (07:00 i 21:00)” |
| D-064 | Dashboard „Dziś” wyłącznie z istniejących danych; suplementy na dashboardzie tylko jako podsumowanie liczbowe — nazwy dawek wyłącznie w planie dnia (zgodnie z D-041) | `src/modules/dzis.js` (karta „Suplementy”); E2E jw. — **naruszenie wykryte i naprawione w Fazie 4** |
| D-038 | 07:00: „Pomiar wagi i ciśnienia na czczo po toalecie.” | E2E |
| D-039 | Bloki CFA pokazują źródło i strony, np. „Curriculum 2026 Vol 1 (QM), s. 3–13 (11 s.)” | `cfaSourceLine()`, E2E |
| D-040 | Nagłówek dnia: nazwa treningu (UPPER 1 + sauna, LOWER 1 …) | `resolver.js` `sessionLabel`, E2E |
| D-013 | Termos: prosto z patelni; > 63 °C podczas jedzenia | dane Meal Prep / Bezpieczeństwo, testy |
| D-014, D-030 | Tauryna 17:15 codziennie (także czw.); kreatyna 5 g 20:15 | testy jednostkowe suplementów |
| D-017 | Fazy kalendarzowe F0 25.09 (D-086; pierwotnie 21.09), F1 12.10, F2 16.11.2026 | `phases.json`, testy |
| D-086 | Plan CFA „MASTER SCHEDULE FINAL”: 432 bloki, 48 dni × 9 (25.09–11.11.2026); plan dnia 12:13–12:20 przerwa kognitywna, 12:20 blok E (druga kawa), 13:13–13:30 przerwa na lunch, bez spaceru; bloki F–I 13:30–17:33; suplementy czasowe do 25.03.2027 | `cfa.json`, `day_template.json` (`tools/extract/day_plan_d086.py`), `plan-cfa.test.mjs`, `resolver.test.mjs`, E2E |
| D-018, D-036 | Warianty dnia; dzień mocka — slot F „Wolne”, slot E kontynuacja sesji 2 (D-086) | resolver, E2E |
| D-020, D-021, D-022 | Nazwy i porcje kanoniczne; obiad codziennie | dane, `verify_all.py` |
| D-027 | Stan zapasów = kopia z 22.09.2026, odliczanie od 23.09.2026 | test jednostkowy migracji (wymaga SOURCES_DIR) |
| D-046 | Zapasy odtwarzają funkcje pierwotnego ZAPASY_DIETA.html (klasyfikacja wg terminu przydatności 1:1, okna, historia, kopia, paragon, raport AI) | `zapasy.js`, E2E; **w Fazie 5 nie usuwać żadnego z okien/przycisków** |
| D-047, D-052 | Mapy mięśni (free-exercise-db) i animowana postać — rysunki własne, poglądowe | `bodymap.js`, `figure.js`, `muscles.json` |
| D-048 | CFA: postęp i error log w dzienniku; CSV v3 | `cfa.js`, E2E |

## B. Dane, prywatność, synchronizacja (nienaruszalne)
| ID | Treść | Potwierdzenie |
|---|---|---|
| D-008, D-026 | Jeden trwały, walidowany dziennik zdarzeń; kod modułowy; plik jednoplikowy tylko jako wynik budowy | `src/core/storage/*`, `tools/build.mjs` |
| D-033 | Synchronizacja **ręczna** przez plik `2027-sync.json` w iCloud Drive (eksport/import w module Dane), scalanie HLC/LWW | `sync/bundle.js`, `npm run e2e:sync` |
| D-034 | Zero płatnych usług i backendu; hosting GitHub Pages | brak zależności runtime |
| D-035, D-045, D-051 | Dane medyczne/osobowe tylko w pakiecie prywatnym (`2027-prywatne.json`), nigdy w repozytorium; w danych publicznych znaczniki `{private:N}` | `.gitignore`, `rekomp.json`, `mealprep.json` |
| D-056 | Zgodność w przód: zdarzenia nieznanego typu (poprawna koperta) zachowane, pomijane w obliczeniach, baner „Niepełne przetwarzanie”; odzyskiwanie z kwarantanny | `validate.js` (`classifyEvent`), `store.js`, `sync-compat.test.mjs` |
| D-057 | Aktualizacja kodu tylko za zgodą („Nowa wersja — odśwież”); oddzielona od synchronizacji danych | `build.mjs` (sw.js), `app.js` (`setupUpdates`), `sync_update.py` C/D |
| D-058 | Format `2027-sync.json` bez zmian | `bundle.js` |

## C. Decyzje redesignu (Fazy 3–4)
| ID | Treść | Potwierdzenie |
|---|---|---|
| D-059 | Jedno źródło tokenów `tokens.css`; warstwa komponentów `system.css`; **nazwy klas używane przez moduły i testy bez zmian** | `tools/build.mjs` (kolejność plików), E2E |
| D-060 | Inter (OFL) lokalnie jako podzbiór znaków aplikacji (32 KB), fallback systemowy | `public/fonts/`, `tokens.css` (`@font-face`) |
| D-061 | Motyw domyślnie ciemny; przełącznik ciemny/jasny/systemowy; preferencje UI per urządzenie w localStorage, poza synchronizacją | `src/ui/prefs.js`, `index.html`, E2E |
| D-062 | Panel boczny: grupy Dzień/Trening/Dieta/Nauka/System, ikony Lucide; telefon: Dziś, Dieta, Trening, CFA + Więcej | `registry.js`, `app.js`, E2E |
| D-063 | Akcent indygo `#4845D2` (jasny) / `#A5A8FF` (ciemny) | `tokens.css`, a11y |
| D-055 | Kolory statusów jako tokeny z wariantem dla obu motywów; audyt axe-core jako stały test | `npm run a11y` (od Fazy 5.0 także stany: `STATES`), `tests/unit/tokens.test.mjs` |

## C2. Decyzje Fazy 5.0 (stabilizacja, 24.09.2026)
| ID | Treść | Potwierdzenie |
|---|---|---|
| D-065 | Dane syntetyczne w testach bez plików użytkownika (fikcyjne, generowane, tylko w katalogu tymczasowym) | `tests/e2e/fixtures.py`, `e2e.py`, `sync_update.py` |
| D-066 | Odnośniki `#id` w obrębie strony: przewinięcie + fokus, bez zmiany trasy | `app.js` (`inPageLink`), E2E „Meal Prep: skrót fazy…” |
| D-067 | `theme-color` i manifest w kolorze motywu domyślnego (ciemny); `status-bar-style` bez zmian (`default`) | `src/index.html`, `public/manifest.webmanifest` |

## C3. Decyzje Fazy 5 — Trening i CFA (24.09.2026)
| ID | Treść | Potwierdzenie |
|---|---|---|
| D-068 | Licznik przerwy: tylko dzień bieżący, czas z planu, stan lokalny (bez zdarzeń, bez synchronizacji) | `trening.js` (`restBar`), `calc/training.js` (`restSeconds`), E2E z zegarem, unit |
| D-069 | Karta „Następna seria” i podsumowanie sesji — wyłącznie z planu i dziennika | `trening.js`, `calc/training.js` (`nextSet`), E2E, unit |
| D-070 | CFA: zaległe = przed dziś i nieodhaczone; panel zaległych, filtr w harmonogramie, filtr/wyszukiwanie error logu | `cfa.js`, `calc/cfa.js` (`cfaPace`), E2E z zegarem, unit |

## C4. Decyzje Fazy 5 — Dieta i Zapasy (24.09.2026)
| ID | Treść | Potwierdzenie |
|---|---|---|
| D-071 | Dieta: kolejność godzin, następny posiłek, zwarte pozycje, składniki z Zapasów, sekcje rzadkie zwinięte | `dieta.js`, `calc/diet.js` (`mealTimes`, `nextMeal`), unit, E2E z zegarem |
| D-072 | Zapasy: przegląd, siatka akcji, „Do kupienia” z „Kupione”, zwarte wiersze, pasek zapasu, zwinięte korekty | `zapasy.js`, `calc/inventory.js` (`runway`), unit, E2E (dane syntetyczne), a11y z danymi |
| D-073 | Kierunek „premium personal OS” w ramach tokenów, bez efektów i metryk bez danych | `REDESIGN-SPEC.md` §1 |

## C5. Decyzje Fazy 5 — Meal Prep, Suplementacja, Bezpieczeństwo, Rekompozycja, Dane (24.09.2026)
| ID | Treść | Potwierdzenie |
|---|---|---|
| D-074 | Meal Prep: składniki na jutro, oznaczenia kart, bieżąca karta, zwinięte tabele | `mealprep.js`, `calc/inventory.js` (`coverage`), unit, E2E |
| D-075 | Suplementacja: minione/następna pora, zapas suplementów z „Kupione” | `suplementy.js`, E2E z zegarem i danymi syntetycznymi |
| D-076 | Bezpieczeństwo/Rekompozycja: nagłówki, „Wyczyść filtry”, wyszukiwanie w planie; link przechowywania tylko przy identycznej nazwie | `bezpieczenstwo.js`, `rekompozycja.js`, `zapasy.js`, E2E |
| D-077 | Dane: synchronizacja na górze, bez zmian mechanizmu | `dane.js`, E2E, `e2e:sync` |

Decyzje użytkownika wydane przed Fazą 3 (w rozmowie, zapisane jako D-060…D-063): mobile 4 + Więcej (Dziś, Dieta, Trening, CFA);
grupy panelu jw. „o ile analiza kodu potwierdzi” — **potwierdzone** polem `domain` w rejestrze; motyw „systemowy jako domyślny
… (ale domyślnie dark)” — **interpretacja: domyślnie ciemny + przełącznik z opcją systemowego — zatwierdzona przez użytkownika 24.09.2026**; akcent indygo dobrany wg WCAG; Lucide; Inter tylko przy
nieistotnym wzroście paczki — spełnione przez podzbiór.

## D. Zasady nienaruszalne (skrót — pełna lista w `CLAUDE.md`)
1. Nie zmieniaj modelu danych, typów zdarzeń, bazy `p2027`, formatu `2027-sync.json`, logiki `reduce()`/resolvera.
2. Nie dodawaj automatycznej synchronizacji ani automatycznego przeładowania.
3. Żadnych danych prywatnych w repo; żadnych metryk bez danych; żadnych makiet zamiast funkcji.
4. Nie usuwaj funkcji, zakładek, testów; nie zmieniaj nazw klas używanych w testach bez aktualizacji testów w tym samym kroku.
5. Nazwy dawek suplementów w „Dziś” wyłącznie w planie dnia (D-041/D-064).
6. Tylko tokeny z `tokens.css`; każdy nowy kolor z wariantem jasnym i ciemnym i sprawdzonym kontrastem.
7. Zmiana wymagająca naruszenia powyższych → zatrzymaj się i zapytaj użytkownika.

## E. Punkty otwarte (nierozstrzygnięte)
- G-20: dziennik kolana i monitoring (waga, sen, obwody) — brak decyzji, czy mają trafić do aplikacji.
- D-031: import postępu i error logu CFA v3 od użytkownika — funkcje gotowe, pliki nie zostały dostarczone.
- ~~Potwierdzenie wyglądu na iPhonie (Safari i PWA)~~ — **potwierdzone przez użytkownika 24.09.2026** dla wersji `4e68589` (wszystkie punkty `REDESIGN-TESTING.md` §5).
  naprawy synchronizacji, wersji sprzed redesignu).
