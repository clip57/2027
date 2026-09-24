# CLAUDE.md — instrukcje dla Claude Code (projekt „2027”)

Osobista aplikacja offline-first (PWA na GitHub Pages + wariant jednoplikowy): plan dnia, dieta, suplementacja, zapasy,
meal prep, trening, nauka CFA, bezpieczeństwo żywności, plan rekompozycji. Jeden użytkownik, urządzenia: MacBook,
iPhone (Safari **i** aplikacja z ekranu początkowego — to dwie osobne bazy danych), przeglądarka na komputerze.
Język interfejsu i dokumentacji: **polski**.

**Bieżące zadanie: redesign UI/UX, Faza 5** (przeniesienie pozostałych modułów na nowy system projektowy).
Przed pracą przeczytaj: `docs/REDESIGN-STATUS.md` → `docs/REDESIGN-SPEC.md` → `docs/REDESIGN-DECISIONS.md` → `docs/REDESIGN-TESTING.md`.
Pełny rejestr decyzji produktowych: `docs/DECYZJE_2027.md` (D-001…D-064).

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
| Rdzeń | `src/core/` | `resolver.js` (data → plan dnia), `calc/*` (zużycie, zapasy, dieta, suplementy, trening), `storage/*` (dziennik zdarzeń), `sync/bundle.js`, `migrate/*`, `dates.js`, `ids.js` (HLC), `hash.js` |
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
npm run a11y              # axe-core WCAG 2.1 A/AA: 20 widoków × 390/1280 px × jasny/ciemny + przewijanie w poziomie
npm run verify            # weryfikacja danych ze źródłami — WYMAGA SOURCES_DIR (pliki użytkownika), bez nich nie działa
```
Zmienne opcjonalne: `SOURCES_DIR` (katalog z plikami źródłowymi, m.in. `zapasy_kopia_2026-09-22.json`),
`PRIVATE_PACK` (ścieżka do `2027-prywatne.json`). **Nie masz ich w repozytorium** — testy zależne od nich raportują się
jako „pominięte” (szczegóły: `docs/REDESIGN-TESTING.md`). Nigdy nie próbuj ich odtwarzać ani wymyślać.
Workflow GitHub (`.github/workflows/pages.yml`): Node 22, `npm ci` → `npm test` → `npm run build` → publikacja `dist/web`.

## 3. ZASADY BEZWZGLĘDNE (nie naruszaj bez wyraźnej zgody użytkownika)

1. **Dane i model danych:** nie zmieniaj typów zdarzeń, kluczy, nazwy bazy (`p2027`), wersji IndexedDB, struktury
   magazynów ani `reduce()` w sposób zmieniający wynik dla istniejących danych.
2. **Synchronizacja:** format `2027-sync.json` bez zmian (pola `format, schema, exportedAt, device, count, sha256, events`;
   deduplikacja po `id`; import idempotentny). Synchronizacja jest **ręczna** (D-033) — nie dodawaj „automatycznej” ani
   jej pozorów. Aktualizacja kodu (service worker) to **inna** sprawa niż synchronizacja danych (D-057).
3. **Zgodność w przód (D-056):** zdarzeń o poprawnej kopercie i nieznanym typie nie wolno usuwać ani przenosić do
   kwarantanny; pomijane w obliczeniach, raportowane banerem „Niepełne przetwarzanie”.
4. **Aktualizacja kodu tylko za zgodą (D-057):** żadnego automatycznego `location.reload()`; przycisk „Nowa wersja — odśwież”.
   Nie zmieniaj logiki `sw.js` generowanej w `tools/build.mjs` bez uruchomienia `npm run e2e:sync`.
5. **Prywatność (D-035, D-045, D-051):** żadnych danych medycznych/osobowych użytkownika w repozytorium, testach,
   zrzutach, przykładach ani commitach. Pliki `*prywatne*.json`, `zapasy_kopia_*.json`, `2027-sync*.json` są w `.gitignore`.
6. **Treść merytoryczna:** nie zmieniaj wartości w `src/data/*.json`, dawek, gramatur, godzin ani tekstów źródłowych.
   Suplementy wyłącznie z SUPLEMENTACJI (D-001); **w zakładce „Dziś” nazwy dawek tylko w planie dnia — bez dublowania
   (D-041, D-064)**. Nie twórz metryk ani wykresów bez danych (np. „Focus Score”, nastrój, AI insight).
7. **Bez płatnych usług i backendu (D-034); offline-first** — nowe zasoby muszą działać w obu wariantach buildu
   (w `2027.html` wszystko inline) i trafiać do listy `SHELL` service workera.
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
