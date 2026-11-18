# Raport D-115 — „Fundament jakości” (etap 1 audytu 10.11.2026, T2–T9)

Decyzja użytkownika (18.11.2026): „Zrób obecnie wszystko z fundamentu jakości” — pozycje T2–T9 z `docs/RAPORT_AUDYT_2026-11-10.md` §4.
**Bez zmian w danych:** typy zdarzeń, klucze, baza (`p2027`, wersja 1, magazyny), `reduce()`, format `2027-sync.json` i synchronizacja — bez zmian.
Nowy klucz `errlog` w magazynie `meta` (lokalny, niesynchronizowany — jak konfiguracja chmury). Wygląd modułów bez zmian (strażnik wizualny:
jedyna różnica — nowa sekcja „Dziennik błędów” w „Dane”).

## 1. Co zrobione

| Pozycja | Wykonanie |
|---|---|
| **T3 — linter i typy** | ESLint 9 (`eslint.config.js`, `npm run lint`): zalecane reguły + reguły kodujące pułapki z tabeli (`docs/PULAPKI.md`): `append(cond && x)` i tablica w `append`, `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`, automatyczny `location.reload()`, zdarzenie `scroll`, View Transitions poza zmianą motywu, `SRC.week.days[…]` poza `dayPlan()`, `new Store` poza `attachStore()`, `String.replace(marker, kod)` w buildzie, stała użyta przed deklaracją (strefa martwa). Wyjątek tylko komentarzem z powodem (4 miejsca, wszystkie zgodne z decyzjami: motyw, jedyna instancja Store, przeładowanie po kliknięciu, `dayPlan()`). Kontrola typów `tsc --noEmit` (`tsconfig.json`, `npm run typecheck`) nad **całym `src/`** (checkJs, JSDoc): typ `EventType` (`src/core/types.d.ts`, równy `EVENT_TYPES` — test `types.test.mjs`) w `store.record()`/`recordMany()`, kontekst modułu `Ctx` w funkcjach `render*`, deklaracje globalne `src/globals.d.ts`. 84 zastrzeżenia usunięte opisami typów. Oba kroki w CI. |
| **T7 — dziennik błędów** | `src/core/errlog.js`: nasłuch `error` i `unhandledrejection` od startu (przed otwarciem bazy — wpisy czekają w pamięci), bufor ≤ 50 wpisów w `meta.errlog`, kolejne powtórzenia jako licznik, przycięty komunikat (300 znaków) i stos (5 linii), trasa bez parametrów. „Dane” → **„Dziennik błędów”**: ostatnie 10 wpisów, „Kopiuj dla asystenta” (tekst z wersją i przeglądarką), „Wyczyść”. Bez usług zewnętrznych i bez synchronizacji. Testy: `errlog.test.mjs`, `run_d115`. |
| **T8 — utwardzenie** | **Trusted Types** w CSP wariantu web: `require-trusted-types-for 'script'; trusted-types p2027`. Jedyne miejsce wymagające typu zaufanego — adres service workera — przez politykę `p2027` (`app.js`, tylko `./sw.js`). Sprawdzone w Chromium i WebKit (service worker zarejestrowany, brak naruszeń). **Trwały magazyn:** okazało się, że `navigator.storage.persist()` jest już wywoływane przy otwarciu bazy (`adapter-idb.js`, wywołanie opcjonalne `persist?.()` — audyt go nie wychwycił); stan widoczny w „Dane” („Ochrona przed usunięciem”). Szyfrowany eksport pliku — **nie wdrożony**: zmienia format pliku synchronizacji (§3.2), wymaga osobnej decyzji. |
| **T6 — budżety** | `tests/e2e/budget.py` (`npm run budget`, w CI): rozmiar pakietu (JS, JS gzip, CSS, `2027.html`), start przy pustym dzienniku i przy 50 tys. zdarzeń (≈ rok; syntetyczne `setting` i `train.set`), węzły DOM (widoki zwykłe / pełna lista harmonogramu MPW), dotknięcie → zmiana na ekranie. Limity z zapasem względem pomiarów (tabela §2) — łapią wyraźne pogorszenie, nie szum CI. |
| **T4 — WebKit** | `tests/e2e/webkit.py` (`npm run e2e:webkit`, osobne zadanie CI `webkit` równolegle z Chromium): 60 tras × oba warianty na iPhonie (WebKit z dotykiem, 390 px) + wariant web w Safari 1280 px — bez błędów JS, bez przewijania w poziomie, bez artefaktów tekstowych; IndexedDB po przeładowaniu; okno (Esc); tryb skupienia; gest przesunięcia na zdarzeniach dotyku; paleta ⌘K; CSP z Trusted Types i service worker; axe-core w obu motywach (wariant jednoplikowy). WebKit 26.0 (Playwright 1.56). |
| **T5 — strażnik wizualny w CI** | `tools/visual/ci.sh` + zadanie CI `wizualny`: zrzuty 30 widoków × 390/1280 px × ciemny/jasny dla commitu bazowego (PR: baza PR; gałąź: rozwidlenie z `main`; `main`: poprzedni commit) i bieżącego, na tej samej maszynie; porównanie z tolerancją szumu krawędzi (`compare.py`: różnica kanału > 24, > 30 pikseli), numer wersji maskowany. Wynik: tabela w podsumowaniu przebiegu i artefakt `wizualny-roznice` (obrazy „przed | po | różnice”). Zmiana wyglądu zwykle jest zamierzona, więc różnice nie zatrzymują testów — **chyba że opis commitu zawiera `[wygląd bez zmian]`** (porządki stylów, refaktoryzacja). Czas: ok. 3,5 min. |
| **T2 — łatanie po kluczach** | `captureUi` / `restoreUi` w `src/ui/patch.js`: przy pełnym przerysowaniu w miejscu (`render(true)` — zapis, zmiana z chmury) i przy podmianie fragmentu (`swap`, P2) rozwinięte sekcje `<details>` i przesunięte paski (`.scroll-x`, `.day-strip`, `.pills`, `.seg`…) przechodzą na odpowiedniki w nowym drzewie po kluczu (`id` › `data-key` › tekst nagłówka sekcji z numerem powtórzenia / znacznik + klasa + numer). Działa we wszystkich modułach naraz, także w 8 z pełnym przerysowaniem — usuwa całą klasę pułapek („sekcja zamyka się po każdej korekcie”) bez przepisywania modułów na punktowe odświeżanie. Przenoszone tylko to, co zmienił użytkownik. Przykład naprawiony: zapis wyniku testu kalibracyjnego w Meal Prep zwijał sekcję z tabelą testów. Pełne przejście modułów na punktowe odświeżanie — dalej stopniowo, przy pracy w danym module. |
| **T9 — `CLAUDE.md`** | 53 KB → 16 KB. Zostały: rdzeń (stan, reguły obowiązujące zawsze, architektura, komendy, **zasady bezwzględne §3 bez zmian — sprawdzone porównaniem**, sposób pracy). Przeniesione bez zmian: historia stanu i streszczenia decyzji → `docs/HISTORIA_STANU.md`, tabela pułapek → `docs/PULAPKI.md` (z opisem, które pilnuje teraz linter i typy). |

**Błędy znalezione przy okazji (naprawione):**
- Zapasy → „Paragon”: gdy wszystkie pozycje rozpoznane, pod podglądem pojawiało się słowo **„false”** (`append(cond && x)`) — wykrył ESLint.
- Zapasy → nowa / edytowana pozycja: opcja kategorii **„Inne” miała pustą etykietę** (tablica `[['Inne']]` zamiast `'Inne'`) — wykryła kontrola typów.
- Martwe importy i stałe (10 plików), warunek zawsze prawdziwy w `plan_check.mjs` — bez wpływu na działanie.

## 2. Pomiary (18.11.2026, lokalnie; limity budżetów)

| Pomiar | Wynik | Limit |
|---|---|---|
| Pakiet JS / gzip | 1131 KB / 290 KB | 1400 / 340 KB |
| Style CSS | 181 KB | 230 KB |
| `2027.html` | 1570 KB | 1900 KB |
| Start — pusty dziennik (mediana z 3) | 163 ms | 1500 ms |
| Start — 50 tys. zdarzeń (mediana z 3) | 1021 ms | 4000 ms |
| Węzły DOM — widok zwykły (najwięcej: Zapasy) | 2476 | 3500 |
| Węzły DOM — pełna lista (harmonogram MPW, 392 bloki) | 5920 | 8500 |
| Dotknięcie → zmiana na ekranie (mediana z 5) | 9–13 ms | 250 ms |

## 3. Testy

Wyniki pełnej regresji — §5 (uzupełniane po przebiegu).

## 4. Ograniczenia

- **Gest w WebKit** sprawdzany zdarzeniami `touch*` wysyłanymi ze skryptu (WebKit nie pozwala tworzyć obiektów `Touch` ze skryptu) — testuje
  logikę gestu w silniku Safari, nie sam potok dotyku iOS. Przewijanie i płynność nadal wymagają kontroli na iPhonie.
- **Strażnik wizualny** porównuje z bazą, nie z zatwierdzonymi wzorcami w repozytorium (zrzuty z różnych maszyn różnią się wygładzaniem) —
  pokazuje *zmianę*, a o jej zamierzeniu decyduje opis commitu (`[wygląd bez zmian]`).
- **Środowisko sesji:** do testów WebKit utworzono środowisko „2027” z dostępem do serwera pobierania przeglądarek Playwright
  (`cdn.playwright.dev`, `playwright.download.prss.microsoft.com`); w CI WebKit instaluje się normalnie.
- Szyfrowany eksport pliku (T8) i punktowe odświeżanie we wszystkich modułach (T2, pełne) — poza zakresem (patrz §1).
