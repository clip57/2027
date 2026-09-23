# Raport Etapu 4 — Zapasy i Meal Prep (22.09.2026)

## Wykonane
**Dane (`src/data/mealprep.json`)** — ekstrakcja MEAL_PREP.html z zastosowaniem decyzji:
- 12 kart w 5 fazach dnia, 4 tabele (naczynia, urządzenia, testy kalibracyjne, wkłady chłodzące), 11 uzasadnień;
- **19 gramatur sparametryzowanych** — zamiast liczb z Fazy 0 są odwołania `{produkt}`, podstawiane z planu diety dla aktywnej fazy i wariantu dnia (D-003);
- **D-013:** usunięty każdy próg pakowania (85 °C, 75 °C); zostaje „prosto z patelni” i kontrola „> 63 °C” przed jedzeniem. Skrypt przerywa pracę, jeśli po podmianach zostanie jakikolwiek próg (185 °C air fryera jest rozpoznawane poprawnie);
- **D-020** (Białko WPC), **D-022** (pomidorki 80 g), **D-001** (melatonina 1 mg), **I-3** (Contigo #1 herbata, #2 kawa; szpinak wyłącznie w 520 ml);
- **D-035:** dwa zdania z wynikami badań zastąpione znacznikami `{private:1}`, `{private:2}` i przeniesione do pakietu prywatnego. Zdania są wykrywane wzorcem, więc ich treść nie występuje w żadnym pliku repozytorium.

**Moduł Zapasy**
- Stan liczony z inwentaryzacji i planu; prognoza „wystarczy do” uwzględnia typ dnia i zmianę fazy.
- Statusy i cele zakupowe wg reguł ZAPASY v31; widoki (wszystko, pilne, średni stan, na listę zakupów) i wyszukiwarka.
- Operacje: ± porcja, + opakowanie, ustawienie stanu na dziś — każda zapisywana jako zdarzenie.
- Lista zakupów na najbliższą sobotę z zapisem całej listy jako zakupu i kopiowaniem do schowka.

**Moduł Meal Prep**
- Karty krok po kroku z ilościami wyliczonymi na dziś (faza, wariant), z odhaczaniem kroków zapisywanym trwale (licznik postępu) i minutnikami tam, gdzie krok podaje czas.
- Tabele wyposażenia oraz testy kalibracyjne z zapisem wyniku (zdany/niezdany z datą).
- Sekcja „Dlaczego tak”; fragmenty prywatne pokazują treść po zaimportowaniu pakietu, a bez niego jasny komunikat.

**Rdzeń:** nowe typy zdarzeń `prep.step` i `prep.test` z walidacją i regułą „ostatni zapis wygrywa”.

## Testy
| Zestaw | Wynik |
|---|---|
| Weryfikacja danych ze źródłami | 407 / 0 błędów |
| Jednostkowe | 55 / 55 (nowe: struktura Meal Prep, brak progów pakowania, nazwy i kubki, brak danych z badań, podstawianie ilości dla faz 0/1/2, oznaczanie pozycji nieobecnych w dniu nietreningowym, obsługa pakietu prywatnego) |
| E2E (web i pojedynczy plik × 390 / 1280 px) | 288 / 0 błędów (nowe: 55 pozycji i prognozy, zakup opakowania zmienia i utrwala stan, lista zakupów, ilości Fazy 0 w Meal Prep, progi D-013, brak danych z badań, trwałość odhaczonego kroku) |

## Problemy wykryte i naprawione
- Reguły zamiany kubków Contigo cofały się nawzajem — rozwiązane znacznikiem pośrednim.
- Lista zdań z wynikami badań była wpisana wprost w skrypcie w repozytorium — zastąpiona wykrywaniem wzorcem.
- Długie tytuły sekcji „Dlaczego tak” rozpychały układ na iPhonie.
- Dwa testy E2E były niestabilne lub nieprecyzyjne (oczekiwanie na tekst obecny też w nagłówku listy zakupów; treść zwiniętych sekcji niewidoczna dla `inner_text`).

## Uwaga do pakietu prywatnego
Pakiet ma teraz trzy sekcje (diagnoza, badania kontrolne, fragmenty z Meal Prep). **Wygeneruj go ponownie i zaimportuj na obu urządzeniach**, inaczej w Meal Prep zobaczysz komunikat o braku fragmentów.

## Następny krok
Etap 5: Trening i CFA (dziennik serii z ciężarem, powtórzeniami i RIR, system kolana, harmonogram nauki z trwałym postępem i error logiem, import postępu z plików CFA v3).
