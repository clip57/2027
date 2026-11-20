# Raport D-116 — studia wg harmonogramu, plan MPW od 20.11, nowy plan CFA Level I 2027, kalendarz do 30.06.2027

Polecenie użytkownika (20.11.2026), dosłownie: „1. Pozostaw godziny 8.00-15.23. 2. Usuń z tego dnia rozmowe kwalifikacyjna 3. Dostosuj numeracje
do przeslanego harmonogramu i zapomnij o poprzednich datach 4. 20-21.03 nie traktuj jako zjazd, bo mnie na nim nie będzie - pozostaje wtedy nauka MPW
i egzamin 5. Przedłuż kalendarz aplikacji do końca czerwca. Zastosuj dotychczasowe schematy treningu, diety itd. I tak będziemy je pozniej dostosowywac.
6. Zignoruj kwestie seminarium. Ponadto przesyłam zaktualizowane plany MPW i CFA. MPW to zmiana kosmetyczne bo tylko przesuniecie rozpoczecia na 20.11
i dodanie bloków w dniach 24-27.12, ale CFA to zupełnie nowy plan w nowych datach. Zaimplementuj wszystko.”

Pliki użytkownika (poza repozytorium): harmonogram studiów (PDF), `MASTERSCHEDULE_MPW.csv`, `MASTER_SCHEDULE_CFA_451.csv`.
Dane wygenerowane skryptem decyzji `tools/extract/plan_d116.py <mpw.csv> <cfa.csv>` (idempotentny — drugie uruchomienie niczego nie zmienia).

**Bez zmian modelu danych:** typy zdarzeń, klucze, baza (`p2027`, wersja 1), `reduce()`, format `2027-sync.json`, synchronizacja — bez zmian.
Zmieniła się tylko generacja numeracji bloków CFA (`CFA_PLAN_VERSION` 15 → 16 — mechanizm z D-098/D-103): odhaczenia planu V44 zostają
w bazie i w synchronizacji, ale nie liczą się w nowym planie (numery bloków oznaczają w nim inne bloki).

## 1. Co zrobione

| Punkt polecenia | Wykonanie |
|---|---|
| 1. Godziny 8:00–15:23 | Zjazdy w slotach A–G (8:00–15:23), jak dotąd. Zjazd ma pierwszeństwo przed blokiem CFA w tych godzinach — blok jest wtedy opisany w slocie („kolizja z planem CFA: blok …”). |
| 2. Rozmowa kwalifikacyjna | Usunięta z 28–29.11 (w tym terminie zjazd II online). Rozmowa 21–22.11 bez zmian. |
| 3. Numeracja wg harmonogramu | Zjazdy I (14–15.11), II online (28–29.11), III online (09–10.01), IV (06–07.02), V (20–21.02), VII (03–04.04), VIII online (24–25.04), IX (08–09.05), X (29–30.05); egzamin końcowy online 05.06; obrony online 21–22.06. Dawne daty studiów usunięte (m.in. 05–06.12). |
| 4. 20–21.03 | Bez zjazdu VI: 20.03 — powtórka MPW (P1–P7 + A–C), 21.03 — egzamin MPW. |
| 5. Kalendarz do 30.06.2027 | `phases.json`: koniec 30.06.2027; Faza 2 do końca; tydzień bazowy (trening, dieta T/NT, sauna, basen, zakupy w czwartki) i preparaty czasowe do 30.06. Czwartki: wariant „czwartek_st” (zakupy 15:30, MPW +30 min, dawki przed sauną 17:45) tylko do 18.03 (ostatni czwartek MPW); od 25.03 zwykły czwartek (sauna 17:55, zakupy 19:05, dawki 17:15). |
| 6. Seminarium | Pominięte. |
| Plan MPW | Start 20.11 (zamiast 16.11) — daty bloków z okresu 16.11–23.12 przesunięte o 4 dni; bloki także 24–27.12 (święta: bez treningu, po południu MPW); dni wolne tylko 19–20.02. 392 bloki, 119 dni, egzamin 21.03.2027 11:00 bez zmian. W 16 zadaniach odsyłacz „blok luki 21.12” → „25.12” (jak w CSV). |
| Plan CFA | Nowy plan **CFA Level I 2027** (`CFA_L1_2027_451_20261120`): 451 bloków, 151 dni, 20.11.2026–12.05.2027, 398,38 h netto; lektura Curriculum 2027 (311), pierwsze podejście do banku (70), powtórki (40), 2 mocki × 2 sesje (18 bloków SYMULACJA: 18.04, 01.05, 06–07.05) i analiza (12). 10 działów (strony i daty z CSV). Litery B–I = sloty szablonu dnia, **J 21:00–21:53** (88 bloków, wieczór jak w D-099), **blok dodatkowy 17:40–18:33** (53 bloki, od 19.02 i od 22.03). Bez sesji recall 22:00 i bez sesji mocka S1/S2 w planie dnia (mocki to zwykłe bloki). Zadania bloków — część osobna jak w MPW (`plan-cfa.<hash>.json`). |

## 2. Zmiany w kodzie

- **Plan dnia (`resolver.js`)** — dwa plany nauki naraz: kolejność slotu nauki: stałe zdarzenie weekendu (studia, egzamin — z opisem kolizji) →
  blok CFA → blok MPW w slocie (P1–P7, czwartki st) → czas bloków MPW A–C („Nauka MPW”) → pozostałe zdarzenia weekendu (praca magisterska,
  rozmowa, święta) w swoich slotach → „Czas własny”. Blok dodatkowy jako osobny slot (`slot.cfa.Dodatkowy`, tytuł „CFA — blok dodatkowy”);
  w dni bez treningu okno „Wolne” przycinane wokół bloku. Recall 22:00 tylko, gdy plan go ma (`nightRecall`). `inValidity` — `until` opcjonalne.
- **Zakładki** (`registry.js`): CFA — do 11.11.2026 i od 22.03.2027 (zakres „poza oknem”: `tabFrom > tabUntil`), MPW — 12.11.2026–21.03.2027.
  W okresie obu planów CFA jest w „Więcej” (i w planie dnia); pasek można zmienić w Ustawieniach.
- **Dziś**: w okresie obu planów kafel **„Nauka”** (bloki CFA + MPW, podpowiedź „CFA a/b · MPW c/d”), karty planów CFA i MPW obok siebie;
  kafel CFA przed startem planu — „od 20.11” (jak MPW). Bez dopisku „bez recall”, gdy plan nie ma recall.
- **Moduł CFA**: tryby planu 2027 (LEKTURA, PIERWSZE PODEJŚCIE, POWTÓRKA, SYMULACJA, ANALIZA), działy z pola `topic`, „X dni do końca planu”
  i wiersz „Egzamin: termin do uzupełnienia” (data egzaminu nieznana), zadania bloku wczytywane osobno, bez sekcji recall.
- **Wymaga uwagi**: zaległe CFA do końca planu CFA (bez daty egzaminu); „Koniec preparatów czasowych” liczony per preparat (zmiana godziny
  dawki czwartkowej nie jest już fałszywym „końcem preparatu” — dotyczyło też 06.01).
- **Pakiet aplikacji** (`plan-split.js`): kolumny analityczne CSV CFA poza pakietem; zadania CFA w osobnej części (69 KB).
- **Wygląd**: „Zadania bloku” (MPW i CFA) — cel dotykowy 44 px (`instrument.css`; wcześniej 32 px — wykrył test celów dotykowych).
- **Narzędzia**: `plan_check.mjs` — plany bez recall, tryb SYMULACJA, kolizje ze zjazdem i blok dodatkowy (D1) jako ostrzeżenia;
  `cfa_smoke.py` — dni z J, z blokiem dodatkowym, dzień zjazdu.

## 3. Kolizje i sprawy do decyzji użytkownika

1. **Termin egzaminu CFA** — plan kończy się 12.05.2027, w CSV nie ma daty egzaminu (`cfa.json`: `exam = null`). Moduł pokazuje „dni do końca planu”.
2. **08–09.05 (zjazd IX) × bloki CFA B–G** (12 bloków, w tym symulacja 06–07.05 nie koliduje) — wygrywa zjazd; bloki są w opisie slotów, w module CFA
   do odhaczenia. Do przeniesienia albo akceptacji.
3. **Blok dodatkowy 17:40–18:33** (53 dni: 19.02 i od 22.03 do 12.05) nakłada się na okno treningowe od 17:45 (transport, rozgrzewka, trening,
   sauna, basen). W tych godzinach karta „Teraz” pokazuje trening. To ta sama sprawa co otwarta decyzja **D1** (popołudnie).
4. **Weekendy z pracą magisterską (12–13.12, 19–20.12, 02–03.01, 16–17.01, 23–24.01, 30–31.01, 13–14.02, 27–28.02) i rozmowa 21–22.11** —
   bloki CFA E–G (12:20–15:23) zajmują swoje sloty; praca magisterska / rozmowa zostają w slotach A–D. Do potwierdzenia.
5. **Wielkanoc 27–28.03** — bez treningu, ale z blokami CFA E–I i dodatkowym (wg planu).
6. **Suplementy czasowe** — zapas z D-015 (chondroityna 360, glukozamina 180, boswellia 180 kaps.) wystarczał na 180 dni; plan ma teraz 256 dni
   (18.10.2026–30.06.2027): potrzeba 512 / 256 / 256 kapsułek. Zapasy pokażą brak — do dokupienia.
7. **Święta po 28.03** nie są dniami wolnymi (Poniedziałek Wielkanocny 29.03, 01.05, 03.05, Boże Ciało 27.05) — trening i dieta wg tygodnia bazowego.
8. **Obrony** — oznaczone 21 i 22.06 („wg przydziału”). Po przydziale zostanie jeden dzień.
9. **Historia 16.10–19.11** — plan V44 nie jest już w danych: minione dni nie mają bloków CFA ani recall, a dni, które miały blok M,
   pokazują saunę wg tygodnia bazowego (historia zapisanych treningów i dawek bez zmian). Notatki wyjątków 22–23.10 i 01–11.11 nadal wspominają bloki K/L/M (tekst historyczny).

## 4. Testy

| Zestaw | Wynik |
|---|---|
| `npm run lint`, `npm run typecheck` | bez błędów |
| `npm test` (jednostkowe) | 280 / 280 — `plan-cfa.test.mjs` napisany od nowa dla planu 2027; dostosowane: resolver, plan-mpw, recall, ics, attention, cfa-pace, consumption, diet-supp, plan-split, sync (R2), week, care |
| `node tools/verify/plan_check.mjs` | 0 błędów, 9 ostrzeżeń (termin egzaminu, kolizja 08–09.05 × B–G, blok dodatkowy × okno treningowe — D1) |
| `python3 tests/e2e/cfa_smoke.py` | 0 błędów (191 bloków — „Teraz” w środku bloku wskazuje blok) |
| `npm run e2e` | 1716 / 1716 |
| `npm run a11y` | 0 naruszeń |
| `npm run e2e:trening` | zaliczone |
| `npm run e2e:sync` | 23 / 23 |
| `npm run e2e:cloud` | 100 / 100 |
| `npm run e2e:webkit` | 243 / 243 |
| `npm run budget` | 9 / 9 (JS 1161 KB / gzip 293 KB, `2027.html` 1671 KB, start przy 50 tys. zdarzeń 1120 ms) |

Testy E2E sprawdzające CFA działają na zegarze w okresie planu 2027 (24.11 / 26.11); recall usunięty z testów (plan go nie ma).
`npm run verify` wymaga plików źródłowych (`SOURCES_DIR`) — nie uruchamiany.
