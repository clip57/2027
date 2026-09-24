# Redesign — Faza 5, moduły 5–9: Meal Prep, Suplementacja, Bezpieczeństwo, Rekompozycja, Dane — raport (24.09.2026)

Kierunek jak w Diecie i Zapasach (D-073): najważniejsza informacja na wierzchu, szczegóły zwinięte, powiązania z Zapasami tylko
z rzeczywistych danych (plan + dziennik zdarzeń). Bez nowych typów zdarzeń, bez zmian w synchronizacji i danych źródłowych.

## Meal Prep (D-074)
| Zmiana | Uzasadnienie |
|---|---|
| Karta „Składniki na jutro”: stan na koniec dziś vs zużycie jutra wg planu, dla produktów użytych w kartach (np. „Szpinak mrożony — potrzeba 100 g · zostanie 50 g”) | wieczorne karty (rozmrażanie, overnight oats) przygotowują jutro — brak widać, zanim trzeba go użyć |
| Oznaczenie „Brak na jutro: …” na kartach z brakującym produktem | czynność i przyczyna w jednym miejscu |
| Wyróżniona karta z następnym krokiem | orientacja w długiej procedurze (69 kroków) |
| Tabele (naczynia, urządzenia, testy, wkłady) i „Dlaczego tak” zwinięte | rzadko potrzebne, a zajmowały połowę strony |
| Minutnik 44 px z opisem dla czytników | cel dotykowy, dostępność |

## Suplementacja (D-075)
| Zmiana | Uzasadnienie |
|---|---|
| Oś dnia: pory minione na przyciemnionym tle, następna wyróżniona („następna”); w nagłówku „następna pora: 10:30” | odpowiedź na „co teraz” bez czytania całej listy |
| Karta „Zapas suplementów” pod osią: pilne i średnie (progi v31), „Kupione +opakowanie”, link do Zapasów; w nagłówku link „do uzupełnienia: N” | zapas suplementów to jedyna zmienna w tym module — działanie jednym dotknięciem |
| Wybór dnia w 7 równych kolumnach z datą | jeden wiersz na 375 px |
| Pasek zapasu w tabeli „Preparaty” | stan widoczny bez liczenia dni |

## Bezpieczeństwo, Rekompozycja (D-076)
- Nagłówki jak w pozostałych modułach, wyszukiwarki 44 px bez emoji, „Wyczyść filtry”.
- Rekompozycja: wyszukiwanie w treści planu (np. „kreatyna”, „sen”) zawęża spis treści i sekcje, „Rozwiń / Zwiń wszystko”.
- Zapasy → Bezpieczeństwo: link „Przechowywanie →” w szczegółach pozycji, **tylko** gdy nazwa jest identyczna w Tabeli
  bezpieczeństwa (15 z 55). Pozostałe powiązania wymagałyby zgadywania albo zmiany danych (`product_links` ma 1 pozycję) — nie dodano.
- Cele dotykowe: „Przechowywanie i opakowanie” (71 kart) i „Pierwotne uzasadnienie” miały 32–42 px → 44 px (wykryte nowym testem).

## Dane (D-077)
Synchronizacja jako pierwsza sekcja: status niewysłanych zmian z ikoną, ostatnie wysłanie i import, „Wyślij do iCloud” i
„Pobierz z iCloud lub importuj plik” (na telefonie na pełną szerokość). Kolejne sekcje bez zmian treści: aktualizacja aplikacji,
stan zapisu, kontrola stanów, kopie automatyczne. Mechanizm eksportu/importu, teksty rozróżniające kod i dane, format pliku — bez zmian.

## Style
Sekcje `styles.css` dla podstaw (komunikaty, panel, `kv`, tabele), Bezpieczeństwa, Rekompozycji, Poradnika i schematu ruchu na
tokenach; zwijany panel `details.panel.fold` wspólny dla Diety i Meal Prep.

## Zmienione pliki
`src/modules/mealprep.js`, `suplementy.js`, `bezpieczenstwo.js`, `rekompozycja.js`, `dane.js`, `zapasy.js` (link przechowywania),
`dieta.js` (klasa `fold`), `src/core/calc/inventory.js` (+`coverage`), `src/ui/styles.css`; testy: nowy
`tests/unit/prep-supp.test.mjs`, `tests/e2e/e2e.py`, `tests/e2e/a11y.py`; dokumentacja: `CLAUDE.md`, `docs/REDESIGN-*.md`,
`docs/DECYZJE_2027.md` (D-074–D-077), ten raport.

## Wyniki testów
`docs/REDESIGN-TESTING.md` §2 („Faza 5 — moduły 5–9”).

## Świadomie nie dodano
- Odhaczania przyjętych dawek suplementów — nowy typ zdarzenia (a „Dziś” celowo nie dubluje dawek, D-041/D-064).
- Automatycznego powiązania wszystkich pozycji Zapasów z Tabelą bezpieczeństwa — wymagałoby zgadywania.
- Przebudowy treści Rekompozycji / Poradnika — to dokumenty źródłowe (D-049…D-054).
