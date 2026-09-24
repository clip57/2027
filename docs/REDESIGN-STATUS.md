# REDESIGN-STATUS — stan po Fazach 3–4, stabilizacji 5.0 i Fazie 5 (wszystkie moduły) — 24.09.2026

Wersja kodu: `package.json` 0.2.0; numer builda generowany z treści (`<meta name="app-version">`, widoczny w module Dane).
**Stan repozytorium i wdrożenia (sprawdzone 24.09.2026):** `origin/main` = `69d5d94` (Etap 6) i to ten commit jest ostatnią publikacją
na GitHub Pages (workflow „Publikacja 2027”, przebieg 3). **Na `main` nie ma naprawy synchronizacji** (D-056–D-058) — naprawa i Fazy 3–4
są w jednym commicie `b65b9fa` na gałęzi `redesign-faza4`; Faza 5.0 — zmiany robocze na tej samej gałęzi (bez commita).
Wcześniejszy zapis „użytkownik potwierdził działanie wersji z naprawą synchronizacji” nie ma pokrycia w historii git ani w publikacjach
Pages — prawdopodobnie test lokalny. Użytkownik zatwierdził wdrożenie naprawy i redesignu razem (24.09.2026).
**Wersja opublikowana `4e68589` (Fazy 3–5, wszystkie moduły) sprawdzona ręcznie przez użytkownika na urządzeniach według
`REDESIGN-TESTING.md` §5 — działa (24.09.2026).** Pozostaje Faza 7 z plikami użytkownika (`SOURCES_DIR`, `PRIVATE_PACK`).

## 1. Przebieg (kontekst)
| Etap | Zakres | Raport |
|---|---|---|
| Etapy 0–6 | Budowa aplikacji (dane, rdzeń, 10 modułów) | `docs/RAPORT_*.md`, `docs/RAPORT_KONCOWY.md` |
| Naprawa synchronizacji | Zgodność w przód (D-056), aktualizacja za zgodą (D-057), widoczność wersji/pliku | `docs/RAPORT_NAPRAWA_SYNC.md`, `docs/TEST_IPHONE_SYNC.md` |
| Faza 1–2 redesignu | Audyt UI/UX i plan (poza repozytorium — artefakt rozmowy); założenia zweryfikowane w kodzie przed Fazą 3 | `docs/RAPORT_REDESIGN_F3_F4.md` („Weryfikacja założeń”) |
| **Faza 3** | System projektowy | niżej |
| **Faza 4** | Dashboard „Dziś” | niżej |
| **Faza 5.0** | Stabilizacja Faz 3–4 przed modułami (audyt w kodzie + poprawki + testy) | `docs/RAPORT_REDESIGN_F5_0.md` |
| **Faza 5 (1–2)** | Trening i CFA: system projektowy + rozbudowa funkcji (D-068–D-070) | `docs/RAPORT_REDESIGN_F5_TRENING_CFA.md` |
| **Faza 5 (3–4)** | Dieta i Zapasy jako jeden system; kierunek „premium personal OS” (D-071–D-073) | `docs/RAPORT_REDESIGN_F5_DIETA_ZAPASY.md` |
| **Faza 5 (5–9)** | Meal Prep, Suplementacja, Bezpieczeństwo, Rekompozycja, Dane (D-074–D-077) | `docs/RAPORT_REDESIGN_F5_POZOSTALE.md` |

## 2. Wykonane

### Faza 3 — system projektowy
- `src/ui/tokens.css` — jedyne źródło tokenów (kolory obu motywów, typografia, odstępy, promienie, głębia, ruch, układ) + aliasy starych nazw.
- `src/ui/system.css` — warstwa komponentów: podstawy, przyciski, pola, karty, KPI, segmenty, plakietki, komunikaty, tabele,
  okna (arkusz od dołu < 600 px), pasek dolny, „Więcej”, przełącznik motywu, panel boczny; na końcu style dashboardu (`dz-*`).
- Font Inter — `public/fonts/inter-latin.woff2` (26 684 B), `inter-latin-ext.woff2` (5 320 B), licencja `OFL-Inter.txt`.
- Ikony Lucide — `src/ui/icons.js` (40 ikon, ok. 7 KB) generowany przez `tools/icons.mjs`.
- Motyw — `src/ui/prefs.js` + skrypt w `src/index.html`; domyślnie ciemny; przełącznik w panelu i na stronie „Więcej”.
- Nawigacja — `src/modules/registry.js` (grupy, ikony, sekcje telefonu), `src/app.js` (`nav()`, `themeSwitch()`, strona `#/wiecej`,
  chowanie paska przy klawiaturze).
- Build — `tools/build.mjs`: sklejanie `tokens.css + styles.css + system.css`, kopiowanie fontów, fonty jako data URI w `2027.html`, fonty w `SHELL` service workera.
- Usunięte z `styles.css`: stare bloki tokenów, stara nawigacja (`.tabs`, `.side`, `.more-list`), reguły `.sf-risk` z kolorem na sztywno.

### Faza 4 — dashboard „Dziś” (`src/modules/dzis.js`)
Nagłówek z nawigacją po dniach, skróty (jadłospis, suplementacja, trening, bloki CFA), karta „Teraz” z pierścieniem postępu dnia,
4 kafle (Dieta, Trening, CFA, Zapasy), karty boczne (Suplementy — podsumowanie liczbowe, Meal prep, Zapasy, Plan CFA,
Aktywność treningowa 6 tyg.), plan dnia. Wszystko z resolvera i dziennika zdarzeń (`dayData()`, `activityGrid()`).
Funkcje `slotView()`, `currentSlot()`, `cfaBlock()` bez zmian merytorycznych.

### Poprawki w trakcie Faz 3–4
Przełącznik motywu nie mieścił się w panelu; karta „Teraz” jasna w ciemnym motywie; wielkie litery w nazwie miesiąca;
zbyt ciasne kafle obok kolumny bocznej; **karta suplementów dublowała nazwy dawek (sprzeczne z D-041) → podsumowanie liczbowe**.

### Przygotowanie przekazania (ten krok)
- Nowe: `CLAUDE.md`, `docs/REDESIGN-SPEC.md`, `docs/REDESIGN-DECISIONS.md`, `docs/REDESIGN-STATUS.md`, `docs/REDESIGN-TESTING.md`.
- `tests/e2e/e2e.py`, `tests/e2e/sync_update.py`: pominięte bloki raportowane jawnie (`skip()`, „pominiętych bloków: N”) zamiast
  liczenia jako zaliczone; jawne pominięcie bloku pakietu prywatnego.
- `tests/e2e/sync_update.py`: w konfiguracji bez plików użytkownika test kończył się błędem `ValueError` (brak stanu kefiru
  i wyścig z zapisem) — ustawia teraz testowe stany banana i kefiru i czeka na potwierdzenie zapisu. Błąd testu, nie aplikacji.
- Usunięty pusty katalog-artefakt `tools/{extract,verify}`.

### Faza 5.0 — stabilizacja (24.09.2026)
Poprawione (wszystkie potwierdzone w przeglądarce przed poprawką): kontrast odhaczonej serii/bloku CFA w ciemnym motywie (1,6:1 → token
`--on-success`); szary tekst odhaczonego bloku CFA w jasnym motywie; `.tg-law` i akcenty posiłków bez wariantu ciemnego (→ tokeny domen);
utracone kolorowe krawędzie `.meal`, `.daycard`, `.gd-rt/.gd-day`; nieustawiana zmienna `--dc` (ikony „Więcej”) — `h()` używa `setProperty`;
odnośniki `#id` w Meal Prep przenoszące na „Dziś” (D-066); `theme-color`/manifest w kolorach sprzed redesignu (D-067); przyklejona kolumna
„Dziś” ucinana w niskim oknie; przerysowanie widoku przy każdym powrocie na ekran, gdy czeka nowa wersja (ryzyko utraty wpisu); okno
podglądu importu zostające w DOM po Esc; nieaktualny tekst „moduł Zapasy powstanie w Etapie 4”. `system.css` bez literałów kolorów,
promieni i rozmiarów pisma. Testy: dane syntetyczne (D-065 — 296 wcześniej pomijanych kontroli E2E teraz wykonywanych), `tokens.test.mjs` (4 testy),
28 przebiegów stanów w `a11y.py`, 34 nowe kontrole E2E, 2 nowe w `e2e:sync` (blok pominięty w B → wykonywany).

### Faza 5, moduły 1–2 — Trening i CFA (24.09.2026)
- **Trening:** licznik przerwy między seriami (D-068), karta „Następna seria” i podsumowanie ukończonej sesji (D-069), ikony w przyciskach
  czasu treningu i kopiowania serii, kotwice ćwiczeń, wybrany dzień w pasku dni w akcencie, cele dotykowe ≥ 44 px (dotąd 34–40 px:
  kopiowanie serii, „Technika i mięśnie”, plakietki, odtwarzanie ruchu, pole minut, „+ Dodaj serię”), sekcje stylów na tokenach.
- **CFA:** tempo względem planu i zaległe bloki (D-070) w nagłówku, panel zaległych w widoku dnia bieżącego, następny blok dnia,
  filtr „tylko zaległe” w harmonogramie, nawigacja dni jak w „Dziś”, filtr rodzaju błędu i wyszukiwanie w error logu, dzień bieżący
  w kalendarzu w akcencie. **Naprawiony błąd:** drugi wpis error logu z rzędu zapisywał się, ale widok nie odświeżał się (ten sam adres).
- Nagłówki `.hero-tr`/`.hero-cfa` bez dekoracyjnych gradientów (dotyczy też Meal Prep — ta sama klasa).
- Bez nowych typów zdarzeń, bez zmian w synchronizacji i danych źródłowych.

### Faza 5, moduły 5–9 — Meal Prep, Suplementacja, Bezpieczeństwo, Rekompozycja, Dane (24.09.2026)
Zob. `docs/RAPORT_REDESIGN_F5_POZOSTALE.md`. **Faza 5 zakończona** — wszystkie 10 modułów w systemie projektowym. Następnie: Faza 6
(kontrola na urządzeniach, 7 szerokości) i Faza 7 (regresja końcowa), zob. §4.

### Faza 5, moduły 3–4 — Dieta i Zapasy (24.09.2026)
Zob. `docs/RAPORT_REDESIGN_F5_DIETA_ZAPASY.md`. Strona Zapasów na 375 px: ok. 17 000 → 11 700 px wysokości (55 pozycji).
Wszystkie funkcje D-046 (okna, historia, paragon, raport AI, kopia, cofanie, korekty dnia, operacje zbiorcze) zachowane.

## 3. Zmienione pliki w Fazach 3–4
Nowe: `src/ui/tokens.css`, `src/ui/system.css`, `src/ui/icons.js`, `src/ui/prefs.js`, `tools/icons.mjs`,
`public/fonts/inter-latin.woff2`, `public/fonts/inter-latin-ext.woff2`, `public/fonts/OFL-Inter.txt`, `tools/fonts/LICENSE-lucide.txt`,
`docs/RAPORT_REDESIGN_F3_F4.md`.
Zmienione: `src/ui/styles.css`, `src/app.js`, `src/modules/registry.js`, `src/modules/dzis.js`, `src/index.html`,
`tools/build.mjs`, `tests/e2e/e2e.py`, `tests/e2e/a11y.py`, `package.json`, `package-lock.json`, `README.md`, `docs/DECYZJE_2027.md`.
**Bez zmian:** `src/core/**`, `src/data/**`, pozostałe moduły (dziedziczą tokeny i komponenty automatycznie).

## 4. Pozostało

### Faza 5 — pozostałe moduły (kolejność zalecana)
Każdy moduł: przeniesienie literalnych wartości na tokeny, ujednolicenie kart/nagłówków/list z `system.css`, ikony Lucide w
nagłówkach i akcjach, spójny nagłówek modułu (h1 + `.topline`), układ mobile/desktop, zrzuty w obu motywach, pełna regresja.
Stan literalnych wartości w `src/ui/styles.css` (`grep` bez `var(`): po Fazie 5.0 — 0 kolorów, 59 promieni, 156 `font-size`;
**po Trening + CFA — 0 kolorów, 39 promieni, 118 `font-size`**; w sekcjach Trening/CFA/Meal Prep (odsłona 2) zostały wyłącznie
mikro-odstępy < 3 px. Pozostałe moduły — wg tabeli:

| # | Moduł | Plik | Sekcje w `styles.css` do uporządkowania | Uwagi |
|---|---|---|---|---|
| ✅ 1 | Trening | `trening.js`, `movement.js`, `figure.js`, `bodymap.js`, `charts.js` | „Etap 5: Trening…”, „Karty ćwiczeń” (8 promieni, 11 font), „Trening: schemat ruchu…”, „Pasek dni”, „Mapa mięśni” | zachować `.ex, .set, .set-toggle, .set-copy, .ex-tech, .ex-map, .hero-tr, .tm*, .opt-note, .hist-*`; kolejka zapisów serii |
| ✅ 2 | CFA | `cfa.js` | „Etap 5: CFA” (4/6/10) | zachować `.cfa-row, .cal, .cal-d, .log-*, .topic, .form-grid, .filters, .hero-cfa` |
| ✅ 3 | Dieta | `dieta.js` | „Kafel główny diety”, „Karty posiłków” | zachować `.hero, .meal`, atrybut `data-meal`; akcenty posiłków już na tokenach (5.0) |
| ✅ 4 | Zapasy | `zapasy.js` | „Etap 4 (odsłona 2)” (3/18/17) | **zachować wszystkie funkcje D-046** i klasy `.dash, .actions, .counters, .pills, .inv, .inv-item`; okna → arkusz od dołu już działa globalnie |
| ✅ 5 | Meal Prep | `mealprep.js` | „Meal Prep — odświeżona szata”, „odsłona 2” (7/7/12) | zachować `.prep-card, .prep-list, .mp-ring, .mp-next` |
| ✅ 6 | Suplementacja | `suplementy.js` | „Oś czasu suplementacji”, „Etap 3…” | zachować `.dose-list` |
| ✅ 7 | Bezpieczeństwo | `bezpieczenstwo.js` | „Etap 6: Bezpieczeństwo (odsłona 2)” (9/11/18), „Poradnik” | zachować `.sf-card, .safety-table, .gd-rt`; plakietki `.tg-*` już na tokenach (5.0) |
| ✅ 8 | Rekompozycja | `rekompozycja.js` | „Etap 6: Rekompozycja” (7/9/15) | znaczniki `{private:N}` / `.priv-in`, `.priv-miss`, `.rk-sec` bez zmian logiki |
| ✅ 9 | Dane | `dane.js` | „Komunikaty”, `kv` | sekcje synchronizacji i aktualizacji — **tylko wygląd**; teksty rozróżniające kod/dane zostają |

### Faza 6 — responsywność i iOS
Zrzuty i kontrola na 320, 375, 390, 430, 768, 1280, 1440 px (jasny/ciemny); tabele CFA/Rekompozycji na < 600 px
(rozważyć listę kart — **zmiana struktury: najpierw zgoda użytkownika**); ręczna kontrola na iPhonie (`REDESIGN-TESTING.md` §4).

### Faza 7 — regresja końcowa
Wszystkie zestawy z `REDESIGN-TESTING.md`, build obu wariantów, cykl eksport → import na czystym profilu, aktualizacja SW
stara → nowa bez utraty danych, testy wizualne na 7 szerokościach.

### Wdrożenie (po zatwierdzeniu przez użytkownika)
Scalenie `redesign-faza4` → `main` wdroży naraz naprawę synchronizacji, Fazy 3–4 i 5.0. Urządzenia działają na kodzie z `main`
(stary service worker bez zgody) — pierwsze przejście nastąpi bez przycisku (tak jak testuje `sync_update.py` D). Kolejność na urządzeniach:
najpierw aktualizacja kodu w każdym miejscu (K, S, P — ta sama „Wersja aplikacji”), potem dopiero import plików (`TEST_IPHONE_SYNC.md`).

## 5. Znane ograniczenia
- **Brak skryptu podzbioru fontu w repozytorium.** Pliki woff2 wygenerowano poza repo (`pyftsubset` z fonttools z plików
  `@fontsource-variable/inter` 5.3.0, znaki z `src/**/*.js` i `src/data/*.json` + polskie litery, cechy `kern,liga,calt,tnum,case`).
  Nowe znaki poza podzbiorem wyświetlą się fontem systemowym. Odtworzenie wymaga dopisania skryptu **[do zrobienia]**.
- Brak testów w WebKit/Safari (środowisko bez WebKit) — wszystkie testy automatyczne w Chromium.
- Motyw domyślnie ciemny — **potwierdzone przez użytkownika 24.09.2026**.
- 79 znaków używanych w aplikacji (strzałki, ≤ ≥ ≈ ≠, ✓, emoji) jest poza podzbiorem Inter i wyświetla się fontem systemowym.
- Pasek statusu PWA (`status-bar-style: default`) — zachowanie w motywie ciemnym do sprawdzenia na iPhonie (D-067).
- Konfiguracja testów z plikami użytkownika (A) nie była uruchamiana w Fazie 5.0.
- Referencje Figma (Nucleus OS, OneDay) nie były otwarte — kierunek oparty na zrzutach użytkownika.
- Rysunki `figure.js` / `bodymap.js` są poglądowe (rysunek własny), nie atlasem anatomicznym.
- `npm run verify` i część testów wymagają plików użytkownika spoza repozytorium (zob. `REDESIGN-TESTING.md`).
- Paczka: JS 667 KB (ok. 157 KB gzip, głównie dane planów); `2027.html` 790 KB (pomiar 5.0; wcześniej podawane 683/806 KB z innego builda).
