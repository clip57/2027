# Projekt „2027” — Etap 1: Architektura systemu · wersja 1.1

**Data:** 22.09.2026 · **Zastępuje:** `SPEC_2027_etap1.md` (v1.0) · **Powiązane:** `AUDYT_2027_etap0.md`
**Status:** specyfikacja po decyzjach użytkownika. Nie zmieniłem żadnego pliku i nie napisałem kodu aplikacji. Implementacja (Etap 2) wymaga osobnego polecenia.

> **Ograniczenie techniczne:** pliki projektu są dla mnie tylko do odczytu. Każda „zmiana treści” z tego dokumentu oznacza nową wersję pliku w repozytorium aplikacji. Wymianę plików w projekcie wykonujesz Ty.

---

## 1. Rejestr decyzji

| ID | Data | Decyzja | Status |
|---|---|---|---|
| D-000 | 21.09 | Audyt Etapu 0 jako punkt odniesienia | obowiązuje |
| D-001 | 22.09 | `SUPLEMENTACJA_2027` jest jedynym źródłem prawdy dla suplementów (lista, dawki, godziny, powiązanie z posiłkami, warunki). Sprzeczne fragmenty w innych plikach należy ujednolicić | obowiązuje |
| D-002 | 22.09 | Termos: pakowanie 85 °C, drugi próg 63 °C | **zastąpiona przez D-013** |
| D-003 | 22.09 | Gramatury faz są danymi logistycznymi i przeliczają się automatycznie; jedno źródło danych o fazach | obowiązuje |
| D-004 | 22.09 | Plan dnia ma warianty dni; godziny bez zmian, zmienia się zawartość slotów | obowiązuje |
| D-005 | 22.09 | Mock CFA jako odrębny wyjątek | doprecyzowana w D-019 |
| D-006 | 22.09 | Plan CFA z projektu jest źródłem harmonogramu; first pass kończy się 05.11 | obowiązuje; aktualna wersja pliku: v3 (sekcja 2) |
| D-007 | 22.09 | PDF-y diety i DOCX suplementacji stają się funkcjonalnymi modułami (nie przepisaniem) | obowiązuje |
| D-008 | 22.09 | Trwały, wersjonowany, walidowany zapis danych użytkownika z eksportem i importem | obowiązuje |
| D-009 | 22.09 | Zapis lokalny oddzielony od przyszłej synchronizacji | obowiązuje |
| D-010 | 22.09 | Responsywność desktop + iPhone | obowiązuje |
| D-011 | 22.09 | Ujednolicenie całego systemu | obowiązuje |
| D-012 | 22.09 | Najpierw architektura, potem przebudowa | obowiązuje |
| **D-013** | 22.09 | **Termos:** brak jakiegokolwiek progu temperatury przy wkładaniu. Posiłek trafia do termosu **prosto z patelni**. Jedyny próg: temperatura posiłku w termosie **podczas jedzenia musi przekraczać 63 °C**. Wszystkie fragmenty z progiem pakowania należy przepisać | obowiązuje |
| **D-014** | 22.09 | **Tauryna 2 g o 17:15 codziennie, także w czwartek** (zgodnie z SUPLEMENTACJĄ). Teksty TRENING i REKOMPOZYCJI o jej odpadaniu w czwartek są błędne i do poprawy. Banana w czwartek nie ma (zgodnie z dietą NT) | obowiązuje |
| **D-015** | 22.09 | **Glukozamina, chondroityna, Boswellia — „do wyczerpania zapasów”**, czasowo na 6 miesięcy, potem niekontynuowane. Stan początkowy: Boswellia 180 tabl. (opak. 90), glukozamina 180 tabl. (opak. 90), chondroityna 360 tabl. (opak. 60) = zapas na 180 dni | obowiązuje |
| **D-016** | 22.09 | **Cynk** kontynuowany (2 × w tygodniu wg SUPLEMENTACJI). Opakowanie 150 tabl. Zapas duży, nieodnotowany (starczy na lata) | obowiązuje |
| **D-017** | 22.09 | **Fazy kalendarzowe:** F0 od 21.09.2026, F1 od 12.10.2026, F2 od 16.11.2026 | obowiązuje |
| **D-018** | 22.09 | **Warianty dnia** (tabela z v1.0, K-6) zatwierdzone. Okno 17:45–20:15 jest wspólne dla wszystkich aktywności. W czwartek slot 19:45–20:05 = „wolne” | obowiązuje |
| **D-019** | 22.09 | **Dzień mocka:** godziny posiłków i suplementów bez zmian; plan dnia zastępuje bloki CFA A–D sesjami mocka | obowiązuje |
| **D-020** | 22.09 | **Nazwy kanoniczne:** Skyr · Białko WPC · Brokuły mrożone (brokuły świeże zostają wyłącznie w Tabeli bezpieczeństwa) · Chleb żytni na zakwasie (dopisek „bez drożdży” może zostać tam, gdzie już jest) | obowiązuje |
| **D-021** | 22.09 | **Porcje kanoniczne:** szczypiorek 5 g · melisa 2 g · cytryna 1/7 szt. · imbir 5 g (2–3 plastry) · wanilia 0,25 ml (5 kropel) — ujednolicone wszędzie | obowiązuje |
| **D-022** | 22.09 | **Obiad gotowany codziennie**, pomidorki 80 g, procedury jak w MEAL_PREP | obowiązuje |
| **D-023** | 22.09 | **Docelowe środowisko: przeglądarka z hostingu GitHub (GitHub Pages).** Obecnie Documents by Readdle (okres przejściowy) | obowiązuje |
| **D-024** | 22.09 | Eksport danych ZAPASY został wykonany | stan faktyczny |
| **D-025** | 22.09 | Pielęgnacja poza zakresem platformy | obowiązuje |
| **D-026** | 22.09 | **Jedna wspólna warstwa danych i jeden system zapisu, kod logicznie modułowy.** Ewentualny pojedynczy plik HTML powstaje w procesie budowania z modułowej struktury źródłowej, nigdy jako ręcznie scalony monolit | obowiązuje |

### 1.1 Wnioski z decyzji przyjęte bez dodatkowego pytania (interpretacje)

- **I-1 (D-013):** „przekraczać 63 °C” czytam ściśle jako **> 63 °C**. Dotychczasowe teksty mają „≥ 63 °C” — zmienię na „> 63 °C”.
- **I-2 (D-001, D-014):** kolagen i witamina C w czwartek przyjmowane o 17:15, jak w SUPLEMENTACJI. Teksty „dowolna pora” w TRENING i REKOMPOZYCJI są z nią sprzeczne i zostaną poprawione razem z tauryną.
- **I-3 (D-022, „procedury jak w MEAL_PREP”):** w MEAL_PREP karty procedur są nadrzędne nad tabelą naczyń:
  - Contigo #1 = zielona herbata, #2 = kawa (tabelę naczyń poprawiam);
  - szpinak rozmraża się w pojemniku 520 ml (z opisu 320 ml usuwam „rozmrażanie szpinaku”).
- **I-4 (korekta mojego audytu):** 4 i 6 kostek lodu w MEAL_PREP to nie sprzeczność. 4 kostki schładzają Contigo rano (karta 3), 6 kostek trafia do kawy (karta 7). Wycofuję ten zarzut z pozycji S-8 audytu.
- **I-5 (D-021):** notatka miodu w ZAPASY „1/2 łyżeczki” jest sprzeczna z PDF („1 łyżeczka, 6 g”). Źródłem diety są PDF-y, więc zmieniam na „1 łyżeczka (6 g)”.
- **I-6 (D-020):** w PDF-ach produkt nazywa się „Białko KFD” i „Skyr naturalny”. PDF-ów nie zmieniam. W aplikacji wyświetlam nazwę kanoniczną, a nazwa z PDF zostaje aliasem ze wskazaniem źródła.
- **I-7 (D-019):** w dniu mocka nie wyświetlam ostrzeżeń o kolizjach (w D-019 ich nie ma). Na mapie dnia sesje mocka są po prostu widoczne obok niezmienionych posiłków.
- **I-8 (D-017):** fazę wylicza kalendarz, nie przełącza jej użytkownik. Zostaje zapisana konfiguracja dat faz (dane, nie kod), żeby ewentualna przyszła zmiana dat nie wymagała zmian w programie.

---

## 2. Plan CFA v3 (plik naprawiony 22.09) — weryfikacja

| Kontrola | Wynik |
|---|---|
| 416 bloków, 52 dni × 8, numeracja, dni tygodnia | poprawne |
| First pass do 05.11; Curriculum 3269 stron bez luk; 93 readings Schwesera raz; Schweser po Curriculum działu | poprawne |
| Tryby: FIRST PASS 290 · CONSOLIDATION 75 · MOCK 24 · ANALIZA BŁĘDÓW 24 · ACTIVE RECALL 3 | poprawne; problem CFA-9 z v1.0 rozwiązany (analiza ma własny tryb) |
| Fazy: F1 21.09–05.11 (368 bl. = 290 + 42 + 36), F2 06.11–11.11 (48 bl. = 33 + 15) | zgodne z danymi |
| Tabela kolejności działów — daty „od → do” | zgodne z danymi |
| Opisy: mocki w odstępach 4, 4, 4 dni; „6 dni czystej praktyki”; pokrycie 82,1 / 89,0 / 95,6 / 100 % | zgodne z danymi |
| Licznik „9 bloków”, „11.09”, martwy `#egzaminy` | usunięte |
| Data „dziś” | liczona lokalnie (`ymd`) — błąd strefy czasowej usunięty |
| Trwałość | dodany localStorage (`cfaL1_done_v1`, `cfaL1_log_v1`) |
| Bloki 1–208 | identyczne jak w v1 i v2 — postęp zgodny |

**Uwagi pozostałe w v3.** Nie blokują niczego, bo nowy moduł CFA używa tylko danych `D`:

- nieudany zapis jest ignorowany — `store.set` zwraca `false`, ale nikt tego nie sprawdza;
- brak importu error logu z CSV;
- w kodzie zostały tryby „LAW”;
- na ekranie 390 px strona ma 617 px szerokości;
- formularz error logu ma 7 rodzajów błędów, a tekst opisuje 4 „kubełki”. Domyślnie zachowuję 7 rodzajów z formularza, bo z nimi zapisane są wpisy.

**Migracja z v3:** postęp i error log z Readdle przeniosę eksportem (JSON + CSV). Nowy moduł będzie miał import CSV.

---

## 3. Katalog zmian w treściach (ujednolicenie wg decyzji)

W implementacji każda zmiana zostanie pokazana jako różnica „przed → po” do akceptacji. Poniżej pełna lista znalezionych miejsc. Pozycje oznaczone **[usunięcie]** likwidują treść. Wskazuję je wprost, zgodnie z zasadą 2.

### 3.1 Termos (D-013)

| Plik | Fragment dziś | Po zmianie |
|---|---|---|
| MEAL_PREP, karta 3 (lunch) | „Próg pakowania: ≥ 85 °C. Mierzony termometrem DOQAUS…” | „Danie trafia do termosu prosto z patelni.” **[usunięcie progu]** |
| MEAL_PREP, tabela urządzeń (termometr) | „próg 85 °C przy pakowaniu lunchu” | „kontrola > 63 °C w termosie przed jedzeniem” |
| MEAL_PREP, test kalibracyjny | „13:20, przed dodaniem skyru ≥ 63 °C” | „> 63 °C” |
| MEAL_PREP, uzasadnienie (skyr) | „Przy bazie 85 °C danie po wymieszaniu trafiałoby…” | to samo rozumowanie bez liczby progu pakowania |
| MEAL_PREP, askorbinian (2 miejsca) | „sześć godzin w 63–85 °C rozłożyłoby większość dawki” | „sześć godzin powyżej 63 °C rozłożyłoby…” |
| REKOMPOZYCJA s.5 | „≥75 °C przy pakowaniu” | „prosto z patelni” **[usunięcie progu]** |
| REKOMPOZYCJA s.5 | „przy bazie 75 °C danie trafiało do termosu w ok. 57 °C…” | rozumowanie bez liczby progu pakowania |
| REKOMPOZYCJA s.5 | „Próg krytyczny: 60 °C. Wynik ≥60 °C… <60 °C…” | „> 63 °C … ≤ 63 °C” |
| Bezpieczne v3, s.1 poz. 2 | cała pozycja „Pakuj termos przy ≥ 85 °C — liczba wymyślona przeze mnie” | **[usunięcie pozycji]**; wstęp „Jedenaście twierdzeń…” → „Dziesięć…”, numeracja 3–11 → 2–10 |
| Bezpieczne v3, s.5 | „jedyny punkt wymagający zmiany — Poprzednio podałem Ci próg pakowania 85 °C. Wycofuję…” | „Danie prosto z patelni do wygrzanego termosu; rozstrzyga pomiar podczas jedzenia: > 63 °C” **[usunięcie opisu historii progu]** |
| Bezpieczne v3, s.5 | „Próg ≥ 63 °C PARAMETR” | „> 63 °C PARAMETR” (status i uzasadnienie zostają) |
| Tabela bezpieczeństwa | brak wiersza termosu | **nowy wiersz** „Lunch w termosie”: prosto z patelni; > 63 °C podczas jedzenia; źródło: decyzja D-013 |

Bez zmian zostają, bo nie dotyczą pakowania termosu: 63 °C jako parametr gorącego przechowywania, temperatury odgrzewania (70 °C / 75 °C), 74 °C w kurczaku, 60 °C przy dodawaniu glicyny, 63 °C przy Salmonelli.

### 3.2 Suplementacja (D-001, D-014, D-015, D-016)

| Plik | Fragment dziś | Po zmianie |
|---|---|---|
| TRENING, czwartek | „Kolagen i witamina C — dowolna pora. Tauryna odpada.” | „Kolagen, witamina C i tauryna — 17:15, jak w pozostałe dni.” |
| REKOMPOZYCJA s.22, czwartek | „kolagen i witaminę C bierzesz o dowolnej porze, tauryna odpada” | jw. |
| REKOMPOZYCJA s.6, tabela „Usunięte” | glukozamina, chondroityna, Boswellia — „usunięte” z uzasadnieniem | „Przyjmowane do wyczerpania zapasów (do 20.03.2027), potem niekontynuowane” — uzasadnienie merytoryczne zostaje jako tło, oznaczone „nie stanowi obecnej decyzji” |
| REKOMPOZYCJA s.6, cynk | „ze śniadaniem … z posiłkiem, nie na czczo” | wg SUPLEMENTACJI: 07:00, na czczo, czw. i nd. |
| REKOMPOZYCJA s.6/18/22, melatonina | „0,5–1 mg, codziennie przez 4–8 tygodni, potem odstawić” | „1 mg, 22:00” (wg SUPLEMENTACJI) |
| REKOMPOZYCJA s.6, kreatyna | „dowolnie, start: po badaniach z tyg. 0” | „5 g, 20:15, z posiłkiem potreningowym” (wg SUPLEMENTACJI) |
| REKOMPOZYCJA s.6/24, tauryna | „opcjonalnie”, „odpada” | „2 g, 17:15, codziennie” |
| REKOMPOZYCJA s.24 | „7 podstawowych / 6 podstawowych…, cynk odchodzi, glukozamina… odchodzą” | streszczenie stacku wygenerowane z SUPLEMENTACJI **[usunięcie sprzecznych zdań]** |
| REKOMPOZYCJA s.20 (badania) | „Po odstawieniu suplementu cynku nie ma rutynowego wskazania” | „Cynk jest kontynuowany — …” (sama zasada badań warunkowych zostaje) |
| PLAN_DNIA | brak wit. C 13:20 i kreatyny 20:15 | plan generowany z SUPLEMENTACJI — kompletny |
| MEAL_PREP, karta 1 | „melatonina 0,5–1 mg” | „1 mg” |

W ZAPASY dochodzą nowe pozycje: Boswellia, glukozamina, chondroityna (ze stanem i opakowaniem z D-015) oraz cynk (sekcja 6.2).

### 3.3 Nazwy (D-020) i porcje (D-021, D-022)

| Plik | Dziś | Po zmianie |
|---|---|---|
| ZAPASY | „Białko KFD”, „Skyr naturalny” | „Białko WPC”, „Skyr” (ID bez zmian — dane użytkownika zachowane) |
| ZAPASY | Brokuły, notatka „Świeże (limit zamrażarki)” | notatka poprawiona na „mrożone” (dziś jest wewnętrznie sprzeczna) |
| ZAPASY | szczypiorek 3 g, melisa 3 g, miód „1/2 łyżeczki” | 5 g, 2 g, „1 łyżeczka (6 g)” |
| REKOMPOZYCJA (6 tabel diety) | „Odżywka białkowa (serwatka)”, „Chleb żytni razowy” | „Białko WPC”, „Chleb żytni na zakwasie” |
| REKOMPOZYCJA s.5 | „2–3 g suszonej melisy” | „2 g” |
| REKOMPOZYCJA s.5 | „ryż/makaron w partiach; schładzaj ≥12 h; kurczak i warzywa na 2–3 dni” | zgodnie z D-022: obiad gotowany codziennie **[usunięcie zaleceń batch]** |
| MEAL_PREP | „Odżywka białkowa po treningu” (shaker); pomidorki 85 g | „Białko WPC”; 80 g |
| MEAL_PREP, tabela naczyń | Contigo #1 kawa / #2 herbata; 320 ml „rozmrażanie szpinaku” | wg kart (I-3) |
| Bezpieczne v3 | „Jogurt naturalny 0 % wysokobiałkowy”, „jogurt” (ok. 12 miejsc), „WPC / KFD” | „Skyr”, „Białko WPC” |
| Tabela | „Jogurt 0% wysokobiałkowy kubek 400 g”, „WPC / KFD proszek” | „Skyr kubek 400 g”, „Białko WPC proszek”; „Brokuły świeże” zostają |

### 3.4 Fazy (D-017)

| Plik | Dziś | Po zmianie |
|---|---|---|
| TRENING | przełącznik faz z domyślną F0 | faza z kalendarza (etykiety „tyg. 1–3 / 4–8 / 9+” zgodne z datami) |
| REKOMPOZYCJA s.8 | „przejście zależy od odpowiedzi organizmu, nie od kalendarza” + kryteria | patrz pytanie H-4 |

---

## 4. Mapa źródeł prawdy (aktualna)

| Obszar | Źródło prawdy |
|---|---|
| Jadłospis: 3 fazy × T/NT, gramatury, kcal, makro | 6 PDF (bez zmian), z nazwami kanonicznymi (D-020) i porcjami kanonicznymi (D-021) |
| Suplementy | SUPLEMENTACJA + D-014, D-015, D-016 |
| Fazy | kalendarz faz (D-017) |
| Tydzień i warianty dnia | REKOMPOZYCJA s.7 + D-018 |
| Szablon godzin | PLAN_DNIA (godziny niezmienne) |
| Trening | dane TRENING (= REKOMPOZYCJA s.9–17) |
| CFA | `Plan_nauki_CFA.html` v3 — dane `D` |
| Termos | D-013 |
| Limity przechowywania | Tabela (+ wiersz termosu) |
| Procedury kuchenne | MEAL_PREP (karty nadrzędne nad tabelą naczyń) |
| Katalog magazynu | ZAPASY (parametry) + nowe pozycje suplementów |
| Strategia, algorytmy, badania | REKOMPOZYCJA (po ujednoliceniu z sekcji 3) |
| Dane użytkownika | warstwa zapisu (sekcja 7) |

Zależności między modułami — bez zmian względem v1.0, sekcja 5.

---

## 5. Warianty dnia (zatwierdzone, D-018)

| Typ dnia | Dni | Dieta | 18:05–19:35 | 19:45–20:05 | 20:15 | Recall 22:00 |
|---|---|---|---|---|---|---|
| Siła + sauna | pn (UPPER 1), sob (LOWER 2) | T | rozgrzewka + trening + schłodzenie | sauna | po treningu | pn tak · sob nie |
| Siła bez sauny | wt (LOWER 1), pt (UPPER 2) | T | jw. | wolne | po treningu | wt tak · pt nie |
| Cardio + sauna | śr | T | rower 55 min + ABS | sauna | po treningu | tak |
| Bez treningu, 2 × sauna | czw | NT | 2 rundy sauny wg protokołu | **wolne** | po saunie | tak |
| Basen | nd | T | basen 55 min | wolne | po treningu | tak |
| Wyjątek: mock CFA | 26.10, 30.10, 03.11, 07.11 | wg dnia tygodnia | wg dnia tygodnia | wg dnia tygodnia | wg dnia tygodnia | wg dnia tygodnia; bloki A–D → sesje mocka S1/S2 |

---

## 6. Wartości przeliczane automatycznie

### 6.1 Lista (zaktualizowana)

| Wartość | Reguła |
|---|---|
| Faza dnia | kalendarz D-017 |
| Typ dnia, wariant diety | tabela z sekcji 5 |
| Gramatury, kcal, makro posiłków | PDF[faza][wariant] |
| Suplementy dnia | SUPLEMENTACJA, filtr dni tygodnia (cynk: czw, nd) i okresu ważności (D-015) |
| Zużycie dzienne produktów | suma pozycji diety danego dnia + pozycje spoza PDF (D-021) |
| Zużycie dzienne suplementów | suma dawek danego dnia, tylko w okresie ważności |
| Stan bieżący | ostatnia inwentaryzacja + zakupy/korekty − planowane zużycie dzień po dniu |
| Prognoza, data wyczerpania, lista zakupów | symulacja w przód z rzeczywistymi typami dni i fazami |
| Serie treningowe | seria[faza z kalendarza] |
| Bloki CFA dnia, recall, mock, postęp | dane `D` + postęp użytkownika |
| Ilości w krokach MEAL_PREP | odwołania do pozycji diety (faza, wariant) |

### 6.2 Suplementy czasowe i nieśledzone

- **Glukozamina, Boswellia** (1/d), **chondroityna** (2/d): zapas na 180 dni. Przy liczeniu od 22.09.2026 (przed porannymi dawkami) ostatni dzień przyjmowania to **20.03.2027**. Te pozycje nigdy nie trafiają na listę zakupów. Stan = 0 kończy ich obecność w planie dnia (patrz H-2).
- **Cynk:** status „nieśledzony”. Pojawia się w planie dnia (czw., nd.), a w magazynie ma opakowanie 150 tabl., ale bez prognozy, alarmów i zakupów, dopóki nie wpiszesz stanu. Nie zgaduję liczby tabletek.

---

## 7. Warstwa zapisu — z uwzględnieniem GitHub Pages (D-023)

Zasady z v1.0 (koperty ze schematem, weryfikacja zapisu, kwarantanna, dziennik zdarzeń, migracje, eksport/import z podglądem, adapter lokalny/synchronizacja) pozostają bez zmian. Hosting na GitHub Pages wprowadza trzy nowe fakty.

1. **Wspólne pochodzenie:** wszystkie strony GitHub Pages jednego konta (`<login>.github.io/<repo>`) mają to samo pochodzenie przeglądarki. Każdy inny Twój projekt opublikowany pod tym adresem ma techniczny dostęp do tych samych danych w przeglądarce. Rozwiązania:
   - przestrzeń nazw `p2027` w nazwie bazy;
   - opcjonalnie własna domena lub osobne konto dla aplikacji. To Twoja decyzja — nie jest blokująca.
2. **Safari na iOS** może usuwać dane stron nieodwiedzanych przez dłuższy czas, jeśli strona nie jest dodana do ekranu początkowego (polityka WebKit; nie mogę tego sprawdzić na Twoim urządzeniu). Rekomendacja:
   - instalacja jako aplikacja z ekranu początkowego (manifest + service worker);
   - `navigator.storage.persist()`;
   - przypomnienie o eksporcie kopii co 7 dni.
3. **Praca offline:** service worker przechowuje aplikację w pamięci podręcznej, więc działa bez sieci. Dane użytkownika **nigdy nie trafiają do repozytorium** — pozostają w przeglądarce i w plikach kopii.

**Okres przejściowy (Readdle):** dane z Readdle przenoszę wyłącznie przez pliki eksportu. Mam już Twój eksport ZAPASY (D-024); postęp i error log CFA wymagają eksportu z pliku v3.

---

## 8. Architektura kodu (D-026)

### 8.1 Struktura repozytorium

```
2027/
├── src/
│   ├── data/                 # warstwa ŹRÓDŁO — JSON wygenerowany i zweryfikowany z plików źródłowych
│   │   ├── diet.json             (6 wariantów, pozycje z polem src)
│   │   ├── supplements.json      (SUPLEMENTACJA + D-014/015/016)
│   │   ├── week.json, day-template.json, phases.json
│   │   ├── training.json, cfa.json, safety.json, mealprep.json, catalog.json
│   │   └── docs/                 (Rekompozycja, Bezpieczne — treść po ujednoliceniu z sekcji 3)
│   ├── core/                 # logika bez interfejsu
│   │   ├── dates.js              (daty lokalne)
│   │   ├── resolver.js           (data → dzień)
│   │   ├── calc/                 (zapasy, zakupy, postęp, makro)
│   │   ├── schema/               (walidatory)
│   │   └── storage/              (adapter IndexedDB, migracje, kopie)
│   ├── ui/                   # wspólne komponenty i tokeny wyglądu
│   ├── modules/              # dzis, dieta, suplementy, mealprep, zapasy, trening, cfa, bezpieczenstwo, rekompozycja, dane
│   └── app.js                # router i start
├── tools/
│   ├── extract/              # skrypty odczytu PDF/DOCX/HTML → data/*.json
│   ├── verify/               # porównanie data/*.json ze źródłami 1:1
│   └── build.mjs             # budowa wersji
├── tests/                    # testy core (Node, bez przeglądarki) + testy E2E (Chromium, 390 px i 1280 px)
├── public/                   # manifest, ikony, service worker
└── dist/                     # wynik budowy (nieedytowany ręcznie)
```

Reguły:
- moduły nie importują siebie nawzajem — komunikacja wyłącznie przez `core`;
- dane źródłowe są tylko do odczytu;
- żaden plik w `dist/` nie jest edytowany ręcznie.

### 8.2 Warianty budowy

| Wariant | Przeznaczenie | Zawartość |
|---|---|---|
| `dist/web/` | GitHub Pages (docelowy) | moduły ES + manifest + service worker, praca offline, instalacja na ekranie początkowym |
| `dist/single/2027.html` | Readdle / plik lokalny (przejściowy) | jeden plik zbudowany z tych samych źródeł przez bundler (inlining JS/CSS/danych); bez service workera |

Oba warianty powstają z jednego źródła jednym poleceniem. Narzędzie budowy: esbuild (jedna zależność deweloperska) — aplikacja w przeglądarce nie ma żadnych zależności zewnętrznych.

### 8.3 Testy obowiązkowe

1. **Weryfikacja danych:** każda wartość w `src/data` porównana ze źródłem (PDF, DOCX, `D` CFA, `EX`/`EX_ROM`, Tabela). Wyjątki wyłącznie z listy decyzji (sekcja 3) — każdy z ID decyzji.
2. **Resolver:** wszystkie dni od 21.09.2026 do 31.03.2027 — typ dnia, faza, wariant diety, suplementy (w tym koniec D-015), bloki CFA, mocki.
3. **Obliczenia zapasów:** porównanie ze starym ZAPASY dla Fazy 0 (różnice tylko w znanych miejscach), przejście F0→F1 i F1→F2, zakończenie suplementów czasowych.
4. **Zapis:** błąd zapisu, uszkodzony odczyt, import niepoprawny, migracja z eksportu ZAPASY v31, z `postep-nauki.json` i z `error-log.csv`, równoległe karty.
5. **E2E:** każdy moduł na 390 × 844 i 1280 × 800 — brak przewijania w poziomie, cele dotykowe ≥ 44 px, brak błędów konsoli.

---

## 9. Plan etapów

| Etap | Zakres | Zastępowane pliki | Kryterium zakończenia |
|---|---|---|---|
| **2 — Rdzeń** | repozytorium, ekstrakcja i weryfikacja danych, katalog zmian z sekcji 3 jako różnice do akceptacji, resolver, obliczenia, warstwa zapisu, migracje, budowa obu wariantów, szkielet nawigacji | żadne (stare pliki działają) | testy 8.3 pkt 1–4 zaliczone; raport |
| 3 — Dziś, Dieta, Suplementacja | nowe moduły, warianty dnia, mock | PLAN_DNIA | przegląd 7 dni × 3 fazy + 4 mocki |
| 4 — Meal Prep, Zapasy i zakupy | ilości z diety, D-013, dziennik zapasów, suplementy czasowe | MEAL_PREP, ZAPASY | migracja Twojego eksportu 1:1 |
| 5 — Trening, CFA | trwałe serie, faza z kalendarza, harmonogram v3, error log z importem | TRENING, Plan_nauki_CFA | migracja postępu i logu |
| 6 — Bezpieczeństwo, Rekompozycja, spójność | widoki mobilne, treści po ujednoliceniu, audyt responsywności i dostępności | Tabela, Bezpieczne, REKOMPOZYCJA | testy E2E |

Po każdym etapie raport (wykonane, niewykonane, problemy, testy, ryzyka, następny krok) i aktualizacja tego dokumentu.

---

## 10. Otwarte kwestie

| ID | Pytanie | Wariant domyślny | Blokuje |
|---|---|---|---|
| **H-1** | **Publiczność danych na GitHub Pages.** Strona z repozytorium publicznego jest dostępna dla każdego, kto zna adres, a samo repozytorium jest publiczne. REKOMPOZYCJA zawiera wyniki badań krwi, opis MRI i antropometrię; plan diety i suplementacji też jest osobisty. (Prywatne repozytorium z Pages wymaga płatnego planu GitHub; nie sprawdzałem aktualnych warunków.) Które treści mogą być publiczne? | W wersji hostowanej pomijam sekcję diagnozy REKOMPOZYCJI (antropometria, badania, MRI); zostaje ona tylko w wariancie lokalnym. Dodaję `noindex` dla wyszukiwarek | Etap 2 (struktura danych i budowy) |
| H-2 | Koniec suplementów czasowych: 180 tabletek daje ostatni dzień 20.03.2027, a „dokładnie 6 miesięcy” od 22.09 kończy się 21/22.03.2027. Co rozstrzyga? Czy stan 180/180/360 jest na rano 22.09, przed dawką 07:00? | Rozstrzyga zapas: stan na rano 22.09, koniec 20.03.2027 | nie |
| H-3 | Tabela bezpieczeństwa nie ma wiersza „Brokuły mrożone” (jest tylko świeże), a to produkt faktycznie używany. Limitów nie wymyślę. | Dodać wiersz z wartościami skopiowanymi z pozycji „Mieszanka warzyw mrożona” jako analogii, oznaczony „do potwierdzenia”, albo zostawić bez wiersza | nie |
| H-4 | REKOMPOZYCJA s.8: „przejście zależy od odpowiedzi organizmu, nie od kalendarza” + kryteria przejścia — sprzeczne z D-017 | Zdanie zmieniam na daty kalendarzowe; kryteria zostają jako informacyjna lista kontrolna, bez wpływu na fazę | nie |
| H-5 | SUPLEMENTACJA 20:15: „kreatyna … z węglowodanami z banana”. W czwartek banana nie ma. | Kreatyna codziennie o 20:15; w czwartek opis dawki bez odniesienia do banana | nie |
| H-6 | Pliki do testów migracji | Proszę przesłać do rozmowy: eksport ZAPASY (JSON) oraz z CFA v3 „Zapisz postęp do pliku” i „Zapisz do CSV” | Etap 4–5 (nie Etap 2) |
