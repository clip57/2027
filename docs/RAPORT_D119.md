# Raport D-119 — przebudowa modułów Suplementacja, Pielęgnacja i Nauka (CFA, MPW) w kierunku „Instrument+”

Polecenie użytkownika (22.11.2026): „Tak, instrument+ […] Nie rób prototypu tylko od razu wszystkie moduły i wdrażaj. Zgadzam się ze wszystkimi
rekomendacjami tylko proszę przede wszystkim chcę, żeby przyciski odznaczania były ładniejsze, a nie tak toporne. Nie wprowadzaj wibracji.
Wprowadź szacunek tempa. Wróć do nowych danych po przebudowie.” — doprecyzowanie: „wszystko w instrument+” (bez wariantu łagodniejszego
dla Pielęgnacji i Suplementacji).

Plan: `docs/PLAN_PRZEBUDOWY_MODULOW_2026-11-22.md` (§3–§6). Decyzje §9: kierunek „Instrument+” dla wszystkich 4 modułów; bez prototypu;
**bez haptyki** (bez sztuczki z `<input switch>`); szacunek tempa — tak; nowe typy danych („pominięte”, powtórki error logu w rosnących
odstępach, data ważności produktu) — **po przebudowie, osobną decyzją**.

**Bez zmian danych:** typy zdarzeń, klucze, baza, `reduce()`, format `2027-sync.json`, synchronizacja — bez zmian. `src/data/*.json` bez zmian.
Szacunek tempa czyta istniejące pole `at` zdarzeń odhaczenia (zapisywane od zawsze) — nic nowego nie jest zapisywane.

## 1. Co zrobione

| Obszar | Wykonanie |
|---|---|
| **Przyciski odznaczania (priorytet)** | Wspólny komponent `src/ui/check.js` (`checkBtn`, `checkInput`): okrąg 44 px w kolorze domeny (`--ck`: dawki — zielony, bloki nauki — `--cfa`, serie — `--train`, Pielęgnacja — `--care`), w środku litera bloku / numer serii; po odhaczeniu wypełnienie i **rysowany znacznik SVG** (stroke-dashoffset), sprężyste „pyknięcie” i fala — **tylko dla przycisku właśnie przełączonego** (także po przerysowaniu widoku: klucz w ciągu 1,5 s), bez pętli, „ogranicz ruch” = bez ruchu. Pole wyboru Pielęgnacji w tym samym stylu (input zostaje — dostępność i testy). Zastosowane wszędzie: Suplementacja, „Dziś” (dawki, bloki MPW), Nauka (bloki, recall), Trening (serie). Klasa `set-toggle` i `aria-pressed` bez zmian (gesty, testy). |
| **Suplementacja** | Przyrząd „pierścień pór” (`src/ui/rings.js` — łuk = pora, wypełnienie = przyjęte dawki; stany: przyjęta / następna / nieprzyjęta po czasie) z liczbą dawek w środku; **następna pora** z odliczaniem („za 20 min”, odświeżane w miejscu) i główną akcją **„Przyjmij 13:20 (2)”**; „Nieprzyjęte: 10:30” z odnośnikiem; pasek pór (odnośniki do pory). Pora w całości przyjęta — **zwinięta do jednej linii** („4 dawki · przyjęte”), rozwinięcie pozwala cofnąć. Dawka: **znak preparatu** (kapsułka / miarka proszku / tabletka z jednostki w katalogu, stały kolor z 8 tokenów `--sp-1…8`), nazwa, dawka, przycisk z prawej. **Regularność** — preparat × dzień z odhaczeń (`supp.dose:*`), od pierwszego odhaczenia, maks. 28 dni, odsetek przyjętych do wczoraj; bez odhaczeń — tylko informacja. Komputer (kontener ≥ 820 px): dwie kolumny — pory | przyklejony przyrząd + regularność + zapas. |
| **Pielęgnacja** | Przyrząd: **trzy pierścienie pór** (łuk = krok wymagany; bieżąca pora wyróżniona wg godziny), przycisk **„Rozpocznij rutynę”**. **Tryb rutyny** (`?v=fokus&p=<pora>` — powłoka `focus.js`, ekran nie gaśnie): jeden krok naraz, duży tekst, produkt, ostrzeżenie, „Gotowe” zapisuje `care.done` (ten sam zapis co lista), krok z `wait` — **odliczanie startuje samo** (globalny minutnik z sygnałem), gest i klawiatura. Wiersz kroku: produkt jako etykieta ze stanem, **reguła dni jako 7 kropek** (PN…ND) + opis; kroki doraźne w osobnej, cichszej grupie „Doraźnie”. **Tydzień — macierz kroki × dni** (wykonany / w planie / niewykonany). **Produkty — półka** z paskiem stanu i „Użyty N× · ostatnio …” (z odhaczeń). **Plan — oś okresów** kroków z datą „od”/„do” (znacznik „dziś”). |
| **Nauka (CFA, MPW)** | Nagłówek: **ścieżka planu** (start → egzamin/koniec; wypełnienie = wykonane, znacznik = wg planu do dziś), **szacunek tempa** („Szacunek: koniec ok. …”), odnośnik do drugiego planu, gdy oba trwają (D-116). Dzień: karta **„Teraz · zostało 43 min” / „Następny · za …”** dla bieżącego bloku, **tytuł = temat**, pod nim **czytelne źródło** („Vol 1 · Quantitative Methods · s. 147–158 (12 s.)”; pełna nazwa pliku w podpowiedzi — `sourceText` w `resolver.js`), pierścień bloków dnia. **Zaległe jako pasek** (plan do wczoraj, najstarszy dzień, 3 najstarsze bloki) + arkusz **„Plan nadrabiania”** z pełną listą wg dni (odhaczanie w arkuszu). Harmonogram: **nagłówki tygodni** z wykonaniem tygodnia. Kalendarz: **nasycenie koloru = część bloków wykonana** i kropki bloków zamiast „0/3”, znacznik zaległego dnia. Plan: panel **„Tempo (szacunek)”** — obecne tempo z 14 dni, tempo wymagane do końca planu, przewidywany koniec i różnica względem końca planu; działy jako kafle; error log jako karty. Zakładki widoku mieszczą się na 390 px. |
| **Szacunek tempa** | `src/core/calc/tempo.js`: data odhaczenia bloku = `at` zwycięskiego zdarzenia (`cfa.done` / `mpw.done`); tempo = bloki z ostatnich 14 dni (nie wcześniej niż od pierwszego odhaczenia) ÷ dni kalendarzowe; szacunek dopiero po 7 dniach; koniec = dziś + pozostałe ÷ tempo. W interfejsie zawsze „szacunek” / „prognoza, nie wynik”. Testy: `tests/unit/tempo.test.mjs`. |

## 2. Pliki

Nowe: `src/ui/check.js`, `src/ui/rings.js`, `src/core/calc/tempo.js`, `tests/unit/tempo.test.mjs`, `docs/RAPORT_D119.md`.
Zmienione: `src/modules/{suplementy,pielegnacja,study,study_focus,dzis,trening}.js`, `src/core/resolver.js` (`sourceText`), `src/app.js` (tryb rutyny
Pielęgnacji jako tryb skupienia), `src/ui/instrument.css` (reguły D-119), `src/ui/tokens.css` (`--sp-1…8`), `src/ui/system.css` (usunięte martwe reguły
`.pg-jump`, `.pg-wlist`, `.pg-hero .ring`), `tests/e2e/e2e.py` (`run_d119`, tryb rutyny, macierz tygodnia, źródło bloku, 3 najstarsze zaległe),
`tests/unit/resolver.test.mjs`, dokumentacja.

Zmiana struktury znana testom (§3.9): tydzień Pielęgnacji — kroki niecodzienne nie są już listą w karcie dnia, tylko wierszem macierzy
(`.pg-mx-r`); panel zaległych nauki pokazuje 3 (nie 5) najstarsze bloki — reszta w arkuszu „Plan nadrabiania”; źródło bloku — tekst
zamiast nazwy pliku. Testy zaktualizowane w tym samym kroku. Klasy z `docs/REDESIGN-TESTING.md` bez zmian.

## 3. Testy (22.11.2026, lokalnie)

WYNIKI_TESTOW

## 4. Ograniczenia i dalej

- Animacji przejść między widokami (View Transitions) i zwijania nagłówka przy przewijaniu nie dodano — wymagałyby zmian w routerze
  i strażniku wizualnym; do osobnego kroku.
- Godzina przyjęcia dawki nie jest pokazywana (stan odhaczeń nie przechowuje czasu; można ją odczytać z `at` zdarzenia — do decyzji razem
  z nowymi danymi).
- Nowe typy danych (pominięte dawki, powtórki error logu, data ważności produktów) — następny krok, po decyzji użytkownika.
