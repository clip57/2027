# Raport D-107 — poprawki błędów B1–B10 z audytu 23.10.2026 (24.10.2026)

Zlecenie użytkownika (24.10.2026): „Napraw na razie wszystkie błędy B1–B10, a decyzje podejmę w następnym kroku. Chcę, żeby żaden błąd
nie stwarzał już problemu”. Źródło listy: `docs/RAPORT_AUDYT_2026-10-23.md` §3. Decyzje D1–D3 (MPW a plan dnia, egzamin CFA 12.11, święta),
ryzyka R1–R4 i ulepszenia U1–U8 — **bez zmian**, czekają na decyzję użytkownika.

**Bez zmian:** dane planu (`src/data/*.json`), typy zdarzeń, klucze LWW, `reduce()` i wynik dla istniejących danych, format `2027-sync.json`,
zasady synchronizacji (D-084/D-085), service worker (`sw.js`).

## 1. Poprawki

| # | Błąd | Poprawka | Pliki |
|---|---|---|---|
| B1 | „Cofnij” po zmianie stanu przywracał ilość poprzedniej inwentaryzacji bez zużycia od tamtego dnia (1000 g zamiast 760 g); drugie „Cofnij” przywracało pomyłkę; cofnięcie zakupu z wcześniejszą datą datowane „dziś”; zapis zbiorczy cofany po jednej pozycji | „Cofnij” cofa ostatnią **operację** (pojedyncza zmiana albo zapis zbiorczy). Stan po cofnięciu = stan na dziś bez tej operacji (i bez operacji już cofniętych). Zakup lub korekta — ruch odwrotny z tą samą datą, korekta dnia — odwrotna. Cofanie jak stos. Pozycja bez wcześniejszego stanu — stan bez zmian i komunikat. Podpowiedź przycisku: „Cofnij: …”, w Historii dopisek „cofnięcie”. | `core/calc/inventory.js` (`lastOperation`, `undoOperation`, `INV_TYPES`), `modules/zapasy.js` (`manyOp`, `undo`) |
| B2 | Wyczyszczenie pola „Stan” zapisywało 0 (`Number('') === 0`) | Puste lub nieczytelne pole — bez zapisu, pole wraca do stanu, komunikat. Puste „Stan początkowy” nowej pozycji — pozycja bez stanu (było 0 → „BRAK” i lista zakupów). | `modules/zapasy.js` |
| B3 | „Dziś” bez odświeżania: po wznowieniu aplikacji rano wczorajsza data i „Teraz: Sen”; „Teraz” stałe w ciągu dnia | `clockTick` w `app.js`: co 30 s, przy `visibilitychange`, `pageshow`, `focus` — zmiana dnia → przerysowanie w tle (`softRender`, wpis w polu i otwarte okno zostają). `ctx.tick` w modułach: „Dziś” — „Teraz”, wyróżnienie slotu i następna pora dawek w miejscu; koniec zakupów → przerysowanie; Suplementacja, Dieta, Zapasy — przerysowanie po zmianie następnej pory / posiłku / zakupów. | `app.js`, `modules/dzis.js`, `suplementy.js`, `dieta.js`, `zapasy.js` |
| B4 | Stopera > 24 h nie dało się zatrzymać (≥ 1440 min odrzucane przez walidację) | Zatrzymanie zawsze się zapisuje; > 600 min (jak pole ręczne) lub nieczytelny początek — bez minut, z prośbą o wpis ręczny. Wpis minut ręcznie kończy działający stoper. | `modules/trening.js` |
| B5 | `.ics` „Trening, basen i sauna” bez basenu (niedziele), 2 rund sauny (czwartki) i sauny po treningu | Resolver przekazuje rolę slotu (`key`); eksport po `key` (`main`, `sauna`) — także sloty wariantów dnia. | `core/resolver.js`, `core/ics.js` |
| B6 | „Dziś”: „od 15:30” w czwartki od 07.01 (bloki od 16:00); dni P1–P7 + symulacja opisane jako sama symulacja | Czas i godziny z bloków dnia (`mpwDaySpan`): „159 min · od 16:00”, „371 min od 08:00 · symulacja 180 min · 15:30–18:30”; Tydzień z godziną bloków; statystyki planu MPW z godzinami czwartkowymi od 07.01. | `core/calc/mpw.js`, `core/calc/week.js`, `modules/dzis.js`, `modules/mpw.js` |
| B7 | Ikony „timer” i „monitor” bez linii | Generator: nazwy atrybutów z cyframi (`x1`, `y2`); ponowna generacja — zmieniły się tylko te 2 ikony. | `tools/icons.mjs`, `src/ui/icons.js` |
| B8 | „Seria tygodni z rzędu” bez dni z samym wpisem basenu / roweru (D-106) | `streakWeeks` z wpisami dziennika sesji, jak „Treningi” i wykres. | `core/calc/training.js`, `modules/trening.js` |
| B9 | Pielęgnacja: sloty czwartkowe opisane „(sobota)”, powtórzone pozycje | Każdy slot raz, dni z kalendarza planu (np. „17:45 · Zakupy (czw, 22.10–29.10)”), sortowanie po godzinie; dotychczasowe powiązanie kroku zostaje na liście (zapis go nie usuwa). | `core/calc/care.js` (`slotOptions`), `modules/pielegnacja.js` |
| B10 | Zmiana w innej karcie otwierała nowe połączenie IndexedDB i nowy magazyn (stare połączenia otwarte) | `Store.reload()` — nowe zdarzenia do tej samej instancji, bez powiadamiania słuchaczy; powiadomienia w trakcie odczytu łączone; przerysowanie w tle. | `core/storage/store.js`, `app.js` |

**Pola pomocnicze w zdarzeniach `inv.*` (B1):** `op` — wspólny identyfikator zdarzeń jednego zapisu zbiorczego (plan zakupów, paragon,
zerowanie, przywrócenie stanu z Historii, nowa pozycja ze stanem), `undo` — klucz cofniętej operacji. Opcjonalne; walidacja `inv.*`
nie sprawdza dodatkowych pól, `reduce()` ich nie czyta (stan identyczny — test „pole `op`/`undo` nie zmienia stanu”), starsze wersje
aplikacji je pomijają (na nich „Cofnij” działa jak dotąd).

## 2. Testy

Nowe i rozszerzone testy — sprawdzone na kopii kodu sprzed poprawek (commit `ca548a4`): nowe testy jednostkowe **zawodzą** dla B1, B5–B10;
`run_d107` na starym buildzie zawodzi już na B8, B2 i B1 (dalej przerwany na „Cofnij”); B3 i B4 na starym buildzie — potwierdzone sondą
w przeglądarce z audytu (wczorajsza data po wznowieniu, „Odrzucono niepoprawne dane” przy zatrzymaniu stopera):

| Test | Co sprawdza |
|---|---|
| `tests/unit/icons.test.mjs` (nowy) | każdy element ikony z atrybutami; wszystkie ikony zgodne z plikami SVG Lucide (B7) |
| `tests/unit/inventory.test.mjs` | B1: pomyłka 5 g → 760 g; drugie „Cofnij” bez przywrócenia pomyłki; zakup z datą 27.10 cofany z tą datą; korekta dnia; zerowanie jako jedna operacja; stos cofnięć z zakupem pomiędzy |
| `tests/unit/trainlog.test.mjs` | B8: seria tygodni z basenem i rowerem, samo kolano nie jest sesją |
| `tests/unit/ics.test.mjs` | B5: basen w niedzielę, 2 rundy sauny w czwartek (też od 07.01), sauna po treningu, bez sauny w dni z blokiem M |
| `tests/unit/plan-mpw.test.mjs` | B6: `mpwDaySpan` — zwykły dzień, czwartek od 07.01, symulacja, P1–P7; początek = pierwszy blok każdego dnia |
| `tests/unit/care.test.mjs` | B9: bez powtórzeń i „sobota”, wszystkie sloty szablonu, opisy dni z kalendarza |
| `tests/unit/storage.test.mjs` | B10: `reload()` — zmiana z innej karty, bez powiadamiania słuchaczy, zapis po doczytaniu |
| `tests/e2e/e2e.py` → `run_d107` (oba warianty buildu) | B1–B10 w przeglądarce, m.in. „Teraz” o 10:03 bez przerysowania strony, zmiana dnia o północy i po powrocie do aplikacji, stoper po 25 h, plik `.ics`, dwie karty bez nowych połączeń IndexedDB (web) |

## 3. Wyniki (24.10.2026, bez plików użytkownika — dane syntetyczne)

| Zestaw | Wynik |
|---|---|
| `npm test` | 234 / 235 (1 pominięty — wymaga kopii ZAPASY z `SOURCES_DIR`) |
| `npm run e2e` | 1428 / 1428 (w tym 42 kontrole `run_d107`) |
| `npm run a11y` | 0 naruszeń |
| `npm run e2e:sync` | 23 / 23 |
| `npm run e2e:cloud` | 100 / 100 |
| `npm run e2e:trening` | 0 błędów |
| `node tools/verify/plan_check.mjs`, `python3 tests/e2e/cfa_smoke.py` | 0 błędów (3 znane ostrzeżenia planu — D-101) |
| `python3 tools/verify/verify_all.py --data-only` | 13 kontroli, 0 błędów, 1 pominięta (źródła) |
| przegląd w przeglądarce 1065 tras (każdy dzień planu w Dziś, Treningu, Suplementacji, Meal Prep, Pielęgnacji, dni CFA i MPW, pozostałe widoki; 390 px) | 0 błędów JS, 0 „Błąd modułu”, 0 artefaktów „undefined/NaN/null”, 0 przewijania w poziomie |
| kontrola planu dzień po dniu (14.10.2026–30.03.2027) | bez zmian względem audytu — plan dnia nietknięty |

## 4. Ograniczenia

- „Cofnij” nie przywraca stanu „brak stanu” (pozycja bez wcześniejszej inwentaryzacji) — nie ma zdarzenia, które usuwa stan; stan zostaje bez zmian, komunikat mówi o tym wprost. Np. po „Zeruj stany” pozycje wcześniej bez stanu zostają z 0.
- Podział „Minione punkty” w „Dziś” liczony przy wyświetleniu (w ciągu dnia zmienia się tylko „Teraz” i wyróżnienie) — pełne odświeżenie przy zmianie dnia lub wejściu do widoku.
- Na urządzeniu ze starszą wersją aplikacji „Cofnij” działa jak dotąd do czasu aktualizacji (pola `op`/`undo` pomijane).
