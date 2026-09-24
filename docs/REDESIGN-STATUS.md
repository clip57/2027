# REDESIGN-STATUS — stan wdrożenia po Fazach 3–4 (24.09.2026)

Wersja kodu: `package.json` 0.2.0; numer builda generowany z treści (`<meta name="app-version">`, widoczny w module Dane).
Wdrożenie na GitHub Pages: użytkownik potwierdził działanie **wersji z naprawą synchronizacji** (przed redesignem).
**Wersja z Fazami 3–4 nie została jeszcze potwierdzona przez użytkownika na urządzeniach [do weryfikacji].**

## 1. Przebieg (kontekst)
| Etap | Zakres | Raport |
|---|---|---|
| Etapy 0–6 | Budowa aplikacji (dane, rdzeń, 10 modułów) | `docs/RAPORT_*.md`, `docs/RAPORT_KONCOWY.md` |
| Naprawa synchronizacji | Zgodność w przód (D-056), aktualizacja za zgodą (D-057), widoczność wersji/pliku | `docs/RAPORT_NAPRAWA_SYNC.md`, `docs/TEST_IPHONE_SYNC.md` |
| Faza 1–2 redesignu | Audyt UI/UX i plan (poza repozytorium — artefakt rozmowy); założenia zweryfikowane w kodzie przed Fazą 3 | `docs/RAPORT_REDESIGN_F3_F4.md` („Weryfikacja założeń”) |
| **Faza 3** | System projektowy | niżej |
| **Faza 4** | Dashboard „Dziś” | niżej |

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
Stan literalnych wartości w `src/ui/styles.css` (pomiar 24.09.2026; razem: 6 kolorów, 57 promieni, 93 `padding`, 150 `font-size`):

| # | Moduł | Plik | Sekcje w `styles.css` do uporządkowania | Uwagi |
|---|---|---|---|---|
| 1 | Trening | `trening.js`, `movement.js`, `figure.js`, `bodymap.js`, `charts.js` | „Etap 5: Trening…”, „Karty ćwiczeń” (8 promieni, 11 font), „Trening: schemat ruchu…”, „Pasek dni”, „Mapa mięśni” | zachować `.ex, .set, .set-toggle, .set-copy, .ex-tech, .ex-map, .hero-tr, .tm*, .opt-note, .hist-*`; kolejka zapisów serii |
| 2 | CFA | `cfa.js` | „Etap 5: CFA” (4/6/10) | zachować `.cfa-row, .cal, .cal-d, .log-*, .topic, .form-grid, .filters, .hero-cfa` |
| 3 | Dieta | `dieta.js` | „Kafel główny diety”, „Karty posiłków” (4 kolory akcentów posiłków) | zachować `.hero, .meal`; kolory akcentów posiłków → tokeny |
| 4 | Zapasy | `zapasy.js` | „Etap 4 (odsłona 2)” (3/18/17) | **zachować wszystkie funkcje D-046** i klasy `.dash, .actions, .counters, .pills, .inv, .inv-item`; okna → arkusz od dołu już działa globalnie |
| 5 | Meal Prep | `mealprep.js` | „Meal Prep — odświeżona szata”, „odsłona 2” (7/7/12) | zachować `.prep-card, .prep-list, .mp-ring, .mp-next` |
| 6 | Suplementacja | `suplementy.js` | „Oś czasu suplementacji”, „Etap 3…” | zachować `.dose-list` |
| 7 | Bezpieczeństwo | `bezpieczenstwo.js` | „Etap 6: Bezpieczeństwo (odsłona 2)” (9/11/18), „Poradnik” (2 kolory) | zachować `.sf-card, .safety-table`; plakietki statusów poradnika (`.tg-*`) → tokeny |
| 8 | Rekompozycja | `rekompozycja.js` | „Etap 6: Rekompozycja” (7/9/15) | znaczniki `{private:N}` / `.priv-in`, `.priv-miss`, `.rk-sec` bez zmian logiki |
| 9 | Dane | `dane.js` | „Komunikaty”, `kv` | sekcje synchronizacji i aktualizacji — **tylko wygląd**; teksty rozróżniające kod/dane zostają |

### Faza 6 — responsywność i iOS
Zrzuty i kontrola na 320, 375, 390, 430, 768, 1280, 1440 px (jasny/ciemny); tabele CFA/Rekompozycji na < 600 px
(rozważyć listę kart — **zmiana struktury: najpierw zgoda użytkownika**); ręczna kontrola na iPhonie (`REDESIGN-TESTING.md` §4).

### Faza 7 — regresja końcowa
Wszystkie zestawy z `REDESIGN-TESTING.md`, build obu wariantów, cykl eksport → import na czystym profilu, aktualizacja SW
stara → nowa bez utraty danych, testy wizualne na 7 szerokościach.

## 5. Znane ograniczenia
- **Brak skryptu podzbioru fontu w repozytorium.** Pliki woff2 wygenerowano poza repo (`pyftsubset` z fonttools z plików
  `@fontsource-variable/inter` 5.3.0, znaki z `src/**/*.js` i `src/data/*.json` + polskie litery, cechy `kern,liga,calt,tnum,case`).
  Nowe znaki poza podzbiorem wyświetlą się fontem systemowym. Odtworzenie wymaga dopisania skryptu **[do zrobienia]**.
- Brak testów w WebKit/Safari (środowisko bez WebKit) — wszystkie testy automatyczne w Chromium.
- Interpretacja „motyw systemowy domyślny, ale domyślnie dark” = domyślnie ciemny — **do potwierdzenia przez użytkownika**.
- Referencje Figma (Nucleus OS, OneDay) nie były otwarte — kierunek oparty na zrzutach użytkownika.
- Rysunki `figure.js` / `bodymap.js` są poglądowe (rysunek własny), nie atlasem anatomicznym.
- `npm run verify` i część testów wymagają plików użytkownika spoza repozytorium (zob. `REDESIGN-TESTING.md`).
- Paczka: JS ok. 670 KB (ok. 157 KB gzip, głównie dane planów); `2027.html` ok. 806 KB.
