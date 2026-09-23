# Test akceptacyjny na urządzeniach (Etap 2)

Tych punktów nie da się sprawdzić w środowisku testowym — wymagają Twojego iPhone'a i Maca.

## iPhone (Safari)
1. Otwórz adres aplikacji w Safari → Udostępnij → „Do ekranu początkowego”. Uruchamiaj aplikację wyłącznie z ikony — to osobny magazyn danych, niezależny od Safari.
2. Dane → „Pobierz z iCloud lub importuj plik” → wybierz `zapasy_kopia_2026-09-22.json`. Oczekiwane: podgląd „Nowe zmiany: 55” → „Scal dane”. W tabeli: Banan 240 g (22.09) lub stan pomniejszony o zużycie od 23.09.
3. Zamknij aplikację całkowicie (przesuń w górę w przełączniku aplikacji), otwórz ponownie — dane muszą zostać.
4. „Wyślij do iCloud” → czy pojawia się systemowe okno udostępniania z plikiem? → „Zachowaj w Plikach” → iCloud Drive → folder 2027.
5. Tryb samolotowy → otwórz aplikację z ikony → musi działać (offline).
6. Zaimportuj `2027-prywatne.json` — podgląd „Pakiet prywatny”, „Scal dane”.

## Mac (Safari, macOS Sonoma lub nowszy)
7. Otwórz adres → Plik → „Dodaj do Docka”. Uruchamiaj z Docka.
8. „Pobierz z iCloud” → wskaż `2027-sync.json` z iCloud Drive/2027 → „Nowe zmiany: 56” (55 z zapasów + pakiet prywatny) → „Scal dane”.
9. Wyślij z Maca, zaimportuj na iPhonie → „Nowe zmiany: 0” (brak zmian po stronie Maca) — ten sam plik można wczytywać wielokrotnie.

## Wynik
Zgłoś numer punktu i to, co zobaczyłeś, jeśli cokolwiek odbiega od oczekiwań.
