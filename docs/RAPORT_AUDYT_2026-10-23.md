# Audyt aplikacji „2027” — 23.10.2026

Stan kodu: `main` = `790bcef` (D-106). Audyt od zera: przeczytany cały kod aplikacji (`src/`, `tools/build.mjs`, schemat Supabase),
dynamiczna kontrola każdego dnia planu w resolverze i w przeglądarce, testy podejrzeń w Chromium z zegarem Playwright.
Bez plików źródłowych użytkownika (dane syntetyczne). **Kod nie był zmieniany** — raport to lista do decyzji.

## 1. Metoda

| Obszar | Jak sprawdzone |
|---|---|
| Kod | lektura całości: rdzeń (daty, resolver, zapis zdarzeń, walidacja, reduktor, synchronizacja plikiem i w chmurze, szyfrowanie), 15 modułów widoków, UI, build, service worker, CSP, schemat RLS |
| Plan dnia | skrypt na każdym dniu 14.10.2026–30.03.2027 (168 dni): nakładanie i luki slotów, każda dawka w jednym slocie, każdy posiłek w jednym slocie, godzina posiłku w slocie, bloki MPW P1–P7 w slotach, serie ćwiczeń w fazie, zakupy w każdym tygodniu, dni poza planem |
| MPW a plan dnia | każdy blok MPW A–C (119 dni) porównany ze slotami planu dnia |
| Interfejs | 1065 tras w przeglądarce (390 px, dotyk): każdy dzień planu w Dziś, Treningu, Suplementacji, Meal Prep i Pielęgnacji, każdy dzień CFA i MPW, Kalendarz, pozostałe widoki — błędy JS, „Błąd modułu”, artefakty „undefined/NaN/null”, przewijanie w poziomie |
| Podejrzenia | osobne testy w przeglądarce (Zapasy, stoper, północ), w Node (`.ics`, dane MPW) |
| Regresja | `npm test` 224/225 (1 pominięty), `npm run e2e` 1386/1386, `a11y` 0 naruszeń, `e2e:sync` 23/23, `e2e:cloud` 100/100, `e2e:trening` 0 błędów, `plan_check` 0 błędów |

**Wynik przeglądu 1065 tras: 0 błędów JS, 0 „Błąd modułu”, 0 artefaktów tekstowych, 0 przewijania w poziomie.**

## 2. Decyzje pilne (terminy w planie)

### D1. Bloki MPW kolidują z planem dnia — od 16.11 (za 24 dni)
Bloki MPW A 15:30, B 16:30, C 17:30 (D-095) nie zmieniły szablonu dnia („do czasu podania nowego rozkładu” — `RAPORT_MPW_D095.md`).
Kolizje w **108 ze 119 dni MPW**:

| Punkt planu dnia | Dni | Maks. nakładanie |
|---|---|---|
| Przerwa obiadowa 16:23–16:40 (blok B od 16:30) | 108 | 10 min |
| Zmywanie popołudniowe 17:33–17:45 | 108 | 12 min |
| Transport na siłownię i przebieranie 17:45–18:05 | 102 | 20 min |
| Rozgrzewka 18:05–18:15 | 68 | 10 min |
| Trening siłowy (UPPER/LOWER) od 18:15 | 16–18 każdy | 8–15 min |
| Rower / basen | 16–18 | 10–15 min |
| 2 rundy sauny (czwartki przed 07.01) | 6 | 28 min |

Symulacje MPW 15:30–18:30 (np. sob. 27.02, śr. 17.03) zachodzą na trening o 18:15. **Potrzebny nowy rozkład popołudnia od 16.11**
(np. trening później albo blok C wcześniej) — wtedy wprowadzę go jak poprzednie decyzje (`tools/extract/day_plan_d1xx.py`).

### D2. Egzamin CFA 12.11 nie jest widoczny w „Dziś” (za 20 dni)
`cfa.exam` = 2026-11-12 (czwartek). Kalendarz i moduł CFA go pokazują, ale plan dnia 12.11 to zwykły czwartek: od 8:00 sloty
„Brak bloku CFA — Poza okresem planu nauki”, 2 rundy sauny 17:55, zakupy 19:05. Egzamin MPW (21.03) jest w planie dnia jako blok —
CFA nie. Potrzebne: godzina egzaminu i układ dnia (czy sauna i zakupy zostają).

### D3. Święta i zakupy
- **31.12 (czwartek)**: zakupy 19:05–20:35 — w Sylwestra sklepy zwykle zamykają wcześnie. Razem z 24.12 bez zakupów (D-103)
  przerwa między zakupami może wynieść **17.12 → 07.01 (21 dni)**.
- **01.01 (piątek)**: UPPER 2 + 3 bloki MPW; **06.01 (środa)**: rower + sauna — dni ustawowo wolne (siłownia/sauna mogą być zamknięte).
- Informacyjnie (zgodne z decyzjami): bez zakupów w tygodniu 02–08.11 (05.11 — D-101), więc 29.10 → 12.11 = 14 dni.

## 3. Błędy (potwierdzone)

| # | Waga | Gdzie | Błąd i dowód |
|---|---|---|---|
| B1 | średnia/wysoka | Zapasy → „Cofnij” | Cofnięcie zmiany stanu wpisuje dzisiejszą datę z ilością **poprzedniej inwentaryzacji bez odliczenia zużycia od tamtego dnia**. Test: 26.10 stan 1000 g, 29.10 wyliczone 760 g, omyłkowo 5 g → „Cofnij” = **1000 g** (powinno 760 g). Drugie „Cofnij” znów ustawia 5 g — to przełącznik, nie historia. (Cofnięcie zakupu z wcześniejszą datą też jest datowane „dziś”.) „Przywróć ten stan” w Historii liczy poprawnie. |
| B2 | średnia | Zapasy → pole „Stan” | Wyczyszczenie pola zapisuje **stan 0** (`Number('') === 0`) — pozycja dostaje „⛔ BRAK (0)”. Potwierdzone testem (zdarzenie `inv.count` qty 0). |
| B3 | średnia/wysoka | „Dziś” i nawigacja | Widok nie odświeża się sam: po powrocie do aplikacji następnego dnia (iPhone wznawia aplikację z ekranu początkowego) **zostaje wczorajsza data, a „Teraz” pokazuje „Sen (8 h)”**. Test: 26.10 23:50 → +9 h, `visibilitychange` → nadal „Poniedziałek, 26 października”. Karta „Teraz” nie zmienia się też w ciągu dnia (brak zegara); zakładka CFA → MPW 12.11 przełączy się dopiero po nawigacji. |
| B4 | niska/średnia | Trening → stoper | Stoper uruchomiony i niezatrzymany ponad 24 h nie da się zatrzymać: „Zakończ trening” liczy ≥ 1440 min, walidacja `train.session` odrzuca („Odrzucono niepoprawne dane”), stoper biegnie dalej; wpis minut ręcznie też nie kończy (zostaje `start` bez `end`). Potwierdzone testem. |
| B5 | średnia/niska | Dane → plik `.ics` | Kategoria „Trening, basen i sauna” **nie eksportuje basenu (niedziele), 2 rund sauny (czwartki) ani saun po treningu** — `KEY` budowany tylko ze slotów szablonu bazowego, warianty mają inne identyfikatory. Sprawdzone: 25.10 i 12.11 bez wydarzeń treningowych. |
| B6 | niska | „Dziś” → karta MPW | Opis „159 min · od 15:30” wpisany na sztywno — w 11 czwartków od 07.01 bloki są od 16:00. W 06.03 i 13.03 (P1–P7 + symulacja, 10 bloków) opis mówi tylko o symulacji 15:30–18:30. |
| B7 | niska | Ikony | `tools/icons.mjs` (`/([a-z-]+)=/`) gubi atrybuty z cyframi (`x1`, `y2`) — ikony **timer** (licznik przerwy, „Odczekaj”) i **monitor** („Motyw: Systemowy”) rysują się bez linii. Poprawka: `[a-z0-9-]+` i regeneracja. |
| B8 | niska | Trening → Statystyki | „Seria: N tygodni z rzędu” (`streakWeeks`) pomija dni z samym wpisem basenu/roweru (D-106), choć „Treningi” i wykres tygodniowy je liczą. |
| B9 | niska | Pielęgnacja → edycja kroku | Lista „Powiązanie z planem dnia”: sloty czwartkowe (`…z`, wariant `czwartek_zl`) opisane „(sobota)”; powtórzone pozycje (17:45 ×3, mycie głowy ×3 z różnymi godzinami). |
| B10 | niska | Wiele kart/okien | Zmiana w innej karcie otwiera nowe połączenie IndexedDB i pełne przeliczenie stanu; poprzednie połączenia nie są zamykane (`app.js`, kanał `p2027`). Przy długiej pracy w dwóch oknach — narastające zużycie pamięci (wniosek z kodu, nie mierzone). |

## 4. Ryzyka ukryte (dziś bez skutków)

| # | Opis |
|---|---|
| R1 | Chmura: wiersz odrzucony przez walidację starszej wersji (znany typ, np. `cfa.done` z blokiem > 432) trafia do „widzianych” i **nie wraca po aktualizacji** aplikacji na tym urządzeniu. D-106 już łagodne; ryzyko przy przyszłych zmianach walidacji. |
| R2 | Import `postep-nauki.json` znakuje bloki bieżącą wersją planu CFA (15) — plik z innego planu oznaczyłby inne bloki. Plan CFA kończy się 11.11. |
| R3 | Meal Prep: klucz kroku `blok × 100 + krok`, walidacja `prep.step` `idx < 200` — karta z 3 blokami kroków byłaby niezapisywalna (dziś maks. 102). |
| R4 | Kopia przed pobraniem z chmury liczona „raz na dzień” wg daty UTC (`toISOString`) — nieszkodliwe przesunięcie o 1–2 h. |

## 5. Ulepszenia (propozycje)

| # | Propozycja |
|---|---|
| U1 | Po 11.11 plan dnia ma przez 4,5 miesiąca 9 slotów „Brak bloku CFA — Poza okresem planu nauki” dziennie — nazwać je „Czas własny” / zwinąć (razem z D1). |
| U2 | CI (`pages.yml`) uruchamia tylko `npm test`; E2E, a11y i `plan_check` tylko ręcznie — dodać zadanie z Playwright albo przynajmniej `plan_check.mjs`. |
| U3 | Skróty klawiaturowe: brak `g` dla MPW, Kalendarza, Pielęgnacji; `g c` prowadzi do CFA także po 12.11. |
| U4 | Trening: pasek dni zawsze z bieżącego tygodnia — po otwarciu innej daty (Kalendarz, Historia) wybrany dzień nie jest widoczny; brak przełączania tygodni. |
| U5 | Komentarze w kodzie z nieaktualnymi datami (12.10, 16.10, 19.10, 23.11 — `resolver.js`, `dieta.js`, `kalendarz.js`, `training.js`); logika jest z danych, więc tylko mylące. `PRZEKAZANIE.md` §4 p. 2 (`UPGRADE`) jest już wykonany (reguły do D-103c i D-104). |
| U6 | Paczka JS 1,5 MB — `cfa.json` (0,75 MB) ładowany także po zakończeniu CFA; leniwe ładowanie planów nauki. |
| U7 | CSP produkcyjna dopuszcza `http://localhost:*` (potrzebne tylko testom `e2e:cloud`) — można zostawić tylko w buildzie testowym. |
| U8 | Kopie automatyczne w Dane można tylko pobrać — import scala zdarzenia, więc nie cofa stanu (wyjaśnić w opisie albo dodać przywracanie stanów magazynu jak w Historii Zapasów). |

## 6. Co działa poprawnie (sprawdzone)

- Daty liczone od południa czasu lokalnego — zmiana czasu 25.10.2026 i 28.03.2027 nie przesuwa dni; `.ics` z VTIMEZONE.
- Zapis: weryfikacja odczytem, kwarantanna z odzyskiwaniem, zdarzenia z nowszej wersji zachowane (D-056), przyrostowy reduktor = pełny.
- Synchronizacja: import idempotentny, suma kontrolna; chmura — AES-GCM-256 z AAD, PBKDF2 600 000, HMAC identyfikatorów, klucze nieeksportowalne, odrzucanie kluczy sekretnych; RLS wymuszone, wiersze bez edycji, brak uprawnień `anon`.
- DOM wyłącznie przez `h()` — brak `innerHTML`/`eval` w `src/`; CSP w wariancie web.
- Plan dnia: każda dawka i każdy posiłek w dokładnie jednym slocie przez cały plan; jedyne nakładania — 2 znane i zaakceptowane (D-101).
- Dni poza planem mają w danych resolvera posiłki i kcal, ale żaden widok ani obliczenie ich nie używa (sprawdzone: Dziś, Zapasy, zużycie).
