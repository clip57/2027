# Raport Etapu 5, część 1 — moduł Trening (22.09.2026)

## Wykonane
- **Dane:** z TRENING.html przeniesione 31 opisów techniki (ustawienie, kluczowe punkty, zakres ruchu, błędy, opis ruchu, filmy), 26 wizualizacji ruchu (zapisane w danych; rysowanie w interfejsie — patrz „Niewykonane”), rozgrzewki i schłodzenia 4 dni siłowych, arkusze „System kolana” i „Sauna”. Każde z 32 ćwiczeń ma opis techniki.
- **Moduł Trening:** zakładki dni bieżącego tygodnia (domyślnie dziś), faza z kalendarza (D-017) i nazwa sesji, rozgrzewka i schłodzenie, ćwiczenia z liczbą serii dla aktywnej fazy, powtórzeniami, RIR, przerwą, zakresem ruchu i progresją (dni LOWER) oraz uwagami (np. ciężar startowy).
- **Dziennik serii:** dla każdej serii — wykonana, ciężar, powtórzenia, RIR; zapis trwały zdarzeniami `train.set`, synchronizowany jak pozostałe dane; licznik wykonanych serii.
- **Okno techniki** z listami i linkami do filmów; **arkusze** System kolana i Sauna.
- Czwartek i niedziela: opis dnia bez ćwiczeń siłowych (sauna zgodnie z D-014/D-018, basen).

## Błędy wykryte przez testy i naprawione
- Zapis ciężaru kasował odhaczenie serii (odczyt stanu z chwili wyświetlenia strony) — teraz odczyt bieżący.
- Wyścig przy szybkim wpisywaniu (odhaczenie i ciężar tuż po sobie) — zapisy szeregowane w kolejce.

## Niewykonane w tej części
- Rysowanie wizualizacji ruchu (SVG) — dane są przeniesione, renderer w części 2.
- Dziennik kolana i monitoring (waga, sen) — REKOMPOZYCJA ich wymaga, ale zakres nie został przez Ciebie zatwierdzony (pytanie G-20 z audytu pozostaje otwarte).
- Moduł CFA — część 2.

## Testy
Jednostkowe 57/57 · E2E 408/0 (nowe: UPPER 1 w Fazie 0 = 9 ćwiczeń i 10 serii, w Fazie 1 = 18 serii; trwałość serii i ciężaru po przeładowaniu; okno techniki z filmem; czwartek bez ćwiczeń).
