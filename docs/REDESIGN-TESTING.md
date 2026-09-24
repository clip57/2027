# REDESIGN-TESTING — testy, wyniki, kryteria akceptacji, weryfikacja ręczna

## 1. Zestawy testów
| Zestaw | Komenda | Co sprawdza | Wymaga |
|---|---|---|---|
| Jednostkowe | `npm test` | rdzeń: daty, resolver, zużycie, zapasy, dieta, suplementy, trening, Meal Prep, mięśnie, zapis, synchronizacja, zgodność w przód; tokeny wyglądu (identyczne bloki motywu ciemnego, kontrast 23 par w obu motywach) | Node 22 |
| Weryfikacja danych | `npm run verify` | zgodność `src/data/*.json` z plikami źródłowymi (407 kontroli) | **`SOURCES_DIR`** (pliki użytkownika — brak w repo) |
| E2E | `npm run build && npm run e2e` | wszystkie moduły w 2 wariantach buildu (web przez http://localhost:8765, jeden plik przez file://) × 390 px (mobile, dotyk) / 1280 px; brak przewijania w poziomie, brak artefaktów „null/false/undefined/NaN”, cele dotykowe ≥ 44 px (widok Dane na 390 px), funkcje modułów, trwałość zapisu, eksport/import, offline (SW), kontrast odhaczonych elementów, linki w obrębie strony, sygnatury modułów | Python 3, Playwright ≥ 1.56, Chromium; `SOURCES_DIR`, `PRIVATE_PACK` opcjonalnie — bez nich dane syntetyczne (D-065) |
| Synchronizacja i aktualizacja | `npm run e2e:sync` | 2 oddzielne profile (osobne bazy): sync w obu kierunkach, niezależne zmiany, brak duplikatów, ostrzeżenie o starszym pliku, zdarzenia z nowszej wersji (baner, brak utraty), aktualizacja kodu tylko za zgodą, offline po aktualizacji, przejście ze starego SW | jw.; **przebudowuje `dist/` kilka razy** (na końcu przywraca zwykły build); porty 8791 |
| Synchronizacja w chmurze | `npm run build && npm run e2e:cloud` | lokalny fałszywy serwer Supabase (`tests/e2e/fake_supabase.py`, CORS, RLS, rotacja tokenów, indeks numerów) + 2 profile Chromium (390 ciemny / 1280 jasny z zegarem Playwright) + druga karta + plik `2027.html`: konfiguracja (odrzucenie klucza sekretnego), logowanie, hasło szyfrowania, przełącznik automatu (wyłączony: zero zapytań bez kliknięcia), automatyczna wysyłka i grupowanie serii zmian, pierwsza synchronizacja po haśle, powrót do aplikacji, powrót sieci, konflikt, dwie karty (A4), brak przerysowania w trakcie wpisywania, transfer pustej rundy, baner wstrzymania, brak treści jawnej na serwerze, wygasły token, wylogowanie, odłączenie; axe, przewijanie i cele dotykowe w każdym kroku (76 kontroli) | jw.; porty 8793 i 54329 |
| Dostępność | `npm run build && npm run a11y` | axe-core WCAG 2.1 A/AA na 20 widokach + 7 stanach interakcji (`STATES`: odhaczona seria, blok CFA, krok Meal Prep, rozwinięte sekcje poradnika/Rekompozycji/Diety, okno techniki) × 390/1280 px × motyw jasny/ciemny (108 przebiegów) + przewijanie w poziomie | jw. |

Kolejność po każdej zmianie w Fazie 5: `npm run build && npm test && npm run e2e && npm run a11y`;
dodatkowo `npm run e2e:sync`, jeśli zmiana dotyka `src/app.js`, `src/core/**`, `tools/build.mjs`, `src/modules/dane.js`;
`npm run e2e:cloud`, jeśli dotyka `src/core/sync/**`, `src/core/storage/**`, `src/modules/dane*.js` albo `src/app.js`.

## 2. Wyniki regresji

### Synchronizacja automatyczna w chmurze — D-084 (25.09.2026, konfiguracja B — bez plików użytkownika, fałszywy serwer Supabase)
| Zestaw | Wynik |
|---|---|
| `npm test` | 135 testów: 134 zaliczone, 1 pominięty (migracja kopii ZAPASY — wymaga `SOURCES_DIR`), 0 niezaliczonych; nowe: `cloud-auto` (15) |
| `npm run e2e` | 956/956 (po poprawce strefy czasowej w `expected_stock` — wcześniej 12 fałszywych błędów między 22:00 a 24:00 UTC, także na niezmienionym `3d4272e`) |
| `npm run e2e:sync` | 21/21 |
| `npm run e2e:cloud` | 77/77 (automat: wysyłka po zmianie, grupowanie, powrót do aplikacji, powrót sieci, dwie karty — test wykrywa cofnięcie poprawki A4, wpisywanie, baner, transfer) |
| `npm run a11y` | 0 naruszeń, brak przewijania w poziomie |
| Zrzuty | sekcja chmury i baner: 375/390 ciemny, 1280/1440 jasny — bez przewijania w poziomie |
| Safari/WebKit | niedostępny w środowisku (tylko Chromium) — analiza zgodności `docs/SYNC_CHMURA.md` §6.4, kontrola ręczna §6.5 |

### Synchronizacja w chmurze — Etap 2 (24.09.2026, konfiguracja B — bez plików użytkownika, fałszywy serwer Supabase)
| Zestaw | Wynik |
|---|---|
| `npm test` | 120 testów: 119 zaliczonych, 1 pominięty (migracja kopii ZAPASY — wymaga `SOURCES_DIR`), 0 niezaliczonych |
| `npm run e2e` | 956/956 |
| `npm run e2e:sync` | 21/21 |
| `npm run e2e:cloud` | 49/49 (w tym axe w 5 stanach sekcji chmury, 390 ciemny i 1280 jasny) |
| `npm run a11y` | 0 naruszeń, brak przewijania w poziomie |
| `schema.sql` + `check.sql` | sprawdzone na lokalnym PostgreSQL 16 z imitacją `auth.uid()` i ról: `anon` bez dostępu, izolacja użytkowników, brak UPDATE, wstawianie z pominięciem duplikatów, `check.sql` wykrywa nadane UPDATE |

### Faza 5 — moduły 5–9: Meal Prep, Suplementacja, Bezpieczeństwo, Rekompozycja, Dane (24.09.2026, konfiguracja B)
Build: **OK** — wersja `0.2.0+276680fffc`; `dist/web/app.*.js` 688 KB; `dist/single/2027.html` 834 KB.

| Zestaw | Wynik |
|---|---|
| Jednostkowe | 89 uruchomionych · **88 zaliczonych · 0 niezaliczonych · 1 pominięty** (migracja prawdziwej kopii ZAPASY) |
| Weryfikacja danych | **nieuruchomiona** (wymaga `SOURCES_DIR`) |
| E2E | **956 kontroli · 956 zaliczonych · 0 niezaliczonych · 0 pominiętych bloków** (+33) |
| Synchronizacja i aktualizacja | **21 kontroli · 21 zaliczonych · 0 pominiętych** |
| Dostępność | 136 przebiegów (20 widoków + 14 stanów × 2 szerokości × 2 motywy), z danymi syntetycznymi · **0 typów naruszeń** · przewijanie w poziomie: **brak** |

Nowe kontrole: `tests/unit/prep-supp.test.mjs` (`coverage`); E2E — składniki na jutro w Meal Prep i oznaczenia kart, zapas
suplementów i „Kupione”, link przechowywania z Zapasów, minione / następna pora suplementów (zegar 10:00), bieżąca karta Meal
Prep, wyszukiwanie i „Rozwiń wszystko” w Rekompozycji, „Wyczyść filtry” w Bezpieczeństwie, synchronizacja jako pierwsza sekcja
Danych; cele dotykowe ≥ 44 px we wszystkich 10 modułach na 390 px (wykryły i pozwoliły naprawić 71 + 3 za małe elementy
rozwijane). Test Meal Prep czyta progi z `textContent` (tabele w zwiniętych panelach). a11y: stany „wyszukiwanie w planie”,
„filtr produktów”, „rozwinięte tabele”.

### Faza 5 — Dieta i Zapasy (24.09.2026, konfiguracja B)
Build: **OK** — wersja `0.2.0+b6d6a8961c`; `dist/web/app.*.js` 681 KB; `dist/single/2027.html` 821 KB.

| Zestaw | Wynik |
|---|---|
| Jednostkowe | 87 uruchomionych · **86 zaliczonych · 0 niezaliczonych · 1 pominięty** (migracja prawdziwej kopii ZAPASY) |
| Weryfikacja danych | **nieuruchomiona** (wymaga `SOURCES_DIR`) |
| E2E | **923 kontrole · 923 zaliczone · 0 niezaliczonych · 0 pominiętych bloków** (+38 względem Treningu/CFA) |
| Synchronizacja i aktualizacja | **21 kontroli · 21 zaliczonych · 0 pominiętych** (scenariusz korzysta z przebudowanych wierszy Zapasów) |
| Dostępność | 124 przebiegi (20 widoków + 11 stanów × 2 szerokości × 2 motywy), z danymi syntetycznymi · **0 typów naruszeń** · przewijanie w poziomie: **brak** |

Kontrola wizualna: Dieta i Zapasy na 375 px (ciemny, jasny) i 1440 px (jasny, ciemny); regresja wyglądu Dziś, Suplementacji, Treningu —
bez zmian układu, brak przewijania w poziomie.

Nowe kontrole: `tests/unit/diet-stock.test.mjs` (3: `mealTimes`, `nextMeal`, `runway`); E2E (dane syntetyczne) — pasek stanu
magazynu, karta „Do kupienia”, „Kupione” zdejmuje pozycję z listy, pasek zapasu z kreską zakupów, „Więcej” z korektami porcji
i pozostawanie rozwiniętym po zapisie, korekta dnia rozwinięta po zapisie, oznaczenia składników w Diecie; E2E z zegarem —
następny posiłek (10:00 → przekąska 11:15), kolejność godzin w nawigacji, „Pokaż skład”, inny wariant bez karty; cele dotykowe
≥ 44 px także dla `summary`, `a.chip`, `.dt-nav-a` w Treningu, CFA, Diecie i Zapasach. a11y: przed audytem import syntetycznej
kopii zapasów (statusy, paski, ostrzeżenia w Diecie widoczne dla axe), nowe stany „rozwinięte korekty i szczegóły”, „filtr pilnych”.
Zmienione nazwy przycisków Zapasów w testach: „Zakupy”, „Kopia”, „Cofnij”, „Historia” (ikony zamiast emoji), korekty dnia bez emoji
i w zwiniętej sekcji `.daycard` (test najpierw ją rozwija).

### Faza 5 — Trening i CFA (24.09.2026, konfiguracja B)
Build: **OK** — wersja `0.2.0+4830b6b2a4`; `dist/web/app.*.js` 674 KB (+7 KB: licznik, karty, 5 ikon); `dist/single/2027.html` 801 KB.

| Zestaw | Wynik |
|---|---|
| Jednostkowe | 84 uruchomione · **83 zaliczone · 0 niezaliczonych · 1 pominięty** (migracja prawdziwej kopii ZAPASY) |
| Weryfikacja danych | **nieuruchomiona** (wymaga `SOURCES_DIR`) |
| E2E | **885 kontroli · 885 zaliczonych · 0 niezaliczonych · 0 pominiętych bloków** (+39 nowych z zegarem) |
| Synchronizacja i aktualizacja | **21 kontroli · 21 zaliczonych · 0 pominiętych** (przebieg po zmianach w `core/calc`; końcowa poprawka dotyczyła tylko CSS) |
| Dostępność | 116 przebiegów (20 widoków + 9 stanów × 2 szerokości × 2 motywy) · **0 typów naruszeń** · przewijanie w poziomie: **brak** |

Kontrola wizualna: 375 px (jasny), 390 px (ciemny), 1280 px (jasny), 1440 px (ciemny) — Trening z licznikiem przerwy, CFA z panelem
zaległych; brak przewijania w poziomie.

Nowe kontrole: `tests/unit/cfa-pace.test.mjs` (6: `cfaPace`, `restSeconds` — także każda przerwa w danych TRENING, `nextSet`);
E2E `run_features()` — przeglądarka z zegarem ustawionym na pn 28.09.2026 10:00 (Playwright `clock.install`), 2 konfiguracje
(web 390 px, jeden plik 1280 px): karta następnej serii, licznik przerwy (start, odliczanie z `fast_forward`, „+30 s”, koniec
ogłoszony czytnikom, „Pomiń”), przewinięcie do ćwiczenia, podsumowanie ukończonej sesji, brak licznika dla innego dnia; CFA — tempo
i zaległe (oczekiwania liczone z `cfa.json`), panel zaległych, odhaczenie zaległego, nawigacja dni, filtr „tylko zaległe”, filtr i
wyszukiwanie error logu, cele dotykowe ≥ 44 px w Treningu i CFA na 390 px. a11y: zegar jak wyżej, nowe stany „licznik przerwy”
i „filtr error logu”; zmienione nazwy przycisków: „Rozpocznij trening”, „Zakończ trening” (ikony zamiast ▶/⏹).

### Faza 5.0 (24.09.2026, konfiguracja B — bez plików użytkownika, jak w repozytorium; dane syntetyczne D-065)
Build: **OK** — wersja `0.2.0+4bd48a78e2` (końcowy przebieg; numer zmienia się z każdą zmianą kodu); `dist/web/app.*.js` 667 KB; `dist/single/2027.html` 790 KB.

| Zestaw | Wynik |
|---|---|
| Jednostkowe | 78 uruchomionych · **77 zaliczonych · 0 niezaliczonych · 1 pominięty** (migracja prawdziwej kopii ZAPASY — wymaga pliku) |
| Weryfikacja danych | **nieuruchomiona** (wymaga `SOURCES_DIR`) |
| E2E | **846 kontroli · 846 zaliczonych · 0 niezaliczonych · 0 pominiętych bloków** (bloki zapasów, Meal Prep, eksportu/importu i pakietu prywatnego wykonane na danych syntetycznych) |
| Synchronizacja i aktualizacja | **21 kontroli · 21 zaliczonych · 0 pominiętych** — 2 kolejne przebiegi stabilne |
| Dostępność | 108 przebiegów · **0 typów naruszeń** · przewijanie w poziomie: **brak** |

Konfiguracja A (z plikami użytkownika) **nie była uruchamiana** w Fazie 5.0 — ścieżka z prawdziwymi plikami pozostała
w testach bez zmian oczekiwań (55 zmian, banan od 240 g, 30 fragmentów pakietu); do potwierdzenia przy najbliższym uruchomieniu u użytkownika.
Wyniki z Faz 3–4 (A: 74/74, E2E 812/812, sync 19/19; B: 73+1 pominięty, E2E 516 + 4 pominięte bloki, sync 19 + 1 pominięty blok) — historyczne.

Nowe testy wykrywają błędy starego kodu (sprawdzone na kodzie sprzed poprawek): `tokens.test.mjs` — 2 z 4 testów niezaliczone
(brak tokenu tekstu na `--success`); `a11y.py` ze stanami — `color-contrast` dla `.tg-law` (ciemny) i szarego tekstu odhaczonego bloku CFA (jasny).

### Dane syntetyczne (D-065)
`tests/e2e/fixtures.py`: kopia w formacie ZAPASY v31 — stany = zużycie dzienne z katalogu × umowna liczba dni (1,5 / 3 / 6 / 12 / 25,
cyklicznie), data inwentaryzacji = wczoraj, 2 wpisy historii „[DANE TESTOWE]”; pakiet prywatny — 4 sekcje o poprawnej strukturze,
fragmenty dla każdego znacznika `{private:N}` z tekstem „[DANE TESTOWE] …”. Oczekiwane wartości (liczba zdarzeń, stan banana,
liczba fragmentów) liczone z tych samych danych. Pliki powstają w katalogu tymczasowym; nic nie trafia do repozytorium.

## 3. Kryteria akceptacji dla Fazy 5 (każdy moduł)
1. `npm run build` bez błędów; oba warianty (`dist/web`, `dist/single/2027.html`).
2. Jednostkowe: 0 niezaliczonych (pominięty wyłącznie test migracji bez `SOURCES_DIR`).
3. E2E: 0 niezaliczonych; liczba kontroli nie mniejsza niż przed zmianą (konfiguracja B: ≥ 846, 0 pominiętych bloków), chyba że raport wyjaśnia różnicę.
4. `npm run a11y`: 0 naruszeń, brak przewijania w poziomie, w obu motywach; nowy stan interakcji modułu (odhaczenie, rozwinięcie, okno) dopisz do `STATES`.
   `npm test` obejmuje `tokens.test.mjs` — nowy kolor tekstu dopisz do `PAIRS`.
5. `npm run e2e:sync` (jeśli dotyczy): 21/21.
6. Brak błędów w konsoli przeglądarki (E2E zbiera `pageerror` i `console.error`).
7. Zrzuty 375/390/1280/1440 px w motywie ciemnym i jasnym przejrzane; brak regresji wyglądu innych modułów.
8. Żadne dane, dawki, gramatury, godziny ani teksty merytoryczne nie zmienione; D-041/D-064 zachowane
   (w „Dziś” chondroityna widoczna dokładnie 2 razy dla dnia 2026-09-21).
9. Nowe style wyłącznie z tokenów; brak nowych kolorów wpisanych na sztywno.

## 4. Klasy CSS używane w selektorach testów (nie zmieniaj nazw)
`.actions .bm-p .bodymap .c-exam .c-mock .cal .cal-d .cfa-row .chart .chip .counter .counters .dash .data .day .dose-list
.dz-aside .dz-card .dz-kpis .ex .ex-map .ex-tech .fg-head .fig-svg .filters .form-grid .hero .hero-cfa .hero-tr .hist-item
.hist-list .inv .inv-item .is-min .log-item .log-list .meal .more-list .mp-next .mp-ring .mv-cues .mv-phase .nowcard .opt-note
.panel .pill-b .pills .prep-card .prep-list .priv-in .priv-miss .prog .quicklinks .rk-sec .safety-table .set .set-copy .set-h
.set-toggle .sf-card .sheet .sheet-head .shop-list .side .side-a .side-gl .slot .slot-items .slot-title .stats .tabs .tm
.tm-clock .tm-man .topic .topline .gd-card .gd-rt .more-ic .more-n .mp-jump .prep-list .cfa-row .set:not(.set-h)
.tr-next .tr-rest .tr-rest-t .tr-rest-n .tr-rest-next .cf-backlog .cf-search .cf-kinds .cfa-dayhead .hero-cfa
.dt-next .dt-nav-n .dt-stock .dt-alerts .dt-stock-b a.dt-today .zp-hbar .zp-shop .zp-buy-n .zp-buy-b .zp-run .zp-run-s .zp-more .daycard
.dn-sync .dn-cloud .dn-cloud-msg .dn-cloud-cfg .dn-sync-s .has-unsent .dn-cloud-auto .dn-cloud-auto-b .cloud-banner`
(chmura, Etap 2: etykiety pól „Project URL”, „Publishable Key”, „E-mail konta”, „Hasło konta”, „Hasło szyfrowania”, „Powtórz hasło
szyfrowania”, przyciski „Zapisz konfigurację”, „Zaloguj”, „Odblokuj”, „Ustaw hasło szyfrowania”, „Synchronizuj teraz”, „Wyloguj”,
„Odłącz to urządzenie”, „Synchronizuj automatycznie” (`aria-pressed`), „Zamknij komunikat synchronizacji”, link „Przejdź do Dane”,
pole `name=email`, pole wyszukiwania `.rk-search input`, klucze `meta` `cloud.keys`, komunikaty „Konfiguracja zapisana”, „Zalogowano”,
„Synchronizacja zakończona”, „Pobrane z chmury: N”, „wysłane: N”, „Brak połączenia”, „Nieprawidłowe hasło szyfrowania”)
(od Fazy 5.0 także: atrybut `data-meal`, identyfikatory `mp-ph-N`, tekst „Przejdź do karty”; od Fazy 5: identyfikatory `ex-<id>`,
przyciski „Rozpocznij trening”, „Zakończ trening”, „+30 s”, „Pomiń przerwę”, „Dodaj wpis”, „pośpiech: 1”, „Wszystkie: N”, linki
„Przejdź do ćwiczenia”, „Następny dzień”, teksty „Zaległe: N bloków”, „Plan do wczoraj”, „Sesja ukończona”, „Następny: blok A”).
Testy używają też: ról i nazw przycisków (np. „Wyślij do iCloud”, „Nowa wersja — odśwież”, „Motyw: Jasny”, „Zwiń panel”,
„↩ Cofnij”, „+ opakowanie”), atrybutów `aria-pressed`, `aria-current`, `data-theme`, `meta[name=app-version]`, tekstów
komunikatów (np. „Zaimportowano”, „Niepełne przetwarzanie”, „STARSZY”), placeholderów pól (`kg`, `powt.`, `RIR`).
Zmiana któregokolwiek z nich = aktualizacja testu w tym samym kroku.

## 5. Czego testy automatyczne NIE obejmują (weryfikacja ręczna)
Środowisko nie ma WebKit — Safari nie było testowane automatycznie. Na urządzeniach sprawdza użytkownik:

**iPhone — Safari (karta) i aplikacja z ekranu początkowego (PWA) — osobno, bo mają osobne bazy:**
1. Moduł Dane → „Wersja aplikacji” taka sama jak na komputerze; „Uruchomiono jako” poprawne dla Safari / PWA.
2. Motyw: domyślnie ciemny; przełączenie na jasny i systemowy (strona „Więcej” → Wygląd) zapamiętane po zamknięciu aplikacji.
3. Dolny pasek: Dziś, Dieta, Trening, CFA, Więcej; nie zasłania treści; margines nad wskaźnikiem Home.
4. Pole tekstowe z klawiaturą (np. Zapasy → „Stan”, Trening → kg): pasek dolny chowa się, po zamknięciu klawiatury wraca na miejsce.
5. Okna (Zapasy → Zakupy / Historia / Kopia; Trening → „Technika i mięśnie”): otwierają się jako arkusz od dołu, przewijają, zamykają.
6. Dashboard „Dziś”: karta „Teraz”, 4 kafle, karty boczne, plan dnia — czytelne, brak poziomego przewijania.
7. Font Inter widoczny także offline (tryb samolotowy, PWA).
   PWA: ekran startowy ciemny (bez białego błysku); pasek statusu czytelny w motywie ciemnym i jasnym (`status-bar-style: default`, D-067).
   Meal Prep → skróty faz i „Przejdź do karty”: przewijają w obrębie modułu (nie przenoszą na „Dziś”).
   Trening (dzień z treningiem): po odhaczeniu serii pasek przerwy nad dolnym paskiem; przy wygaszonym ekranie i powrocie czas się zgadza;
   przy otwartej klawiaturze (pole kg) pasek przerwy się chowa i wraca. CFA: panel zaległych i nawigacja dni czytelne na 375 px.
8. Synchronizacja: pełna procedura `docs/TEST_IPHONE_SYNC.md` (komputer ↔ Safari ↔ PWA, niezależne zmiany, starszy plik, offline, aktualizacja za zgodą).
9. Synchronizacja w chmurze (Etap 2): kontrola ręczna `docs/SYNC_CHMURA.md` §5.6 — wykonana przez użytkownika (lokalnie i na
   GitHub Pages, 24.09.2026). Synchronizacja automatyczna (D-084): kontrola ręczna §6.5 (Safari i PWA osobno, powrót do aplikacji,
   tryb samolotowy, wpisywanie podczas pobierania) — **jeszcze niewykonana**.

**MacBook (Safari i Chrome):** panel boczny z grupami, zwijanie zapamiętane, przełącznik motywu, dashboard na 1280–1440 px.

Stan: **wszystkie punkty tej sekcji (iPhone Safari i PWA, MacBook, synchronizacja wg `TEST_IPHONE_SYNC.md`) sprawdzone ręcznie
przez użytkownika na wersji opublikowanej `4e68589` (Faza 5 zakończona) — działa (potwierdzenie 24.09.2026).**
(`TEST_IPHONE_SYNC.md`) została potwierdzona dla wersji sprzed redesignu.
