# Raport: poprawki zakładki Dziś (22.09.2026)

## Wykonane
- **Dublowanie suplementów (D-041):** tekst każdego slotu PLAN_DNIA rozbity na podpunkty w danych (`day_template.json → items`) i sklasyfikowany: `task`, `meal`, `supp` (ukryty — dawki wyłącznie z SUPLEMENTACJI), `derived` (ukryty — wylicza resolver). Kontrola przy ekstrakcji: podpunkty razem odtwarzają cały tekst źródłowy, więc nic nie ginie niezauważenie.
- **Pomiar wagi i ciśnienia (D-038).**
- **Źródło i strony w blokach CFA (D-039):** „Curriculum 2026 Vol 1 (QM), s. 3–13 (11 s.)”, pod spodem temat i tryb; godzina bloku tylko gdy różni się od slotu (sesje mocka).
- **Nazwa treningu w nagłówku (D-040);** slot 18:15 w dni siłowe: „Trening siłowy: UPPER 1” itd.
- **Czytelność:** slot jako osobna karta (godzina od–do, tytuł, kcal), podpunkty jako lista, posiłki z nazwą i kcal zależnymi od fazy i wariantu (np. czwartek: „Posiłek po saunie (20:15) 114 kcal”), suplementy w osobnej ramce (godzina · nazwa · dawka · uwaga), blok CFA w osobnej ramce.

## Zachowane bez zmian
Architektura warstw, magazyn zdarzeń, synchronizacja (format pliku, scalanie, sumy kontrolne), migracje, moduł Dane, budowa obu wariantów. Dane użytkownika nie wymagają migracji — zmiany dotyczą wyłącznie danych źródłowych i widoku.

## Testy
| Zestaw | Wynik |
|---|---|
| Weryfikacja danych | 407 / 0 błędów |
| Jednostkowe | 44 / 44 (nowe: brak suplementów w podpunktach każdego dnia 21.09.2026–31.03.2027, D-038, D-039, D-040, kcal posiłków wg fazy) |
| E2E (web i pojedynczy plik × 390 / 1280 px) | 160 / 0 błędów (nowe: chondroityna dokładnie 2 razy w dniu, tekst pomiaru, linia CFA, nazwa treningu) |

## Aktualizacja na urządzeniach
- GitHub Pages: wypchnij zmiany do `main`; aplikacja z ekranu początkowego pobierze nową wersję przy następnym uruchomieniu z siecią (service worker podmienia pamięć podręczną) — może być potrzebne drugie uruchomienie.
- Readdle: zastąp plik `2027.html`.
Dane zostają — nowa wersja nie zmienia formatu zapisu.
