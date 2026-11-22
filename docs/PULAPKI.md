# Pułapki, które już wystąpiły w tym projekcie (przeniesione z CLAUDE.md — D-115, T9)

Tabela bez zmian. Część pułapek pilnują teraz automaty — nie trzeba ich pamiętać, ale trzeba wiedzieć, skąd bierze się błąd:
- **ESLint** (`npm run lint`, `eslint.config.js`): `append(cond && x)` i tablica w `append`, `innerHTML`/`outerHTML`/`insertAdjacentHTML`,
  automatyczny `location.reload()`, kod w zdarzeniu `scroll`, View Transitions poza zmianą motywu, `SRC.week.days[…]` poza `dayPlan()`,
  `new Store` poza `attachStore()`, `String.replace(marker, kod)` w buildzie, stała użyta przed deklaracją (strefa martwa — „const po
  return <widok>()”, „const show”).
- **Kontrola typów** (`npm run typecheck`): literówka w typie zdarzenia przy `store.record()` (typ `EventType` w `src/core/types.d.ts`).
- **Testy E2E / WebKit / budżety / strażnik wizualny** — pozostałe pozycje (opis przy każdej).


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
| Nowa instancja `Store` bez słuchacza (przeładowanie po zmianie w innej karcie) | karta przestaje powiadamiać inne karty i planować synchronizację | zmiana w innej karcie → `store.reload()` (ta sama instancja i połączenie, D-107/B10); nowe instancje tylko przez `attachStore()` w `app.js` (test „dwie karty” w `e2e:cloud`, B10 w `run_d107`) |
| Przerysowanie widoku „w tle” (np. po pobraniu z chmury) | utrata wpisu w polu, zamknięty arkusz | `softRender()` w `app.js` — czeka, aż pole straci fokus i żadne okno nie jest otwarte |
| Element rozwijany (`details[open]`) w kolumnie siatki `auto` | kolumna rozpycha się do szerokości treści, sąsiednia `minmax(0,1fr)` spada do 0 — nazwa łamana po literze (Zapasy, „Więcej”, ≥ 1100 px) | po rozwinięciu jedna kolumna (`:has(.zp-more[open])`), układ dwukolumnowy zależny od szerokości listy (`@container`), test szerokości w `e2e.py` |
| Licznik zapytań w teście E2E przy działającym sprawdzaniu co 30 s | fałszywy błąd: sprawdzenie „w locie” w chwili odczytu licznika | liczyć per profil (`user_agent` → `checks_of`/`calls_of` w `cloud_sync.py`) i odczytywać po ustaniu ruchu |
| Przycisk z krótkim tekstem widocznym („+ 500 g”) | test szukający „+ opakowanie” go nie znajduje | pełna nazwa w `aria-label` (testy i czytniki ekranu używają nazwy dostępnej) |
| Liczba bloków CFA wpisana na sztywno (416) w walidacji `cfa.done` i imporcie postępu | po zmianie planu bloki 417–432 odrzucane przy zapisie | `CFA_BLOCKS` w `validate.js`, test zgodności z `cfa.json` (`plan-cfa.test.mjs`); zmiana planu = przejrzeć `grep -rn "<stara liczba>"` |
| Typ dnia / dieta czytane z `SRC.week.days[weekday]` | wyjątek daty (np. 27.09 — dieta NT) pominięty w Zapasach, Treningu, Suplementacji | zawsze `dayPlan(date)` z `resolver.js` (wyjątki `week.exceptions`, D-087) |
| Test zależny od prawdziwego kalendarza planu (np. lista zakupów od 22.09) | wyjątek daty zmienia oczekiwane zużycie | w testach ogólnej logiki używaj tygodni bez wyjątków (od 05.10.2026) |
| Tytuł slotu w „Dziś” czytany w teście przez `textContent` | w dniu bieżącym dopisek „teraz” — test zależny od godziny | tytuł bez znacznika: `.slot-title` → `firstChild.textContent` |
| Zmiana godzin planu dnia bez źródłowego `PLAN_DNIA.html` | ponowna ekstrakcja przywróciłaby stary rozkład | zmiana jako funkcja decyzji w `tools/extract/` (np. `day_plan_d086.py`) stosowana po odczycie źródła |
| `wait_for_selector('.slot')` w „Dziś” dnia bieżącego | pierwszy slot jest w zwiniętych „Minionych punktach” (U-a) — test czeka do przekroczenia czasu | czekaj na `.dz-plan-h`; przed odczytem treści rozwiń `details.dz-past` |
| `wait_for_function('…')` z tekstem predykatu / `add_script_tag` w wariancie web | CSP (S1, bez `'unsafe-eval'` i skryptów inline) blokuje narzędzie testowe | odpytywanie przez `evaluate` (`wait_js` w testach), axe przez CDP `Runtime.evaluate` |
| Pole `type=search` w oknie | pierwszy Esc tylko czyści tekst, okno zostaje | obsłuż `Escape` w polu (zamknięcie okna — `search.js`) |
| Dni sprzed startu planu w nowych widokach (D-088) | trening, dawki, bloki dla 21–24.09 | zawsze przez `resolveDay`/`dayPlan` (`outside`), statystyki od `TRAIN_FROM` |
| Stan pochodny jako `const` w module z punktowym odświeżaniem (P2) | przyciski w niezmienionych fragmentach działają na starym stanie (np. „Oznacz cały dzień” pomija odhaczone w międzyczasie) | stan pochodny w zmiennych `let` przeliczanych przed odświeżeniem (`derive()`/`compute()`); przyciski czytają zmienne, nie kopie z chwili renderu |
| Zmiana `reduce()` / akumulatora `Reducer` | stan przyrostowy różny od pełnego — rozjazd widoków po zapisie i po ponownym otwarciu | jeden kod dla obu ścieżek; test `reduce-incremental.test.mjs` (kopia wzorcowa `reduce()` sprzed P1) musi przechodzić |
| Nowa akcja w module z punktowym odświeżaniem | fragment zależny od zmiany nieodświeżony | dopisz go do `update`/`refresh` modułu albo użyj `ctx.rerender()`; przypadek do `run_p2` w `e2e.py` (porównanie z pełnym przerysowaniem) |
| Pasek zakładek z `--muted` nad prześwitującym przyciskiem (półprzezroczyste tło paska) | kontrast 4,45:1 tylko na jednej trasie (a11y) | etykiety zakładek w `--text-2` |
| Długie ciągi bez spacji (adresy w zadaniach MPW, „a/b/c”) w wierszu bloku | przewijanie w poziomie przy 320 px, pierścień dnia ściśnięty do zera | `overflow-wrap: anywhere` w `.cfa-body`, `min-width: 0` i `flex: none` pierścienia |
| `Number('')` w polu liczbowym zapisującym dane | puste pole „Stan” zapisywało 0 („⛔ BRAK”) | puste / nieczytelne = bez zapisu i komunikat (B2, D-107); `Number.isFinite` po jawnym sprawdzeniu `''` |
| Widok liczony z „dziś” / godziny tylko przy renderze | aplikacja wznowiona rano pokazywała wczorajszy dzień i „Teraz: Sen” | zmiana dnia — `clockTick` w `app.js`; zależność od godziny — `ctx.tick(fn)` w module (punktowo albo `ctx.soft()`), B3 |
| „Cofnij” przywracające ilość poprzedniej inwentaryzacji | stan bez zużycia od tamtego dnia (+240 g), drugie „Cofnij” przywracało błąd | `lastOperation` / `undoOperation` (stos, stan „jakby operacji nie było”); zapisy zbiorcze w Zapasach przez `manyOp` (B1) |
| Slot rozpoznawany po identyfikatorze szablonu bazowego | warianty dnia (basen, czwartek) pominięte w `.ics` | rola slotu z `slot.key` (resolver przekazuje), B5 |
| Godziny lub dni wpisane na sztywno w tekście („od 15:30”, „(sobota)”) | błędny opis po zmianie planu (czwartki od 07.01 o 16:00) | z danych: `mpwDaySpan`, `slotOptions` (B6, B9) |
| Wyrażenie `[a-z-]+` dla atrybutów SVG w `tools/icons.mjs` | ikony bez `x1`/`y2` (timer, monitor) | nazwy atrybutów z cyframi; test `icons.test.mjs` porównuje z plikami Lucide (B7) |
| Test czytający pobrany plik przez `read_text()` | `\r\n` zamienione na `\n` — fałszywy błąd przy kontroli `.ics` | `read_bytes().decode('utf8')` |
| `clock.fast_forward(t)` w Playwright przy zegarze co 30 s | zegar wywołany najwyżej raz — sprawdzenie „po 10:03” nie zachodzi | przeskok ≥ 60 s albo `run_for` |
| Stałe (`const`) zdefiniowane w module po `return <widok>()` | `ReferenceError` przy kliknięciu (okno edycji Pielęgnacji się nie otwierało) | pomocnicze stałe i fragmenty (`region`) przed wyborem widoku; funkcje (`function`) mogą być niżej |
| Pole planu nauki z listy `DROP` (`src/core/plan-split.js`) albo `zadania` użyte wprost w kodzie | w Node (testy) pole jest, w przeglądarce — `undefined` (build podaje plan bez niego) | nowe użycie = usunięcie pola z `DROP`; zadania MPW tylko przez `planTasks`/`loadPlanTasks`; strażnik `plan-split.test.mjs` |
| Test chmury w wariancie web z produkcyjną CSP | `connect-src` bez `localhost` (U7) blokuje lokalny serwer testowy | `e2e:cloud` (`cloud_sync.py`) sam buduje wariant `BUILD_LOCAL_API=1`; nie dodawaj `localhost` do CSP publikowanej wersji |
| Moduł przewinięty, nowa trasa (hash) — przewinięcie zostawało | nowy moduł otwierał się w połowie strony | D-110: `navigate()` w `app.js` — nowy moduł/widok od góry, „Wstecz” z pamięci (`history.state.p2027`); filtry bez zmiany przewinięcia |
| View Transitions przy zmianie trasy | przerysowanie po przechwyceniu starego obrazu: +50–300 ms bez GPU — testy czytały stary widok | trasy: przerysowanie od razu + animacja CSS `main[data-enter]`; View Transitions tylko przy zmianie motywu (wybór zapisany przed przejściem, test czeka na warunek) |
| Animacja sterowana przewijaniem (`animation-timeline: scroll()`) w predykacie „koniec animacji” | `getAnimations()` zwraca ją jako trwającą — test czeka bez końca | czekaj tylko na animacje czasowe: `a.timeline !== document.timeline` pomijaj (`axe_audit` w `e2e.py`, `a11y.py`) |
| `stroke` na `.ring-fg` w CSS | nadpisuje gradient pierścienia (atrybut `stroke="url(#rg-N)"`) | kolor pierścienia przez `--ring` na `.ring` |
| Element przyklejony (`position: sticky`) na telefonie z `top: safe-area` | chowa się pod paskiem tytułu `.appbar` | `top: calc(env(safe-area-inset-top) + var(--appbar-h))` |
| Odstęp od dołu liczony z `--tab-h + safe-area` | treść / komunikat pod pływającym paskiem dolnym | `--nav-space` (pasek + odstęp `--dock-b`) |
| Pomiar wymiarów w trakcie animacji `transform` (wejście ekranu) | `getBoundingClientRect()` = 43,9999 px — fałszywie „za mały cel dotykowy” | tolerancja 0,5 px w testach (`< 43.5`); animacje wejścia bez `scale` |
| Przesunięcie w bok (animacja wejścia) poza szerokość ekranu | `scrollWidth` > szerokość w trakcie animacji — błąd „przewijanie w poziomie” | `.main { overflow-x: clip }` (przycięcie bez kontenera przewijania; `sticky` działa) |
| Sekcja wypełniana po `await` w miejscu nad treścią wstawioną wcześniej (synchronizacja w „Dane”) | skok układu; test kolejności sekcji czasem czytał stronę przed wypełnieniem (CI, 1 / 1517) | elementy asynchroniczne przygotuj przed pierwszym `add(root, …)` (`cloudEl` w `dane.js`); po `await` dokładaj tylko na końcu strony |
| Animacja nieskończona w widoku przewijanym (puls „teraz” na `box-shadow`, także na samym `transform`) | przeliczanie stylów w każdej klatce (181 w 3 s spoczynku, 325 przy przewijaniu) — szarpane przewijanie na iPhonie | bez animacji nieskończonych (strażnik w `run_d110`); wskaźnik — stała poświata (D-112) |
| Kod w zdarzeniu `scroll` z odczytem układu (`getBoundingClientRect`) | praca wątku głównego w każdej klatce przewijania | `IntersectionObserver` (`watchTitle()`), pozycje zapisywane przy zmianie trasy (D-112) |
| `scrollTo` po asynchronicznym przerysowaniu nowego modułu | szarpnięcie strony, którą użytkownik zaczął już przewijać | na górę przed przerysowaniem; przywracanie tylko bez dotyku w międzyczasie (`touchedAt`, D-112) |
| Przerysowanie w miejscu modułu asynchronicznego (Dane, MPW) — zmiana z chmury w tle | strona na chwilę krótsza, przewinięcie spadało do góry (900 → 0) | `render(true)` przywraca pozycję (`keepY`, D-112) |
| Przeciąganie na zdarzeniach wskaźnika (`pointer*`) na iOS | Safari przejmuje gest jako przewijanie (`pointercancel`) — arkusz się nie rusza | zdarzenia dotyku, `preventDefault` w pierwszym `touchmove` (`dragToClose`, D-112) |
| Nowy znak w tekstach (strzałka, symbol, litera spoza podzbioru fontu) | wyświetlany fontem systemowym, `fonts.test.mjs` niezaliczony | `python3 tools/fonts.py` (dopisze znak do podzbioru albo do listy fontu systemowego); emoji z U+FE0F zawsze systemowe |
| Wspólna reguła `border: 1px solid …` (skrót) na kartach w nowej warstwie | znika kolorowa lewa krawędź (Poradnik, stan pozycji w Zapasach) | w warstwach nadpisujących zmieniaj `border-color`/`box-shadow`, nie skrót `border` |
| Dowiązanie `node_modules` w drzewie roboczym `git worktree` + `git add -A` | dowiązanie w commicie; po scaleniu zastąpiło katalog zależności | `.gitignore` obejmuje `node_modules` (także plik/dowiązanie); przed commitem `git status` |
| Zakup „dziś” a oczekiwany stan w teście | stan na koniec dnia = zakup − dzisiejsze zużycie (K1) | porównuj ze stanem sprzed zakupu, nie z ilością zakupu |
| Przycisk akcji w komunikacie o tej samej nazwie co w module („Cofnij”) | `get_by_role(..., exact=True)` znajduje dwa elementy | inna nazwa dostępna (`aria-label` „Cofnij tę zmianę”) |
| Tło z gradientem (`background:` skrót) na elemencie sprawdzanym helperem `CONTRAST` | `backgroundColor` przezroczysty — fałszywie niski kontrast | kolor w `background-color`, połysk tylko w `background-image` (`.set-toggle[aria-pressed=true]`) |
| Atrybut / właściwość `hidden` na elemencie SVG (`<g>`, `<path>`) | brak efektu — wskazówka tarczy widoczna w dniu innym niż dziś | widoczność SVG przez `style.display` (`show()` w `dial.js`) |
| Zmienna lokalna o nazwie funkcji pomocniczej modułu (`const show = …` w funkcji, która woła `show()`) | `ReferenceError` (strefa martwa) tylko na jednej ścieżce — „Dziś” bez treści w wariancie web | nie przesłaniaj nazw pomocniczych; E2E obu wariantów przed commitem |
| `grid-area: <nazwa>` na elemencie siatki bez nazwanych obszarów (telefon) | niejawne kolumny — rozjechany układ „Dziś” innego dnia | `grid-area` tylko w regułach, gdzie siatka ma `grid-template-areas` (≥ 1100 px) |
| Kolor tokenu w OKLCH a `getComputedStyle(...).backgroundColor` w teście | tekst `oklch(...)` zamiast `rgb(...)` — fałszywy błąd porównania | porównuj po przeliczeniu (piksel na płótnie — jak `CONTRAST` w `e2e.py`) |
| Test porównujący z datą uruchomienia przy zegarze testu ustawionym na inny dzień | po 12.11 test oczekiwał zakładki „MPW”, a aplikacja (19.10) pokazywała „CFA” | oczekiwanie liczone z zegara testu (`TODAY()` z `VCLOCK`), nie z `datetime.now()` |
| Reguła z `!important` w warstwie `legacy` | wygrywa z każdą deklaracją warstwy `instrument` (także `!important`) | nadpisuj w `instrument` bez `!important`; regułę z `!important` usuń z `legacy` przy migracji modułu |
| `runs-on: ubuntu-latest` w workflow z Playwright (11.2026: obraz Ubuntu 26.04) | „Playwright does not support chromium on ubuntu26.04” — testy CI i publikacja zatrzymane na instalacji przeglądarki | testy na `ubuntu-24.04` (`testy.yml`), do czasu aktualizacji Playwright z obsługą 26.04 |
| Pełne dane Rekompozycji / Bezpieczeństwa czytane przez `SRC.safety` albo import `rekomp.json` / `guide.json` w module widoku (D-118) | w Node (testy) działa, w przeglądarce jest tylko rdzeń — pusty widok albo brak pól | w widoku `await loadModuleData(id)`; rdzeń (`data-split.js`) tylko dla innych modułów; test `module-data.test.mjs` |
| Nowa reguła CSS dopisana do `styles.css` / `system.css` / `precision.css` albo kolor wpisany w `instrument.css` | strażnik `styles-guard.test.mjs` zatrzymuje testy | reguła w `instrument.css`, kolor i rozmiar pisma z tokenów (`tokens.css`); limit linii legacy zmniejszaj przy porządkach |
