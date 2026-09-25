# CLAUDE.md — instrukcje dla Claude Code (projekt „2027”)

Osobista aplikacja offline-first (PWA na GitHub Pages + wariant jednoplikowy): plan dnia, dieta, suplementacja, zapasy,
meal prep, trening, nauka CFA, bezpieczeństwo żywności, plan rekompozycji. Jeden użytkownik, urządzenia: MacBook,
iPhone (Safari **i** aplikacja z ekranu początkowego — to dwie osobne bazy danych), przeglądarka na komputerze.
Język interfejsu i dokumentacji: **polski**.

**Bieżące zadanie: redesign UI/UX — Faza 5 zakończona; następnie Faza 6–7** (urządzenia, regresja końcowa).
Faza 5.0 (stabilizacja Faz 3–4: kontrast, sygnatury modułów, linki w obrębie strony, dane syntetyczne w testach) — zakończona
24.09.2026, raport `docs/RAPORT_REDESIGN_F5_0.md`. Faza 5, moduły 1–2 (Trening, CFA: system projektowy + licznik przerwy,
następna seria, zaległe bloki CFA — D-068…D-070) — zakończone, raport `docs/RAPORT_REDESIGN_F5_TRENING_CFA.md`.
Faza 5, moduły 3–4 (Dieta, Zapasy jako jeden system; kierunek „premium personal OS” — D-071…D-073) — zakończone,
raport `docs/RAPORT_REDESIGN_F5_DIETA_ZAPASY.md`. Faza 5, moduły 5–9 (Meal Prep, Suplementacja, Bezpieczeństwo, Rekompozycja,
Dane — D-074…D-077) — zakończone, raport `docs/RAPORT_REDESIGN_F5_POZOSTALE.md`. **Faza 5 zakończona.** Następne: Faza 6
(urządzenia, 7 szerokości) i Faza 7 (regresja końcowa). `main`/Pages = commit `4e68589` (Faza 5 kompletna).
**Kontrola ręczna na urządzeniach (`REDESIGN-TESTING.md` §5) wykonana przez użytkownika 24.09.2026 — wszystko działa.**
**Synchronizacja przez chmurę (Supabase, D-078…D-085)** — Etap 1 (rdzeń: `src/core/sync/crypto.js`, `cloud-api.js`,
`cloud.js`, `tools/supabase/schema.sql`), Etap 2 (interfejs: sekcja „Synchronizacja w chmurze” w Dane —
`src/modules/dane-cloud.js`, warstwa urządzenia `src/core/sync/cloud-local.js`, `tools/supabase/check.sql`, `npm run e2e:cloud`)
i synchronizacja automatyczna (D-084: harmonogram `src/core/sync/cloud-auto.js`, podłączony w `app.js`; D-085: automatyczne
pobieranie zmian — lekkie sprawdzanie) wykonane. Adres
projektu i Publishable Key użytkownik wpisuje **na urządzeniu** (magazyn `meta`); synchronizacja automatyczna (przełącznik
per urządzenie) + „Synchronizuj teraz”. Projekt, audyt, instrukcja i kontrola ręczna: `docs/SYNC_CHMURA.md`. Ręczna synchronizacja
plikiem zostaje. Nigdy nie wpisuj do repozytorium adresu projektu, kluczy, haseł ani `service_role`.
Przed pracą przeczytaj: `docs/REDESIGN-STATUS.md` → `docs/REDESIGN-SPEC.md` → `docs/REDESIGN-DECISIONS.md` → `docs/REDESIGN-TESTING.md`.
Pełny rejestr decyzji produktowych: `docs/DECYZJE_2027.md` (D-001…D-085).

---

## 1. Architektura (stan zweryfikowany w kodzie 24.09.2026)

| Warstwa | Pliki | Uwagi |
|---|---|---|
| Wejście, router, nawigacja | `src/app.js`, `src/index.html` | router na `location.hash` (`#/modul?param=…`), każdy moduł renderuje do `<main>` przy każdej zmianie; strona `#/wiecej` generowana w `app.js` |
| Rejestr modułów | `src/modules/registry.js` | `GROUPS` (Dzień/Trening/Dieta/Nauka/System), `MODULES` (id, name, group, icon, domain, tab) |
| Moduły widoków | `src/modules/*.js` | `dzis, dieta, suplementy, zapasy, mealprep, trening, cfa, bezpieczenstwo, rekompozycja, dane` (+ `placeholder.js`) |
| UI — helpery | `src/ui/dom.js` | `h()` (tworzenie DOM **bez innerHTML**), `add()` (dołączanie z pominięciem null/false/undefined), `clear`, `fmt`, `plural` |
| UI — komponenty | `src/ui/components.js`, `icons.js`, `prefs.js`, `charts.js`, `bodymap.js`, `figure.js`, `movement.js` | `segmented, stat, statGrid, section, macroChips, progressRing`; ikony Lucide `icon(name,{size,label})`; preferencje per urządzenie |
| Style | `src/ui/tokens.css` → `src/ui/styles.css` → `src/ui/system.css` | sklejane w tej kolejności przez `tools/build.mjs`. **Tokeny tylko w `tokens.css`** |
| Dane źródłowe | `src/data/*.json` | generowane skryptami `tools/extract/*` z plików źródłowych użytkownika (NIE w repozytorium); traktuj jako tylko do odczytu |
| Rdzeń | `src/core/` | `resolver.js` (data → plan dnia), `calc/*` (zużycie, zapasy, dieta, suplementy, trening), `storage/*` (dziennik zdarzeń), `sync/bundle.js` (plik), `sync/crypto.js, cloud-api.js, cloud.js, cloud-local.js, cloud-auto.js` (chmura), `migrate/*`, `dates.js`, `ids.js` (HLC), `hash.js` |
| Build | `tools/build.mjs` | esbuild → `dist/web/` (index + `app.<hash>.js/css` + `fonts/` + `sw.js` + manifest) i `dist/single/2027.html` (wszystko wbudowane) |
| Ikony | `tools/icons.mjs` → `src/ui/icons.js` | plik wygenerowany i wersjonowany; regeneracja: `node tools/icons.mjs` (wymaga devDependency `lucide-static`) |
| Fonty | `public/fonts/inter-latin*.woff2` | podzbiór Inter (OFL); **brak skryptu podzbioru w repo** — zob. REDESIGN-STATUS „znane ograniczenia” |

Stan aplikacji = **dziennik zdarzeń w IndexedDB** (`p2027`, wersja 1; magazyny `events`, `meta`, `quarantine`, `backups`)
przeliczany funkcją `reduce()` w `src/core/storage/store.js`. Moduły czytają `ctx.store.state` i zapisują przez
`ctx.store.record(type, data)`. Po zapisie zwykle `ctx.rerender()` lub lokalna aktualizacja DOM.

Typy zdarzeń (walidacja w `src/core/storage/validate.js`, `SCHEMA = 1`):
`inv.count, inv.dayshift, inv.move, cat.upsert, cat.delete, cfa.done, cfa.err.put, cfa.err.del, train.set, setting,
train.session, prep.step, prep.test, private.pack, archive`.

## 2. Komendy

```bash
npm ci                    # zależności (esbuild, axe-core, lucide-static)
npm run build             # dist/web + dist/single/2027.html (wymagane przed testami E2E/a11y)
npm test                  # testy jednostkowe (node --test)
npm run e2e               # testy w przeglądarce: Python + Playwright + Chromium, obie wersje buildu, 390 i 1280 px
npm run e2e:sync          # synchronizacja między 2 profilami + aktualizacja kodu za zgodą (kilka razy przebudowuje dist/)
npm run e2e:cloud         # synchronizacja w chmurze: 2 profile + plik 2027.html, lokalny fałszywy serwer Supabase (tests/e2e/fake_supabase.py)
npm run a11y              # axe-core WCAG 2.1 A/AA: 20 widoków × 390/1280 px × jasny/ciemny + przewijanie w poziomie
npm run verify            # weryfikacja danych ze źródłami — WYMAGA SOURCES_DIR (pliki użytkownika), bez nich nie działa
```
Zmienne opcjonalne: `SOURCES_DIR` (katalog z plikami źródłowymi, m.in. `zapasy_kopia_2026-09-22.json`),
`PRIVATE_PACK` (ścieżka do `2027-prywatne.json`). **Nie masz ich w repozytorium.** Bez nich E2E i `e2e:sync` używają
**danych syntetycznych** z `tests/e2e/fixtures.py` (D-065: fikcyjne stany wyliczane wzorem z katalogu, pakiet prywatny
z tekstami „[DANE TESTOWE] …”, pliki tylko w katalogu tymczasowym). Tylko `npm run verify` i test migracji kopii ZAPASY
wymagają plików użytkownika (raportowane jako „pominięte”). Nigdy nie próbuj odtwarzać ani wymyślać plików użytkownika;
nie dopisuj do fixtures wartości „podobnych do prawdziwych” — wyłącznie wzór z katalogu i teksty zastępcze.
Workflow GitHub (`.github/workflows/pages.yml`): Node 22, `npm ci` → `npm test` → `npm run build` → publikacja `dist/web`.

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
- Faza 5: jeden moduł na raz, kolejność w `docs/REDESIGN-STATUS.md`. Po każdym module:
  `npm run build && npm test && npm run e2e && npm run a11y` (+ `npm run e2e:sync`, gdy dotykasz `app.js`, `core/`, `build.mjs`).
- Wygląd sprawdzaj zrzutami Playwright na 375, 390, 1280 i 1440 px, w motywie ciemnym **i** jasnym
  (`localStorage['p2027.theme']` = `dark`/`light`/`system` przed załadowaniem strony).
- Raport po etapie: zmienione pliki, opis zmian (desktop / mobile / komponenty), czy zmieniła się logika, wyniki testów
  (uruchomione / zaliczone / niezaliczone / pominięte), build, ograniczenia. Nie deklaruj działania bez sprawdzenia.
- Nowe istotne decyzje dopisuj do `docs/DECYZJE_2027.md` (kolejny numer D-0xx) i `docs/REDESIGN-DECISIONS.md`.

## 5. Pułapki, które już wystąpiły w tym projekcie (nie powtarzaj)

| Pułapka | Skutek | Zasada |
|---|---|---|
| `String.replace(marker, kod)` z kodem zawierającym `$&` | uszkodzony `2027.html` | w buildzie podstawiaj funkcją: `text.replace(mark, () => value)` |
| `el.append(cond && h(...))` / tablica w `append` | napisy „null”, „false”, tekst tablicy | używaj `add()` |
| Kolizja nazw klas (np. `.check` w dwóch modułach) | rozjechany układ innego modułu | prefiks modułu dla nowych klas (`dz-`, `rk-`, `sf-`, `mp-`…) |
| Walidacja głębokości treści w kopercie zdarzenia | pakiet prywatny trafiłby do kwarantanny | nie zaostrzaj walidacji istniejących typów; test `sync-compat` |
| Odczyt stanu z chwili renderu przy szybkich zapisach | nadpisanie wcześniejszej zmiany | czytaj `store.state` w chwili zapisu; kolejkuj zapisy (`trening.js`) |
| Testy zależne od dnia tygodnia / daty uruchomienia | fałszywe błędy (np. czwartek bez banana) | w testach używaj jawnych dat |
| Serwer testowy: odpowiedź 304 wg daty pliku (1 s) | „brak aktualizacji” w teście SW | kopie z bieżącą datą (`deploy()` w `sync_update.py`) |
| Kolor wpisany na sztywno w ciemnym motywie | kontrast poniżej AA | wyłącznie tokeny; `npm run a11y` w obu motywach |
| `#fff` na `--success` (odhaczona seria) | kontrast 1,6:1 w ciemnym motywie; axe nie widział stanu | tekst na wypełnieniu = token `--on-…`; pary w `tests/unit/tokens.test.mjs`, stany w `a11y.py` (`STATES`) |
| `style: {'--x': …}` przez `Object.assign` | zmienna CSS po cichu nieustawiona | `h()` używa `setProperty` dla `--*` (od Fazy 5.0) |
| Odnośnik `href="#id"` (bez `/`) | router pokazuje „Dziś” zamiast przewinąć | obsługuje go `inPageLink()` w `app.js` (przewinięcie + fokus); trasy zawsze `#/modul` |
| Wspólna reguła `border-color` kart w `system.css` | znikają kolorowe lewe krawędzie modułów | sygnatury przywrócone w `system.css`; nowe krawędzie dopisz tam lub zwiększ specyficzność |
| Element w zwiniętym `<details>` w teście | `wait_for_selector` czeka na widoczność i kończy się błędem | `state='attached'` albo najpierw rozwiń sekcję |
| `location.hash = ten sam adres` | brak `hashchange` — zapis wykonany, widok nieodświeżony (drugi wpis error logu CFA) | porównaj z `location.hash`, przy równości `ctx.rerender()` (`go()` w `cfa.js`) |
| Oczekiwana wartość liczona w Pythonie od `date.today()` (UTC), a aplikacja w strefie Europe/Warsaw | 12 fałszywych błędów E2E między 22:00 a 24:00 UTC | „dziś” w testach zawsze w strefie przeglądarki: `datetime.now(ZoneInfo('Europe/Warsaw')).date()` (`expected_stock` w `e2e.py`) |
| Funkcja zależna od „dziś” / godziny w teście | wynik zależny od dnia uruchomienia | zegar Playwright: `page.clock.install(time=…)` (`CLOCK` w `e2e.py`, `a11y.py`); przerwy — `clock.fast_forward` |
| `--muted` na tle `--sunken` (jasny motyw) | 4,47:1 — poniżej AA | na `--sunken` używaj `--text-2` (para w `tokens.test.mjs`) |
| `setInterval` sprawdzający `isConnected` przed wstawieniem elementu do DOM | licznik nigdy nie startuje | pierwsze wypełnienie bez warunku, zatrzymanie dopiero gdy element zniknie z DOM |
| `<details>` przerysowywany po każdym zapisie | sekcja zamyka się po każdej korekcie | stan rozwinięcia w pamięci modułu (`keepOpen()` w `zapasy.js`) |
| `page.goto(url + '#/dane')`, gdy strona już jest pod tym adresem | brak przerysowania; test czyta komunikat poprzedniej akcji | przed akcją wyczyść obszar komunikatu (aplikacja robi to w `run()` sekcji chmury) albo przejdź najpierw na inną trasę |
| Nowa instancja `Store` bez słuchacza (przeładowanie po zmianie w innej karcie) | karta przestaje powiadamiać inne karty i planować synchronizację | każdą instancję tworzyć przez `attachStore()` w `app.js` (test „dwie karty” w `e2e:cloud`) |
| Przerysowanie widoku „w tle” (np. po pobraniu z chmury) | utrata wpisu w polu, zamknięty arkusz | `softRender()` w `app.js` — czeka, aż pole straci fokus i żadne okno nie jest otwarte |
| Element rozwijany (`details[open]`) w kolumnie siatki `auto` | kolumna rozpycha się do szerokości treści, sąsiednia `minmax(0,1fr)` spada do 0 — nazwa łamana po literze (Zapasy, „Więcej”, ≥ 1100 px) | po rozwinięciu jedna kolumna (`:has(.zp-more[open])`), układ dwukolumnowy zależny od szerokości listy (`@container`), test szerokości w `e2e.py` |
| Licznik zapytań w teście E2E przy działającym sprawdzaniu co 30 s | fałszywy błąd: sprawdzenie „w locie” w chwili odczytu licznika | liczyć per profil (`user_agent` → `checks_of`/`calls_of` w `cloud_sync.py`) i odczytywać po ustaniu ruchu |
| Przycisk z krótkim tekstem widocznym („+ 500 g”) | test szukający „+ opakowanie” go nie znajduje | pełna nazwa w `aria-label` (testy i czytniki ekranu używają nazwy dostępnej) |
