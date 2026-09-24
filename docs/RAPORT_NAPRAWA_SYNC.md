# Naprawa synchronizacji zapasów (iPhone / Safari / PWA) — raport (24.09.2026)

## Dwie oddzielne sprawy
| | Aktualizacja KODU aplikacji | Synchronizacja DANYCH |
|---|---|---|
| Co przenosi | nową wersję programu | Twoje zdarzenia (zapasy, trening, CFA…) |
| Jak | service worker; teraz za Twoją zgodą („Nowa wersja — odśwież”) | ręcznie: „Wyślij do iCloud” → plik `2027-sync.json` → „Pobierz z iCloud” na innym urządzeniu |
| Automatyczna? | pobieranie w tle tak, uruchomienie — tylko po kliknięciu | **nie** (bez zmian, D-033). Poprawka NIE dodaje automatycznej synchronizacji |

Każde miejsce uruchomienia — przeglądarka na komputerze, Safari na iPhonie, aplikacja z ekranu początkowego — ma **osobną bazę danych**. Dane przechodzą między nimi wyłącznie przez import pliku.

## Przyczyny usunięte w kodzie
1. **Jedno zdarzenie z nowszej wersji blokowało cały import** (walidator odrzucał nieznany typ → „Nie można zaimportować”, zapasy bez zmian). Teraz takie zdarzenia są przyjmowane i zachowywane, a import zapasów przechodzi.
2. **Starsza wersja usuwała z bazy zdarzenia nowszej wersji** (kwarantanna przy otwarciu). Teraz zdarzenia o poprawnej budowie zostają w bazie; do kwarantanny trafiają tylko uszkodzone. Zdarzenia, które starsza wersja wcześniej przeniosła do kwarantanny, wracają do bazy automatycznie (kopia w kwarantannie zostaje).
3. **Aplikacja z ekranu początkowego mogła długo działać na starym kodzie** (brak sprawdzania aktualizacji przy wznowieniu, brak informacji o nowej wersji). Teraz sprawdza przy każdym powrocie na ekran i pokazuje „Nowa wersja — odśwież”; bez automatycznego przeładowania.
4. **Brak widoczności**: moduł Dane pokazuje wersję aplikacji, tryb uruchomienia (z informacją o osobnej bazie), dane ostatnio wczytanego pliku; podgląd importu — datę eksportu i urządzenie źródłowe pliku oraz ostrzeżenie, gdy plik jest starszy niż ostatnio wczytany.

## Zmienione pliki
| Plik | Zmiana |
|---|---|
| `src/core/storage/validate.js` | `validateEnvelope`, `isKnownType`, `classifyEvent` ('ok' / 'future' / błąd); treść typów nieznanych sprawdzana jako czysty JSON |
| `src/core/storage/store.js` | otwarcie bazy: zdarzenia 'future' zostają, kwarantanna tylko dla uszkodzonych; odzyskiwanie z kwarantanny; `reduce` pomija nieznane typy i zwraca `unprocessed`; `appendMany` przyjmuje zdarzenia 'future' |
| `src/core/sync/bundle.js` | import przyjmuje i zachowuje zdarzenia 'future' (liczone osobno); `pv.file` (exportedAt, device, schema — istniejące pola); `lastImport.file` |
| `src/modules/dane.js` | wersja, tryb uruchomienia, wczytany plik, niepełne przetwarzanie, odzyskane zdarzenia; osobna sekcja „Aktualizacja aplikacji”; podgląd importu z datą/urządzeniem pliku i ostrzeżeniami |
| `src/app.js` | globalny baner „Niepełne przetwarzanie”; aktualizacja za zgodą (`setupUpdates`: sprawdzanie przy powrocie na ekran, przycisk, przeładowanie tylko po kliknięciu) |
| `tools/build.mjs` | service worker: nowa wersja czeka na zgodę (`SKIP_WAITING` z przycisku); jednorazowe przejście ze starego SW bez przeładowania; `BUILD_TAG` do testów |
| `src/ui/styles.css` | styl banera aktualizacji |
| `tests/unit/sync-compat.test.mjs` | nowe (8 testów) |
| `tests/e2e/sync_update.py` | nowe (19 kontroli) |
| `tests/e2e/e2e.py` | 2 testy uniezależnione od dnia tygodnia (środowisko przeszło na czwartek — aplikacja działała poprawnie) |
| `package.json`, `docs/*` | skrypt `e2e:sync`, raport, instrukcja testu na iPhonie, decyzje D-056–D-058 |

**Bez zmian:** format `2027-sync.json` (sprawdzone: schema, exportedAt, device, count, sha256, identyfikatory zdarzeń i deduplikacja po id już istniały), klucze bazy, typy zdarzeń, mechanizm ręcznej synchronizacji, offline-first, logika zapasów.

## Błędy wykryte w trakcie i naprawione przed oddaniem
- Pierwsza wersja kontroli „koperty” sprawdzała zagnieżdżenie o poziom głębiej niż dotychczas — **pakiet prywatny zostałby odrzucony i przeniesiony do kwarantanny**. Wychwycone przez testy E2E; poprawione; dodany test regresji.
- Napis „undefined” w oknie podglądu importu (użycie `append` zamiast `add`).
- Niestabilny test aktualizacji — przyczyna w serwerze testowym (odpowiedź 304 wg daty pliku z dokładnością 1 s), nie w aplikacji; poprawione, 3 kolejne przebiegi 19/19.

## Wyniki testów (Chromium)
| Zestaw | Wynik |
|---|---|
| Weryfikacja danych | 407 / 0 |
| Jednostkowe | 74 / 74 (w tym 8 nowych) |
| E2E | 784 / 0 |
| Synchronizacja i aktualizacja (nowe; 2 oddzielne profile przeglądarki) | 19 / 0 |
| Dostępność (axe-core) | 0 naruszeń |

## Znane ograniczenia
1. **Brak testu automatycznego w Safari/WebKit** — silnika nie da się zainstalować w środowisku (brak dostępu do serwera pobierania). Safari na iPhonie i aplikację z ekranu początkowego trzeba sprawdzić ręcznie: `TEST_IPHONE_SYNC.md`.
2. **Przejście z obecnie zainstalowanej wersji:** dopóki iPhone działa na starym kodzie, stary kod nadal odrzuca pliki ze zdarzeniami nowszych typów. Najpierw zaktualizuj aplikację w każdym miejscu (instrukcja, krok 1), dopiero potem importuj. Zdarzenia, które stary kod przeniósł do kwarantanny, nowy kod odzyska automatycznie.
3. **Safari i aplikacja z ekranu początkowego to dwie bazy** — import trzeba wykonać w każdej z nich (zalecenie: na iPhonie używaj tylko aplikacji z ekranu początkowego).
4. **Synchronizacja pozostaje ręczna** (D-033, bez płatnych usług).
5. **Nazwa pliku w iCloud Drive:** zapis przez okno udostępniania może utworzyć kopię obok (np. „2027-sync 2.json”); aplikacja nie ma na to wpływu — ostrzeże, gdy wczytany plik jest starszy niż poprzedni.
6. **GitHub Pages** może przez kilka minut po publikacji podawać poprzednią wersję pliku `sw.js` (pamięć podręczna serwera) — aktualizacja pojawi się po chwili lub po „Sprawdź aktualizację”.
7. Safari (poza aplikacją z ekranu początkowego) może usuwać dane stron nieużywanych przez dłuższy czas — zasada eksportu kopii bez zmian.
