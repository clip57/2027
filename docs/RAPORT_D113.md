# Raport D-113 — audyt 31.10.2026 i System 3.0 „Precision”

Decyzje użytkownika (31.10.2026) do `docs/RAPORT_AUDYT_2026-10-31.md` §7: „Wszystko akceptuję od 1 do 5 (Precision jako główny
motyw), 6 — nie publikuj od razu, tylko z całym patchem już po zmianach, a punkt 7 zrobię później”. Prototyp „Dziś” i „Zapasy”
zaakceptowany („Tak”) przed przebudową pozostałych modułów. Zapis decyzji: `docs/DECYZJE_2027.md` (D-113), `docs/REDESIGN-DECISIONS.md` (C13).

## 1. Zakres

| Etap | Zawartość |
|---|---|
| 0 | **K1 — Zapasy bez stanów ujemnych:** `stockInfo` (stan ≥ 0, zużycie przy braku = niedobór, zakup z dnia D pokrywa zużycie dnia D, „Brak od <data>” i niedobór wg planu); „− porcja” do zera; Diagnostyka „Braki wg planu”; W1 (pole „Stan” bez długich ułamków), D11 |
| 1 | W2 (przecinek w polach liczbowych, `numberOf`; nieczytelny wpis bez zapisu), W3 (tabela kontrolna z pozycjami własnymi), D1–D17 (lista w raporcie audytu; D7 — zweryfikowane, nie błąd; D17 — faktyczny brak w Pielęgnacji), ml/g → ml (`tools/extract/d113_units.py`), odstępy przed interpunkcją w danych (`tools/extract/d113_text.py`) |
| 2 | Fundament „Precision”: tokeny (paleta grafitowa z projektu OKLCH, akcenty indygo / turkus / bursztyn), Inter Display, `precision.css`, minifikacja CSS, komponenty (`metric`, `statusBadge`, `timerChip`), wykresy SVG (`sparkline`, `areaChart`, `donut`, `heatmap`, `stockAxis`), pasek górny, Ustawienia, komunikat z „Cofnij”, paleta ⌘K z poleceniami, prototyp Dziś/Zapasy |
| 3 | Moduły codzienne: tryb zakupów (F-Z2/F-Z3/F-Z5), szczegóły pozycji (F-Z4), odhaczanie dawek (F-D4), „Wymaga uwagi” z akcjami (F-D2), podsumowanie dnia (F-D3), postęp ćwiczenia i rekord (F-T2), sygnał przerwy (F-T1), pierścień makro w Diecie (F-DI2), Dieta dla daty (F-DI1) |
| 4 | Nauka: postęp względem planu (F-N1), licznik bloku 53 min (F-N2), mapa wykonania (F-N3); Kalendarz — podgląd dnia (F-K1); Tydzień — wykonanie z dziennika (F-G3) |
| 5 | Pozostałe moduły w Precision (Meal Prep, Pielęgnacja, Bezpieczeństwo — ikony zamiast emoji, Rekompozycja, Dane, Więcej); F-G6: pamięć wyników `stockInfo` |

## 2. Dane i zgodność

- **Bez nowych typów zdarzeń, bez zmian `reduce()`, bazy, formatu `2027-sync.json` i synchronizacji.** Nowe zapisy przez istniejący
  typ `setting` (LWW per klucz, jak recall CFA — I11):
  - `supp.dose:RRRR-MM-DD|GG:MM|<preparat>` → `true`/`false` (F-D4);
  - `zapasy.shop:RRRR-MM-DD|<pozycja>` → `true`/`false` (F-Z2; data najbliższych zakupów). Jeden klucz na pozycję — odhaczenia z dwóch
    urządzeń się nie nadpisują. Klucze mieszczą się w walidacji (`checks.test.mjs` — każda dawka planu i każda pozycja katalogu).
- **K1 zmienia wynik obliczeń stanów** (świadomie, decyzja 1): pozycje zaniżone dawniej „fikcyjnym zużyciem” po braku pokazują wyższy,
  prawidłowy stan. Dziennik zdarzeń bez zmian.
- `statusInfo` zwraca dodatkowo `label` (słowa, bez emoji); `badge` (format v31) zostaje w raporcie tekstowym i podpowiedzi.
- Dane źródłowe: `catalog.json` (2 jednostki), `safety.json` i `rekomp.json` (147 odstępów przed interpunkcją) — skryptami decyzji,
  idempotentnie, bez zmiany treści. `cfa.json`, `mpw.json`, `guide.json`, `mealprep.json` bez zmian.
- Preferencje urządzenia (localStorage, poza dziennikiem): `p2027.accent`, `p2027.density`, `p2027.text`, `p2027.sound`, `p2027.start`.

## 3. Wygląd

- Warstwa `src/ui/precision.css` (po `system.css`); tokeny tylko w `tokens.css`. Kontrasty par w obu motywach i dla każdego akcentu —
  `tokens.test.mjs`; jasny `--warning` przyciemniony (#834600), bo plakietka dowodów na zabarwionym tle Bezpieczeństwa miała 4,31:1.
- Inter Display: `public/fonts/inter-display.woff2` (27 KB, opsz 32, 500–800), dotychczasowe pliki fontu bajtowo bez zmian.
- CSS: 173 KB → 141 KB (26 KB gzip) — minifikacja esbuild; fonty wariantu jednoplikowego osadzane przed minifikacją.
- Komputer: pasek górny poza `<main>` (testy czytające treść modułu go nie widzą); „Dziś” — bento: Teraz, liczby dnia, podsumowanie,
  „Wymaga uwagi”, plan; prawa kolumna — karty.
- Bez animacji nieskończonych i bez kodu w czasie przewijania (zasady D-112 zachowane).

## 4. Testy

| Zestaw | Wynik |
|---|---|
| Jednostkowe (`npm test`) | 266 / 266 (nowe: `checks`, `commands`, akcenty w `tokens`, etykiety stanów, K1 w `inventory`) |
| `plan_check`, `verify_all --data-only`, `cfa_smoke` | 0 błędów |
| E2E (`npm run e2e`, z `run_d113`) | patrz §6 (wynik końcowy) |
| a11y, Trening, `e2e:sync`, `e2e:cloud` | patrz §6 |

Zmienione oczekiwania testów (świadome zmiany zachowania): korekta dnia w Zapasach przy stanie dodatnim (K1), format dat w Suplementacji,
„Raport” zamiast „Status AI”, plakietki stanu bez emoji, panel: 13 modułów + Ustawienia, komunikat z akcją 10 s, klik dnia w Kalendarzu
— podgląd, potem „Otwórz w Dziś”, kolor tła jasnego motywu `#f5f7fa`.

## 5. Ograniczenia

- Sygnał minutników na iPhonie działa, gdy aplikacja jest na ekranie (Web Audio wymaga gestu — odblokowanie przy starcie odliczania);
  przy wygaszonym ekranie PWA nie zagra dźwięku — ograniczenie systemu.
- Wykres „Postęp względem planu” liczy bloki wg dnia bloku w planie (dziennik nie przechowuje daty odhaczenia bloku).
- Ilość w trybie zakupów zmieniana przed „Kupione” jest stanem okna (nie synchronizuje się); odhaczenia — tak.
- D1 (popołudnie od 16.11) — bez zmian, decyzja użytkownika później.

## 6. Wyniki końcowe (31.10.2026, stan publikowany)

| Zestaw | Wynik |
|---|---|
| `npm test` | 266 / 266 |
| `plan_check` · `verify_all --data-only` · `cfa_smoke` | 0 błędów · 0 błędów (1 kontrola źródłowa pominięta — brak `SOURCES_DIR`) · 0 błędów |
| `npm run e2e` (z `run_d113`) | 1577 / 1577 |
| `npm run a11y` | 0 naruszeń |
| `npm run e2e:trening` | 0 błędów |
| `npm run e2e:sync` | 23 / 23 |
| `npm run e2e:cloud` | 100 / 100 |
| Przegląd widoków (1233 renderów: 320, 375, 390, 768, 1024, 1280, 1440, 1920 px; daty 16.10.2026–30.03.2027) | 0 wartości ujemnych, NaN, `undefined`, „Invalid Date”; przewijanie w poziomie przy 1024 px (pasek górny) — naprawione |

Do sprawdzenia na iPhonie (Safari i aplikacja z ekranu początkowego): tryb zakupów — odhaczenie na iPhonie widoczne na MacBooku po
synchronizacji; odhaczanie dawek; sygnał przerwy w Treningu (dźwięk przy włączonym ekranie); Ustawienia → akcent i rozmiar tekstu;
przewijanie „Dziś” (bez szarpania, D-112); podgląd dnia w Kalendarzu.
