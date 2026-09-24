# Redesign — Faza 5, moduły 3–4: Dieta i Zapasy jako jeden system — raport (24.09.2026)

## Kierunek (D-073)
„Premium personal OS” na podstawie zrzutów użytkownika (desktop „LifeOS”, mobilne ekrany „productivity”). Strona Figma z linku
była niedostępna w środowisku (blokada sieci) — nie była używana. Przejęte zasady: jedna główna informacja na kartę, spokojne karty
o jednej skali, kolumna podsumowania na komputerze, siatka akcji z ikonami na telefonie, wskaźniki postępu tylko z danych. Pominięte
świadomie: Focus Score, „efficiency”, energy balance, AI chat, wykresy biometryczne — brak danych w modelu aplikacji.

## Audyt przed zmianami (375 px, dane syntetyczne)
| Moduł | Problem | Skutek |
|---|---|---|
| Zapasy | każda z 55 pozycji jako wysoka karta (3 rzędy plakietek, 4 przyciski, pole stanu) | strona ok. 17 000 px; trudno znaleźć pilne pozycje |
| Zapasy | nad listą 4 bloki: podsumowanie, karta dnia z rzadkimi korektami, 7 dużych przycisków, liczniki | pierwsza pozycja listy dopiero na 2. ekranie |
| Zapasy | plan zakupów tylko w oknie | w dniu zakupów brak szybkiego „kupione” |
| Zapasy | emoji w nagłówku, etykietach, sortowaniu | niespójne z systemem ikon |
| Dieta | przełączniki fazy/dnia w dwóch wierszach; 4 plakietki makro przy każdym produkcie | dużo szumu, długa strona |
| Dieta | posiłki w kolejności PDF (obiad 16:23 po posiłku 20:15) | nie odpowiada przebiegowi dnia |
| Dieta | brak informacji „co teraz” i o brakach składników | moduł odcięty od Zapasów i planu dnia |

## Wdrożone (priorytety)
**Konieczne**
- Zapasy — zwarte wiersze: nazwa + status, typ + „Wystarczy do” + relacja do zakupów, **pasek zapasu** (dni pokrycia na tle 14 dni,
  suplementy 30, kreska = dzień zakupów), pole stanu i „+ opakowanie” w jednym wierszu; porcje, tagi, usuwanie własnej pozycji
  w „Więcej”. Strona: ok. 17 000 → 11 700 px na 375 px.
- Zapasy — przegląd: pasek stanu magazynu (udział pilnych / średnich / OK / bez stanu) i najbliższy brak; siatka 7 akcji z ikonami
  (Zakupy, Dodaj, Paragon, Cofnij, Historia, Status AI, Kopia); korekta zużycia dnia i operacje zbiorcze zwinięte.
- Dieta — zwarte pozycje (makro jako jedna linia), przełączniki w równych kolumnach, posiłki w kolejności godzin, zwinięte sekcje
  rzadkie (różnice faz, zamienniki, przyprawy).

**Bardzo użyteczne**
- Zapasy — karta **„Do kupienia”**: data i skala zakupów, 5 najpilniejszych pozycji (wg dnia braku) z przyciskiem
  **„Kupione +ilość”** (istniejące zdarzenie `inv.move` purchase, cofane przez „Cofnij”), „Pełny plan zakupów”.
- Dieta — **„Następny posiłek”** (godzina z planu dnia, kcal, makro, „Pokaż skład”), nawigacja po posiłkach z godziną i kcal.
- Dieta ↔ Zapasy — karta **„Składniki w zapasach”** (pilne i średnie składniki bieżącego planu, link do Zapasów z filtrem pilnych),
  przy produkcie oznaczenie tylko pilnego braku.
- Komputer: kolumna boczna (Dieta: kcal, następny posiłek, składniki; Zapasy: zakupy, korekta dnia), przyklejona przy wysokim oknie.
- Rozwinięte sekcje nie zamykają się po zapisie (kilka korekt z rzędu).

**Odłożone (świadomie)**
- Odhaczanie zjedzonych posiłków / bilans dnia — wymagałoby nowego typu zdarzenia; brak decyzji użytkownika.
- Historia zużycia na wykresie — mała wartość przy zużyciu liczonym z planu.
- Grupowanie listy Zapasów w sekcje statusów — filtr i sortowanie wystarczają; mniej przewijania kosztem ukrycia pozycji.
- Zmiana kolejności kategorii lub nazw statusów v31 — D-046 (1:1 z pierwotnym modułem).

## Zmienione pliki
- **Aplikacja:** `src/modules/dieta.js` (przebudowa widoku), `src/modules/zapasy.js` (nagłówek, przegląd, akcje, „Do kupienia”,
  wiersze, zwinięte sekcje; okna bez zmian funkcji), `src/core/calc/diet.js` (+`mealTimes`, `nextMeal`),
  `src/core/calc/inventory.js` (+`runway`), `src/ui/styles.css` (sekcje Dieta/Zapasy na tokenach + `dt-*`, `zp-*`, `.dot-s`),
  `tools/icons.mjs` + `src/ui/icons.js` (+8 ikon).
- **Testy:** nowy `tests/unit/diet-stock.test.mjs`; `tests/e2e/e2e.py` (nowe kontrole, nazwy przycisków), `tests/e2e/a11y.py`
  (dane syntetyczne, nowe stany).
- **Dokumentacja:** `CLAUDE.md`, `docs/REDESIGN-STATUS.md`, `REDESIGN-SPEC.md`, `REDESIGN-DECISIONS.md`, `REDESIGN-TESTING.md`,
  `DECYZJE_2027.md` (D-071–D-073), ten raport.

**Bez zmian:** model danych, typy zdarzeń, `reduce()`, walidacja, format `2027-sync.json`, `src/data/**`, `app.js`, `build.mjs`,
logika stanów, prognoz, statusów v31 i listy zakupów; moduły Trening, CFA, Dziś i pozostałe (poza wspólnymi stylami sekcji, które
dostały tokeny — wizualnie ±2 px).

## Wyniki testów
W `docs/REDESIGN-TESTING.md` §2 („Faza 5 — Dieta i Zapasy”).

## Ryzyka
- „Kupione” dodaje wyliczoną ilość (pełne opakowania) — przy innej faktycznej ilości trzeba poprawić stan (pole stanu lub „Cofnij”).
- Kolejność posiłków wg godzin różni się od kolejności w PDF — wartości bez zmian, zmienia się tylko prezentacja.
- Brak WebKit: przyklejona nawigacja posiłków i siatka akcji na iPhonie do sprawdzenia ręcznie.
