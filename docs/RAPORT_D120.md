# Raport D-120 — godziny nauki CFA i MPW dopasowane do planu dnia, symulacje MPW, dni bez treningu, „Praca”

Decyzje użytkownika z 23.11.2026 (po dwóch rundach analizy kolizji w czacie, model sprawdzony przed wdrożeniem). Pliki planów (`cfa.json`, `mpw.json`
— kopie plików użytkownika) **bez zmian**; nowe daty i godziny bloków zapisuje skrypt decyzji `tools/extract/plan_d120.py` w `week.json` →
`studyMoves`, a aplikacja stosuje je przy wczytaniu (`src/core/data.js`, jak przesunięcie czwartków D-097). Decyzja obowiązuje **od 23.11.2026** —
dni minione (20–22.11) bez zmian. Odhaczenia (`cfa.done`, `mpw.done`) wiążą się z numerem bloku — po przesunięciu zostają przy swoich blokach.

## 1. Reguły

| Dni | Wdrożenie |
|---|---|
| **Dni robocze z MPW** | A 15:30–16:23, **B 16:40–17:33** (po przerwie obiadowej — w planie było 16:30, w trakcie obiadu), **C 22:00–22:53**; gdy tego dnia jest **CFA J** o 21:00: **MPW C 21:00, CFA J 22:00** |
| **Dni robocze z blokiem dodatkowym CFA** (19.02, 22.03–12.05) | **blok dodatkowy 21:00–21:53** (w miejscu J — ciągłość materiału), **J 22:00–22:53** — okno treningowe wolne (D1 rozwiązane) |
| **Czwartki z zakupami** (07.01–11.03) | MPW 16:00 / 17:00 / 18:00 bez zmian (D-097), **CFA J 22:00**, **relaks z kolacją 21:00–21:53** |
| **Weekendy** | wszystkie bloki CFA i MPW **o jeden slot wcześniej** (CFA od 11:20 zamiast 12:20; MPW 14:30, 15:30, 16:40) — weekend kończy się przed treningiem i basenem |
| **Praca dyplomowa** (12.12–28.02, 16 dni) | **08:00–11:03** (o jeden blok krócej), nazwa **„Pisanie pracy dyplomowej”** (nagłówek dnia „Praca dyplomowa 8:00–11:03”) |
| **Weekendy zjazdowe** (28–29.11, 09–10.01, 06–07.02, 03–04.04, 24–25.04) | sobota: 15:30, 16:40; **ostatni blok soboty → niedziela 15:30**; niedziela: 16:40, 21:00, 22:00 (chronologicznie); niedziela z blokiem o 21:00 — wieczór: relaks 19:45–20:05, prysznic 20:05–20:35, przygotowanie kolacji 20:35–20:50, **kolacja 20:50–21:00** |
| **21.02** (niedziela, zjazd) | **symulacja 16:40–19:40**, bez basenu, **dieta NT, bez sesji**; zmywanie 19:40–19:52, relaks z białkiem (dieta NT) 19:52–20:15 |
| **27.02** (sobota) | **symulacja 11:20–14:20**, lunch 14:20–14:30, CFA E 14:30, F 15:30, G 16:40; dawki lunchu 14:20 |
| **06.03 i 13.03** (soboty) | P1–P5 bez zmian, **symulacja 13:30–16:30**, przygotowanie obiadu 16:30, obiad 16:45, **P6 17:00–17:53**, zmywanie 17:53, **siłownia 18:00–20:30** (LOWER 2 18:30–19:50, sauna 20:00–20:20), posiłek 20:30 (kreatyna 20:30), mycie głowy 20:40–20:45, relaks z kolacją 21:00–21:53, **P7 22:00–22:53** |
| **07.03 i 14.03** | P1–P7 bez zmian, A 15:30, B 16:40, **C 22:00** |
| **17.03** (środa) | **symulacja 16:40–19:40**, bez roweru i sauny, **dieta NT, bez sesji**; zmywanie 19:40, czas wolny z białkiem 19:52–20:35 |
| **20.03** (sobota przed egzaminem) | P1–P7, A 15:30, B 16:40, zmywanie 17:33–17:40, **C 17:40–18:33**, czas wolny 18:33–20:15, białko 20:15; **bez siłowni, dieta NT** |
| **Dni wolne** (26–27.12, 27–28.03) | blok nauki ma pierwszeństwo — kolidująca godzina „Wolne” usunięta |
| **Dni robocze 2027** | „Czas własny” 08:00–15:23 → **„Praca”**; poza świętami: 01.01, 06.01, 29.03, 03.05, 27.05, 01.11, 11.11, 24.12 |

Dieta NT w dzień bez sauny (dni bez treningu, święta) — posiłek „po treningu” z planu diety NT (białko WPC 30 g) zostaje i nazywa się
„Białko (dieta NT)” (dotąd „Posiłek po saunie”). Suplementy: godziny bez zmian, poza dawkami przy przesuniętych posiłkach (kreatyna, chondroityna,
dawki lunchu 27.02). Dawka 22:00 (glicyna, magnez, melatonina) wypada w trakcie bloku 22:00–22:53 — bez zmian, do decyzji użytkownika.

## 2. Wdrożenie

- `tools/extract/plan_d120.py` (idempotentny): `week.studyMoves` (CFA 255 bloków, MPW 241), wyjątki dat 21.02, 27.02, 06.03, 13.03, 17.03, 20.03
  (dzień bez treningu, wariant dnia, `doseTimes`), praca dyplomowa (`until: '11:03'`), `week.work` („Praca”), warianty dnia `d120_*` w
  `day_template.json` (kopie slotów szablonu z nowymi godzinami — zadania, posiłki i role bez zmian).
- `src/core/data.js`: przesunięcia przy wczytaniu — `SRC.cfa.D.bloki`, `SRC.mpw.D.bloki`, `cfaByDay`, `mpwByDay` są już przesunięte; plan z pliku w
  `godz_src` / `data_src`, `dzien` przeliczony.
- `src/core/resolver.js`: blok CFA w slocie **wg godziny początku** (nie litery); bloki CFA i MPW bez slotu nauki w swoich godzinach (21:00, 22:00) —
  sloty dodatkowe, które zastępują „Wieczór wolny” (zadanie „melisa” i dawki 22:00 przechodzą do slotu bloku); wieczór z kolacją 20:50, gdy
  jakikolwiek blok zaczyna się o 21:00 (`block21`); czwartek z J o 22:00 — relaks z kolacją do 21:53; „Praca”; `doseTimes` z wyjątku dnia;
  niedziela z basenem przy bloku o 21:00 — 10 min oddaje relaks (posiłek po basenie bez zmian).
- `src/core/ics.js`: symulacja jako jedno wydarzenie z godzin bloków symulacji, pozostałe bloki dnia osobno; numer bloku w UID, gdy litera powtarza
  się w dniu. `src/core/calc/mpw.js` i „Dziś”: zakres godzin dnia z najwcześniejszego i najpóźniejszego bloku (bloki nie muszą iść po kolei).
- `src/modules/mpw.js`: opis godzin bloków i symulacji w widoku „Plan”.
- Kontrola **każdego dnia do 31.12.2027**: `tools/verify/day_check.mjs` (ciągłość doby 07:00–23:00 bez dziur i nakładek, każdy blok w dokładnie
  jednym slocie o swojej godzinie, karta „Teraz” w każdej minucie bloku, kolacja nie w trakcie bloku, każda dawka w slocie) — w CI obok `plan_check`.
- `tools/export_plans_csv.mjs`: pliki CSV planów w układzie plików użytkownika, z godzinami jak w aplikacji, i plik zmian.

## 3. Kolacja względem bloków (dni 23.11.2026–31.12.2027)

Żadnego dnia kolacja nie wypada w trakcie bloku. Kolacja 21:00–21:45 (relaks) — 309 dni; **krótka kolacja 20:50–21:00 przed blokiem o 21:00 — 83 dni**
(39 dni roboczych z CFA J i MPW C 04.01–12.03, 39 dni z blokiem dodatkowym CFA, 5 niedziel zjazdowych); relaks z kolacją 21:00–21:53 — 12 dni
(czwartki 07.01–11.03, 06.03, 13.03).

## 4. Pliki CSV (dla użytkownika, poza repozytorium)

`MASTER_SCHEDULE_MPW_D120.csv` (392 bloki, kolumny pliku MPW), `MASTER_SCHEDULE_CFA_451_D120.csv` (451 bloków, kolumny pliku CFA; odsyłacze do
bloków MPW z nowymi datami), `ZMIANY_GODZIN_D120.csv` (529 zmian: CFA 255 i MPW 241 — D-120, MPW 33 — czwartki D-097). Kodowanie UTF-8 z BOM,
przecinek — jak pliki wgrane wcześniej.

## 5. Testy (23.11.2026, lokalnie)

| Zestaw | Wynik |
|---|---|
| `npm run lint`, `npm run typecheck` | bez błędów |
| `npm test` | 298 / 298 (nowy `d120.test.mjs` 6; zaktualizowane testy planów, resolvera i `.ics` — godziny wg D-120) |
| `node tools/verify/plan_check.mjs` | 0 błędów, **0 ostrzeżeń** (dotąd 2 ostrzeżenia D1 — rozwiązane) |
| `node tools/verify/day_check.mjs` (nowy, w CI) | 404 dni (23.11.2026–31.12.2027), 0 błędów |
| `python3 tests/e2e/cfa_smoke.py`, `verify_all.py --data-only`, `npm run e2e:trening` | 0 błędów |
| `npm run e2e` | 1758 / 1758 (nowe kontrole D-120 w `run_d119`) |
| `npm run a11y` | 0 naruszeń |
| `npm run e2e:webkit` | 249 / 249 |
| `npm run e2e:sync` / `npm run e2e:cloud` | 23 / 23 · 100 / 100 |
| `npm run budget` | 9 / 9 — pakiet JS 1049 KB (gzip 251 KB; +26 KB — mapa przesunięć i warianty dnia), start przy 50 tys. zdarzeń ok. 900 ms |
