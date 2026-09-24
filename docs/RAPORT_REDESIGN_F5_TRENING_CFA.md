# Redesign — Faza 5, moduły 1–2: Trening i CFA — raport (24.09.2026)

## Wybór zakresu
Kolejność Fazy 5 z `REDESIGN-STATUS.md` zaczyna się od Treningu i CFA. Oba moduły są w dolnym pasku telefonu i używane codziennie
(sesja na siłowni z telefonem, 8 bloków nauki dziennie), więc rozbudowa daje największy zysk w codziennym użyciu. Zakres: przeniesienie
na system projektowy **i** funkcje oparte wyłącznie na istniejących danych (plan + dziennik) — bez nowych typów zdarzeń, bez zmian
w synchronizacji i danych źródłowych.

## Trening
| Funkcja | Opis | Dane |
|---|---|---|
| Licznik przerwy (D-068) | Po odhaczeniu serii w dniu bieżącym pasek przerwy: czas z planu ćwiczenia (`2–3 min` → gotowość po 2:00, koniec po 3:00), faza („Przerwa” → „Możesz zaczynać” → „Przerwa zakończona”), następna seria, „+30 s”, „Pomiń”. Czas liczony od znacznika startu — poprawny po wygaszeniu ekranu iPhone’a. Ogłoszenie dla czytników tylko przy zmianie fazy. Ukryty przy otwartej klawiaturze. Brak licznika dla innych dni i po ostatniej serii. | plan (`rest`), stan lokalny karty — **nie** w dzienniku ani w pliku synchronizacji |
| Następna seria (D-069) | Karta w nagłówku sesji: ćwiczenie, seria X z N, plan powtórzeń/RIR/przerwy, ostatni wynik; „Przejdź do ćwiczenia” (przewinięcie w module, D-066); ćwiczenie następne wyróżnione ramką | plan + `train.set` |
| Podsumowanie sesji (D-069) | Po odhaczeniu wszystkich serii: „Sesja ukończona” — serie, objętość, powtórzenia, czas (albo „czas nie zapisany”) | `train.set`, `train.session` |
| Wygląd | przyciski czasu treningu z ikonami (play/square), kopiowanie serii — ikona `copy`, wybrany dzień w pasku dni w akcencie, nagłówek bez gradientu, sekcje stylów na tokenach | — |
| Cele dotykowe | wszystkie przyciski ≥ 44 px (wcześniej 34–40 px: kopiowanie serii, „Technika i mięśnie”, plakietki arkuszy, odtwarzanie ruchu, pole minut, „+ Dodaj serię”) | — |

## CFA
| Funkcja | Opis | Dane |
|---|---|---|
| Tempo i zaległe (D-070) | W nagłówku: „Zaległe: N” (link do harmonogramu z filtrem) albo „Na bieżąco z planem”, „Plan do wczoraj: X / Y”, „Z wyprzedzeniem: Z”. Zaległe = zaplanowane przed dziś i nieodhaczone | `cfa.json` (daty bloków) + `cfa.done` |
| Panel zaległych | W widoku dnia bieżącego: 5 najstarszych zaległych bloków do odhaczenia + „Wszystkie zaległe (N)” | jw. |
| Następny blok | „Następny: blok A · 08:00–08:53 · temat” i wyróżnienie wiersza (dzień bieżący) | plan |
| Harmonogram | filtr „tylko zaległe (przed dziś: N)” | jw. |
| Nawigacja dni | linki z chevronami jak w „Dziś” (zamiast przycisków) | — |
| Error log | filtr rodzaju błędu (przyciski z licznikami, `aria-pressed`) i wyszukiwanie (temat, reguła, data); eksport CSV nadal eksportuje wszystkie wpisy | `cfa.err.*` |
| Błąd naprawiony | drugi wpis error logu z rzędu zapisywał się, ale widok nie odświeżał się (ten sam adres nie wywołuje `hashchange`) | — |

## Zmienione pliki
- **Aplikacja:** `src/modules/trening.js`, `src/modules/cfa.js`, `src/core/calc/training.js` (+`restSeconds`, `nextSet`), nowy
  `src/core/calc/cfa.js` (`cfaPace`), `src/ui/styles.css` (sekcje Trening/CFA/Meal Prep na tokenach, nowe style `tr-*`, `cf-*`),
  `src/ui/system.css` (`a.btn`, `.sr-only`), `tools/icons.mjs` + wygenerowany `src/ui/icons.js` (+5 ikon: square, copy, skip-forward,
  calendar-clock, list-todo).
- **Testy:** nowy `tests/unit/cfa-pace.test.mjs`; `tests/unit/tokens.test.mjs` (para `--text-2` na `--sunken`); `tests/e2e/e2e.py`
  (`run_features` z zegarem, nazwy przycisków czasu treningu); `tests/e2e/a11y.py` (stały zegar, 2 nowe stany).
- **Dokumentacja:** `CLAUDE.md`, `docs/REDESIGN-STATUS.md`, `REDESIGN-SPEC.md`, `REDESIGN-DECISIONS.md`, `REDESIGN-TESTING.md`,
  `DECYZJE_2027.md` (D-068–D-070), ten raport.

**Bez zmian:** `src/core/storage/**`, `src/core/sync/**`, `reduce()`, typy zdarzeń, baza `p2027`, format `2027-sync.json`,
`src/data/**`, `tools/build.mjs`, `src/app.js`. Żadna funkcja nie została usunięta; ćwiczenia opcjonalne, statystyki, historia, stoper,
schemat ruchu, harmonogram, kalendarz, plan, import/eksport CSV działają jak wcześniej (testy E2E bez zmian oczekiwań).

## Wyniki testów
W `docs/REDESIGN-TESTING.md` §2 (sekcja „Faza 5 — Trening i CFA”).

## Ryzyka i ograniczenia
- Licznik przerwy nie wysyła powiadomień systemowych ani dźwięku (PWA na iOS nie działa w tle bez usług płatnych/serwera — D-034);
  po powrocie do aplikacji pokazuje poprawny czas. Stan znika po zamknięciu karty/aplikacji (celowo — D-068).
- „Zaległe” liczą się od daty z planu v3; jeśli harmonogram zostanie przesunięty, liczby odzwierciedlą plan, nie rzeczywistą zmianę planu.
- Brak WebKit w testach: zachowanie paska przerwy przy klawiaturze iOS i wygaszaniu ekranu — do sprawdzenia na iPhonie
  (`REDESIGN-TESTING.md` §5).
- Nagłówek `.hero-tr` bez gradientu zmienia też wygląd Meal Prep (ta sama klasa) — zamierzone, zgodne ze SPEC §1.
