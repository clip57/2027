# Audyt aplikacji 2027 i plan rozwoju — 31.10.2026

Polecenie użytkownika (31.10.2026): „Zrób ponownie pełny audyt BARDZO szczegółowy całej aplikacji w poszukiwaniu jakichkolwiek najmniejszych
błędów i chcę zaktualizować jego funkcjonalności i tym razem naprawdę PORZĄDNIE polepszyć go graficznie i funkcjonalnie, żeby był bardziej
nowoczesny, futurystyczny jak bardzo profesjonalna strona internetowa. Ponadto w zapasach cały czas pojawiają się ujemne wartości po
osiągnięciu zera w zapasach, więc napraw to. Najpierw przedstaw bardzo szczegółowy audyt i plan, dopiero potem będziemy wdrażać.”

**Ten dokument to tylko audyt i plan — kod nie był zmieniany.** Wdrożenie po akceptacji planu i decyzjach z §7.

---

## 0. Najważniejsze w skrócie

| | |
|---|---|
| **Stan ogólny** | Aplikacja jest stabilna: w 1011 renderach wszystkich widoków (każda data planu 16.10–30.03, 7 różnych „dziś”, dwie szerokości) — **0 błędów JavaScript, 0 × NaN/undefined/null, 0 przewijania w poziomie**. Wszystkie zestawy testów zielone (stan po D-112). |
| **Błąd krytyczny** | **K1 — ujemne stany w Zapasach** (Twoje zgłoszenie). Potwierdzony i rozłożony na czynniki: to nie tylko kosmetyka — **zużycie z dni, gdy produktu już nie było, „zjada” następny zakup** (przykład: kupione 450 g skyru, aplikacja pokazuje 75 g zamiast 300 g). |
| **Błędy pozostałe** | 3 ważne, 17 drobnych (spójność dat, odmiana, formatowanie liczb, teksty zakodowane na sztywno, martwy kod, drobne niespójności funkcji). Lista z dowodami w §2. |
| **Wygląd** | System 2.0 jest spójny, ale: zbyt wiele równorzędnych kart, plakietek i obramowań („wszystko krzyczy tak samo”), jeden rozmiar optyczny fontu, emoji w elementach interfejsu, mało wizualizacji danych, niespójne formaty dat. Do „bardzo profesjonalnej strony” brakuje hierarchii, oddechu, typografii nagłówkowej i wykresów. §3. |
| **Propozycja** | **System 3.0 „Precision”** — spokojna, precyzyjna, ciemna-pierwsza estetyka (jak najlepsze współczesne aplikacje webowe), duże liczby i czytelne wykresy z Twoich danych, jedna główna akcja na ekran, nowa powłoka (pasek poleceń, ustawienia), przebudowa wszystkich 13 modułów. §4. |
| **Funkcje** | 24 propozycje (§5) — większość bez zmian w danych; 2 wymagają Twojej decyzji (nowe zapisy). |
| **Plan** | 7 etapów (§6): **najpierw poprawka Zapasów (od razu, osobno)**, potem drobne błędy, potem fundament 3.0 z **prototypem do Twojej akceptacji przed przebudową modułów**. |
| **Pilne terminowo** | **D1 — rozkład popołudnia od 16.11** (bloki MPW 15:30/16:30/17:30 kolidują z planem dnia w 108 ze 119 dni) — decyzja potrzebna do ok. 10.11. |

---

## 1. Metoda

1. **Odtworzenie zgłoszenia** — obliczenia `core/calc/inventory.js` na danych z planu (skyr 150 g/dzień), krok po kroku.
2. **Automatyczny przegląd wszystkich widoków** (`2027.html`, dane syntetyczne D-065: kopia zapasów z 20.10 — żeby w ciągu 11 dni ujawniły się braki; plan pielęgnacji testowy):
   - 35 widoków statycznych (wszystkie moduły i podwidoki) + **każdy dzień** 16.10.2026–30.03.2027 w „Dziś” i Treningu, co 2–4 dni w Diecie, Suplementacji, Meal Prep, Pielęgnacji, każdy dzień planu CFA i co 2. dzień MPW;
   - 390 px (pełny zakres) i 1280 px (co 7. dzień);
   - 7 wartości „dziś”: 31.10 10:40, 02.11 01:30 (noc), 12.11 08:00 (egzamin CFA, zmiana zakładki na MPW), 16.11 07:10 (start MPW), 31.12 23:30, 28.03 22:00 (koniec planu, zmiana czasu), 29.03 09:00 (po planie);
   - kontrola tekstu: NaN, undefined, null, Infinity, „[object”, Invalid Date, ujemne ilości, puste nawiasy, spacje przed przecinkiem, odmiana liczebników, długie ułamki; pola liczbowe; błędy JS i konsoli; przewijanie w poziomie.
3. **Przegląd kodu** — wszystkie moduły widoków, obliczenia (`core/calc/*`), resolver, daty (zmiana czasu 25.10 i 28.03), zapis zdarzeń, wyszukiwanie, budowa.
4. **Wydajność** — czas pierwszego widoku i przejść przy CPU ×1/×4/×6 (przybliżenie telefonu), rozmiary zasobów, praca wątku głównego, skala dziennika do końca planu (22 500 zdarzeń).
5. **Wygląd** — 112 zrzutów: 28 widoków i stanów × 390 / 1440 px × motyw ciemny / jasny, ocena pod kątem hierarchii, gęstości, typografii, spójności, wizualizacji danych.

**Ograniczenia:** brak silnika Safari (WebKit) w środowisku — zachowanie na iPhonie oceniane pośrednio (Chromium z dotykiem, CPU ×4), dlatego część punktów jest oznaczona „do sprawdzenia na iPhonie”. Dane syntetyczne — nie Twoje rzeczywiste stany.

---

## 2. Błędy

### 2.1 Krytyczne

#### K1. Ujemne stany w Zapasach i „zjadanie” zakupów — POTWIERDZONE
- **Przyczyna:** `stockAt()` w `src/core/calc/inventory.js` liczy *ostatnia inwentaryzacja + zakupy/korekty − zużycie z planu za każdy dzień* **bez dolnej granicy**. Po zejściu do zera stan dalej maleje o zużycie z planu.
- **Odtworzenie (skyr, 150 g dziennie, stan 225 g na koniec 25.10):**

  | Dzień | 26.10 | 27.10 | 28.10 | 30.10 |
  |---|---|---|---|---|
  | Stan w aplikacji | 75 g | **−75 g** | **−225 g** | **−525 g** |

  **Skutek gorszy niż wyświetlanie:** zakup 450 g w dniu 29.10 → aplikacja pokazuje **75 g zamiast 300 g**, bo od zakupu odejmuje „zjedzone” 375 g z dni, w których skyru nie było. Każdy zakup po braku jest zaniżony, prognozy i lista zakupów od tego momentu są błędne.
- **Gdzie widać wartości ujemne (przegląd automatyczny):**
  - Zapasy → pole „Stan” (np. −90, −13 185; w 30 widokach); jednocześnie plakietka „⛔ BRAK (0)” — sprzeczne informacje;
  - Dane → „Kontrola stanów magazynu” (np. „Brokuły mrożone −1430 g”, „Kefir −1600 ml/g”);
  - Suplementacja → tabela „Preparaty”, kolumna „Zapas” (np. „Kolagen −40 g”);
  - „Status AI” (raport do schowka): „masz −225 g”;
  - „− porcja” pozwala zejść poniżej zera.
- **Poprawka (proponowana semantyka):** symulacja dzień po dniu z dolną granicą 0 — *zużycie nie może przekroczyć tego, co jest*. W dniu D najpierw zakupy i korekty z datą D, potem zużycie dnia D (zakup pokrywa potrzeby dnia zakupu), stan nigdy < 0. Dodatkowo: **„brak od <data>”** i **niedobór wg planu** (ile zabrakło od dnia braku) — informacja zamiast ujemnej liczby.
- **Skutek dla Twoich danych:** pozycje, które w przeszłości „zeszły pod zero”, a potem zostały kupione, po poprawce pokażą **wyższy, prawidłowy stan** (bez fikcyjnego zużycia). Dziennik zdarzeń bez zmian — zmienia się tylko obliczenie. Pozycje, w których po braku wpisałeś nowy stan (inwentaryzacja) — bez zmian.
- **Testy:** nowe testy jednostkowe (brak → zakup → stan; korekty dnia przy zerze; „Cofnij” po braku), aktualizacja odwzorowania wzoru w testach E2E (`expected_stock` w `e2e.py`).

### 2.2 Ważne

| # | Moduł | Błąd | Dowód | Poprawka |
|---|---|---|---|---|
| W1 | Zapasy | Pole „Stan” pokazuje surowy ułamek: `String(r.st)` z zaokrągleniem do 6 miejsc → „−3.666667”, „−9.425714” | przegląd: 30 pól | formatowanie wg jednostki (g/ml — całe lub 1 miejsce, kaps./szt. — całe), bez zmiany zapisu |
| W2 | Trening, Zapasy, dziennik sesji | Pola liczbowe `type=number` z przecinkiem dziesiętnym: jeśli przeglądarka odrzuci „62,5”, wartość jest pusta → w Treningu **zapis `null` kasuje ciężar bez komunikatu** (w Zapasach od D-107 jest komunikat). Wcześniejszy ślad: opis B2 w D-107 („przecinek, którego przeglądarka nie przyjęła”). | kod: `trening.js` 260, 282; `trening_log.js` 29 | jedno pole liczbowe aplikacji: `inputmode=decimal`, przecinek i kropka, walidacja zakresu, komunikat — **do potwierdzenia na iPhonie** |
| W3 | Dane | „Kontrola stanów magazynu” pomija **pozycje własne** (tylko katalog fabryczny) — inaczej niż Zapasy | kod: `dane.js` 165 | ta sama lista co w Zapasach |

### 2.3 Drobne

| # | Moduł | Błąd | Poprawka |
|---|---|---|---|
| D1 | Dieta | Podpowiedzi wariantów zakodowane na sztywno: „Dzień treningowy: pn–śr, pt–nd”, „nietreningowy: czwartek” — nieprawda np. 23.10, 01–02.11, **03–11.11**, 25–27.12, 01.01, 26–28.03 (wszystkie NT) | podpowiedź z kalendarza planu; **widok diety dla wybranej daty** (dziś tylko faza × wariant) |
| D2 | Suplementacja | Tabela „Preparaty”: daty w formacie ISO („do 2026-11-03”, „od 2026-10-08 do 2027-03-28”) — reszta aplikacji „pn 03.11” | wspólny format dat |
| D3 | Meal Prep | Odmiana: „Wszystkie 12 składniki kart wystarczą” (≥ 5 → „składników”) | `plural()` |
| D4 | Meal Prep | Wynik testu kalibracyjnego z datą ISO („zdany · 2026-10-25”) | wspólny format |
| D5 | Meal Prep | Minutnik kroku działa dalej po zmianie widoku (niewidoczny), bez sygnału końca | minutnik globalny z sygnałem dźwiękowym (patrz F-T1) |
| D6 | CFA/MPW | Dzień bez bloków: pierścień „0 / 1” → 0 % zamiast stanu „dzień wolny” | stan „wolne” |
| D7 | CFA | Panel dnia: „recall 22:00” zakodowane na sztywno — godzina recallu pochodzi z danych (`nightRecall`) | godzina z danych |
| D8 | Zapasy | Plan zakupów: „Kopiuj listę” respektuje zaznaczenia, a „Do Reminders” zawsze wysyła całą listę | obie z zaznaczeń |
| D9 | Zapasy | „Status AI” i „Kopiuj listę” przerysowują cały widok bez potrzeby | bez przerysowania |
| D10 | Zapasy | Nazwa „Status AI” myląca — to raport tekstowy do schowka | „Raport do schowka” (lub „Raport dla asystenta”) |
| D11 | Zapasy | Przy stanie 0: „Wystarczy do: DZIŚ (Brak)” — bez informacji, od kiedy brakuje | „Brak od 27.10” (K1) |
| D12 | Bezpieczeństwo | Spacja przed przecinkiem w tekstach z ekstrakcji: „Listeria , drożdże”, „próżniowo , pojedynczo” (57 miejsc w kartach i tabeli) | normalizacja przy ekstrakcji (`tools/extract`) — bez zmiany treści |
| D13 | Katalog | Jednostka „ml/g” (2 pozycje, m.in. kefir) — wygląda jak błąd | **decyzja:** „ml” czy zostaje |
| D14 | Dziś | Martwy kod „Dnia zero” („dzień 0 z 180”, „Wielkanoc”) — po D-100 nie występuje | usunąć |
| D15 | Tydzień | „Następny tydzień” bez górnej granicy (po 28.03 — nieskończone tygodnie „poza planem”) | granica jak w Treningu |
| D16 | Dane | „Wersja 0.2.0+…” — numer z `package.json` nie zmienia się od miesięcy | wersja = data budowy + skrót, np. „31.10.2026 · 4f1c…” |
| D17 | Trening | Pasek przerwy (pływający) zasłania ostatnią sekcję na telefonie, bez odstępu pod treścią | odstęp na czas przerwy |

**Dokumentacja (porządkowe):** `CLAUDE.md` i `docs/PRZEKAZANIE.md` §1 wciąż wspominają `main = redesign-faza4 = b3b4edc` i gałąź `redesign-faza4` — nieaktualne.

### 2.4 Sprawdzone i poprawne (bez uwag)
Daty i zmiana czasu (25.10, 28.03 — funkcje dat liczą w południe czasu lokalnego), przełom roku, zmiana zakładki CFA → MPW 12.11, start MPW 16.11, koniec planu 28.03 i dni po planie, noc (01:30), „Teraz” przez północ, odmiana w pozostałych miejscach, dostępność (axe — 0 naruszeń, testy), brak błędów konsoli, przewijanie w poziomie (0), obliczenia przy dużym dzienniku (22 500 zdarzeń: przeliczenie 43 ms).

---

## 3. Ocena wyglądu i UX (stan po D-110–D-112)

**Mocne strony:** spójne kolory modułów, czytelny ciemny i jasny motyw, dobre stany fokusu i kontrast (AA), oś czasu w „Dziś”, pływający pasek dolny, arkusze, szybkie przejścia.

**Co odróżnia ją od „bardzo profesjonalnej strony”:**

| # | Problem | Przykład |
|---|---|---|
| V1 | **Brak hierarchii — wszystko ma podobną wagę.** Kilkanaście kart, plakietek i obramowań o tym samym znaczeniu wizualnym; oko nie wie, gdzie zacząć. | „Dziś” na komputerze: 4 kafle + 6 kart + „Wymaga uwagi” + skróty — 12 obramowanych bloków powyżej planu dnia |
| V2 | **Zagnieżdżone karty i nadmiar „chipów”.** Karta w karcie, plakietka obok plakietki (nagłówek „Dziś” na telefonie: data + 3 plakietki w 2 wierszach), siatka 7 równych przycisków w Zapasach. | Zapasy: pasek stanu + 7 przycisków + 4 liczniki + 9 kategorii + lista |
| V3 | **Typografia jednego rozmiaru optycznego.** Inter 14 opsz także w dużych liczbach i tytułach — profesjonalne serwisy używają wariantu „Display” dla nagłówków (ciaśniejszy, elegantszy). | „2595 kcal”, „12 dni do egzaminu” |
| V4 | **Emoji w elementach interfejsu** obok ikon Lucide: „⛔ BRAK (0)”, „🚨 < 7 dni”, „⚠️ Średni (7-13.9d)”, „🟢 OK (≥14d)”, przyciski arkuszy, reguły Bezpieczeństwa. Wygląda amatorsko na tle reszty. | plakietki statusu w Zapasach |
| V5 | **Mało wizualizacji danych poza Statystykami treningu.** Są paski i pierścienie; brak osi czasu zapasów, historii stanu pozycji, rozkładu makro, postępu nauki w czasie — mimo że dane są. Wykresy treningu (objętość, czas, 1RM, najcięższa seria) są tylko w osobnym widoku. | Zapasy, Dieta, CFA/MPW |
| V6 | **Niespójne formaty:** ISO („2026-11-03”), „pn 03.11”, „Sob, 31 paź”, „31 października 2026”, „(7-13.9d)”, wielkie litery „TRWAŁE (>7D)”. | Suplementacja, Zapasy, Meal Prep |
| V7 | **Powłoka komputerowa jak telefon na dużym ekranie** — brak paska z datą/wyszukiwaniem/stanem synchronizacji, brak ustawień, przełącznik motywu ukryty w panelu. | 1440 px |
| V8 | **Kalendarz na telefonie** — komórki z samymi kropkami, szczegóły dnia dopiero po przejściu do „Dziś”. | Kalendarz 390 px |
| V9 | **Gęste teksty pomocnicze** w kartach (2–3 zdania drobnym drukiem) zamiast krótkiej etykiety + szczegóły na żądanie. | Dane, Zapasy, Meal Prep |

**Wydajność (dla wrażenia „premium”):** pierwszy widok 268 ms (CPU ×4: 647 ms; ×6: 1,2 s); przejścia ×4: 60–160 ms, Kalendarz ×6: 372 ms. CSS **niezminifikowany** (173 KB), JS 1 MB z danymi planów (gzip 262 KB), „Dziś” liczy stany wszystkich pozycji dwa razy na render.

---

## 4. System 3.0 „Precision” — kierunek wizualny (propozycja)

**Idea:** spokojna precyzja zamiast ozdobników — jak najlepsze współczesne aplikacje i serwisy (narzędzia klasy pro, panele analityczne, aplikacje Apple Fitness/Health): grafitowe powierzchnie, jedno mocne światło akcentu, **duże liczby i czytelne wykresy z Twoich danych**, mnóstwo oddechu, jedna główna akcja na ekran. „Futurystyczny” przez precyzję, światło i ruch — nie przez neon.

### 4.1 Zasady
1. **Jedna rzecz najważniejsza na ekran** — wyraźny „bohater” (Teraz, Stan zapasów, Następna seria, Następny blok), reszta cichsza.
2. **Mniej ramek, więcej przestrzeni** — grupowanie odstępem i tłem zamiast obramowań; bez kart w kartach; plakietki tylko dla stanów.
3. **Liczby jako bohater** — duży krój „Display”, cyfry tabelaryczne, jednostki pomniejszone, zmiana / trend obok.
4. **Kolor = sygnał** — neutralna grafitowa baza, kolory modułów tylko w danych (wykresy, wskaźniki), czerwień wyłącznie dla braków i zaległości.
5. **Wykresy zamiast opisów** — każda liczba, która ma historię lub prognozę, dostaje mini-wykres; zawsze z prawdziwych danych (zasada 6).
6. **Ruch krótki i tani** — 150–250 ms, wyłącznie `transform`/`opacity`, bez animacji nieskończonych (lekcja D-112), z poszanowaniem „Ogranicz ruch”.
7. **Jeden język formatów** — daty „pn 03.11” / „3 listopada 2026”, ilości wg jednostki, zakresy „7–14 dni”, bez wersalików poza etykietami sekcji.

### 4.2 Fundament
- **Typografia:** Inter Text (14 opsz) do treści + **Inter Display (32 opsz) do nagłówków i dużych liczb** — drugi podzbiór z tego samego źródła (`tools/fonts.py`), ok. +25–35 KB. Skala: 12 / 14 / 16 / 20 / 28 / 40 / 56 px, wysokości linii 1,2–1,5, ciaśniejsze odstępy liter w nagłówkach.
- **Kolor:** paleta w przestrzeni OKLCH (równa jasność odcieni modułów → wykresy czytelne w obu motywach), 12-stopniowa skala grafitu, akcent z wyborem w Ustawieniach (np. indygo / turkus / bursztyn). Kontrasty jak dziś pilnowane testem `tokens.test.mjs`.
- **Siatka i odstępy:** 4/8 px, siatka 12 kolumn na komputerze (max 1280–1360 px), układy „bento” w panelach.
- **Powłoka:**
  - komputer — **pasek górny**: przełącznik dnia (← dziś →), wyszukiwanie i polecenia ⌘K, stan synchronizacji, motyw; smuklejszy panel boczny z sekcjami;
  - telefon — duże tytuły zwijające się do paska (jest), pasek dolny (jest), **przycisk głównej akcji** modułu (np. „Kupione”, „Start treningu”);
  - **Ustawienia** (nowa strona): motyw, akcent, gęstość, rozmiar tekstu, dźwięki minutników, ekran startowy.
- **Biblioteka komponentów** (`src/ui/components.js` + `system.css`): Karta (nagłówek: ikona, tytuł, meta, akcja), Liczba (wartość + jednostka + trend + mini-wykres), Wiersz listy (ikona, tytuł, podpis, wartość, akcja), Plakietka statusu (ikona + słowo — bez emoji), Pasek postępu i Pierścień (jeden styl), Przełącznik segmentowy, Arkusz v2, **Komunikat z „Cofnij”**, Stan pusty, **Zestaw wykresów SVG** (mini-wykres, obszar, słupki, pierścień udziałów, mapa ciepła, oś zapasu) — bez bibliotek zewnętrznych, działające w obu wariantach budowy i offline.

### 4.3 Moduły — co się zmieni (skrót)

| Moduł | Telefon | Komputer |
|---|---|---|
| **Dziś** | „Teraz” jako bohater (pasek, odliczanie, następne 2 punkty), oś planu z automatycznym przewinięciem do „teraz”, „Wymaga uwagi” jako skrzynka z akcjami w miejscu | układ bento: Teraz + oś dnia (lewa kolumna), prawa — liczby dnia z mini-wykresami (dieta, trening, nauka, zapasy), skrzynka uwag |
| **Zapasy** | lista pozycji jako wiersze: stan, „starczy do”, oś zapasu z dniem zakupów, szybkie „+”; **tryb zakupów** (lista do odhaczania w sklepie) | tabela/lista z filtrami w pasku, kolumna „Zakupy”, **szczegóły pozycji** w panelu (historia stanu na wykresie, zużycie na 14 dni, brak od) |
| **Trening** | następna seria jako bohater, tabela serii, licznik przerwy z sygnałem | sesja + mapa mięśni + postęp ćwiczenia przy ćwiczeniu (wykresy ze Statystyk w nowym stylu) |
| **Dieta** | **wybór daty** (nie tylko fazy), oś posiłków, pierścień makro | jadłospis + podsumowanie makro i stan składników |
| **Suplementacja** | oś dnia z „teraz”, zapas preparatów | oś + tabela preparatów (spójne daty) |
| **Nauka (CFA/MPW)** | dzisiejsze bloki jako lista do odhaczania, **licznik bloku 53 min** | **wykres postępu względem planu** (wykonane vs plan do dziś), mapa ciepła wykonania, harmonogram |
| **Kalendarz** | **podgląd wybranego dnia pod siatką** (bez przechodzenia) | miesiąc z wierszami zdarzeń w komórkach |
| **Meal Prep, Pielęgnacja** | listy kontrolne z postępem, minutniki z sygnałem | dwie kolumny: kroki + składniki/produkty |
| **Bezpieczeństwo, Rekompozycja** | wyszukiwanie na górze, karty z czytelnym limitem; spis treści | czytnik ze spisem treści w kolumnie |
| **Dane** | centrum synchronizacji (chmura + plik + kopie) z jednym stanem na górze | jw. + diagnostyka |

**Kontrola jakości wyglądu:** zrzuty 320 / 375 / 390 / 1280 / 1440 / 1920 px × oba motywy, testy dostępności, budżet wydajności (bez animacji nieskończonych, przejście ≤ 150 ms przy CPU ×4), lista kontrolna na iPhonie.

---

## 5. Ulepszenia funkcjonalne (propozycje)

Oznaczenia: **[bez zmian danych]** — tylko widok i obliczenia; **[decyzja: dane]** — wymaga nowego rodzaju zapisu (zgodnie z zasadami — tylko za Twoją zgodą).

| # | Moduł | Propozycja | Wartość | Dane |
|---|---|---|---|---|
| F-Z1 | Zapasy | „Brak od <data>” i niedobór wg planu (K1) | wiesz od kiedy brakuje i ile | bez zmian |
| F-Z2 | Zapasy | **Tryb zakupów**: lista do odhaczania w sklepie, na koniec jeden zapis „Kupione” (z możliwością zmiany ilości) | wygodne zakupy w czwartek | bez zmian (stan listy w urządzeniu) albo **[decyzja: dane]**, jeśli lista ma się synchronizować między iPhonem i MacBookiem |
| F-Z3 | Zapasy | Zakup dowolnej ilości (nie tylko „+ opakowanie”), krokowy wybór ilości | mniej korekt | bez zmian |
| F-Z4 | Zapasy | Szczegóły pozycji: historia stanu na wykresie (z dziennika), zużycie na 14 dni, prognoza | zrozumiesz, skąd liczby | bez zmian |
| F-Z5 | Zapasy | Lista zakupów pogrupowana wg kategorii, kopiowanie i Przypomnienia z zaznaczenia | szybsze zakupy | bez zmian |
| F-D1 | Dziś | Oś dnia z automatycznym przewinięciem do „teraz” i zwinięciem minionych | mniej przewijania | bez zmian |
| F-D2 | Dziś | „Wymaga uwagi” z akcjami w miejscu (Kupione, Odhacz blok, Przejdź) | mniej przejść | bez zmian |
| F-D3 | Dziś | Wieczorne podsumowanie dnia (serie, bloki, kroki, dawki wg planu) | domknięcie dnia | bez zmian |
| F-D4 | Dziś / Suplementacja | **Odhaczanie dawek suplementów** (jak recall CFA — zapis ustawienia) | kontrola przyjmowania | **[decyzja: dane]** |
| F-T1 | Trening | Licznik przerwy z **sygnałem dźwiękowym** (i krótką wibracją tam, gdzie działa) | nie musisz patrzeć na ekran | bez zmian |
| F-T2 | Trening | Postęp ćwiczenia **w sesji** (mini-wykres najcięższej serii / 1RM przy ćwiczeniu — dziś tylko w Statystykach) i wyróżnienie rekordu po zapisie serii | progresja na oczach | bez zmian |
| F-T3 | Trening | Pola liczbowe przyjmujące przecinek (W2) | bez utraty wpisów | bez zmian |
| F-DI1 | Dieta | Widok diety **dla wybranej daty** (z kalendarza planu) | poprawny jadłospis dnia | bez zmian |
| F-DI2 | Dieta | Pierścień udziału makroskładników, oś posiłków | czytelność | bez zmian |
| F-N1 | Nauka | Wykres postępu względem planu (wykonane vs plan do dziś) | widać tempo | bez zmian |
| F-N2 | Nauka | Licznik bloku 53 min z przerwą (stan interfejsu) | nauka blokami | bez zmian |
| F-N3 | Nauka | Mapa ciepła wykonania (kalendarz) | regularność | bez zmian |
| F-K1 | Kalendarz | Podgląd wybranego dnia pod siatką | szybciej | bez zmian |
| F-G1 | Globalne | **Paleta poleceń ⌘K z akcjami** (Dodaj zakup, Start treningu, Odhacz blok, Przejdź do daty) | szybkość na MacBooku | bez zmian |
| F-G2 | Globalne | **Ustawienia** (motyw, akcent, gęstość, rozmiar tekstu, dźwięki, ekran startowy) | dopasowanie | bez zmian (ustawienia urządzenia) |
| F-G3 | Globalne | Przegląd tygodnia: wykonanie planu z dziennika (serie, bloki, kroki) | tygodniowe podsumowanie | bez zmian |
| F-G4 | Globalne | Stan synchronizacji zawsze widoczny (pasek / ikona) | pewność, że dane są wysłane | bez zmian |
| F-G5 | Globalne | Komunikat po zapisie z przyciskiem „Cofnij” | bezpieczeństwo pomyłek | bez zmian |
| F-G6 | Wydajność | Minifikacja CSS, dane planów ładowane w modułach (wariant web), pamięć obliczeń dnia | szybszy start na iPhonie | bez zmian |

---

## 6. Plan wdrożenia

Każdy etap: osobny commit na gałęzi roboczej, pełna regresja (jednostkowe, E2E, dostępność, Trening, synchronizacja plikiem i w chmurze), zrzuty w obu motywach, raport. **Publikacja na `main` tylko po Twoim potwierdzeniu.** Zasady bez zmian: dane, zdarzenia, synchronizacja i treści planów nienaruszone; nowe rodzaje zapisów tylko za zgodą (§7).

| Etap | Zakres | Wynik / kryterium odbioru |
|---|---|---|
| **0. Pilna poprawka Zapasów** (od razu po akceptacji) | K1 (stan nie spada poniżej 0, zakup po braku liczony poprawnie, „brak od”, niedobór), W1 (formatowanie pola „Stan”), ujemne wartości w Dane i Suplementacji, „− porcja” do zera, D11 | żadna ilość < 0 w całej aplikacji (strażnik w teście przeglądu), testy brak → zakup; **możliwa osobna publikacja zaraz po Twoim potwierdzeniu** |
| **1. Drobne błędy i spójność** | W2 (pola liczbowe z przecinkiem), W3, D1–D17, porządek w dokumentacji | lista D zamknięta; wspólne formatowanie dat i ilości |
| **2. Fundament System 3.0** | tokeny (OKLCH, Display), komponenty, zestaw wykresów, powłoka (pasek górny, ⌘K z akcjami, Ustawienia, komunikat z „Cofnij”), wydajność (F-G6) | **prototyp: „Dziś” i „Zapasy” w nowym wyglądzie (390 i 1440 px, oba motywy) — do Twojej akceptacji przed dalszą przebudową** |
| **3. Moduły codzienne** | Dziś, Zapasy (tryb zakupów, szczegóły pozycji), Trening (sygnał przerwy, postęp ćwiczeń), Dieta (data), Suplementacja | publikacja po kontroli na iPhonie |
| **4. Nauka i kalendarz** | CFA/MPW (wykres postępu, licznik bloku, mapa ciepła), Kalendarz (podgląd dnia), Tydzień (przegląd tygodnia) | jw. |
| **5. Pozostałe moduły** | Meal Prep, Pielęgnacja, Bezpieczeństwo, Rekompozycja, Dane, Więcej | jw. |
| **6. Regresja końcowa i urządzenia** | Fazy 6–7: 7 szerokości, iPhone (Safari i aplikacja), MacBook (Safari, Chrome), wydajność, dokumentacja, decyzja D-113 | gotowe do codziennego użycia |

**Ryzyka i jak je ograniczam:** zmiana obliczeń Zapasów → testy porównawcze na danych syntetycznych i lista pozycji, których stan się zmieni; przebudowa wyglądu → prototyp do akceptacji, klasy używane przez testy zachowane lub testy zaktualizowane w tym samym kroku; iPhone (brak WebKit tutaj) → lista kontrolna po każdej publikacji, bez animacji nieskończonych i bez ciężkich efektów przy przewijaniu; drugi font → podzbiór i test pokrycia (`fonts.test.mjs`).

---

## 7. Decyzje potrzebne od Ciebie

1. **Zapasy (K1) — semantyka:** stan nie schodzi poniżej 0; zakup z dnia D pokrywa zużycie dnia D; pokazujemy „brak od” i niedobór. Pozycje zaniżone przez dawne „fikcyjne zużycie” po poprawce pokażą wyższy (prawidłowy) stan. **Akceptujesz?**
2. **Kierunek wizualny:**
   - **A — „Precision” (zalecany):** grafit, jedno światło akcentu, duże liczby, wykresy, mało ramek — spokojnie i bardzo profesjonalnie;
   - **B — „Vivid”:** jak A, ale z żywymi kolorowymi kartami modułów i gradientami (bliżej Apple Fitness);
   - **C — „HUD”:** ciemny, kontur i siatka, akcenty neonowe, krój o charakterze technicznym — najbardziej „futurystyczny”, mniej spokojny.
   Mogę też przygotować **prototyp ekranu „Dziś” w dwóch wybranych kierunkach** do porównania.
3. **Zakres funkcji z §5** — wszystkie, czy wskażesz, które pominąć.
4. **Nowe zapisy:** odhaczanie dawek suplementów (F-D4) i lista zakupów synchronizowana między urządzeniami (F-Z2) — tak / nie.
5. **Jednostka „ml/g”** (kefir i druga pozycja) — zmienić na „ml”?
6. **Publikacja:** etap 0 od razu po zakończeniu (zalecam), kolejne etapy — po Twoim sprawdzeniu każdego?
7. **D1 — popołudnie od 16.11** (bloki MPW a plan dnia): decyzja potrzebna do ok. 10.11 — osobno.

---

## Załącznik A — liczby z przeglądu automatycznego
- Renderów: 1011 (390 px: 35 widoków + 8 modułów × daty; 1280 px: co 7. dzień; 6 dodatkowych „dziś”).
- Błędy JS / konsoli: 0. NaN / undefined / null / Infinity / „[object” / Invalid Date: 0. Przewijanie w poziomie: 0.
- Ujemne ilości: Dane 296 trafień, Suplementacja 158, pola „Stan” w Zapasach 30 widoków (K1). Długie ułamki w polach: 30 (W1).
- Spacja przed przecinkiem: 464 trafienia, 57 wzorców — wyłącznie Bezpieczeństwo (D12).
- Odmiana i „długie liczby” w tekście: fałszywe alarmy (ułamki „0 / 3 bloków”, daty) — bez błędów.

## Załącznik B — wydajność
| Pomiar | CPU ×1 | CPU ×4 | CPU ×6 |
|---|---|---|---|
| Pierwszy widok „Dziś” (web) | 268 ms | 647 ms | 1166 ms |
| Przejście do Zapasów | 28 ms | 145 ms | 283 ms |
| Przejście do Kalendarza | 23 ms | 135 ms | 372 ms |

Zasoby: JS 1030 KB (gzip 262 KB), CSS 173 KB niezminifikowany (gzip 36 KB), fonty 61 KB, `2027.html` 1,45 MB.
Skala do końca planu: 22 500 zdarzeń → przeliczenie stanu 43 ms, stany wszystkich pozycji 2 ms, plik synchronizacji ok. 4,4 MB.
