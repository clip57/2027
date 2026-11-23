# CLAUDE.md — instrukcje dla Claude Code (projekt „2027”)

Osobista aplikacja offline-first (PWA na GitHub Pages + wariant jednoplikowy `2027.html`): plan dnia, dieta, suplementacja, zapasy,
meal prep, trening, nauka (CFA do 11.11.2026, MPW 16.11.2026–20.03.2027), bezpieczeństwo żywności, pielęgnacja, plan rekompozycji.
Jeden użytkownik, urządzenia: MacBook, iPhone (Safari **i** aplikacja z ekranu początkowego — to dwie osobne bazy danych),
przeglądarka na komputerze. Język interfejsu i dokumentacji: **polski**.

**Stan (22.11.2026):** D-114 „Instrument” i D-115 „Fundament jakości” — opublikowane na `main` (18–19.11.2026). **D-116** (studia wg harmonogramu,
plan MPW od 20.11, nowy plan **CFA Level I 2027** — 451 bloków 20.11.2026–12.05.2027, kalendarz do **30.06.2027**) — **opublikowany na `main` 21.11.2026** (`d7678ad`). **D-117** (egzamin CFA 13.05.2027, bez zjazdu IX, kalendarz do **31.12.2027**) — **opublikowany na `main` 22.11.2026** (`0371a91`). **D-118** (drobne z audytu 10.11: M5–M7, T10, T1) i **D-119** („Instrument+”: przebudowa Suplementacji, Pielęgnacji i Nauki, nowe przyciski odznaczania, tryb rutyny, szacunek tempa — `docs/RAPORT_D119.md`) — **opublikowane na `main` 22.11.2026** (`ab192f3`). **D-120** (godziny nauki dopasowane do planu dnia — D1 rozwiązane, symulacje MPW, dni bez treningu, „Praca” w dni robocze 2027 — `docs/RAPORT_D120.md`) — **opublikowany na `main` 23.11.2026** (`e0a5197`). Następny krok: nowe typy danych (pominięte dawki, powtórki error logu, data ważności produktów) — do decyzji użytkownika.
**Otwarte decyzje użytkownika:** (D1 — rozwiązane w D-120);
z D-116/D-117 (`docs/RAPORT_D116.md` §3, `RAPORT_D117.md`): święta po 28.03.2027 (do końca roku — bez wyjątków), dzień obrony.
Decyzje nie-designowe audytu „baza na dekadę” (`docs/RAPORT_AUDYT_2026-11-10.md` §11) — czekają na użytkownika.

**Czytaj w razie potrzeby (nie wczytuj wszystkiego na start):**
- `docs/PRZEKAZANIE.md` — stan, zasady współpracy, niedokończone zadania, pliki spoza repozytorium (**najpierw**, przy większej pracy);
- `docs/HISTORIA_STANU.md` — streszczenia decyzji D-086…D-120 z regułami technicznymi (daty i wersje planów, warianty dnia, moduły) —
  **przed zmianą w danym obszarze przeczytaj jego wpis**; pełny rejestr: `docs/DECYZJE_2027.md` (D-001…D-120) i raporty `docs/RAPORT_D0xx.md`;
- `docs/PULAPKI.md` — tabela pułapek, które już wystąpiły (część pilnują teraz linter i testy) — **przed zmianą UI, testów lub buildu**;
- wygląd: `docs/REDESIGN-STATUS.md` → `REDESIGN-SPEC.md` → `REDESIGN-DECISIONS.md` → `REDESIGN-TESTING.md` (klasy używane przez testy).

## 0. Reguły, które obowiązują zawsze (skrót z historii decyzji — szczegóły w `docs/HISTORIA_STANU.md`)

- **Plan dnia i daty:** typ dnia, dieta, trening, wyjątki dat — zawsze przez `dayPlan(date)` / `resolveDay(date)` z `resolver.js`
  (nigdy `SRC.week.days[…]`); dni poza planem (`inPlan`, `PLAN_START`, `PLAN_END` = 31.12.2027, D-117) — bez planu, treningu, dawek, bloków;
  zdarzeń z tych dni nie usuwaj i nie filtruj w `reduce()` ani w synchronizacji. **Godziny bloków nauki — tylko przez `week.studyMoves` (D-120, skrypt decyzji), pliki planów bez zmian; blok w slocie wg godziny.** Bloki weekendowe — `dayBlocks(date)`; najbliższe zakupy —
  `nextShopping()`; zmiany godzin planu dnia — jako skrypt decyzji w `tools/extract/day_plan_dXXX.py` (źródeł użytkownika nie ma w repozytorium).
- **Nauka:** widok wspólny CFA i MPW w `src/modules/study.js` (konfiguracje `CFA_PLAN`, `MPW_PLAN`); oba plany mogą trwać jednocześnie (D-116 — kolejność slotów w `resolveDay`); liczba bloków nigdy na sztywno
  (`CFA_BLOCKS`, `MPW_BLOCKS` w `validate.js`); `cfa.done` z polem `plan` (`CFA_PLAN_VERSION`); pola z listy `DROP` (`plan-split.js`)
  i zadania bloków MPW i CFA tylko przez `planTasks`/`loadPlanTasks`. Nawigacja zawsze przez `modulesOn(today)` / `tabModules()`.
- **Zapisy:** `ctx.store.record(type, data)` (typ z `EventType` — `src/core/types.d.ts`), zbiorcze `store.recordMany()`; **nowe ustawienia
  i odhaczenia wyłącznie przez `setting`** (`src/core/calc/checks.js`: `supp.dose:…`, `zapasy.shop:…`, `cfa.recall:…`); Zapasy — operacje przez
  `manyOp` (stos „Cofnij”). Przycisk odhaczenia zawsze `checkBtn`/`checkInput` (`src/ui/check.js`, D-119); okna zawsze `sheet()` z `components.js`; komunikaty po akcji `ctx.flash()`; przerysowanie w tle `softRender()`.
- **Pielęgnacja (D-094):** plan wyłącznie w danych użytkownika — **nigdy nie dodawaj treści planu (produkty, leki, kroki) do repozytorium,
  testów ani zrzutów**; testy tylko z `fixtures.synthetic_care_plan()`. **Imię i nazwisko użytkownika nie mogą pojawić się nigdzie**
  (także w plikach prywatnych).
- **Chmura (D-078…D-085):** adres projektu i Publishable Key użytkownik wpisuje na urządzeniu. **Nigdy nie wpisuj do repozytorium adresu
  projektu, kluczy, haseł ani `service_role`.** Opis i kontrola ręczna: `docs/SYNC_CHMURA.md`.
- **Wygląd (D-110…D-114):** tokeny tylko w `src/ui/tokens.css` (kolory w OKLCH), **nowe reguły tylko w `src/ui/instrument.css`** (warstwa
  `@layer instrument` nad `legacy`); bez animacji nieskończonych i kodu w zdarzeniu `scroll`; gesty zawsze z odpowiednikiem przyciskiem;
  wykresy i metryki tylko z prawdziwych danych. Zmiana stylów „bez zmiany wyglądu” — osobna linia `[wygląd bez zmian]` w opisie commitu (strażnik w CI).
- **Pakiet prywatny (D-091):** po zmianie planu zaktualizuj `UPGRADE` w `tools/extract/private_pack_lib.py`.

## 1. Architektura (stan zweryfikowany w kodzie 18.11.2026)

| Warstwa | Pliki | Uwagi |
|---|---|---|
| Wejście, router, nawigacja | `src/app.js`, `src/index.html` | router na `location.hash` (`#/modul?param=…`), każdy moduł renderuje do `<main>` przy każdej zmianie; strony `#/wiecej` i `#/ustawienia` (poza rejestrem modułów, `PAGES` w `app.js`) oraz pasek górny na komputerze (`topbar()`) generowane w `app.js` |
| Rejestr modułów | `src/modules/registry.js` | `GROUPS` (Dzień/Trening/Dieta/Nauka/System), `MODULES` (id, name, group, icon, domain, tab, `tabFrom`/`tabUntil`), `modulesOn(today)` |
| Moduły widoków | `src/modules/*.js` | `dzis, pielegnacja, dieta, suplementy, zapasy, mealprep, trening, cfa, mpw, bezpieczenstwo, rekompozycja, dane` (+ `placeholder.js`; `study.js` — wspólny widok CFA i MPW) |
| UI — helpery | `src/ui/dom.js`, `src/ui/patch.js` | `h()` (tworzenie DOM **bez innerHTML**), `add()` (dołączanie z pominięciem null/false/undefined), `clear`, `fmt`, `plural`; `region()`/`swap()`/`holdFocus()` — punktowe odświeżanie z zachowaniem fokusu (P2) |
| UI — komponenty | `src/ui/components.js`, `icons.js`, `prefs.js`, `charts.js`, `signal.js`, `settings.js`, `search.js`, `bodymap.js`, `figure.js`, `movement.js`, D-114: `dial.js`, `live.js`, `gestures.js`, `motion.js`, `wakelock.js` | `segmented, stat, statGrid, section, macroChips, progressRing, metric, statusBadge, timerChip`; wykresy SVG (`sparkline, areaChart, donut, heatmap, stockAxis` oraz starsze `barChart, lineChart`); ikony Lucide `icon(name,{size,label})`; preferencje per urządzenie (`prefs.js`: motyw, akcent, gęstość, rozmiar tekstu, dźwięk, ekran startowy); sygnał odliczania (`signal.js`); strona Ustawienia (`settings.js`); paleta ⌘K z poleceniami (`search.js`) |
| Style | `@layer legacy` (`src/ui/tokens.css` → `styles.css` → `system.css` → `precision.css`), `@layer instrument` (`src/ui/instrument.css`) | sklejane i minifikowane przez `tools/build.mjs` (D-113, warstwy D-114). **Tokeny tylko w `tokens.css`; nowe reguły tylko w `instrument.css`** |
| Dane źródłowe | `src/data/*.json` | generowane skryptami `tools/extract/*` z plików źródłowych użytkownika (NIE w repozytorium); traktuj jako tylko do odczytu |
| Rdzeń | `src/core/` | `resolver.js` (data → plan dnia), `calc/*` (zużycie, zapasy, dieta, suplementy, trening), `storage/*` (dziennik zdarzeń), `sync/bundle.js` (plik), `sync/crypto.js, cloud-api.js, cloud.js, cloud-local.js, cloud-auto.js` (chmura), `migrate/*`, `dates.js`, `ids.js` (HLC), `hash.js`, `errlog.js` (dziennik błędów, D-115), `types.d.ts` (typy zdarzeń i kontekstu modułu), `data-split.js` + `module-data.js` (dane widoków doładowywane — D-118: pełne dane Rekompozycji i Bezpieczeństwa tylko przez `loadModuleData`) |
| Build | `tools/build.mjs` | esbuild → `dist/web/` (index + `app.<hash>.js/css` + `fonts/` + `sw.js` + manifest + `splash/` — obrazy startowe iOS z `tools/splash.py` + pliki `plan-*`/`data-*.json`) i `dist/single/2027.html` (wszystko wbudowane) |
| Ikony | `tools/icons.mjs` → `src/ui/icons.js` | plik wygenerowany i wersjonowany; regeneracja: `node tools/icons.mjs` (wymaga devDependency `lucide-static`) |
| Fonty | `public/fonts/inter-latin*.woff2`, `inter-display.woff2` (D-113) | podzbiór Inter (OFL) ze skryptu `python3 tools/fonts.py` (D-111; opis i znaki przy foncie systemowym — `tools/fonts.json`) |

Stan aplikacji = **dziennik zdarzeń w IndexedDB** (`p2027`, wersja 1; magazyny `events`, `meta`, `quarantine`, `backups`)
przeliczany funkcją `reduce()` w `src/core/storage/store.js` (akumulator `Reducer`: zapis lokalny dokłada zdarzenia przyrostowo, import i synchronizacja — pełne przeliczenie; P1, D-092). Moduły czytają `ctx.store.state` i zapisują przez
`ctx.store.record(type, data)`. Po zapisie zwykle `ctx.rerender()` lub lokalna aktualizacja DOM.

Typy zdarzeń (walidacja w `src/core/storage/validate.js`, `SCHEMA = 1`):
`inv.count, inv.dayshift, inv.move, cat.upsert, cat.delete, cfa.done, cfa.err.put, cfa.err.del, train.set, setting,
train.session, train.detail, prep.step, prep.test, private.pack, archive, care.def, care.done, mpw.done, mpw.err.put, mpw.err.del` (`care.*` — D-094, `mpw.*` — D-095, `train.detail` — D-106).

## 2. Komendy

```bash
npm ci                    # zależności (esbuild, axe-core, lucide-static, eslint, typescript)
npm run build             # dist/web + dist/single/2027.html (wymagane przed testami w przeglądarce)
npm run lint              # ESLint: zalecane reguły + pułapki projektu (eslint.config.js)
npm run typecheck         # tsc --noEmit nad src/ (JSDoc, src/core/types.d.ts, src/globals.d.ts)
npm test                  # testy jednostkowe (node --test)
npm run e2e               # Python + Playwright + Chromium, obie wersje buildu, 390 i 1280 px
npm run e2e:webkit        # WebKit (Safari): iPhone 390 px i Mac 1280 px, oba warianty, axe (wymaga `playwright install --with-deps webkit`)
npm run e2e:sync          # synchronizacja między 2 profilami + aktualizacja kodu za zgodą (kilka razy przebudowuje dist/)
npm run e2e:cloud         # synchronizacja w chmurze (lokalny fałszywy serwer Supabase; sam buduje wariant BUILD_LOCAL_API=1 i przywraca zwykły)
npm run e2e:trening       # arkusze treningu (D-105) i dziennik sesji (D-106)
npm run a11y              # axe-core WCAG 2.1 A/AA: widoki i stany × 390/1280 px × jasny/ciemny + przewijanie w poziomie
npm run budget            # budżety wydajności: rozmiar pakietu, start przy 50 tys. zdarzeń, węzły DOM, czas reakcji (tests/e2e/budget.py)
python3 tools/visual/snap.py <katalog> && python3 tools/visual/compare.py <przed> <po> [różnice]   # strażnik wizualny (w CI: tools/visual/ci.sh)
python3 tools/fonts.py    # podzbiór fontu Inter — po dodaniu nowych znaków do tekstów
node tools/verify/plan_check.mjs && node tools/verify/day_check.mjs && python3 tests/e2e/cfa_smoke.py   # spójność planu dnia i nauki (D-120: ciągłość doby, bloki, kolacja)
npm run verify            # weryfikacja danych ze źródłami — WYMAGA SOURCES_DIR (pliki użytkownika), bez nich nie działa
```
Zmienne opcjonalne: `SOURCES_DIR` (pliki źródłowe użytkownika), `PRIVATE_PACK` (`2027-prywatne.json`). **Nie masz ich w repozytorium.**
Bez nich testy używają **danych syntetycznych** z `tests/e2e/fixtures.py` (D-065). Nigdy nie próbuj odtwarzać ani wymyślać plików
użytkownika; nie dopisuj do fixtures wartości „podobnych do prawdziwych” — wyłącznie wzór z katalogu i teksty zastępcze.
W testach: jawne daty i zegar Playwright (`page.clock.install`), „dziś” w strefie Europe/Warsaw.
Workflow GitHub: `.github/workflows/testy.yml` („Testy 2027” — zadania `testy` (lint, typy, jednostkowe, plan, budowa, E2E, a11y,
Trening, sync, chmura, budżety), `webkit`, `wizualny`; push poza `main` i PR) oraz `pages.yml` (push do `main`: „Testy 2027” → budowa →
publikacja `dist/web`; błąd testów zatrzymuje publikację). Testy na `ubuntu-24.04` (Playwright 1.56 nie obsługuje 26.04).

## 3. ZASADY BEZWZGLĘDNE (nie naruszaj bez wyraźnej zgody użytkownika)

1. **Dane i model danych:** nie zmieniaj typów zdarzeń, kluczy, nazwy bazy (`p2027`), wersji IndexedDB, struktury
   magazynów ani `reduce()` w sposób zmieniający wynik dla istniejących danych.
2. **Synchronizacja:** format `2027-sync.json` bez zmian (pola `format, schema, exportedAt, device, count, sha256, events`;
   deduplikacja po `id`; import idempotentny). Synchronizacja **plikiem** jest ręczna (D-033). Synchronizacja **w chmurze**
   jest automatyczna wyłącznie według D-084 (wyzwalacze, odliczanie, limity, przełącznik per urządzenie, jedna runda naraz)
   i D-085 (lekkie sprawdzanie zmian: 30 s komputer / 60 s telefon / 5 min bezczynność, `focus` ≤ 1/10 s, osobny przełącznik)
   plus przycisk „Synchronizuj teraz”; nie dodawaj innych wyzwalaczy ani krótszych interwałów bez zgody użytkownika.
   Bez Realtime/WebSocketu/SDK — wyłącznie REST.
   Chmura: tylko zaszyfrowane zdarzenia, wiersze niezmienne, klucze sekretne odrzucane (D-078…D-082).
   Aktualizacja kodu (service worker) to **inna** sprawa niż synchronizacja danych (D-057).
3. **Zgodność w przód (D-056):** zdarzeń o poprawnej kopercie i nieznanym typie nie wolno usuwać ani przenosić do
   kwarantanny; pomijane w obliczeniach, raportowane banerem „Niepełne przetwarzanie”.
4. **Aktualizacja kodu tylko za zgodą (D-057):** żadnego automatycznego `location.reload()`; przycisk „Nowa wersja — odśwież”.
   Nie zmieniaj logiki `sw.js` generowanej w `tools/build.mjs` bez uruchomienia `npm run e2e:sync`.
5. **Prywatność (D-035, D-045, D-051):** żadnych danych medycznych/osobowych użytkownika w repozytorium, testach,
   zrzutach, przykładach ani commitach. Pliki `*prywatne*.json`, `zapasy_kopia_*.json`, `2027-sync*.json` są w `.gitignore`.
6. **Treść merytoryczna:** nie zmieniaj wartości w `src/data/*.json`, dawek, gramatur, godzin ani tekstów źródłowych.
   Suplementy wyłącznie z SUPLEMENTACJI (D-001); **w zakładce „Dziś” nazwy dawek tylko w planie dnia — bez dublowania
   (D-041, D-064)**. Nie twórz metryk ani wykresów bez danych (np. „Focus Score”, nastrój, AI insight).
7. **Bez płatnych usług i własnego backendu (D-034); offline-first** — jedyny serwer to opcjonalny projekt Supabase
   użytkownika w planie bezpłatnym (D-078), wyłącznie REST bez SDK; aplikacja musi działać w pełni bez niego. Nowe zasoby
   muszą działać w obu wariantach buildu (w `2027.html` wszystko inline) i trafiać do listy `SHELL` service workera.
8. **Bezpieczeństwo DOM:** nigdy `innerHTML`/`insertAdjacentHTML` z danymi. Budowanie przez `h()`; dołączanie wartości
   warunkowych/tablic przez `add()` (nie `el.append(cond && x)` — wyświetla „false”/„null”/„undefined”).
9. **Nie zmieniaj nazw klas CSS używanych przez testy** (lista w `docs/REDESIGN-TESTING.md`). Zmieniaj ich wygląd.
   Jeśli zmiana struktury jest konieczna — zaktualizuj test w tym samym kroku i opisz to w raporcie.
10. **Nie usuwaj funkcji, zakładek ani testów.** Nie zastępuj działających funkcji makietami.

## 4. Sposób pracy

- Przed większą zmianą: zakres, wpływ na moduły, ryzyko regresji, plan testów. Zmiany w modelu danych, synchronizacji,
  architekturze lub usuwanie funkcji → **zatrzymaj się i zapytaj użytkownika**.
- Po każdej zmianie: `npm run lint && npm run typecheck && npm run build && npm test && npm run e2e && npm run a11y`
  (+ `npm run e2e:sync`, gdy dotykasz `app.js`, `core/`, `build.mjs`; + `npm run e2e:webkit` przy zmianach UI, gestów, przewijania, okien).
- Wygląd sprawdzaj zrzutami Playwright na 375, 390, 1280 i 1440 px, w motywie ciemnym **i** jasnym
  (`localStorage['p2027.theme']` = `dark`/`light`/`system` przed załadowaniem strony).
- Raport po etapie: zmienione pliki, opis zmian (desktop / mobile / komponenty), czy zmieniła się logika, wyniki testów
  (uruchomione / zaliczone / niezaliczone / pominięte), build, ograniczenia. Nie deklaruj działania bez sprawdzenia.
- Nowe istotne decyzje dopisuj do `docs/DECYZJE_2027.md` (kolejny numer D-0xx) i `docs/REDESIGN-DECISIONS.md`.

## 5. Pułapki

Pełna tabela: `docs/PULAPKI.md` (kilkadziesiąt pozycji — każda kosztowała już błąd). Najczęstsze: dołączanie warunkowe tylko przez `add()`;
stan pochodny w module z punktowym odświeżaniem w `let` przeliczanych przed odświeżeniem; `reduce()` i `Reducer` — jeden kod
dla obu ścieżek (`reduce-incremental.test.mjs`); w testach czekaj na stan (`wait_js`), nie na czas; elementy w zwiniętym `<details>` —
`state='attached'`; nowy znak w tekstach → `python3 tools/fonts.py`; nadpisując style w `instrument`, zmieniaj `border-color`, nie skrót `border`.
