# Redesign — Faza 5.0: stabilizacja Faz 3–4 przed przenoszeniem modułów — raport (24.09.2026)

Zakres zatwierdzony przez użytkownika 24.09.2026 (odpowiedzi na 5 pytań audytu): dane syntetyczne w testach — tak (D-065);
naprawa synchronizacji i redesign wdrażane razem — tak; odnośniki w obrębie strony przez `scrollIntoView` — tak (D-066);
`status-bar-style` bez zmiany na `black-translucent`, poprawa `theme-color` i manifestu (D-067); motyw domyślnie ciemny — potwierdzony (D-061).

## Audyt w kodzie — ustalenia (każde odtworzone w przeglądarce przed poprawką)
| # | Problem | Skutek | Poprawka |
|---|---|---|---|
| 1 | `main`/Pages = Etap 6 bez naprawy synchronizacji; naprawa i Fazy 3–4 w jednym commicie na `redesign-faza4` | dokumentacja twierdziła, że wersja z naprawą działa na urządzeniach | opis stanu w `REDESIGN-STATUS.md`; plan wdrożenia |
| 2 | Odhaczona seria (Trening) i blok (CFA): `#fff` na `--success` | kontrast **1,60:1** w motywie domyślnym (ciemnym) | token `--on-success` (ciemny `#0d0f13`, jasny `#fff`) |
| 3 | Szary tekst (`--muted`) w odhaczonym bloku CFA na zielonkawym tle | poniżej 4,5:1 w motywie jasnym (wykryte nowym audytem stanów) | `.cfa-row.is-done .muted` → `--ink-2` |
| 4 | `.tg-law` (poradnik) i akcenty posiłków `post/dinner/supper/drinks` — kolory jasnego motywu na sztywno | ok. 2:1 w ciemnym motywie | tokeny domen `--cfa`, `--train`, `--regen`, `--text-2` (te same wartości w jasnym motywie) |
| 5 | Wspólne `border-color` kart w `system.css` nadpisywało kolorowe lewe krawędzie `.meal`, `.daycard`, `.gd-rt`, `.gd-day` | utracone sygnatury modułów (szare 4 px) | jawne przywrócenie w `system.css` |
| 6 | `h()` ustawiało `style` przez `Object.assign` — zmienne `--*` po cichu pomijane | ikony na stronie „Więcej” bez kolorów domen | `h()` używa `style.setProperty` dla `--*` |
| 7 | Odnośniki `#mp-ph-N`, `#mp-<karta>` (Meal Prep) i `#slot…` („Dziś”) zmieniały trasę routera | Meal Prep: skrót fazy i „Przejdź do karty” przenosiły na „Dziś” | `inPageLink()` w `app.js`: przewinięcie + fokus, trasa bez zmian |
| 8 | Manifest (`#f3f5f7`/`#17202b`) i `theme-color` (`#f3f5f7`/`#0f141a`) sprzed redesignu | jasny ekran startowy PWA i niespójny pasek przeglądarki w ciemnym motywie | manifest `#0d0f13`; `theme-color` ustawiany w `<head>` wg preferencji (= `--bg`) |
| 9 | Przyklejona kolumna „Dziś” (855 px) w oknie 1280×720 | dolna karta niedostępna aż do końca strony | przyklejenie tylko przy wysokości ≥ 940 px + `max-height`/przewijanie jako zabezpieczenie |
| 10 | Każdy powrót na ekran przy czekającej nowej wersji przerysowywał cały widok | możliwa utrata niezapisanego wpisu | sprawdzanie pomija stan „gotowa”; baner pokazywany dopiero po zamknięciu klawiatury |
| 11 | Okno podglądu importu zamknięte klawiszem Esc zostawało w DOM | powielone okna/identyfikatory | usuwanie przy zdarzeniu `close` |
| 12 | Tekst w module Dane: „Pełny moduł Zapasy powstanie w Etapie 4” | nieaktualna informacja | odesłanie do modułu Zapasy |
| 13 | `system.css` z literałami (promienie 9/10/3 px, 8 rozmiarów pisma, cienie `rgb()`) sprzecznie z nagłówkiem i specyfikacją | niespójność systemu | tokeny `--r-in`, `--fs-2xs`, `--fs-stat`, `--e-raise`, `--scrim` |
| 14 | Testy w repozytorium (bez plików użytkownika) pomijały 296 kontroli: Zapasy (D-046), Meal Prep, eksport/import, pakiet prywatny | brak osłony modułów 4–5 kolejki Fazy 5 | dane syntetyczne `tests/e2e/fixtures.py` (D-065) |

## Zmienione pliki
**Aplikacja:** `src/ui/tokens.css` (nowe tokeny), `src/ui/styles.css` (kolory → tokeny, kontrast), `src/ui/system.css` (sygnatury, literały → tokeny,
kolumna „Dziś”), `src/ui/dom.js` (`setProperty` dla `--*`), `src/app.js` (`inPageLink`, spokojniejsze sprawdzanie aktualizacji),
`src/index.html` (`theme-color` przed renderem), `public/manifest.webmanifest`, `src/modules/dane.js` (tekst, okno importu).
**Testy:** nowe `tests/e2e/fixtures.py`, `tests/unit/tokens.test.mjs`; zmienione `tests/e2e/e2e.py`, `tests/e2e/a11y.py`, `tests/e2e/sync_update.py`.
**Dokumentacja:** `CLAUDE.md`, `docs/REDESIGN-STATUS.md`, `docs/REDESIGN-SPEC.md`, `docs/REDESIGN-DECISIONS.md`, `docs/REDESIGN-TESTING.md`,
`docs/DECYZJE_2027.md` (D-065–D-067, potwierdzenie D-061, otwarte G-20 i D-031), ten raport.

**Bez zmian:** `src/core/**` (model danych, `reduce()`, walidacja, synchronizacja, format `2027-sync.json`), `src/data/**`, typy zdarzeń,
baza `p2027`, logika `sw.js` w `tools/build.mjs`, nazwy klas używanych przez testy, treści merytoryczne. Żadna funkcja nie została usunięta.

## Wyniki testów (Chromium, konfiguracja B — bez plików użytkownika)
Zobacz `docs/REDESIGN-TESTING.md` §2 (tam aktualne liczby końcowego przebiegu).

## Ograniczenia i ryzyka
- Konfiguracja A (prawdziwe `SOURCES_DIR`, `PRIVATE_PACK`) nie była uruchamiana; ścieżka w testach zachowała dotychczasowe oczekiwania.
- Brak WebKit: Safari/PWA na iPhonie — kontrola ręczna (`REDESIGN-TESTING.md` §5, w tym ekran startowy, pasek statusu, skróty Meal Prep).
- Wdrożenie: pierwsze uruchomienie na urządzeniach po scaleniu z `main` przełączy stary service worker bez przycisku (zachowanie testowane
  w `sync_update.py` D); przed importem plików zaktualizuj kod we wszystkich miejscach (K, S, P).
- `styles.css` (moduły) nadal zawiera literały promieni, odstępów i pisma — zakres Fazy 5 (moduł po module, zaczynając od Treningu).
- Brak skryptu podzbioru fontu (79 znaków poza podzbiorem wyświetla się fontem systemowym).
