# Plan CFA V44 (od 16.10), kalendarz, trening i zakupy (D-103) — raport (16.10.2026)

Rejestr: `docs/DECYZJE_2027.md` → D-103. Dane: `tools/extract/day_plan_d103.py` (idempotentny: `phases.json`, `week.json`, `day_template.json`), plan CFA: `tools/extract/extract_static.mjs`
(kontrola krzyżowa z `MASTER_CFA_FINAL_V44.csv`: zgodne, 313 wierszy, 13 wspólnych kolumn). Kontrola spójności: `node tools/verify/plan_check.mjs`, test dymny: `python3 tests/e2e/cfa_smoke.py`.

## 1. Zlecenie (polecenia użytkownika 16.10.2026)
| Obszar | Decyzja |
|---|---|
| Plan CFA | `PLAN_CFA_FINAL_V44.html` — 313 bloków od 16.10 do 11.11 (SchweserNotes 2026 + Practice CFA + Curriculum Ethics) |
| Treningi i fazy | treningi od **17.10** (16.10 dzień nietreningowy, dieta NT); Faza 0 do 11.11 (treningi 17.10–02.11, 03–11.11 bez treningu z dietą nietreningową Fazy 0); Faza 1 **12.11–10.12**, Faza 2 od **11.12** |
| Dni z blokiem M | trening skrócony do 18:15–19:15, „Powrót do domu” 19:15–19:25, „Prysznic i mycie głowy” 19:25–19:40; posiłek potreningowy **19:15** zamiast 20:15; reszta bez zmian |
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
- **Skutki w dniach z blokiem M (13 dni, 17.10–02.11):** nie ma sauny ani chłodzenia (nie mieszczą się przed blokiem M), etykieta dnia bez „+ sauna”, notatka dnia „Bez sauny: blok M o 19:40”. Kroki z usuniętych slotów (woda z sodem, przebranie, prysznic, pielęgnacja po basenie) przeniesione do nowych slotów.

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
1. **Sauna w dni treningowe z blokiem M** (pn, śr, sob: 17.10, 19.10, 21.10, 24.10, 26.10, 28.10, 31.10, 02.11): polecenie nie wymieniało sauny, a slot 19:45–20:05 koliduje z blokiem M — sauna odpada. Przywrócenie wymaga decyzji, gdzie ją zmieścić.
2. **23.10 (piątek):** plan ma K 17:40–18:33 i L 18:40–19:33 w całym oknie treningowym, bez M, J i recallu. Przyjęto dzień bez treningu (dieta NT). Jeśli UPPER 2 ma się odbyć, potrzebne są godziny.
3. **Czwartki 22/29.10:** zostaje posiłek 20:15 (w trakcie bloku M, jak w D-101) pod nazwą „Posiłek po saunie”, choć sauny nie ma (nazwa pochodzi z diety NT); dawki przed sauną (kolagen, witamina C, tauryna 17:15) zostają bez zmian.
4. **Posiłek 19:15 w dni K/L/M bez treningu (03–11.11):** zostaje 20:15 w trakcie bloku M (blok L trwa do 19:33, więc 19:15 byłoby w środku L).
5. **Dawki 17:15 (przedtreningowe)** pokazują się także w dniach bez treningu (16.10, 22.10, 23.10, 25.12) — tak jak dotąd w dniach 03–11.11 i 26–27.12.
6. Teksty Rekompozycji o kreatynie „codziennie o 20:15” nie są zmieniane (w dniach z blokiem M aplikacja pokazuje 19:15).

## 6. Do zrobienia
- **E2E (`tests/e2e/e2e.py`):** nadal przestarzały (zegar 05.10, dzień mocka 30.10, setki wartości kalendarza V3). Poprawiony tylko błąd selektora w linii 94. Migracja na kalendarz V44 to osobne zadanie.
- **`tools/verify/verify_all.py`:** kontrole CFA nadal dla v9 (400 bloków, mocki 30.10) — wymaga przepisania i plików źródłowych użytkownika.
- Publikacja: commit, push i wdrożenie na `main` wyłącznie na polecenie użytkownika.
