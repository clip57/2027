# Raport: Trening — schematy ruchu, serie opcjonalne, czas treningu, statystyki (22.09.2026)

## Schemat ruchu (interaktywny)
- Rysunek przeniesiony 1:1 z TRENING.html: ekstrakcja wykonuje oryginalne definicje `FIG`, `FLOOR`, `arc()` i `VIZ` (26 schematów, każde z 31 ćwiczeń ma swój). Renderowanie jak w `vizSVG` (sylwetka odniesienia, tor, strzałka, punkt startu, znacznik izometrii), bez wstawiania HTML — kształty parsowane jako SVG.
- Interakcja: animacja punktu po torze (ruch i powrót), odtwarzanie/pauza, suwak pozycji, opis fazy, tor ruchu, wskazówki techniki krok po kroku. Przy ustawieniu „ogranicz ruch” animację zastępuje suwak.

## Serie opcjonalne
Ćwiczenia bez serii w aktywnej fazie pokazują uwagę „⚠️ To ćwiczenie nie jest elementem Fazy N. Zapis serii jest opcjonalny…” i przycisk „+ Dodaj serię (opcjonalnie)” (do 10 serii). Serie mają znacznik `opt` i są osobno oznaczane w historii.

## Czas treningu
Stoper (Rozpocznij → Zakończ, czas startu zapisany w dzienniku — przetrwa zamknięcie aplikacji) lub wpis ręczny w minutach. Zdarzenie `train.session`, synchronizowane.

## Statystyki (styl Hevy)
Treningi i seria tygodni z rzędu; czas łączny i średni; objętość, serie, powtórzenia; wykresy tygodniowe objętości i czasu (12 tygodni); serie na grupę mięśni (7/28 dni; główny = 1, pomocniczy = 0,5) z mapą ciała; postęp wybranego ćwiczenia — szacowany 1RM (Epley) i najcięższa seria na wykresie oraz tabela sesji; rekordy osobiste (1RM, maks. ciężar, maks. powtórzenia, najlepsza seria objętościowo). Historia: lista sesji z czasem, seriami, objętością, ćwiczeniami i oznaczeniem serii opcjonalnych.

Rdzeń obliczeń: `src/core/calc/training.js` (czyste funkcje, testy jednostkowe).

## Testy
Jednostkowe 65/65 (nowe: Epley, liczenie serii i objętości, sesje z czasem, agregaty tygodniowe, serie na grupę mięśni, historia ćwiczenia, rekordy, seria tygodni) · E2E 664/0 (nowe: schemat ruchu i animacja, wskazówki, stoper i ręczny czas z trwałością, uwaga i zapis serii opcjonalnej, statystyki, historia).
