# Raport D-106 — dziennik szczegółów sesji treningowej (23.10.2026)

## 1. Zlecenie
Patch `d106.patch` (dziennik szczegółów sesji: basen, rower, kolano, sauna, notatka) — ocena, poprawki i publikacja
na polecenie użytkownika z 23.10.2026. Zmiana opisu basenu („Basen 55 min (5 rozgrzewka + 45 właściwa część + 5 schłodzenie)”)
zaakceptowana przez użytkownika.

## 2. Zakres (z patcha)
- Nowy typ zdarzenia `train.detail` — jeden dokument na dzień, „ostatni zapis wygrywa” (`traindet:<data>`), stan `trainDetails`.
- `src/core/trainlog.js` — definicja pól wg protokołów (Rekompozycja, arkusz „System kolana”), `withValue`, tempo /100 m, podsumowanie.
- `src/modules/trening_log.js` — panel „Dziennik sesji” w widoku Trening; podsumowanie dnia w Historii.
- Dzień z wpisem basenu lub roweru liczy się jako sesja (statystyki, Historia, siatka aktywności w „Dziś”); Diagnostyka liczy wpisy sprzed startu.

## 3. Poprawki względem patcha
| Problem | Poprawka |
|---|---|
| Ścisła walidacja w magazynie (znane pola, zakresy) — urządzenie ze starszym kodem odrzucałoby import pliku (`appendMany`) i wiersze z chmury z dokumentem z nowszej wersji (nowe pole, szerszy zakres) | `validate.js`: tylko poprawna data i zwykły JSON (`plain`); formularz sprawdza pole przed zapisem (`fieldOk`); `validateDetail` zostaje jako kontrola zgodności z definicją (testy) |
| Odczyt nieznanych wartości: `summarize` rzucał wyjątek przy nieznanym obrzęku, tempo z tekstu dawało „NaN”, wybór wielokrotny zakładał tablicę | odporne odczyty (`?.[1] ?? wartość`, liczby skończone > 0, `Array.isArray`) |
| Pole godziny sauny bez odświeżania po zapisie | dodane jak w pozostałych polach |
| Brak `train.detail` w liście typów w `CLAUDE.md` §1, wpisu w `REDESIGN-DECISIONS.md`, klas w `REDESIGN-TESTING.md`, raportu | uzupełnione (C7, lista klas, ten raport); G-20 oznaczone jako częściowo rozstrzygnięte |
| `trening_log.py` / `trening_sheets.py` bez skryptu | `npm run e2e:trening` |

Nowe testy jednostkowe: zgodność w przód (dokument z nowym polem / szerszym zakresem → `ok`, błędna data → odrzucony), `fieldOk`,
odczyt dokumentu z nowszej wersji (podsumowanie, tempo, zachowanie nieznanych sekcji przy zapisie).

## 4. Świadomie bez zmian
- Klucz LWW dla całego dnia (nie per sekcja): przy synchronizacji automatycznej w chmurze (D-084/D-085) ryzyko nadpisania dotyczy
  tylko zapisów bez sieci lub urządzeń z wyłączoną synchronizacją; nadpisany dokument zostaje w dzienniku zdarzeń. Decyzja użytkownika 23.10.2026.
- Komunikat o wartości spoza zakresu w obszarze statusu widoku (jak przy seriach); pole oznaczone `aria-invalid`.

## 5. Wyniki (23.10.2026, bez plików użytkownika — dane syntetyczne)
| Zestaw | Wynik |
|---|---|
| `npm test` | 224 / 225 (1 pominięty) |
| `npm run e2e:trening` | 0 błędów (arkusze i dziennik sesji, 390 ciemny / 1100 jasny, axe) |
| `npm run e2e` | 1386 / 1386 |
| `npm run a11y` | 0 naruszeń |
| `npm run e2e:sync` | 23 / 23 |
| `npm run e2e:cloud` | 100 / 100 |
| `plan_check.mjs`, `cfa_smoke.py` | 0 błędów (3 znane ostrzeżenia planu) |
| `verify_all.py --data-only` | 13 kontroli, 0 błędów, 1 pominięta (źródła) |

## 6. Do sprawdzenia ręcznie
- iPhone (Safari i aplikacja z ekranu początkowego): wpisywanie wartości dziesiętnych (RPE 3,5) i godziny sauny; panel przy 390 px.
