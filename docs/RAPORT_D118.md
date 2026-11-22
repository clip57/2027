# Raport D-118 — drobne poprawki z audytu 10.11.2026 bez decyzji (M5, M6, M7, T10, T1) i plan przebudowy modułów

Polecenie użytkownika (22.11.2026): „Zaplanuj poprawę wyglądu modułów jak Pielęgnacja, Suplementacja, MPW i CFA […] Zrób dokładny research […].
Następnie zrób wszystkie drobne rzeczy bez decyzji opisane powyżej.” — „drobne rzeczy” = lista z odpowiedzi o stanie audytu 10.11:
M5 (ekrany po końcu planu), M6 (manifest), M7 (ekran startowy na iPhonie), T10 (mniejszy pakiet), T1 (porządki w stylach).

**Plan przebudowy 4 modułów:** `docs/PLAN_PRZEBUDOWY_MODULOW_2026-11-22.md` — research (§2, §10), diagnoza (§1), projekt (§3–§5), etapy (§6)
i decyzje do podjęcia (§9). Nic z planu nie jest jeszcze wdrożone.

**Bez zmian danych:** typy zdarzeń, klucze, baza, `reduce()`, format `2027-sync.json` i synchronizacja — bez zmian. Pliki `src/data/*.json` bez zmian.

## 1. Co zrobione

| Pozycja | Wykonanie |
|---|---|
| **M5 — po końcu planu** | Dieta: poza planem (przed 18.10.2026 i po 31.12.2027) bez „obowiązuje dziś” i „Następnego posiłku”; notatka „Dziś poza planem — plan zakończył się … Poniżej jadłospis wybrany przełącznikami.”, bez odnośnika „Pokaż plan na dziś”. Zapasy: poza planem chip „poza planem” zamiast fazy i rodzaju dnia; „Najbliższe zakupy” — „poza planem” z opisem, gdy najbliższy czwartek wypada po końcu planu (także w ostatnich dniach planu: „w planie nie ma już zakupów”). Suplementacja: „do uzupełnienia: N” tylko w dniu planu. Kalendarz (ostatni miesiąc planu) i „Dziś” (ekran „Poza planem”) — działały poprawnie, bez zmian. |
| **M6 — manifest** | `public/manifest.webmanifest`: `id`, `dir`, `categories` (health, lifestyle, productivity, education), opis obejmujący wszystkie moduły, **skróty** z ikony: Dziś, Trening, Zakupy (`#/zapasy?s=shop`), Suplementacja. Skróty działają w przeglądarkach, które je obsługują (Chrome/Edge, Android); iOS i Safari ich nie pokazują. Pole `screenshots` pominięte — Safari go nie używa, a dodałoby pliki graficzne do pobrania. |
| **M7 — ekran startowy iOS** | `tools/splash.py` generuje 11 obrazów `apple-touch-startup-image` (iPhone SE 2./3. gen. … seria 17 i Air; pionowo) — tło motywu ciemnego `#090a0d` i znak aplikacji (pierścień + „27”); paleta 64 kolorów, razem 136 KB (ok. 12 KB na plik). Build dodaje `<link rel="apple-touch-startup-image" media="…">` do wariantu web i pliki do listy SHELL. iOS pobiera obraz przy dodawaniu do ekranu początkowego — **istniejąca ikona musi zostać usunięta i dodana ponownie z Safari**, żeby zniknął pusty ekran przy starcie. Do sprawdzenia na iPhonie. |
| **T10 — mniejszy pakiet** | Mechanizm „dane widoków doładowywane przy wejściu do modułu” (wzorzec zadań bloków nauki, U6): `src/core/data-split.js` (rdzeń w pakiecie), `module-data.js` (Node) / `module-data.web.js` (przeglądarka). Rekompozycja (treść sekcji), Bezpieczeństwo żywności (tabela i poradnik) — pełne dane w osobnych plikach `data-<id>.<skrót>.json` (lista SHELL, offline) albo wbudowane w `2027.html`. W pakiecie zostaje rdzeń: spis sekcji i znaczniki pakietu prywatnego (⌘K, Diagnostyka), nazwy produktów i działy tabeli bezpieczeństwa (⌘K, Zapasy). Paleta ⌘K doczytuje treść Rekompozycji przy otwarciu (wyszukiwanie w tekście jak dotąd). **Pakiet JS 1134 → 979 KB (−14 %).** Build sprawdza, że rdzeń jest w pakiecie, a pełna treść nie. |
| **T1 — style** | Usunięte reguły dla klas, których aplikacja już nie tworzy: Dzień zero (D-100), dawna karta „Teraz” (`dz-now-side`), `dz-macro`, `safe-card`, `cf-hero-v`, `dash-dots`/`d-*`, rysunek ruchu `mv-svg` — **0 różnic w wyglądzie** (strażnik wizualny: 120 zrzutów przed/po; jedyna różnica — losowy identyfikator urządzenia w „Dane”). Nowy strażnik w testach (`tests/unit/styles-guard.test.mjs`): `instrument.css` tylko z kolorami i rozmiarami pisma z tokenów (wyjątek: tekst w SVG), starsza warstwa `legacy` nie może rosnąć (nowe reguły tylko w `instrument.css`), żadnych reguł dla klas nietworzonych przez kod ani dane. Pełne przeniesienie reguł modułów z `legacy` — przy przebudowie modułów (plan §5). |

Przy okazji: strażnik wizualny (`tools/visual/snap.py`) zrzuca widoki nauki z dni planów D-116 (24.11 zamiast dni bez bloków).

## 2. Pliki

Nowe: `docs/PLAN_PRZEBUDOWY_MODULOW_2026-11-22.md`, `docs/RAPORT_D118.md`, `src/core/data-split.js`, `src/core/module-data.js`,
`src/core/module-data.web.js`, `tools/splash.py`, `public/splash/` (11 PNG + `splash.json`), `tests/unit/module-data.test.mjs`, `tests/unit/styles-guard.test.mjs`.
Zmienione: `public/manifest.webmanifest`, `tools/build.mjs`, `src/modules/{dieta,zapasy,suplementy,rekompozycja,bezpieczenstwo}.js`,
`src/core/search.js`, `src/ui/search.js`, `src/core/calc/diagnostics.js`, `src/globals.d.ts`, `src/ui/{styles,system,precision}.css`, `tools/visual/snap.py`.

## 3. Testy (22.11.2026, lokalnie)

| Zestaw | Wynik |
|---|---|
| `npm run lint`, `npm run typecheck` | bez błędów |
| `npm test` | 287 / 287 (nowe: `module-data.test.mjs` 3, `styles-guard.test.mjs` 4) |
| `node tools/verify/plan_check.mjs`, `verify_all.py --data-only` | 0 błędów (2 znane ostrzeżenia D1) · 13 kontroli, 0 błędów |
| `npm run e2e` | 1716 / 1716 |
| `npm run a11y` | 0 naruszeń |
| `npm run e2e:webkit` | 249 / 249 |
| `python3 tests/e2e/cfa_smoke.py`, `npm run e2e:trening` | 0 błędów |
| `npm run e2e:sync` | 23 / 23 (service worker z nową listą SHELL) |
| `npm run e2e:cloud` | 100 / 100 |
| `npm run budget` | 9 / 9 — pakiet JS 1002 KB (gzip 238 KB, wcześniej 293 KB), start przy 50 tys. zdarzeń 870 ms (wcześniej 1120 ms) |
| Strażnik wizualny (120 zrzutów przed/po usunięciu martwych reguł CSS) | 0 różnic w wyglądzie (jedyna różnica — losowy identyfikator urządzenia w „Dane”) |

Ograniczenia: obrazów startowych i skrótów manifestu nie da się sprawdzić bez iPhone'a / Chrome — do kontroli na urządzeniu
(ikonę trzeba usunąć i dodać ponownie z Safari).
