# Raport: odtworzenie modułu Zapasy i odświeżenie Meal Prep (22.09.2026)

## Zapasy — przywrócone funkcje pierwotnego pliku ZAPASY_DIETA.html
Pulpit (stan magazynu z licznikami czerwony/żółty/zielony, najbliższy brak, następne zakupy z liczbą pozycji i opakowań), karta dnia z typem dnia i fazą, korekty dnia (⏪ +1 dzień / ⏩ −1 dzień), pasek akcji (Dodaj, Zakupy, Paragon, Cofnij, Historia, Status AI, Kopia), klikalne liczniki statusów jako filtry, wyszukiwarka, sześć sposobów sortowania, dziewięć kategorii, karty pozycji z etykietami (trwałość, opakowanie, limit, notatka), prognozą „wystarczy do”, ostrzeżeniem „skończy się przed zakupami”, przyciskami ± porcja i + opakowanie oraz polem stanu, a także operacje zbiorcze (Zeruj stany, Fabryczna lista).

## Czym to się różni od oryginału (świadome zmiany)
| Element | Oryginał v31 | Teraz | Powód |
|---|---|---|---|
| Zużycie dzienne | wpisane na stałe (Faza 0) | wyliczane z planu diety i suplementacji | D-003, D-017 |
| Korekty dnia | przesuwały datę synchronizacji | zdarzenie „korekta dnia” dodające lub odejmujące zużycie całej doby | dziennik zdarzeń, synchronizacja |
| Cofnij | stos w pamięci karty | zdarzenie odwrotne w dzienniku (działa po ponownym otwarciu i między urządzeniami) | D-008, D-033 |
| Historia | można było wyczyścić | dziennik zdarzeń bez kasowania, z opisem i urządzeniem | spójność synchronizacji |
| Kopia zapasowa | osobne okno w module | przycisk prowadzi do modułu Dane (jeden mechanizm kopii i synchronizacji) | D-008 |
| Paragon | JSON, bez potwierdzenia przy zastąpieniu | JSON, z potwierdzeniem i informacją o pominiętych pozycjach | S-4 z audytu |
| Jednostki na liście zakupów | błąd „szt. szt.” | poprawne jednostki | S-3 z audytu |
| Renderowanie | innerHTML z danymi | bezpieczne tworzenie elementów | W-1 z audytu |

## Meal Prep
Nowa szata: nagłówki faz z akcentem, ikony kroków w zaokrąglonych kafelkach, listy kontrolne i kroki jako oddzielone bloki, minutniki jako pastylki, notatki bezpieczeństwa z kolorową krawędzią. Treść i logika bez zmian.

## Testy
Jednostkowe 55/55 · weryfikacja danych 407/0 · E2E 348/0 (nowe: przyciski akcji, kategorie, liczniki, okno zakupów, okno historii, filtr Suplementy, cofanie zmiany, korekta dnia i jej odwrócenie).


## Uzupełnienie (odsłona 3) — pozostałe funkcje pierwotnego pliku
- **Klasyfikacja wg terminu przydatności 1:1 z `getProductStatus`:** ⛔ BRAK (0); świeże (≤ 7 dni): 🚨 < 2 dni, ⚠️ Niski (2-3.9d), 🟢 OK (≥4d); trwałe: 🚨 < 7 dni, ⚠️ Średni (7-13.9d), 🟢 OK (≥14d); suplementy: 🚨 < 10 dni, ⚠️ Średni (10-19d), 🟢 OK (≥20d). Poprzednia odsłona błędnie stosowała progi trwałych do produktów świeżych — naprawione.
- Plakietki jak w oryginale: ⏱️ ŚWIEŻE (≤7D) / 📦 TRWAŁE (>7D) / 💊 SUPLEMENT, 🛍️ opakowanie, Limit, porcja dzienna, notatka.
- Prognoza w formacie oryginału: „Wystarczy do: Śr, 23 wrz”, „✓ Wystarczy do zakupów”, „⚠️ Skończy się Nd przed zakupami”, „Wystarczy do: DZIŚ (Brak)” i „⚠️ Brak na N dni przed zakupami”.
- Plan zakupów z odhaczaniem i paskiem postępu; „Zaktualizuj stan” dodaje zaznaczone pozycje, a gdy nic nie zaznaczono — wszystkie (z potwierdzeniem, jak w oryginale); kopiowanie i skrót Reminders.
- Historia: „↩ Przywróć ten stan” (pełne przywrócenie magazynu do chwili wpisu, z możliwością cofnięcia), „Usuń wpis”, „🗑️ Wyczyść rejestr historii”. Usuwanie i czyszczenie ukrywają wpisy — zdarzenia zostają w dzienniku dla spójności synchronizacji.
- Okno 💾 Kopia wewnątrz modułu: pobranie kopii i wczytanie pliku (z podsumowaniem i scaleniem).
- Paragon w formatach oryginału: liczba lub obiekt `{qty}`/`{amount}`, przecinek dziesiętny, tylko ilości > 0; nieznane identyfikatory są wymieniane w komunikacie.
- Raport „Status AI” w treści i układzie oryginału.
- **Naprawiony błąd:** pozycje dodane przez użytkownika nie zużywały się — teraz zużywają się wg podanej porcji dziennej (także w prognozach i liście zakupów).

Testy: jednostkowe 57/57 · E2E 372/0 (nowe: klasyfikacja wg terminu przydatności, progi świeżych, format prognozy, pasek postępu zakupów, okno kopii, historia z wpisami i przywrócenie stanu).
