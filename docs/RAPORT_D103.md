# Plan CFA V44 (od 16.10), kalendarz, trening i zakupy (D-103) — raport (16.10.2026)

Rejestr: `docs/DECYZJE_2027.md` → D-103. Dane: `tools/extract/day_plan_d103.py` (idempotentny: `phases.json`, `week.json`, `day_template.json`), plan CFA: `tools/extract/extract_static.mjs`
(kontrola krzyżowa z `MASTER_CFA_FINAL_V44.csv`: zgodne, 313 wierszy, 13 wspólnych kolumn). Kontrola spójności: `node tools/verify/plan_check.mjs`, test dymny: `python3 tests/e2e/cfa_smoke.py`.

## 1. Zlecenie (polecenia użytkownika 16.10.2026)
| Obszar | Decyzja |
|---|---|
| Plan CFA | `PLAN_CFA_FINAL_V44.html` — 313 bloków od 16.10 do 11.11 (SchweserNotes 2026 + Practice CFA + Curriculum Ethics) |
| Treningi i fazy | treningi od **17.10** (16.10 dzień nietreningowy, dieta NT); Faza 0 do 11.11 (treningi 17.10–02.11, 03–11.11 bez treningu z dietą nietreningową Fazy 0); Faza 1 **12.11–10.12**, Faza 2 od **11.12** |
| Dni z blokiem M (do D-103b: 13 dni) | trening skrócony do 18:15–19:15, „Powrót do domu” 19:15–19:25, „Prysznic i mycie głowy” 19:25–19:40; posiłek potreningowy **19:15** zamiast 20:15; reszta bez zmian |
| Czwartki 22.10 i 29.10 (blok L i M) | bez sauny; zakupy 17:45–18:40; wieczorne mycie głowy w przerwie między blokami 19:33–19:40 |
| 03–11.11 | bez treningu, dieta nietreningowa Fazy 0 |
| Święta | 25.12 bez treningu — dzień całkowicie wolny jak 26.12 i 27.12; 24.12 bez zakupów |

## 2. Plan CFA V44 względem V3
| | V3 (D-101) | V44 |
|---|---|---|
| Okres / bloki | 13.10–11.11, 326 (30 dni) | 16.10–11.11, 313 (27 dni: 2×9 + 14×11 + 2×12 + 9×13) |
| Blok J 21:00–21:53, M 19:40–20:33 | J poza 15/23/25.10; M tylko 22/29.10 i 03–11.11 | **J i M poza 16/23/25.10** — M także w dni treningowe |
| K 17:40, L 18:40 | 03–11.11 | 23.10 i 03–11.11; L także 22.10 i 29.10 |
| Kategorie | Curriculum 265, Practice 61 | **SchweserNotes 118**, Practice CFA 157, Curriculum 38 |
| Tryby | FIRST PASS 265, PRACTICE, MOCK 18, ANALIZA 12 | **CZYTANIE 151**, PRACTICE 127, DOPRECYZOWANIE 5, MOCK 18, ANALIZA 12 |
| Practice | 31 bloków | 127 bloków, 1958 pozycji banku (każda raz) |
| Mocki | 06.11, 08.11, 10.11 | 04.11, 05.11, 10.11 |
| Recall 22:00 | 27 dni | 25 dni (poza 23.10 i 25.10) + 5 sesji A–E 12.11 |
| Godziny | — | 301 h (z recall i mockami) |

## 3. Zmiany
- **Dane:** `cfa.json` (V44), `phases.json` (`trainStart` 17.10, fazy 15.10 / 12.11 / 11.12), `week.json` (wyjątki 16.10, 22.10, 23.10, 29.10, 24.12, 25.12 + bloki weekendowe 25.12), `day_template.json` (warianty `czwartek_zl`, `czwartek_bz`, szablon `mTraining`), teksty faz w `rekomp.json` i `rekomp_common.py`, reguły `UPGRADE` pakietu prywatnego.
- **Kod:** `CFA_PLAN_VERSION` 14 → **15** (nowa numeracja, odhaczenia z V3 nie liczą się, zostają w bazie); `resolver.js`: `mTrainDay`, `trainingBeforeM`, `trimTrainWindow`, godziny dawek (kreatyna 19:15); `cfa.js`: postęp działów wg pola `topic` (CZYTANIE), klasy trybów CZYTANIE i DOPRECYZOWANIE; `extract_static.mjs`: blokada na V44, kontrola krzyżowa wspólnych kolumn.
- **Poprawka wady widoku dnia** (wykryta przed wdrożeniem): w dniach z blokami K/L/M bez treningu slot „Wolne” z okna treningowego pokrywał bloki, więc karta „Teraz” pokazywała „Wolne” zamiast bloku K i M (03–11.11). Okno jest teraz pomniejszane o czas bloków. W czwartki 22/29.10 slot posiłku zaczyna się o 20:15 (godzina posiłku bez zmian), żeby „Teraz” wskazywało blok M.
- **Skutki w dniach z blokiem M (po D-103b 10 dni: 18–31.10; pierwotnie 13):** nie ma sauny ani chłodzenia (nie mieszczą się przed blokiem M), etykieta dnia bez „+ sauna”, notatka dnia „Bez sauny: blok M o 19:40”. Kroki z usuniętych slotów (woda z sodem, przebranie, prysznic, pielęgnacja po basenie) przeniesione do nowych slotów.

## 4. Weryfikacja
| Test | Wynik |
|---|---|
| Build | OK |
| Jednostkowe (`npm test`) | 211: **210 przechodzi, 0 błędów**, 1 pominięty (kopia ZAPASY z 22.09 — wymaga pliku użytkownika) |
| `plan_check.mjs` (spójność planu i resolvera, 28 dni) | **0 błędów**, 3 znane ostrzeżenia (nakładanie posiłku 20:15 na blok M w dni bez treningu — D-101; „Zmywanie” 17:33–17:45 ∩ K 17:40 — 5 min) |
| `cfa_smoke.py` (przeglądarka, zegar sztuczny) | **47 OK, 0 błędów**, w tym „Teraz” w środku 82 próbkowanych bloków |
| Ręcznie w aplikacji | „Teraz” o 18:30, 19:20, 19:30, 20:00, 20:40 (19.10), 17:50 / 19:36 / 20:00 (22.10), 18:00 / 19:50 (03.11), 18:00 (23.10): zawsze właściwy slot |
| a11y (`tests/e2e/a11y.py`, axe WCAG 2.1 A/AA, 390/1280 px, jasny/ciemny; zegar 19.10, dodane widoki 17.10, 18.10, 22.10, 23.10, 03.11, 24.12, 25.12) | **0 naruszeń**, brak przewijania poziomego |

## 5. Założenia do potwierdzenia
1. **Sauna w dni treningowe z blokiem M** (pn, śr, sob: 19.10, 21.10, 24.10, 26.10, 28.10, 31.10): polecenie nie wymieniało sauny, a slot 19:45–20:05 koliduje z blokiem M — sauna odpada. Przywrócenie wymaga decyzji, gdzie ją zmieścić.
2. **23.10 (piątek):** plan ma K 17:40–18:33 i L 18:40–19:33 w całym oknie treningowym, bez M, J i recallu. Przyjęto dzień bez treningu (dieta NT). Jeśli UPPER 2 ma się odbyć, potrzebne są godziny.
3. **Czwartki 22/29.10:** zostaje posiłek 20:15 (w trakcie bloku M, jak w D-101) pod nazwą „Posiłek po saunie”, choć sauny nie ma (nazwa pochodzi z diety NT); dawki przed sauną (kolagen, witamina C, tauryna 17:15) zostają bez zmian.
4. **Posiłek 19:15 w dni K/L/M bez treningu (03–11.11):** zostaje 20:15 w trakcie bloku M (blok L trwa do 19:33, więc 19:15 byłoby w środku L).
5. **Dawki 17:15 (przedtreningowe)** pokazują się także w dniach bez treningu (16.10, 22.10, 23.10, 25.12) — tak jak dotąd w dniach 03–11.11 i 26–27.12.
6. Teksty Rekompozycji o kreatynie „codziennie o 20:15” nie są zmieniane (w dniach z blokiem M aplikacja pokazuje 19:15).

## 6. Do zrobienia
- ~~**E2E (`tests/e2e/e2e.py`):** migracja na kalendarz V44~~ — **wykonane** (20.10.2026, commit „odśwież regresję E2E”; 23.10.2026: data syntetycznej kopii ZAPASY liczona od zegara testu `TODAY()`, nie od daty uruchomienia — wcześniej po 20.10 trzy kontrole Zapasów kończyły się błędem).
- ~~**`tools/verify/verify_all.py`:** kontrole CFA dla v9~~ — **wykonane** (kontrole V44: 313 bloków, 16.10–11.11; porównanie ze źródłami `PLAN_CFA_FINAL_V44.html`/`MASTER_CFA_FINAL_V44.csv` wymaga `SOURCES_DIR`).
- Wyniki 23.10.2026 (bez plików użytkownika, dane syntetyczne): `npm test` 214/215 (1 pominięty), `npm run e2e` 1386/1386, `npm run a11y` 0 naruszeń, `npm run e2e:sync` 23/23, `npm run e2e:cloud` 100/100, `cfa_smoke.py` i `trening_sheets.py` 0 błędów, `plan_check.mjs` 0 błędów (3 znane ostrzeżenia), `verify_all.py --data-only` 13 kontroli, 0 błędów, 1 pominięta.
- Publikacja: commit, push i wdrożenie na `main` wyłącznie na polecenie użytkownika.

## 7. Uzupełnienie D-103b (17.10.2026) — osobny patch `d103b.patch`
Polecenie: usunąć w ogóle dzień 15.10 z kalendarza, wyjątkowo usunąć treningi 17.10, 01.11 i 02.11 i ustalić wtedy dietę beztreningową. Dane: `tools/extract/day_plan_d103b.py` (uruchamiać po `day_plan_d103.py`).
- **15.10 usunięty:** plan, dieta i realny początek planu od **16.10** (`phases.json`), wyjątek 15.10 usunięty, okres chondroityny, boswellii i glukozaminy od 16.10 (164 dni planu, zapas 180/360/180 starcza z nadwyżką 16/32/16). Pierwsze zakupy planu: czwartek 22.10. Wariant `czwartek_k` (tylko dla 15.10) zostaje w szablonie jako nieużywany.
- **Bez treningu 17.10, 01.11 i 02.11:** wyjątki `free` z dietą NT Fazy 0, bez sauny i basenu (01.11 bez basenu). `trainStart` zostaje 17.10 (nominalny start), pierwszy trening to niedziela 18.10 (basen). Dni treningowe z blokiem M: 10 dni 18–31.10. W trzech nowych dniach bez treningu jest blok M (bez K/L), więc wieczór układa ten sam mechanizm co w innych dniach bez treningu: mycie głowy 19:30–19:40 tuż przed blokiem M, posiłek 20:15 w trakcie bloku, „Wolne” poza blokiem M i myciem.
- **Poprawka dawek (wykryta przy audycie):** kreatyna niedzielna o 19:30 (z posiłkiem po basenie) w dniach bez treningu trafia do posiłku 20:15. Wcześniej w wolną niedzielę z blokami L/M (08.11) dawka wpadała w slot bloku L i znikała z widoku dnia. Audyt całego planu: żadna dawka nie ginie.
- **Testy:** `npm test` 211: 210 przechodzi, 0 błędów, 1 pominięty; `plan_check.mjs` 0 błędów; zaktualizowane testy kalendarza, zużycia, zapasów, suplementów, ICS i tygodnia.

## 8. Uzupełnienia D-103c i D-104 (17.10.2026)
**D-103c — początek całego planu 18.10:** kalendarz, dieta, suplementy, zakupy i treningi od niedzieli 18.10 (basen); 15–17.10 poza planem, wyjątki dat 16–17.10 usunięte, suplementy od 18.10 (162 dni). Plan CFA V44 ma własny zakres od 16.10: bloki i recall z 16–17.10 zostają w module CFA (313 bloków), widok dnia to „Poza planem”. Pierwsze zakupy planu: 22.10.

**D-104 — skyr 75 g w śniadaniu i lunchu** (6 planów × 2 posiłki, 12 pozycji). Pozycja: 50 kcal, B 9,0, W 2,9, T 0 (z 67 kcal, 12,0, 3,8, 0 na 100 g; kcal zaokrąglone z 50,25).
| Plan | Dzień T (było → jest) | Dzień NT (było → jest) | Średnia tygodniowa (było → jest) |
|---|---|---|---|
| Faza 0 | 2629 → **2595** kcal | 2332 → **2298** kcal | 2587 → **2553** kcal |
| Faza 1 | 2784 → **2750** kcal | 2487 → **2453** kcal | 2742 → **2708** kcal |
| Faza 2 | 2965 → **2931** kcal | 2668 → **2634** kcal | 2923 → **2889** kcal |
Makro dnia T Fazy 0: B 190,5 → 184,5 g, W 267,9 → 266,1 g, T 78,0 g bez zmian (rozkład energii 30,1/42,3/27,7% → 29,5/42,5/28,0%). Śniadanie 629 → 612 kcal, lunch 465 → 448 kcal.
- **Zapasy:** zużycie dzienne skyru 150 g (było 200 g), limit zapasu 12 dni = 1800 g (było 2400 g), opakowanie 400 g bez zmian (starcza na ok. 2,7 dnia); prognozy, lista zakupów, meal prep i paragony liczą z danych diety.
- **Rekompozycja:** tabele składu dni T i NT, zestawienia energii i makro, „Kaloryczność startowa”, wyliczone pochodne w zdaniach (różnica względem punktu wyjścia 179 → 213 kcal; deficyt względem TDEE ~6/7/6% → ~7/8/7%), zdania o 100 g skyru. Formuły sprawdzone: na starych danych odtwarzają stare tabele bez żadnej różnicy.
- **Meal prep i przewodnik:** „Dodaj skyr {skyr}” (75 g z planu), 75 g produktu chłodzonego, skyr 400 g ≈ 2,7 dnia.
- **Do przejrzenia:** prywatne akapity pakietu z wartościami diety (reguły `UPGRADE` zamieniają tylko znane zdania); sprawdzić, czy 75 g skyru nie zmienia zamierzonego białka (−6,0 g dziennie, 2,18 → 2,11 g/kg w dniu T Fazy 0).
- **Testy:** `npm test` 213: 212 przechodzi, 0 błędów, 1 pominięty (kopia ZAPASY z 22.09); nowe: test D-104 (sumy 6 planów, zużycie, limit zapasu), test prognozy i listy zakupów skyru oraz kontrola zgodności tabel Rekompozycji z `diet.json`; test dymny w przeglądarce 47 OK, 0 błędów; kontrola dostępności widoków (dzień, Dieta, Zapasy, Meal Prep, Rekompozycja, Kalendarz) 0 naruszeń; `plan_check.mjs` 0 błędów.
