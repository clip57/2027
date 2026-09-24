# REDESIGN-TESTING — testy, wyniki, kryteria akceptacji, weryfikacja ręczna

## 1. Zestawy testów
| Zestaw | Komenda | Co sprawdza | Wymaga |
|---|---|---|---|
| Jednostkowe | `npm test` | rdzeń: daty, resolver, zużycie, zapasy, dieta, suplementy, trening, Meal Prep, mięśnie, zapis, synchronizacja, zgodność w przód | Node 22 |
| Weryfikacja danych | `npm run verify` | zgodność `src/data/*.json` z plikami źródłowymi (407 kontroli) | **`SOURCES_DIR`** (pliki użytkownika — brak w repo) |
| E2E | `npm run build && npm run e2e` | wszystkie moduły w 2 wariantach buildu (web przez http://localhost:8765, jeden plik przez file://) × 390 px (mobile, dotyk) / 1280 px; brak przewijania w poziomie, brak artefaktów „null/false/undefined/NaN”, cele dotykowe ≥ 44 px, funkcje modułów, trwałość zapisu, eksport/import, offline (SW) | Python 3, Playwright ≥ 1.56, Chromium; opcjonalnie `SOURCES_DIR`, `PRIVATE_PACK` |
| Synchronizacja i aktualizacja | `npm run e2e:sync` | 2 oddzielne profile (osobne bazy): sync w obu kierunkach, niezależne zmiany, brak duplikatów, ostrzeżenie o starszym pliku, zdarzenia z nowszej wersji (baner, brak utraty), aktualizacja kodu tylko za zgodą, offline po aktualizacji, przejście ze starego SW | jw.; **przebudowuje `dist/` kilka razy** (na końcu przywraca zwykły build); porty 8791 |
| Dostępność | `npm run build && npm run a11y` | axe-core WCAG 2.1 A/AA na 20 widokach × 390/1280 px × motyw jasny/ciemny (80 przebiegów) + przewijanie w poziomie | jw. |

Kolejność po każdej zmianie w Fazie 5: `npm run build && npm test && npm run e2e && npm run a11y`;
dodatkowo `npm run e2e:sync`, jeśli zmiana dotyka `src/app.js`, `src/core/**`, `tools/build.mjs`, `src/modules/dane.js`.

## 2. Wyniki regresji (24.09.2026, po przygotowaniu pakietu przekazania)
Build: **OK** — wersja `0.2.0+c702f16bc3`; `dist/web/app.*.js` 682 660 B; `dist/single/2027.html` 806 405 B.

| Zestaw | Konfiguracja A — z plikami użytkownika (`SOURCES_DIR`, `PRIVATE_PACK`) | Konfiguracja B — bez plików (tak jak w repozytorium) |
|---|---|---|
| Jednostkowe | 74 uruchomione · **74 zaliczone · 0 niezaliczonych · 0 pominiętych** | 74 · **73 zaliczone · 0 niezaliczonych · 1 pominięty** (migracja kopii ZAPASY — wymaga pliku) |
| Weryfikacja danych | **407 kontroli · 0 błędów** | **nieuruchomiona** — skrypt kończy się komunikatem „Ustaw SOURCES_DIR” |
| E2E | **812 kontroli · 812 zaliczonych · 0 niezaliczonych · 0 pominiętych bloków** | **516 kontroli · 516 zaliczonych · 0 niezaliczonych · 4 pominięte bloki** (import kopii ZAPASY z zależnymi kontrolami w każdej z 4 konfiguracji; w tym blok pakietu prywatnego) — 296 kontroli nie wykonano |
| Synchronizacja i aktualizacja | **19 kontroli · 19 zaliczonych · 0 niezaliczonych · 0 pominiętych** | **19 · 19 zaliczonych · 0 niezaliczonych · 1 pominięty blok** (import kopii ZAPASY zastąpiony ustawieniem stanów testowych; reszta scenariusza wykonana) — 2 kolejne przebiegi stabilne |
| Dostępność | 80 przebiegów · **0 typów naruszeń** · przewijanie w poziomie: **brak** | nie zależy od plików — wynik jak w A |

Zmiany w testach wprowadzone w tym kroku (bez zmiany sprawdzeń aplikacji):
- pominięte bloki raportowane jawnie (`skip()`; wcześniej liczone jako „zaliczone”);
- `sync_update.py`: ścieżka bez plików ustawia testowe stany banana i kefiru i czeka na potwierdzenie zapisu
  (wcześniej w konfiguracji B test kończył się błędem `ValueError` — błąd testu, nie aplikacji).

## 3. Kryteria akceptacji dla Fazy 5 (każdy moduł)
1. `npm run build` bez błędów; oba warianty (`dist/web`, `dist/single/2027.html`).
2. Jednostkowe: 0 niezaliczonych (pominięty wyłącznie test migracji bez `SOURCES_DIR`).
3. E2E: 0 niezaliczonych; liczba kontroli nie mniejsza niż przed zmianą (konfiguracja B: ≥ 516), chyba że raport wyjaśnia różnicę.
4. `npm run a11y`: 0 naruszeń, brak przewijania w poziomie, w obu motywach.
5. `npm run e2e:sync` (jeśli dotyczy): 19/19.
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
.tm-clock .tm-man .topic .topline`
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
8. Synchronizacja: pełna procedura `docs/TEST_IPHONE_SYNC.md` (komputer ↔ Safari ↔ PWA, niezależne zmiany, starszy plik, offline, aktualizacja za zgodą).

**MacBook (Safari i Chrome):** panel boczny z grupami, zwijanie zapamiętane, przełącznik motywu, dashboard na 1280–1440 px.

Stan: **punkty 1–8 dla Faz 3–4 nie zostały jeszcze zweryfikowane przez użytkownika.** Procedura synchronizacji
(`TEST_IPHONE_SYNC.md`) została potwierdzona dla wersji sprzed redesignu.
