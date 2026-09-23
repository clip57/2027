# Raport Etapu 5 — Trening i CFA (22.09.2026)

Część 1 i 2: zob. `RAPORT_ETAP5_cz1.md`, `RAPORT_ETAP5_cz2.md` (moduł Trening, dziennik serii, mapy mięśni, nowy interfejs Treningu i Meal Prep).

## Część 3 — moduł CFA
- **Nagłówek:** dni do egzaminu (12.11.2026), wykonane bloki i godziny netto, pierścień postępu całego planu.
- **Dzień:** 8 bloków ze źródłem i stronami, tematem, trybem i godziną; odhaczanie pojedynczo lub całego dnia; informacja o mocku i sesji recall.
- **Harmonogram:** wyszukiwanie (temat, źródło, strony, data), filtry kategorii i trybu, „tylko niewykonane”, grupowanie po dniach z przejściem do dnia.
- **Kalendarz:** miesiące planu z postępem dnia (0% / częściowo / 100%), oznaczenie 4 mocków, egzaminu i dnia dzisiejszego.
- **Error log:** dodawanie, edycja, usuwanie; 7 rodzajów błędów jak w v3; podsumowanie wg rodzaju; eksport i import CSV w formacie v3 (import idempotentny).
- **Plan:** postęp 10 działów (pierwsze przejście), mocki z postępem, statystyki trybów.
- Postęp i error log zapisywane trwale i synchronizowane (zdarzenia `cfa.done`, `cfa.err.*`); import `postep-nauki.json` — moduł Dane.

## Błędy wykryte i naprawione w tej części
- **Zakładka Dziś wyświetlała słowo „null”** na każdym dniu innym niż dzisiejszy (od Etapu 3). Przyczyna: przekazywanie wartości warunkowych bezpośrednio do `append`. Wprowadzono funkcję `add()` pomijającą wartości puste i spłaszczającą tablice — zastosowana we wszystkich modułach. Testy E2E sprawdzają teraz na każdej stronie brak artefaktów „null / false / undefined / NaN / [object”.
- W CFA: napis „false” w error logu i lista dni harmonogramu przekazywana jako tekst — ta sama przyczyna.
- Kolizja klas `.check` (CFA) i listy kontrolnej Meal Prep — listy układały się poziomo i rozpychały ekran; klasa CFA przemianowana.

## Testy
Weryfikacja danych 407/0 · jednostkowe 59/59 · E2E 608/0 (nowe: 5 widoków CFA na obu szerokościach, postęp po przeładowaniu, filtr Schweser = 75 bloków, kalendarz z 4 mockami i egzaminem, cykl życia wpisu error logu: dodanie → trwałość → eksport CSV → edycja bez duplikatu → usunięcie, 10 działów; artefakty tekstowe na każdej stronie).

## Niewykonane w Etapie 5
- **Wizualizacje ruchu ćwiczeń z TRENING.html (animowane schematy SVG):** dane są przeniesione, renderer nie został jeszcze przepisany. Mapy mięśni ich nie zastępują — to inna informacja (który mięsień vs. tor ruchu). Do decyzji: przenieść w Etapie 6 czy pominąć.
- Dziennik kolana i monitoring (waga, sen) — pytanie G-20 z audytu nadal otwarte.
- Eksport postępu i error logu z pliku CFA v3 z Twojego urządzenia (D-031) — do zaimportowania w module Dane / CFA, gdy go dostarczysz.

## Następny krok
Etap 6: Bezpieczeństwo żywności i Rekompozycja (widoki mobilne, treści po ujednoliceniu z listą zmian „przed → po” do akceptacji), końcowy audyt responsywności i dostępności.
