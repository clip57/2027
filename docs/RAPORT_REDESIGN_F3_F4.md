# Redesign — Faza 3 (system projektowy) i Faza 4 (dashboard „Dziś”) — raport (24.09.2026)

## Weryfikacja założeń audytu w kodzie (przed Fazą 3)
| Założenie | Wynik |
|---|---|
| Niespójny arkusz | **Potwierdzone**: `styles.css` 642 linie, 17 różnych promieni, 64 wartości `padding`, 40 rozmiarów czcionki, 42 kolory wpisane na sztywno |
| Klasy używane przez testy | **Potwierdzone**: 48 klas (np. `.slot`, `.stats`, `.nowcard`, `.inv-item`, `.set`) — zachowane |
| Stały `theme-color` | **Błędne** (korekta audytu): były już dwa znaczniki dla jasnego i ciemnego motywu |
| Brak przełącznika motywu | Potwierdzone (arkusz obsługiwał `data-theme`, interfejs nie) |
| Grupowanie nawigacji | Potwierdzone jako logiczne na podstawie pól `domain` w rejestrze modułów |
| Rozmiar paczki | JS 669 KB (157 KB gzip), głównie dane planów |

## Faza 3 — system projektowy
- **Tokeny** (`src/ui/tokens.css`, jedyne źródło): kolory (tło, powierzchnie, tekst 3 poziomy, obramowania, akcent, stany, domeny), typografia (skala 7 rozmiarów), odstępy (siatka 4 px), 4 promienie, 2 poziomy głębi, ruch (z `prefers-reduced-motion`). Stare nazwy (`--paper`, `--ink`, `--line`, `--r-1`…) działają jako aliasy — moduły dostały nową paletę bez zmian w kodzie.
- **Kontrast** policzony dla każdej pary przed wdrożeniem (tekst 16:1, akcent 6,9:1 / 8,2:1, obramowanie pól ≥ 3:1 w obu motywach).
- **Font Inter** — podzbiór 153 znaków faktycznie używanych w aplikacji: 32 KB (zamiast 133 KB pełnych plików z polskimi znakami); wariant jednoplikowy +6%.
- **Ikony Lucide** — 40 ikon, 7 KB, bez biblioteki w czasie działania; tworzone bez `innerHTML`, dekoracyjne ukryte przed czytnikami ekranu.
- **Motyw** domyślnie ciemny, przełącznik ciemny / jasny / systemowy (panel boczny, strona „Więcej”); ustawiany przed pierwszym renderem (bez błysku jasnego ekranu); pasek przeglądarki dopasowany do motywu.
- **Nawigacja**: panel boczny z grupami, ikonami, wyraźnym stanem aktywnym i zwijaniem (76 px); telefon: Dziś, Dieta, Trening, CFA + „Więcej” (grupy, ikony w kolorach domen, przełącznik motywu).
- **Komponenty**: przyciski (domyślny, primary w akcencie, danger, ghost), pola formularzy, karty (jedna skala promieni i głębi), KPI, przełącznik segmentowy (tor + podniesiony aktywny element, 44 px), plakietki i filtry, komunikaty, tabele, okna — **na telefonie jako arkusz od dołu** z bezpiecznym marginesem; dolny pasek chowa się przy otwartej klawiaturze (obejście przesuwania elementów `fixed` na iOS).

## Faza 4 — dashboard „Dziś”
Wyłącznie istniejące dane (resolver + dziennik zdarzeń), bez metryk fikcyjnych:
- nagłówek z datą, fazą, sesją, kcal i nawigacją po dniach; skróty (jadłospis, suplementacja, trening, bloki CFA);
- karta **„Teraz”** z pierścieniem postępu dnia (numer bieżącego punktu planu);
- 4 kafle: **Dieta** (kcal + proporcje makro), **Trening** (serie wykonane / zaplanowane z dziennika), **CFA** (bloki wykonane dziś), **Zapasy** (pilne braki, najbliższe zakupy);
- karty boczne: Suplementy (liczba dawek i następna pora — bez nazw, D-064), Meal prep (kroki dziś), Zapasy (pilne pozycje), Plan CFA (postęp całego planu), **Aktywność treningowa** (siatka 6 tygodni z dziennika);
- plan dnia bez zmian merytorycznych.
Układ: komputer — kolumna główna + przyklejona kolumna boczna; tablet — karty boczne w 2 kolumnach; telefon — jedna kolumna w kolejności ważności.

## Zmienione pliki
Nowe: `src/ui/tokens.css`, `src/ui/system.css`, `src/ui/icons.js`, `src/ui/prefs.js`, `tools/icons.mjs`, `public/fonts/*` (2 × woff2 + licencja), `tools/fonts/LICENSE-lucide.txt`.
Zmienione: `src/ui/styles.css` (usunięte bloki tokenów i starej nawigacji), `src/app.js` (nawigacja, strona „Więcej”, motyw, klawiatura), `src/modules/registry.js` (grupy, ikony, sekcje telefonu), `src/modules/dzis.js` (dashboard), `src/index.html` (motyw przed renderem), `tools/build.mjs` (tokeny + fonty, także w wariancie jednoplikowym), `tests/e2e/e2e.py` (+28 kontroli), `tests/e2e/a11y.py` (motyw jawnie w obu przebiegach), `package.json` (lucide-static jako zależność deweloperska).
**Logika aplikacji, model danych, synchronizacja i format plików — bez zmian.**

## Wyniki testów
| Zestaw | Wynik |
|---|---|
| Weryfikacja danych | 407 / 0 |
| Jednostkowe | 74 / 74 |
| E2E | 812 / 0 (+28: motyw, panel, pasek 4 + Więcej, dashboard z danych) |
| Synchronizacja i aktualizacja | 19 / 0 |
| Dostępność (axe-core, 20 widoków × 2 szerokości × jasny/ciemny) | 0 naruszeń, 0 przewijania w poziomie |
| Build (web + jeden plik) | OK |

Wykryte i naprawione w trakcie: przełącznik motywu nie mieścił się w panelu; karta „Teraz” była jasna w ciemnym motywie; wielkie litery w nazwie miesiąca; zbyt ciasne kafle przy kolumnie bocznej; **karta suplementów na dashboardzie dublowała nazwy dawek z planu dnia** (sprzeczne z D-041) — zastąpiona podsumowaniem liczbowym.

## Znane ograniczenia
- Pozostałe moduły korzystają już z nowych tokenów, typografii i komponentów, ale ich układ wewnętrzny (np. ~60 różnych odstępów w starszych regułach) zostanie uporządkowany w Fazie 5.
- Brak testu w Safari/WebKit (środowisko) — wygląd na iPhonie wymaga Twojej kontroli; szczególnie arkusze od dołu i chowanie paska przy klawiaturze.
- Preferencja motywu nie synchronizuje się między urządzeniami (celowo, D-061).

## Następny krok
Faza 5: pozostałe zakładki w kolejności Trening → CFA → Dieta → Zapasy → Meal Prep → Suplementacja → Bezpieczeństwo → Rekompozycja → Dane, każdy moduł z pełną regresją.
