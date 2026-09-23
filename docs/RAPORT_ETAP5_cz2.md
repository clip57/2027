# Raport Etapu 5, część 2 — nowy interfejs Treningu i Meal Prep, mapy mięśni (22.09.2026)

## Mapy mięśni
- **Źródło danych:** free-exercise-db (ponad 800 ćwiczeń, licencja Unlicense — domena publiczna), pola „mięśnie główne / pomocnicze”. Licencja sprawdzona w pliku repozytorium źródła.
- **Mapowanie jawne** (`tools/extract/extract_muscles.py` → `src/data/muscles.json`): 27 ćwiczeń ma dokładny odpowiednik, 4 — najbliższy (podciąganie z asystą → podciąganie, bo rekord „z gumą” pomija biceps; levitation crunch → brzuszki; wall-sit/Spanish squat → przysiad bez obciążenia; suwnica ze stopami wyżej → suwnica). Najbliższe odpowiedniki są oznaczone w oknie techniki.
- **Rysunek własny** (SVG, przód i tył, 17 grup mięśni): działa offline i nie korzysta z cudzych grafik. Kolor pełny — mięśnie główne, jasny — pomocnicze. Rysunek jest poglądowy, nie jest atlasem anatomicznym.

## Trening — nowy interfejs
Pasek dni z nazwami sesji; nagłówek sesji z pierścieniem postępu i mapą mięśni całej sesji; karty ćwiczeń z parametrami w kafelkach, mapą mięśni, wynikami z poprzedniej sesji („Ostatnio: 45 kg × 8”), dużymi przyciskami wykonania serii, polami kg/powtórzenia/RIR i kopiowaniem wartości z poprzedniej serii; okno „Technika i mięśnie” z dużą mapą, legendą i źródłem.

## Meal Prep — nowy interfejs
Nagłówek z pierścieniem postępu dnia i kartą „Następny krok” (z przejściem do karty), przyklejony pasek skrótów do faz dnia, pasek postępu i licznik na każdej karcie, oznaczenie ukończonych kart. Postęp aktualizuje się na bieżąco bez przeładowania widoku.

## Testy
Jednostkowe 59/59 (nowe: kompletność i poprawność danych o mięśniach) · E2E 428/0 (nowe: mapy sesji i ćwiczeń, pierścień postępu, kopiowanie serii, mapa z podanym źródłem w oknie techniki, karta następnego kroku w Meal Prep).

## Pozostało w Etapie 5
Moduł CFA (harmonogram v3, trwały postęp, error log, import z plików v3).
