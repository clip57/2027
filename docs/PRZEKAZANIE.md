# Przekazanie projektu — stan na 1.11.2026 (po D-113, opublikowanym)

Dokument dla kolejnej instancji Claude Code. Zawiera to, czego nie da się wywnioskować z kodu: sposób pracy z użytkownikiem,
stan wdrożenia, niedokończone zadania i pliki spoza repozytorium. Kolejność czytania: `CLAUDE.md` → ten plik → `docs/RAPORT_D113.md`
→ `docs/DECYZJE_2027.md` (D-086…D-113) → `docs/REDESIGN-STATUS.md` / `REDESIGN-SPEC.md` / `REDESIGN-DECISIONS.md` / `REDESIGN-TESTING.md`.

## 1. Gałęzie i publikacja
- Historycznie praca na gałęzi `redesign-faza4` (do D-097). Publikacja = fast-forward gałęzi roboczej na `main`
  (`git push origin <gałąź>:main`; przed publikacją sprawdź zielone „Testy 2027” dla tego commita), workflow „Publikacja 2027” (`.github/workflows/pages.yml`) buduje i publikuje `dist/web` na GitHub Pages.
- **Stan 1.11.2026:** D-113 (audyt i System 3.0 „Precision”) opublikowany na `main` **31.10.2026** jednorazowo po całości (decyzja użytkownika;
  fast-forward `git push origin claude/eager-newton-j2309e:main`, `main` = `8074976`; workflow „Testy 2027” i „Publikacja 2027” zielone).
  Gałąź robocza `claude/eager-newton-j2309e` = `main`. Kolejna zmiana = nowy etap na tej gałęzi (po scaleniu — zacznij od `main`).
- **Stan 24.10.2026:** praca na gałęzi `claude/eager-newton-j2309e`; `main` = **`a824797`** (D-107…D-109, publikacja fast-forward
  `git push origin claude/eager-newton-j2309e:main` na polecenie użytkownika). D-110 (System 2.0) i D-111 — opublikowane na `main` 25.10.2026 (fast-forward z gałęzi roboczej).
- Repozytorium jest **publiczne** — stąd surowe zasady prywatności (CLAUDE.md §3 p. 5, moduł Pielęgnacja).

## 2. Zasady współpracy z użytkownikiem (utrwalone w rozmowach)
- Język: polski (odpowiedzi, dokumentacja, commity).
- **Commit, push i publikacja na `main` wyłącznie na wyraźne polecenie (w D-113 użytkownik polecił: jedna publikacja po całości, nie etapami)** (typowo: „zrób commit, push i publikację na main”). Bez polecenia — nie commituj
  (także gdy prosi o to hook). Nigdy push na `main` bez polecenia.
- Przy niejasnościach w poleceniu planu — pytania z opcjami (AskUserQuestion), opcja zalecana pierwsza z „(Recommended)”; odpowiedzi zapisuj w decyzji D-0xx.
- Zmiany modelu danych, synchronizacji, bezpieczeństwa lub usuwanie funkcji — najpierw pytanie. D2, I9, I12 — zamknięte bez wdrożenia (D-111).
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

## 4. Otwarte sprawy — stan 1.11.2026 (po D-113)
**Rozstrzygnięte 25.10.2026 (D-111):** D1 — na razie bez zmian (popołudnie od 16.11 jak dotąd; wrócić przed 16.11); założenia D-103 §5 —
obowiązują; blok J w niedziele i czwartki — bez zmian; kolano — usunięte z dziennika sesji; G-20 i D-031 — zamknięte; skrypt fontu,
znacznik pielęgnacji w niedziele świąteczne i akcje GitHub na Node 24 — wykonane; D2, I9, I12 — zamknięte bez wdrożenia; D-110 i D-111 —
opublikowane na `main` (25.10.2026).

**D-112 (25.10.2026):** zgłoszenie z iPhone'a (słabe przewijanie, skoki na początek strony, arkusz nie zamyka się przeciągnięciem) —
poprawione i opublikowane (`docs/RAPORT_D112.md`); potwierdzone na iPhonie.

**D-113 (31.10.2026):** audyt (`docs/RAPORT_AUDYT_2026-10-31.md`) i System 3.0 „Precision” — wykonane i opublikowane w całości (K1, W1–W3, D1–D17,
24 funkcje, przebudowa wyglądu; `docs/RAPORT_D113.md`, decyzja D-113 w `DECYZJE_2027.md`, §C13 w `REDESIGN-DECISIONS.md`). Użytkownik sprawdził działanie
na iPhonie (Safari i PWA) 1.11.2026 — wszystko działa. Nowe zapisy: wyłącznie `setting` (`supp.dose:*`, `zapasy.shop:*` — `src/core/calc/checks.js`).

**Audyt 10.11.2026 („baza na dekadę” — `docs/RAPORT_AUDYT_2026-11-10.md`):** tylko audyt i plan, kod bez zmian. Najważniejsze: plan kończy się
28.03.2027 i jest wkompilowany w program (68% pakietu JS to dane planu) → proponowany „silnik planów 2.0” (plany jako dane użytkownika, wyjątki
i odstępstwa w aplikacji); dziennik zdarzeń nie skaluje się na 10 lat (start 4,8–17 s przy 480 tys. zdarzeń) → migawka + ogon; brak powiadomień;
kierunek designu „System 4.0” (trzy warianty); 12 rozszerzeń zewnętrznych; mapa drogowa 9 etapów. **Czeka na 10 decyzji użytkownika (§11 raportu) —
nie wdrażaj niczego z tego raportu przed nimi.**

**Do decyzji użytkownika:**
1. **D1 — popołudnie od 16.11** (odłożone 25.10): bloki MPW 15:30 / 16:30 / 17:30 kolidują z planem dnia w 108 ze 119 dni
   (`RAPORT_AUDYT_2026-10-23.md` D1). Termin: przed 16.11.
2. **Decyzje 2–10 z audytu 10.11.2026** (`RAPORT_AUDYT_2026-11-10.md` §11): kierunek designu, silnik planów 2.0, miejsce treści planu, nowe rodzaje
   danych, poziom powiadomień, adres i nazwa, zakres „rdzenia życia”, asystent AI, start etapu 1.

**Niedokończone / do dopracowania:**
1. **Kontrola D-113 na MacBooku (Safari i Chrome)** — pasek górny, ⌘K z poleceniami, Ustawienia, „Dziś” w dwóch kolumnach, tryb zakupów
   (`REDESIGN-TESTING.md` §5 p. 14); iPhone — potwierdzony. Środowisko pracy nie ma WebKit (testy tylko w Chromium); niesprawdzone: pasek
   statusu PWA w motywie ciemnym (D-067) i `CryptoKey` w IndexedDB w Safari (`SYNC_CHMURA.md`).
2. **Meal Prep, Pielęgnacja, Rekompozycja, Dane, Więcej** — tylko wspólna warstwa „Precision” (paleta, krój, plakietki, wykresy), bez własnej przebudowy
   układu (opcjonalne dopracowanie, jeśli wyglądają słabo na tle „Dziś” i „Zapasów”).
3. Fazy 6–7 redesignu: regresja automatyczna 320–1920 px (D-110, D-113; przegląd 1233 renderów) i kontrola użytkownika na iPhonie — **wykonane**.
4. Ograniczenia D-113 (`RAPORT_D113.md` §5): sygnał minutnika tylko przy włączonym ekranie (Web Audio); wykres postępu nauki liczy bloki wg dnia
   w planie (dziennik nie zapisuje daty odhaczenia); ilość zmieniona w trybie zakupów nie synchronizuje się (odhaczenia tak).
5. `a11y.py` nie ma jeszcze tras `#/ustawienia` i `#/zapasy?a=zakupy` (sprawdzane axe w `run_d113` w `e2e.py`) — do dopisania przy okazji.
6. `npm run verify` i test migracji kopii ZAPASY wymagają plików użytkownika (`SOURCES_DIR`) — w tym środowisku zawsze pominięte.

## 4a. Niedokończone po D-097 (historyczne — kolejność zalecana)
> **Stan 24.10.2026:** punkty 1–4 wykonane — E2E i `verify_all.py` na kalendarzu V44 (wyniki w `RAPORT_D103.md` §6); punkt 2 (`UPGRADE` w `private_pack_lib.py`) — reguły do D-103c i D-104 (potwierdzone w audycie 23.10.2026, U5). Przy następnej zmianie planu dopisz nowe reguły.

1. **`tests/e2e/e2e.py` — oczekiwania sprzed D-097** (E2E nieuruchamiane od D-096: wtedy 1382/1382). Znane miejsca:
   - start planu 27.09 → Dzień zero 29.09 (`#/dzis?d=2026-09-27/28`, linie ~86–125, ~343–348, `d=2026-09-27` w przejściu „poza planem”);
   - soboty z zakupami `#slot\.1213z` / „12:13 Zakupy” (~104–105, ~1135–1138, Tydzień „Zakupy 12:13” ~795) → zakupy w czwartek (`slot.1905c`, od 07.01 `slot.1530j`), sobota z blokiem E;
   - liczby modułów: Więcej 8 → 9, panel 12 → 13 (Kalendarz; ~136, ~149, ~1079);
   - CFA: pierwszy blok 30.09, sobota 03.10 — 9 bloków (~183, ~297 `cfa?v=dzien&d=2026-09-28`);
   - Suplementacja: okres „od 2026-09-30 do 2027-03-28” (~197), Trening/Suplementy 28.09 (~195, ~263);
   - pakiet prywatny „plan od 2026-09-27” (~508–510) → 2026-09-29;
   - dodać: Kalendarz (klik dnia), Dzień zero (`.dz-zero`), czwartek (sauna/zakupy, od 07.01 przesunięte MPW w `run_mpw`), nowy wygląd „Wymaga uwagi” (`.dz-attn a` nadal działa).
2. ~~**`tools/extract/private_pack_lib.py` → `UPGRADE`**~~ — **wykonane** (reguły do D-103c i D-104). Pierwotnie: dopisać reguły D-097 (Faza 0 „27.09–11.10” → „30.09–11.10”, „ostatni dzień 21.03.2027” → „28.03.2027”);
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
- Nowe konto GitHub/Claude: potrzebny dostęp z prawem zapisu do `clip57/2027` (push na gałąź roboczą i `main`).
- Gałąź roboczą wyznacza sesja (obecnie `claude/eager-newton-j2309e`); publikuje wyłącznie push na `main` — tylko na polecenie użytkownika.
- Drzewa robocze `git worktree`: `node_modules` jest dowiązaniem — nie używaj `git add -A` bez sprawdzenia `git status` (zob. pułapki w `CLAUDE.md`).
