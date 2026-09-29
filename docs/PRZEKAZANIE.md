# Przekazanie projektu — stan na 29.09.2026 (po D-097)

Dokument dla kolejnej instancji Claude Code. Zawiera to, czego nie da się wywnioskować z kodu: sposób pracy z użytkownikiem,
stan wdrożenia, niedokończone zadania i pliki spoza repozytorium. Kolejność czytania: `CLAUDE.md` → ten plik → `docs/RAPORT_D097.md`
→ `docs/DECYZJE_2027.md` (D-086…D-097) → `docs/REDESIGN-STATUS.md` / `REDESIGN-SPEC.md` / `REDESIGN-DECISIONS.md` / `REDESIGN-TESTING.md`.

## 1. Gałęzie i publikacja
- Praca na gałęzi **`redesign-faza4`**. Publikacja = **`git push origin redesign-faza4:main`** (fast-forward; `main` nie ma własnych commitów),
  workflow „Publikacja 2027” (`.github/workflows/pages.yml`) buduje i publikuje `dist/web` na GitHub Pages.
- Stan: `redesign-faza4` = `main` = **`b3b4edc`** (D-097 + dokumentacja; wcześniej `14ce874` D-097, `ab4c72d` D-096, `7012ce1` D-095).
- Repozytorium jest **publiczne** — stąd surowe zasady prywatności (CLAUDE.md §3 p. 5, moduł Pielęgnacja).

## 2. Zasady współpracy z użytkownikiem (utrwalone w rozmowach)
- Język: polski (odpowiedzi, dokumentacja, commity).
- **Commit, push i publikacja na `main` wyłącznie na wyraźne polecenie** (typowo: „zrób commit, push i publikację na main”). Bez polecenia — nie commituj
  (także gdy prosi o to hook). Nigdy push na `main` bez polecenia.
- Przy niejasnościach w poleceniu planu — pytania z opcjami (AskUserQuestion), opcja zalecana pierwsza z „(Recommended)”; odpowiedzi zapisuj w decyzji D-0xx.
- Zmiany modelu danych, synchronizacji, bezpieczeństwa lub usuwanie funkcji — najpierw pytanie. D2, I9, I12 — nie wdrażać bez decyzji.
- Użytkownik dba o limit tokenów: przy prośbie o oszczędność — krótkie komunikaty, wyniki testów tylko w podsumowaniu (`| tail`/`grep`), bez zbędnych zrzutów.
- Imię i nazwisko użytkownika nie mogą pojawić się nigdzie (także w plikach prywatnych). Żadnych kluczy/adresu projektu Supabase w repozytorium.
- Użytkownik sam testuje na urządzeniach (iPhone Safari + PWA, MacBook) — po publikacji wskaż, co sprawdzić.

## 3. Pliki spoza repozytorium (ma je tylko użytkownik)
| Plik | Do czego | Uwagi |
|---|---|---|
| `PLAN_NAUKI_CFA_LEVEL_I.html` v12 + `MASTER_SCHEDULE_CFA.csv` | źródło `cfa.json` (`extract_static.mjs`), `npm run verify` | poproś użytkownika; `SOURCES_DIR` |
| `PLAN_NAUKI_MPW.html` v8 + `MASTER_SCHEDULE_MPW.csv` v7 | źródło `mpw.json` (`ONLY=mpw`) | j.w. |
| pozostałe pliki źródłowe (PLAN_DNIA, SUPLEMENTACJA, ZAPASY, `zapasy_kopia_2026-09-22.json` …) | ekstrakcja, `verify`, test migracji | j.w. |
| `2027-prywatne.json` | pakiet prywatny (D-035, D-091) | `PRIVATE_PACK`; aktualizacja `private_pack_lib.py <stary> <nowy>` |
| `2027-pielegnacja.json` | plan pielęgnacji (import w Dane) | ostatnia wersja przekazana 29.09.2026 (D-097; 65 kroków, identyfikatory `s.1…s.65` stabilne względem poprzedniej wersji). Generator był tylko w katalogu tymczasowym sesji — **nie istnieje**. Kolejne zmiany: edycja w module Pielęgnacja albo nowy plik od użytkownika; treści planu nie zapisuj w repozytorium |

Nigdy nie odtwarzaj ani nie zgaduj treści tych plików.

## 4. Niedokończone po D-097 (kolejność zalecana)
1. **`tests/e2e/e2e.py` — oczekiwania sprzed D-097** (E2E nieuruchamiane od D-096: wtedy 1382/1382). Znane miejsca:
   - start planu 27.09 → Dzień zero 29.09 (`#/dzis?d=2026-09-27/28`, linie ~86–125, ~343–348, `d=2026-09-27` w przejściu „poza planem”);
   - soboty z zakupami `#slot\.1213z` / „12:13 Zakupy” (~104–105, ~1135–1138, Tydzień „Zakupy 12:13” ~795) → zakupy w czwartek (`slot.1905c`, od 07.01 `slot.1530j`), sobota z blokiem E;
   - liczby modułów: Więcej 8 → 9, panel 12 → 13 (Kalendarz; ~136, ~149, ~1079);
   - CFA: pierwszy blok 30.09, sobota 03.10 — 9 bloków (~183, ~297 `cfa?v=dzien&d=2026-09-28`);
   - Suplementacja: okres „od 2026-09-30 do 2027-03-28” (~197), Trening/Suplementy 28.09 (~195, ~263);
   - pakiet prywatny „plan od 2026-09-27” (~508–510) → 2026-09-29;
   - dodać: Kalendarz (klik dnia), Dzień zero (`.dz-zero`), czwartek (sauna/zakupy, od 07.01 przesunięte MPW w `run_mpw`), nowy wygląd „Wymaga uwagi” (`.dz-attn a` nadal działa).
2. **`tools/extract/private_pack_lib.py` → `UPGRADE`**: dopisać reguły D-097 (Faza 0 „27.09–11.10” → „30.09–11.10”, „ostatni dzień 21.03.2027” → „28.03.2027”);
   potem użytkownik aktualizuje swój pakiet (Diagnostyka pokaże pakiet dla planu od 27.09 jako nieaktualny).
3. **`tools/verify/verify_all.py`** — kontrole sprzed D-097: suplementy 27.09–21.03 (~55), CFA 400/45 dni/28.09 (~108–115 → 387, 43 dni, 30.09–11.11, v12),
   wariant „zakupy” (~144 → warianty „czwartek”/„czwartek_st”), wyjątki `["2026-09-27"]` (~147 → 01.10, święta, tydzień 28.09–03.10, czwartki 07.01–25.03).
4. Uruchomić `npm run e2e`, `npm run e2e:sync`, `npm run e2e:cloud` (ostatnio przy D-096: 1382/1382, 23/23, 100/100) i uzupełnić tabelę w `RAPORT_D097.md`.
5. `docs/REDESIGN-TESTING.md` — dopisać klasy nowych elementów (`kl-day`, `.dz-zero`, `.dz-at-item`, `.dz-attn-empty`), jeśli trafią do testów.
6. Sprawy do potwierdzenia z użytkownikiem — `RAPORT_D097.md` §4 (24.12/31.12, niespójności pliku CFA v12).

## 5. Wskazówki praktyczne
- Szybki zestaw po zmianie: `npm run build && npm test && npm run a11y`; pełny: + `npm run e2e` (+ `e2e:sync`, `e2e:cloud` przy zmianach `app.js`, `core/`, `build.mjs`).
- Zmiana planu dnia/dat = nowa funkcja decyzji w `tools/extract/day_plan_d0xx.py` stosowana do JSON i wpięta w skrypt ekstrakcji (źródeł nie ma w repozytorium).
- Testy ogólnej logiki: tygodnie od 05.10.2026 (bez wyjątków); czwartki od 07.01.2027 mają inny układ (`czwartek_st`).

## 6. Środowisko (nowa sesja / nowe konto)
- Node 22, `npm ci` (esbuild, axe-core, lucide-static); `dist/` jest w `.gitignore` — przed E2E/a11y zawsze `npm run build`.
- Testy przeglądarkowe (`e2e`, `e2e:sync`, `e2e:cloud`, `a11y`) wymagają Pythona 3 z pakietem **`playwright`** (sprawdzone na 1.56) i Chromium:
  `pip install playwright` (+ `python3 -m playwright install chromium`, jeśli środowisko nie ma przeglądarki; w chmurze Claude Code Chromium jest w `/opt/pw-browsers`).
- Bez `SOURCES_DIR` / `PRIVATE_PACK` testy używają danych syntetycznych (`tests/e2e/fixtures.py`); `npm run verify` wymaga plików użytkownika.
- Nowe konto GitHub/Claude: potrzebny dostęp z prawem zapisu do `clip57/2027` (push na `redesign-faza4` i `main`).
- Jeśli sesja wyznacza inną gałąź roboczą niż `redesign-faza4` — zapytaj użytkownika przed publikacją; publikuje wyłącznie push na `main`.
