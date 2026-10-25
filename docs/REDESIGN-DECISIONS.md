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
| D-017 | Fazy kalendarzowe F0 27.09 (D-090; wcześniej 26.09/25.09/21.09), F1 12.10, F2 16.11.2026 | `phases.json`, testy |
| D-086 | Plan CFA „MASTER SCHEDULE FINAL”: 432 bloki, 48 dni × 9 (25.09–11.11.2026); plan dnia 12:13–12:20 przerwa kognitywna, 12:20 blok E (druga kawa), 13:13–13:30 przerwa na lunch, bez spaceru; bloki F–I 13:30–17:33; suplementy czasowe do 25.03.2027 | `cfa.json`, `day_template.json` (`tools/extract/day_plan_d086.py`), `plan-cfa.test.mjs`, `resolver.test.mjs`, E2E |
| D-087 | Plan CFA v5: 421 bloków (41 × 9, 6 sobót × 8, 25.09 × 4); soboty 12:13–13:13 „Zakupy” (bez bloku E; nie w dniu mocka); wyjątki 25.09 (bez treningu), 26.09 (LOWER 2 kalibracyjny), 27.09 (sauna, dieta NT); Faza 0 od 26.09; suplementy czasowe 25.09.2026–21.03.2027 | `cfa.json`, `week.json` (`exceptions`, `variant`), `day_template.json` (`variants`), `resolver.js` (`dayPlan`, `templateFor`), `plan-cfa.test.mjs`, E2E |
| D-088 | Start planu 25.09.2026: dni 21–24.09 poza planem (w „Dziś” panel „Poza planem”, bez treningu, dawek, bloków i zużycia); serie sprzed startu poza statystykami i historią (zdarzenia zostają w dzienniku); dieta 25.09 NT | `phases.json` (`start`), `resolver.js` (`PLAN_START`, `inPlan`), `consumption.js`, `training.js` (`TRAIN_FROM`), `.dz-outside`, `.sp-outside`, testy jednostkowe (ciągłość dat), E2E |
| D-089 | Audyt — Etapy 1–3 (bez I6, z I11): B1–B9, U-a…U-i, CSP (S1), Diagnostyka (I8), .ics (I1), Wymaga uwagi (I2), Tydzień (I3), wyszukiwanie (I4), skróty (I5), paragon tekstem (I7), recall jako `setting` `cfa.recall:<data>` (I11) | `components.js` (`sheet`), `app.js` (`#toast`, fokus, skip-link), `store.js` (`recordMany`), `core/ics.js`, `core/search.js`, `core/receipt.js`, `calc/attention.js`, `calc/week.js`, `calc/recall.js`, `calc/diagnostics.js`, `tools/build.mjs` (CSP), testy jednostkowe i E2E (`run_audit_fixes`, `run_etap2`, `run_etap3`) |
| D-090 | Plan CFA v7: 409 bloków (41 × 9, 5 sobót × 8), 46 dni 27.09–11.11; start planu i Faza 0 od 27.09; 25–26.09 poza planem (wyjątki usunięte); suplementy czasowe 27.09.2026–21.03.2027 | `cfa.json`, `phases.json`, `week.json`, `supplements.json`, `rekomp.json` (Faza 0 27.09–11.10), `extract_static.mjs` (strażnik 409), `plan-cfa.test.mjs`, E2E |
| D-091 | Pakiet prywatny: metadane wersji planu, zmiany treści planu w tekstach prywatnych, kontrola znaczników, aktualizacja istniejącego pakietu skryptem | `tools/extract/private_pack_lib.py`, `build_private_pack.py`, `core/private.js` (`packStatus`), Diagnostyka, podgląd importu, `private-pack.test.mjs`, E2E, `docs/PAKIET_PRYWATNY.md` |
| D-092 | Etap 4 audytu: P1 (przyrostowe przeliczanie stanu po zapisie lokalnym, wynik identyczny z `reduce()`) i P2 (punktowe odświeżanie: CFA dzień/harmonogram, Trening seria, Zapasy stan/zakup/korekta); D2, I9, I12 niewdrożone | `store.js` (`Reducer`, `reduceInto`), `ui/patch.js`, `cfa.js`, `trening.js`, `zapasy.js`, `reduce-incremental.test.mjs`, E2E `run_p2`, `docs/RAPORT_P1_P2.md` |
| D-093 | Plan CFA v9: 400 bloków (40 × 9, 5 sobót × 8), 45 dni 28.09–11.11; 3 mocki, mixed practice 26–27.10 (PRACTICE); start całego planu bez zmian (27.09 — dzień planu bez CFA) | `cfa.json`, `extract_static.mjs` (strażnik 400), `verify_all.py`, `plan-cfa.test.mjs`, `resolver.test.mjs`, `cfa-pace.test.mjs`, E2E, a11y, `docs/RAPORT_PLAN_CFA_D093.md` |
| D-094 | Moduł „Pielęgnacja” (plan tylko w danych użytkownika; typy `care.def`, `care.done`; widoki Dzień/Tydzień/Produkty/Plan; integracje Dziś, Wymaga uwagi, Dane, ⌘K) i wariant niedzielny planu dnia „basen” | `calc/care.js`, `modules/pielegnacja.js`, `validate.js`, `store.js`, `bundle.js`, `day_plan_d094.py`, `system.css` (`pg-`), `tokens.css` (`--care`), `care.test.mjs`, E2E `run_care`, a11y, e2e:sync, `docs/RAPORT_PIELEGNACJA_D094.md` |
| D-095 | Moduł „MPW” (plan nauki 17.11.2026–20.03.2027; wspólny widok z CFA — `study.js`; typy `mpw.done`, `mpw.err.*`); zakładka CFA do 11.11, od 12.11 MPW; karta „Nauka MPW” w „Dziś” bez zmian godzin planu dnia; prefiks klas `mw-` / `dz-mpw` |
| D-096 | Plan MPW v8 (P1–P7 w slotach A–G); weekendowe bloki 8:00–15:23 w slotach A–G (`week.blocks`, `dayBlocks()`), soboty zjazdów i dni P1–P7 bez zakupów; święta wolne; wyjątki tygodnia 28.09–03.10; linia weekendu w widoku Tydzień (`.wk-blocks`) i znacznik w nagłówku „Dziś” |
| D-097 | Czwartki: warianty „czwartek”/„czwartek_st” (sauna + zakupy, od 07.01 zakupy 15:30 i MPW +30 min), soboty bez zakupów; plan CFA v12; Dzień zero 29.09 (`.dz-zero`), koniec planu 28.03; nowy wygląd „Wymaga uwagi” (`.dz-at-item`, `.dz-attn-empty`); moduł Kalendarz (`kl-`); cykl w Pielęgnacji |
| D-018, D-036 | Warianty dnia; dzień mocka — slot F „Wolne”, slot E kontynuacja sesji 2 (D-086) | resolver, E2E |
| D-020, D-021, D-022 | Nazwy i porcje kanoniczne; obiad codziennie | dane, `verify_all.py` |
| D-027 | Stan zapasów = kopia z 22.09.2026, odliczanie od 23.09.2026 (**od D-088: od 25.09.2026**) | test jednostkowy migracji (wymaga SOURCES_DIR) |
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

## C6. Decyzje Fazy 5 — arkusze treningu (D-105)

- Arkusze i instrukcje ćwiczeń są renderowane z danych ustrukturyzowanych, z nazwami i opisami tekstowymi obok oznaczeń kolorystycznych.
- Ekstraktor zachowuje oryginalne źródła i sprawdza, czy struktura odtwarza ich treść; zmianę formatu źródła traktuje jako błąd wymagający przeglądu.
- Rozszerzenie dotyczy prezentacji danych treningowych; dziennik treningu i jego model zdarzeń pozostają bez zmian.

## C7. Dziennik szczegółów sesji (D-106, 23.10.2026)

- Nowy typ zdarzenia `train.detail` (zgoda użytkownika): jeden dokument na dzień, „ostatni zapis wygrywa”; serie, stoper i ich zdarzenia bez zmian.
- Walidacja w magazynie tylko daty i zwykłego JSON (zgodność w przód, jak D-056) — szczegóły pól sprawdza formularz (`fieldOk`), odczyt toleruje wartości nieznane.
- Panel „Dziennik sesji” w widoku Trening: sekcje zwijane (`details.tl-sec`), wybory jako przyciski z `aria-pressed`/`aria-checked` i znakiem ✓ (stan nie tylko kolorem), pola ≥ 44 px, zapis po zmianie pola bez przerysowania (fokus zostaje).
- Bez automatycznej oceny kolana i bez metryk bez danych (zasada 6); waga, sen, obwody — poza zakresem (G-20).

## C8. Poprawki audytu z 23.10.2026 (D-107, 24.10.2026)

- „Cofnij” w Zapasach cofa całą operację (także zapis zbiorczy) i liczy stan tak, jakby jej nie było; kolejne „Cofnij” sięga dalej (stos), cofnięcie nie wraca. Podpowiedź przycisku mówi, co zostanie cofnięte; w Historii dopisek „cofnięcie”.
- Pole liczbowe zapisujące dane: puste ≠ 0 (stan bez zmian i komunikat w obszarze `#toast`).
- Widok zależny od daty i godziny odświeża się sam: zmiana dnia → przerysowanie w tle (`softRender`); „Teraz” w „Dziś” aktualizowane w miejscu (punktowo, jak P2) — przewinięcie, fokus i rozwinięte sekcje zostają.
- Zmiana w innej karcie: doczytanie do tej samej instancji magazynu i przerysowanie w tle — wpis w polu i otwarte okno nie giną.
- Teksty z godzinami (MPW, sloty Pielęgnacji) wyłącznie z danych planu, bez godzin i dni wpisanych na sztywno.

## C9. Ryzyka i ulepszenia z audytu 23.10.2026 (D-108, 24.10.2026)

- „Czas własny”: slot nauki bez bloku poza planem CFA — mniejszy, bez koloru domeny (`.slot.is-own`), dawki i podpunkty bez zmian; slot w czasie bloków MPW nazywa je z godzinami, bloki zostają w karcie „Nauka MPW”.
- Trening: pasek dni z tygodnia wybranego dnia (z datą każdego dnia) i przełączanie tygodni; na telefonie zakres tygodnia i „Ten tydzień” w pierwszym wierszu, krótkie „Poprzedni / Następny” w drugim (pełna nazwa w `aria-label`).
- Dane → Kopie automatyczne: opis działania kopii i podgląd przed przywróceniem stanów Zapasów (okno `sheet()`), zapis jako jedna operacja do cofnięcia.
- Podgląd importu postępu CFA mówi, z którego planu jest plik i które bloki zostaną oznaczone; plik z innego planu — „Nie można zaimportować”.
- Zadania bloków MPW poza pakietem aplikacji (wczytywane w module); gdy się nie wczytają — baner, reszta planu działa.

## C10. System 2.0 — nowocześniejszy wygląd całej aplikacji (D-110, 24.10.2026)

Polecenie użytkownika (24.10.2026): szeroki audyt designu i wygląd „bardziej nowoczesny, futurystyczny, a jednocześnie praktyczny”.
Zmienia kierunek z D-073 w części „unikaj” (szkło, gradienty) — w granicach poniżej; układ informacji, klasy, dane i logika bez zmian.
- **Głębia przez światło:** tło „aurora” (poświata w kolorze modułu; w „Dziś” — bieżącego punktu planu), krawędź światła kart (`--rim`)
  i miękki cień także w motywie ciemnym, chłodniejsza paleta (jasny `#f3f4f7`, ciemny `#090a0f`), większe promienie (10/14/20/28).
- **Szkło tylko na elementach pływających:** pływający pasek dolny („soczewka” aktywnej sekcji), pływający panel boczny, pasek tytułu
  po przewinięciu (telefon), nagłówek arkusza, liczniki przerwy, przyklejone skróty; krycie dobrane pod kontrast ≥ 4,5:1.
- **Dziś:** najpierw „Teraz” (pasek upływu czasu punktu i „zostało N min”), potem „Wymaga uwagi” jako zwarta lista, kafle KPI
  w kolorach domen z jednostką pomniejszoną, podsumowania jako przewijany pas na telefonie (plan dnia bliżej góry ekranu),
  **plan dnia jako oś czasu** (linia wypełniana upływem czasu w bieżącym punkcie).
- **Nawigacja praktyczniej:** nowy moduł / widok otwiera się od góry, „Wstecz” wraca do miejsca; przełączniki segmentowe nie łamią się
  w dwa wiersze; strzałki dni na telefonie bez etykiet (nazwa w `aria-label`); tydzień w 7 kolumnach dopiero od 1500 px.
- **Ruch z funkcją:** wejście ekranu (CSS, bez opóźnienia renderu), sprężysty nacisk, arkusz zamykany przeciągnięciem (D-112: także za treść), znacznik „teraz”
  (pulsujący do D-112, potem ze stałą poświatą), odsłonięcie nowego motywu kołem (View Transitions — tylko tu; przy zmianie trasy opóźniały przerysowanie).
- **Preferencje systemu przed efektami:** mniej ruchu, mniej przezroczystości, więcej kontrastu, wymuszone kolory.
- Pierścienie postępu z gradientem i poświatą, wykresy z ograniczoną wysokością, kreślone strzałki rozwijania, nowa ikona aplikacji
  (znak „27” w pierścieniu — `tools/app_icons.py`).

## C11. Dopracowanie po liście otwartych spraw (D-111, 25.10.2026)
- **Dziennik sesji bez kolana** (decyzja użytkownika): sekcje Basen / Rower / Sauna / Notatka; dawne wpisy kolana niewidoczne, nieusuwane.
- **Font:** podzbiór Inter odtwarzalny skryptem (`tools/fonts.py`), ten sam wygląd (porównanie pikseli: 0 różnic), pokrycie całego Latin-1
  i interpunkcji (’ “ € … w tekstach wpisywanych przez użytkownika), Latin Extended-A, ș ț, znaki łączące (tekst NFD) i symboli interfejsu
  (← → ≤ ≥ ≈ ≠ ✓ ⌘); emoji i znaki z selektorem emoji — font systemowy. Pliki 32 → 61 KB.
- **Pielęgnacja w „Dziś”:** znacznik kroku przypiętego do slotu innego wariantu dnia — w slocie tego dnia o tej porze.

## C12. iPhone: przewijanie i arkusze (D-112, 25.10.2026)
- **Bez animacji nieskończonych** w widokach przewijanych (także samym `transform`): przeliczanie stylów w każdej klatce przewijania;
  wskaźniki „teraz” — stała poświata zamiast pulsu. Strażnik w `run_d110`: brak animacji nieskończonych w „Dziś”.
- **Bez kodu w czasie przewijania:** pasek tytułu przez `IntersectionObserver`, pozycje widoków zapisywane przy zmianie trasy, przywracanie ręczne.
- **Przewinięcie nie „szarpie”:** na górę od razu przy zmianie modułu; przywracanie („Wstecz”, przerysowanie w miejscu) tylko bez dotyku w międzyczasie.
- **Arkusz:** przeciąganie w dół za nagłówek albo za treść u góry (zdarzenia dotyku — na iOS zdarzenia wskaźnika przegrywały z przewijaniem).
- **Zakładka bieżącego modułu** — ponowne dotknięcie przewija na górę (konwencja iOS).

## D. Zasady nienaruszalne (skrót — pełna lista w `CLAUDE.md`)
1. Nie zmieniaj modelu danych, typów zdarzeń, bazy `p2027`, formatu `2027-sync.json`, logiki `reduce()`/resolvera.
2. Nie dodawaj automatycznej synchronizacji ani automatycznego przeładowania.
3. Żadnych danych prywatnych w repo; żadnych metryk bez danych; żadnych makiet zamiast funkcji.
4. Nie usuwaj funkcji, zakładek, testów; nie zmieniaj nazw klas używanych w testach bez aktualizacji testów w tym samym kroku.
5. Nazwy dawek suplementów w „Dziś” wyłącznie w planie dnia (D-041/D-064).
6. Tylko tokeny z `tokens.css`; każdy nowy kolor z wariantem jasnym i ciemnym i sprawdzonym kontrastem.
7. Zmiana wymagająca naruszenia powyższych → zatrzymaj się i zapytaj użytkownika.

## E. Punkty otwarte (nierozstrzygnięte)
- ~~G-20~~ — **zamknięte (D-111, 25.10.2026):** kolano usunięte z dziennika sesji; waga, sen, obwody — nie w aplikacji.
- ~~D-031~~ — **zamknięte (D-111):** pliki CFA v3 nieaktualne po planie V44.
- ~~D2, I9, I12~~ (Etap 4 audytu 25.09.2026) — **zamknięte bez wdrożenia (D-111, decyzja użytkownika 25.10.2026).**
- ~~Potwierdzenie wyglądu na iPhonie (Safari i PWA)~~ — **potwierdzone przez użytkownika 24.09.2026** dla wersji `4e68589` (wszystkie punkty `REDESIGN-TESTING.md` §5).
  naprawy synchronizacji, wersji sprzed redesignu).
