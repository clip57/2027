# Test na urządzeniach: synchronizacja zapasów (komputer · Safari na iPhonie · aplikacja z ekranu początkowego)

Oznaczenia: **K** — przeglądarka na komputerze, **S** — Safari na iPhonie (karta), **P** — aplikacja z ekranu początkowego.
Zapisuj wyniki w tabeli na końcu. Przed testem wykonaj kopię: w każdym miejscu Dane → „Wyślij do iCloud” (zapisz pod inną nazwą, np. `przed-testem-K.json`).

## 1. Aktualizacja kodu w każdym miejscu (to NIE jest synchronizacja danych)
1. Wypchnij nową wersję na GitHub, odczekaj do końca publikacji (zakładka Actions) i jeszcze ok. 10 minut.
2. **K:** otwórz aplikację → Dane. Jeśli widzisz „Nowa wersja — odśwież”, kliknij. Zanotuj „Wersja aplikacji”.
3. **S:** otwórz adres w Safari → Dane → „Sprawdź aktualizację”; jeśli pojawi się „Nowa wersja — odśwież”, dotknij. Jeśli wersja nadal różni się od K: zamknij kartę, otwórz ponownie.
4. **P:** otwórz z ikony → zamknij całkowicie (przesuń w górę w przełączniku aplikacji) → otwórz ponownie → Dane → „Sprawdź aktualizację” → dotknij „Nowa wersja — odśwież”, jeśli się pojawi.
   *Przy pierwszej aktualizacji ze starej wersji przycisk może się nie pojawić — nowa wersja uruchomi się po kolejnym pełnym zamknięciu i otwarciu.*
5. ✅ **Oczekiwane:** we wszystkich trzech ta sama „Wersja aplikacji”; „Uruchomiono jako”: K i S — „karta przeglądarki”, P — „aplikacja z ekranu początkowego / Docka”. Aplikacja **nigdy** nie przeładowała się sama.

## 2. Komputer → Safari i komputer → aplikacja (synchronizacja danych)
1. **K:** Zapasy → wyszukaj „Banan” → „+ opakowanie”. Zanotuj stan banana. Dane → „Wyślij do iCloud” → iCloud Drive/2027, **zastąp** poprzedni plik. Zanotuj „To urządzenie” (identyfikator K).
2. **S:** Dane → „Pobierz z iCloud” → wybierz `2027-sync.json`. ✅ Podgląd: „Plik wyeksportowany <godzina z K> na urządzeniu <identyfikator K>”. „Scal dane”. Zapasy → Banan = wartość z K.
3. **P:** to samo co w kroku 2. ✅ Banan = wartość z K.

## 3. Aplikacja → komputer i aplikacja → Safari
1. **P:** Zapasy → „Kefir” → „+ opakowanie”. Zanotuj stan. Dane → „Wyślij do iCloud” → „Zachowaj w Plikach” → iCloud Drive/2027 → zastąp.
2. **K:** Dane → „Pobierz z iCloud” → plik. ✅ Podgląd pokazuje urządzenie P. Po scaleniu Kefir = wartość z P.
3. **S:** to samo. ✅ Kefir = wartość z P.

## 4. Niezależne zmiany na różnych urządzeniach
1. Bez synchronizacji między krokami: **K:** Banan „+ opakowanie”; **P:** Banan „+ opakowanie”; **S:** Kefir „+ porcja”.
2. Kolejno: **P** wysyła → **K** pobiera → **K** wysyła → **P** i **S** pobierają → **S** wysyła → **K** i **P** pobierają.
3. ✅ We wszystkich trzech: ten sam stan banana (oba zakupy zachowane) i ten sam stan kefiru.

## 5. Ostrzeżenia i brak duplikatów
1. **S:** wczytaj ponownie ten sam plik. ✅ „Nowe zmiany: 0”, brak przycisku „Scal dane”.
2. **S:** wczytaj kopię `przed-testem-K.json`. ✅ Ostrzeżenie „Ten plik jest STARSZY niż ostatnio wczytany”.
3. W iCloud Drive/2027 sprawdź, czy nie powstały pliki „2027-sync 2.json” itp. — jeśli tak, zanotuj (to zachowanie iOS, nie aplikacji).

## 6. Offline
1. **P:** tryb samolotowy → otwórz aplikację. ✅ Działa, zapasy widoczne, wersja jak w kroku 1.

## 7. Aktualizacja kodu za zgodą (przy następnej publikacji)
1. Po kolejnej publikacji otwórz **P** (z tła). ✅ Pojawia się „Nowa wersja — odśwież”; aplikacja sama się nie przeładowuje.
2. Dotknij przycisku. ✅ Nowa wersja, zapasy bez zmian.

## Tabela wyników
| Krok | K | S | P | Uwagi |
|---|---|---|---|---|
| 1 wersja / tryb | | | | |
| 2 banan po imporcie | | | | |
| 3 kefir po imporcie | | | | |
| 4 banan / kefir końcowo | | | | |
| 5 duplikat / starszy plik | | | | |
| 6 offline | — | — | | |
| 7 zgoda na aktualizację | | | | |

Jeśli coś się nie zgadza: zrób zrzut modułu Dane (wersja, tryb, wczytany plik, ewentualne „Niepełne przetwarzanie”) i okna podglądu importu.
