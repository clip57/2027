# Raport D-121 — nowy początek planu: Dzień zero 23.11.2026, czysta karta od dziś

Decyzje użytkownika z 23.11.2026 (po ocenie wykonalności i potwierdzeniu chronologii w czacie). Skrypt decyzji: `tools/extract/plan_d121.py`
(idempotentny — najpierw uruchamia `plan_d120.py`, potem nakłada D-121). Pliki planów (`cfa.json`, `mpw.json`) — bez zmian.
**Bez zmian modelu danych:** typy zdarzeń, klucze, baza, `reduce()`, format `2027-sync.json`, synchronizacja. Zdarzenia z dni sprzed startu
zostają w dzienniku (eksport, synchronizacja) — widoki ich nie pokazują.

## 1. Reguły

| Obszar | Wdrożenie |
|---|---|
| **Początek planu** | `phases.json`: `start` = `zero` = **23.11.2026** (Dzień zero, poniedziałek); `realStart`, `dietStart`, `trainStart` = **24.11.2026**; **Faza 0 24.11–06.12, Faza 1 07.12–10.01, Faza 2 od 11.01.2027** do końca kalendarza (31.12.2027) |
| **Dzień zero** | dzień planu (`zero: true`): **bez diety, suplementów i treningu** (UPPER 1 odwołany), bez zużycia w Zapasach; **nauka CFA i MPW wg planu**; **pielęgnacja tylko wieczorna**; w pasku górnym „Dzień zero”, potem „dzień 1 z 403” |
| **Historia** | dni sprzed 23.11 — poza planem, **ukryte we wszystkich modułach**: Dziś, Kalendarz, Tydzień, Trening (historia, statystyki, podpowiedzi „ostatnio” — od 24.11), Pielęgnacja (kroki, macierz, „Użyty N×”), Nauka (tempo — odhaczenia z datą sprzed startu pomijane), Zapasy (wykres stanu — bez punktów sprzed startu), Suplementacja (regularność od startu). Wyjątki dat i bloki weekendów sprzed 23.11 (zjazd I, rozmowa, dni bez treningu października i listopada) **usunięte z `week.json`** |
| **Nauka — chronologia** | materiał z 20.11 w Dniu zero; każdy blok kolejno w następne miejsce planu (kolejność numerów = kolejność dat i godzin). Zaległe 9 bloków: **MPW rano 14–16.12** (08:00, 09:10, 10:10), **CFA rano 17–18.12 i 24.12**; **24.12 bloki MPW 12:20, 13:30, 14:30**. Wyrównanie z planem D-120: **MPW od popołudnia 16.12, CFA od 25.12** (dalej bez zmian; 06.03 i 13.03 P7 o 22:00 po symulacji — D-120). `week.studyMoves`: CFA 333, MPW 269 bloków |
| **Dni bez treningu** | **12.12** (LOWER 2) i **24.12** (sauna, bez zakupów) — dieta NT, bez sesji; 23.11 — Dzień zero |
| **Suplementy czasowe** | chondroityna (07:00, 21:00), boswellia (09:00), glukozamina (13:20) **24.11.2026–30.04.2027** (158 dni) |
| **Dawki prywatne** | plik użytkownika poza repozytorium: `{"format": "2027-private-doses", "version": 1, "doses": [{"id", "time", "name", "label", "from"?, "until"?, "weekdays"?, "note"?}]}`; import w **Dane → Wczytaj plik** (podgląd z listą dawek) → jedno ustawienie `supp.private` (istniejący typ `setting`; nowszy plik zastępuje listę; ten sam plik ponownie — bez zmian). Dawki w Suplementacji, w planie dnia (slot o swojej godzinie), odhaczanie jak dawki planu (`supp.dose:…|priv.<id>`), **bez Zapasów**, bez dawek w Dniu zero |
| **Pielęgnacja** | plan użytkownika: daty kroków przesunięte o 36 dni (plik prywatny, poza repozytorium — import w „Dane”; zmienione kroki zastępują poprzednie wersje) |
| **Rekompozycja i pakiet prywatny** | daty faz w `rekomp.json` (Faza 0 24.11–06.12, Faza 1 07.12–10.01, Faza 2 od 11.01) i w `UPGRADE` w `private_pack_lib.py` — pakiet prywatny trzeba zaktualizować skryptem (`python3 tools/extract/private_pack_lib.py <stary.json> <nowy.json>`), Diagnostyka danych to wskaże |

## 2. Wdrożenie

- `src/core/resolver.js`: Dzień zero jako dzień planu (`dayPlan`), dawki prywatne (`setPrivateDoses`, `validPrivateDose`, `PRIVATE_DOSES_KEY`).
- `src/core/data.js`: `D.stat.start` planów nauki = pierwszy przesunięty blok (`start_src` — data z pliku).
- `src/core/calc/care.js` (Dzień zero — wieczór; dni sprzed startu bez kroków), `calc/tempo.js`, `calc/consumption.js` (bez dawek prywatnych), `calc/supplements.js` (nazwa dawki prywatnej).
- `src/core/sync/bundle.js`: import pliku dawek prywatnych; `src/modules/dane.js`: podgląd importu; `src/app.js`: dawki prywatne przed rysowaniem, licznik „Dzień zero”.
- `src/modules/{dzis,pielegnacja,zapasy}.js`; `src/core/migrate/cfa.js` (import postępu — data planu z pliku); `src/ui/instrument.css` (lista dawek w podglądzie).
- Narzędzia: `tools/extract/plan_d121.py` (nowy), `rekomp_common.py`, `private_pack_lib.py`; `tools/verify/plan_check.mjs`, `verify_all.py` (Dzień zero);
  `tools/export_plans_csv.mjs` (pliki `*_D121.csv`).
- Testy: nowy `tests/unit/d121.test.mjs`; testy jednostkowe i E2E przepisane na daty od 23.11.2026 (zegar E2E 30.11.2026; bloki CFA w E2E przez
  `_moved()` jak w `data.js`); testy wyjątków sprzed startu (22.10, 29.10, 05.11, 01–11.11, zjazd I) zastąpione testami D-121.

## 3. Testy (23.11.2026, lokalnie)

| Zestaw | Wynik |
|---|---|
| `npm run lint`, `npm run typecheck` | bez błędów |
| `npm test` | 302 / 302 (nowy `d121.test.mjs` 4; 23 pliki zaktualizowane) |
| `node tools/verify/plan_check.mjs`, `day_check.mjs` | 0 błędów, 0 ostrzeżeń · 404 dni (23.11.2026–31.12.2027), 0 błędów |
| `python3 tests/e2e/cfa_smoke.py`, `verify_all.py --data-only`, `npm run e2e:trening` | 0 błędów |
| `npm run e2e` | 1778 / 1778 |
| `npm run a11y` | 0 naruszeń |
| `npm run e2e:webkit` | 249 / 249 |
| `npm run e2e:sync` / `npm run e2e:cloud` | 23 / 23 · 100 / 100 |
| `npm run budget` | 9 / 9 — pakiet JS 1051 KB (gzip 252 KB), start przy 50 tys. zdarzeń ok. 870 ms |

## 4. Ograniczenia

- Odhaczenia bloków nauki są przypisane do numerów bloków (materiału) — blok odhaczony przed 23.11 zostaje odhaczony (materiał zrobiony); nie liczy
  się do szacunku tempa. Cofnięcie — przyciskiem przy bloku.
- Pakiet prywatny z datami faz sprzed D-121 — do aktualizacji skryptem `private_pack_lib.py` (plik użytkownika, poza repozytorium).
- Pliki dawek prywatnych i pielęgnacji przygotowane dla użytkownika w czacie — nie są częścią repozytorium.
