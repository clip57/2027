# Plan przebudowy modułów Pielęgnacja, Suplementacja, MPW i CFA — research i propozycja (22.11.2026)

Polecenie użytkownika (22.11.2026): „Zaplanuj poprawę wyglądu modułów jak Pielęgnacja, Suplementacja, MPW i CFA, bo uważam, że nie są nowoczesne
i wręcz przestarzałe. Zrób dokładny research, który pozwoli to zdecydowanie unowocześnić i zrobić bardziej interaktywnym na poziomie najlepszych stron.”

**Status (22.11.2026): wdrożony jako D-119** — decyzje §9: „Instrument+” we wszystkich 4 modułach, bez prototypu, **bez haptyki**, szacunek tempa — tak, nowe typy danych — po przebudowie. Szczegóły i odstępstwa: `docs/RAPORT_D119.md`.
Podstawa: zrzuty obecnych widoków (24.11.2026, 390 i 1280 px, motyw ciemny, dane syntetyczne w Pielęgnacji), przegląd kodu modułów
(`pielegnacja.js`, `suplementy.js`, `study.js`, `cfa.js`, `mpw.js`, `study_focus.js`) i research źródeł zewnętrznych (§10).

---

## 0. W skrócie

- **Problem nie jest w kolorach, tylko w konstrukcji ekranów.** Te cztery moduły dostały w D-114 wspólną warstwę „Instrument” (paleta, krój, pasek
  zakładek), ale nie dostały **własnego przyrządu i własnej logiki ekranu**. W efekcie to długie listy jednakowo ważnych kart, w których
  najważniejsza rzecz („co mam zrobić teraz”) bywa poniżej ekranu, a dane są pokazywane jako surowy tekst (np. nazwy plików `.pdf`).
- **Kierunek (rekomendacja): „Instrument+”** — kontynuacja systemu z „Dziś” i Treningu: każdy moduł dostaje **jeden przyrząd-sygnaturę**,
  **„teraz” na górze**, **wiersz 2.0** (odhaczenie, które domyka i zwija), **arkusze szczegółów z płynnym przejściem**, **układ dwukolumnowy
  na komputerze** i **tryby skupienia** tam, gdzie czynność trwa (rutyna pielęgnacji, blok nauki).
- **Interaktywność „jak najlepsze aplikacje”** dają głównie nowe możliwości Safari, które użytkownik ma już na urządzeniach: przejścia widoków
  (View Transitions, Safari 18), animacje sterowane przewijaniem i pozycjonowanie względem kotwicy (Safari 26), sprężyste krzywe `linear()`
  (Safari 17.2), wejścia elementów `@starting-style` (Safari 17.5), przyciski sterujące oknami bez JavaScriptu (Safari 26.2), stylowane listy
  wyboru (Safari 27) oraz — na iPhonie — **haptyka** przy odhaczaniu (Safari 18). Wszystko jako stopniowe ulepszenie z bezpiecznym zapasem.
- **Bez zmian w danych i synchronizacji.** Dwie funkcje wymagałyby nowych danych („pominięte” jako trzeci stan, powtórki z error logu) —
  są oddzielone i czekają na decyzję (§9).
- **Proces jak w D-114:** fundament → prototyp (Suplementacja + Nauka „Dzień”) do akceptacji na iPhonie → reszta → publikacja po „Publikuj”.

---

## 1. Diagnoza — co dziś postarza te moduły

### 1.1 Problemy wspólne (wszystkie cztery moduły)

| # | Problem | Gdzie widać (zrzuty 24.11) | Skutek |
|---|---|---|---|
| W1 | **„Teraz” nie jest na górze** | Nauka: panel „Zaległe z poprzednich dni: 11” (5 dużych kart) stoi **przed** blokami dnia — dzisiejszy blok E zaczyna się ok. 1900 px niżej (390 px) | najczęstsza czynność wymaga przewijania; zaległości dominują ekran i zniechęcają |
| W2 | **Wszystko ma tę samą wagę** | karty w kartach: panel → karta kroku → ramka; ten sam rozmiar tytułu dla pory dnia, kroku i nagłówka | brak hierarchii, oko nie wie, gdzie patrzeć |
| W3 | **Surowe dane zamiast informacji** | „CFA Level I 2027 Vol 1. Quantitative Methods.pdf, PDF 25–36 · druk 15–26” jako tytuł bloku; „0/3” w każdej komórce kalendarza; statystyki planu jako lista „termin: wartość”; mocki jako podkreślone linki w liście punktowanej | interfejs wygląda jak wydruk danych, nie jak aplikacja |
| W4 | **Brak przyrządu** | „Dziś” ma tarczę dnia, Trening tryb skupienia; tu tylko generyczny pierścień „0%” | moduły nie mają charakteru ani szybkiego odczytu stanu |
| W5 | **Odhaczenie nie domyka** | po odhaczeniu wiersz zostaje na miejscu, nic się nie zwija ani nie podsumowuje | lista nie „topnieje” w ciągu dnia — brak poczucia postępu |
| W6 | **Komputer = rozciągnięty telefon** | Nauka 1280 px: jedna kolumna ok. 950 px, wiersze tekstu przez całą szerokość; Pielęgnacja „Tydzień”: siedem prawie pustych kart | marnowane miejsce, długie linie tekstu, brak panelu podsumowań |
| W7 | **Wykresy jak dodatki** | heatmapa „Wykonanie dni” z kwadratami ok. 8 px; postęp działów jako cienkie paski bez odczytu | dane są, ale nie zapraszają do interakcji |
| W8 | **Zakładki widoku ucięte na telefonie** | „Dzień · Harmonogram · Kalendarz · Error l…” (390 px) | nie widać, że jest „Plan”; wygląda na błąd |

### 1.2 Problemy modułów

- **Suplementacja** — oś z godzinami jest dobrym pomysłem, ale ekran ma ok. 2600 px: każda dawka to duży okrąg + nazwa + plakietka + opis + czasem
  druga plakietka (przy długich nazwach plakietka spada do nowej linii); minione pory zostają rozwinięte; przycisk „Przyjęte wszystkie o 09:00”
  wygląda jak etykieta, nie jak główne działanie; brak informacji, ile zostało do następnej pory i ile zapasu starczy.
- **Pielęgnacja** — trzy panele pór z grubą lewą krawędzią i kartami kroków w środku (karty w kartach); kroki doraźne i z ostrzeżeniem
  wyglądają prawie tak samo; „Odczekaj 10 min” to zwykły przycisk, choć to naturalny moment na tryb krok po kroku; „Tydzień” na komputerze
  to siedem kart „0 / 5” z cienkim paskiem; „Produkty” i „Plan” są listami bez struktury czasu (okresy od–do nie są widoczne na osi).
- **MPW i CFA** (wspólny `study.js`) — nagłówek z dwoma „chipami” i pierścieniem, potem cztery-pięć zakładek (ucięte), panel zaległych,
  dopiero potem dzień; blok to kafelek z literą + 4–6 linii tekstu + plakietki (tryb, godziny, nr, LOS/KNF, priorytet) + „Zadania bloku”;
  „Harmonogram” to 451 / 392 takich wierszy; „Kalendarz” to miesiące z „0/3” w każdej komórce; „Plan” łączy wykres tempa, mikroskopijną
  heatmapę, listę działów z cienkimi paskami, listę mocków z linkami i tabelę statystyk — pięć różnych stylów na jednym ekranie.

### 1.3 Co jest dobre i zostaje

Oś pór w Suplementacji, odhaczanie punktowe bez przerysowania (P2), gesty z odpowiednikiem przyciskiem, minutnik 53 min i tryb skupienia Nauki,
licznik odczekania w Pielęgnacji, wykres tempa z odczytem pod palcem (`charts.js`), kolory domen, ciemny motyw i OLED, szybkość (dotknięcie →
zmiana 16 ms). Plan tego nie wyrzuca — przestawia i dopracowuje.

---

## 2. Research — czego uczą najlepsi

### 2.1 Dawki i leki
- **Apple Zdrowie → Leki** (iOS 16–18): każdy lek ma **kształt i kolor** wybrany jako wizualny znak rozpoznawczy; dawki loguje się jako
  **„Przyjęte / Pominięte”**, z powiadomienia jest **„Oznacz wszystkie jako przyjęte”**; po 30 min przypomnienie uzupełniające; widok historii
  pokazuje **regularność z 28 dni**. Wniosek: tożsamość wizualna preparatu + jedna akcja na porę + historia regularności.
- Badania użytkowników aplikacji przypominających (Stanford CS147, „Pill Pal”, 2025): główny kłopot to często nie zapominanie, tylko
  **niepewność, czy już wziąłem** — stąd wyraźny, trwały stan „przyjęte o 09:04” i podsumowanie pory zamiast samego okrągłego pola.

### 2.2 Rutyny i nawyki
- **Streaks**: nawyk jako **duży przycisk** (dotknij i przytrzymaj = zrobione), świadome ograniczenie liczby elementów na ekranie.
- **Tiimo** (iPhone App of the Year 2025): dzień podzielony na **poranek / dzień / wieczór**, szczypnięcie przełącza listę ↔ oś czasu,
  ikona i kolor każdej czynności, **spokojne odliczanie** w trybie skupienia, pasek „ile zostało czasu”.
- **Aplikacje pielęgnacyjne** (SkinJourney, „Skincare Routine: AM PM”, Mimoglow): **wyraźnie rozdzielone rano / wieczór**, odhaczenie jednym
  dotknięciem, **harmonogram każdego kroku osobno** (dni tygodnia, co kilka dni), półka produktów, ostrzeżenia **z wyjaśnieniem**.
  Krytyka w opiniach: ręczne powtarzanie rutyny i nieczytelny interfejs — czyli to, czego tu unikamy.
- **Things 3**: odhaczenie to **nagroda** (wypełnienie, znacznik, krótki dźwięk, wiersz odjeżdża) — ok. 0,5 s.
- **Gentler Streak** (Apple Design Award 2024): ton „życzliwy” — odpoczynek nie przerywa serii, spójny i spokojny język wizualny.
- **Duolingo**: seria 7 dni = 2,4 × większa szansa powrotu następnego dnia, ale **cel dzienny okazał się barierą** — seria powinna nagradzać
  pojawienie się, nie karać za niedokończenie.

### 2.3 Nauka do egzaminu
- **UWorld**: trzy poziomy analizy — **przegląd → podział na przedmioty/działy → trend w czasie**; z raportu można od razu utworzyć sesję
  z najsłabszych działów.
- **AMBOSS**: działy z jasną etykietą stanu („Building Up” / „Proficient”) zamiast samych procentów.
- **Khan Academy**: poziomy opanowania z ikoną i opis **„3 z 22 umiejętności do poziomu Proficient”** — liczba do celu zamiast abstrakcyjnego %.
- **Anki / FSRS**: kalendarz-heatmapa aktywności, prognoza obciążenia, wykres retencji — dane z historii, nie ozdoby.
- **Oura (2025)**: ekran „Today” z **„One Big Thing”** — jedna najważniejsza rzecz na dziś na górze, wskaźniki jako skróty.

### 2.4 Rzemiosło interfejsu
- **Linear** (odświeżenie 03.2026 „A calmer interface”): **mniej linii i separatorów, miększe krawędzie i kontrast**, łatwiejsze skanowanie;
  wersja mobilna 2025 — matowe szkło na elementach pływających.
- **Rauno Freiberg (Vercel), „Invisible Details of Interaction Design”** i **Vercel Web Interface Guidelines**: interakcja ma odpowiadać na
  intencję (przewidywalne gesty, przerywalny ruch, cele dotykowe = cele wizualne, natychmiastowa odpowiedź).
- **Emil Kowalski, „Great Animations”**: krótkie, przerywalne animacje na właściwościach sprzętowych (`transform`, `opacity`), `ease-out` przy
  wejściu, zawsze szacunek dla „ogranicz ruch”.
- **Bento grid** (Apple, SaaS 2024–2026): kafle różnej wielkości tworzą hierarchię bez dodatkowych ozdobników; na telefonie — kolejność wg ważności.
- **Apple Liquid Glass (iOS 26)**: szkło tylko dla nawigacji i elementów pływających, nie dla treści — zgodne z D-110/D-114 (bez zmian).

### 2.5 Platforma — co działa na iPhonie i Macu (Safari)

| Możliwość | Od wersji Safari | Do czego w modułach | Zapas, gdy brak |
|---|---|---|---|
| View Transitions (w obrębie strony) | 18 (`match-element` 18.4) | wiersz → arkusz szczegółów, zmiana zakładki widoku, zmiana dnia | zwykła zmiana bez animacji |
| `@starting-style` + `allow-discrete` | 17.5 | wejście arkuszy, popoverów, nowych wierszy | brak animacji wejścia |
| `linear()` (krzywe sprężyste) | 17.2 | domknięcie wiersza, „przyklejenie” po geście | `cubic-bezier`; uwaga: w wydanym Safari animacje `linear()` mogą gubić klatki (WebKit 312407) — tylko krótkie animacje `transform`/`opacity` |
| Animacje sterowane przewijaniem | 26 (w 27 — wątkowe dla `transform`/`opacity`) | duży tytuł zwija się do paska; postęp przewijania ścieżki nauki | statyczny nagłówek (bez kodu w zdarzeniu `scroll` — zasada D-114) |
| Pozycjonowanie względem kotwicy + `popover` | 26 (popover 17) | podgląd dnia z heatmapy, dymki wykresów, menu wiersza | arkusz od dołu |
| `command` / `commandfor` | 26.2 | otwieranie arkuszy i popoverów bez JS | obecne przyciski z JS |
| `field-sizing: content` | 26.2 | pola error logu i notatek rosną z tekstem | stała wysokość |
| Stylowany `select` (`appearance: base-select`) | 27 | filtry harmonogramu w stylu aplikacji | systemowa lista |
| `text-wrap: pretty` | 26 | tytuły bloków i kroków bez „sierotek” | zwykłe łamanie |
| Haptyka przez `<input type=checkbox switch>` | iOS 18 (źródła: 17.4/18.0) | lekkie „stuknięcie” przy odhaczeniu na iPhonie | brak (komputer) |
| Wake Lock, Badging | 18.4 / 16.4 (aplikacja z ekranu początkowego) | ekran nie gaśnie w trybie rutyny i bloku; (plakietka — decyzja 6 audytu) | — |

Uwaga o wersjach: cel buildu pozostaje `safari16`; każda z tych funkcji jest dodatkiem wykrywanym przez `@supports` / sprawdzenie API.
Strony webkit.org nie były osiągalne z sesji — wersje potwierdzone wynikami wyszukiwania (§10), do ponownego sprawdzenia przy wdrożeniu.

---

## 3. Zasady przebudowy (wspólne)

1. **Jedna najważniejsza rzecz na górze** (Oura „One Big Thing”, Tiimo): następna pora / następny krok / bieżący blok — z główną akcją w zasięgu kciuka.
2. **Jeden przyrząd na moduł** (sygnatura jak tarcza w „Dziś”): pierścień pór (Suplementacja), trzy pierścienie pór dnia (Pielęgnacja),
   mapa materiału i ścieżka do egzaminu (Nauka). Przyrząd jest zawsze **interaktywny** (dotknięcie = przejście do miejsca).
3. **Wiersz 2.0** zamiast karty w karcie: wiodący znak (kapsuła preparatu / litera bloku / ikona obszaru), tytuł, jedna linia kontekstu,
   akcja z prawej; szczegóły w arkuszu. Minimum linii i ramek (Linear 2026).
4. **Odhaczenie domyka**: animacja znacznika (≈0,4 s), haptyka na iPhonie, wiersz przesuwa się do zwiniętej grupy „zrobione” —
   lista topnieje w ciągu dnia (Things). Cofnięcie zawsze możliwe (przycisk i gest).
5. **Informacja zamiast surowych danych**: nazwy plików → „Vol 1 · Quantitative Methods · s. 15–26”; „0/3” w kalendarzu → nasycenie koloru;
   statystyki → kafle z liczbą i opisem „ile do celu” (Khan).
6. **Komputer ≠ duży telefon**: od 1100 px dwie kolumny — lista (ok. 640 px) + przyklejony panel przyrządów (ok. 360 px); od 1440 px
   dodatkowe kafle (bento).
7. **Ruch jako odpowiedź**: przejścia widoków (View Transitions), sprężyste domknięcia, wejścia `@starting-style`; nic w pętli;
   „ogranicz ruch” = natychmiastowe zmiany.
8. **Zakładki widoku zawsze widoczne**: na telefonie maksymalnie 4 + „więcej”, albo przewijany pasek z wyraźną krawędzią (dziś ucięte).
9. **Tylko prawdziwe dane** (zasada §3.6): żadnych „wyników” i „gotowości” bez źródła; prognozy (np. tempo nauki) wyraźnie oznaczone jako szacunek.
10. **Klasy testowe zostają** (`docs/REDESIGN-TESTING.md`): zmienia się wygląd i układ; gdy struktura musi się zmienić — test w tym samym kroku.

---

## 4. Projekt modułów

### 4.1 Suplementacja — „pierścień pór” i pory, które się domykają

```
 telefon 390 px
┌────────────────────────────────────────┐
│ Suplementacja            ‹ wt 24.11 ›   │ ← duży tytuł zwija się do paska przy przewijaniu
│  ╭────────╮   7 z 16 dawek               │
│  │ ◔ ◑ ●  │   Następna: Lunch 13:20      │ ← odliczanie z planu
│  │ 8 pór  │   za 2 h 40 min              │
│  ╰────────╯   [ Przyjmij lunch (2) ]     │ ← główna akcja
├────────────────────────────────────────┤
│ ✓ 07:00 Pobudka · 1 dawka · 07:04       │ ← minione pory zwinięte do jednej linii
│ ✓ 09:00 Śniadanie · 5 dawek · 09:12     │
│ ◐ 13:20 Lunch              [Wszystkie]  │ ← następna pora rozwinięta i wyróżniona
│   ⬭ Glukozamina        1 kaps.     ○    │   kapsuła w kolorze preparatu
│   ⬭ Witamina C         100 mg      ○    │
│ ○ 17:15 Pre-trening · 4 dawki           │
│ ○ 20:15 · ○ 21:00 · ○ 22:00             │
├────────────────────────────────────────┤
│ Regularność · 28 dni   ▦▦▦▦▦▦▦▦▦▦▦▦     │ ← z zapisanych odhaczeń
│ Zapas   Chondroityna ▓▓▓▓░ do 14.01      │ ← z Zapasów
└────────────────────────────────────────┘
```

- **Przyrząd: pierścień pór** — 8 łuków (pory dnia) na tarczy 24 h jak w „Dziś”; łuk wypełnia się, gdy wszystkie dawki pory są przyjęte;
  dotknięcie łuku przewija do pory. Ten sam komponent co tarcza dnia (`dial.js`), inny zestaw łuków.
- **Tożsamość preparatu** (Apple Zdrowie): mała ikona kształtu wyprowadzona z istniejącej jednostki (kaps. → kapsuła, g → miarka proszku,
  mg → tabletka) i kolor z palety domeny przypisany na stałe do preparatu — **bez nowych danych**.
- **Pory**: minione i ukończone zwijają się do jednej linii z godziną odhaczenia (odpowiedź na „czy już wziąłem?”); następna pora rozwinięta,
  z przyciskiem „Przyjmij wszystkie” jako główną akcją; pora nieprzyjęta po czasie — spokojny znacznik „nieprzyjęte”, bez czerwieni.
- **Dawka**: dotknięcie = przyjęta (animacja + haptyka), gest w prawo/lewo jak dziś; szczegóły (opis, uwaga „na czczo”, zapas) w arkuszu.
- **Regularność 28 dni**: heatmapa preparat × dzień z zapisanych odhaczeń (`supp.dose:*`); dotknięcie komórki — podgląd dnia (popover).
- **Zapas**: pasek „starczy do …” z Zapasów; przy braku stanów — zaproszenie do ustawienia (jak dziś).
- **Komputer**: lewa kolumna — pory; prawa — przyrząd, „Preparaty” (tabela z harmonogramem i zapasem), regularność.

### 4.2 Pielęgnacja — trzy pory, tryb rutyny i plan na osi czasu

```
┌────────────────────────────────────────┐
│ Pielęgnacja              ‹ wt 24.11 ›   │
│  ( Rano ◕ )  ( Dzień ○ )  ( Wieczór ○ ) │ ← trzy pierścienie pór — dotknięcie = przejście
├────────────────────────────────────────┤
│ RANO · 07:00                    2 z 3  │
│ [ ▶ Rozpocznij rutynę ]                 │ ← tryb rutyny (pełny ekran)
│  ✓ ◍ Twarz   krok poranny 1  Produkt A  │
│  ○ ◍ Twarz   krok poranny 2             │
│      ⚠ ostrzeżenie (rozwinięte)         │
│      ⏱ potem 10 min przerwy             │
│  ○ ◍ Jama ustna  krok poranny 3         │
│ W CIĄGU DNIA · 0 z 1   (+1 doraźnie)    │
│ WIECZÓR · 21:00 · 0 z 1                 │
└────────────────────────────────────────┘

 tryb rutyny
┌────────────────────────────────────────┐
│ Rano · krok 2 z 3          ●●○          │
│ TWARZ                                   │
│ Krok poranny 2                          │ ← duży tekst
│ ⚠ ostrzeżenie                           │
│        [ Gotowe ]                       │
│ → po „Gotowe”: pierścień odliczania 10:00│ ← z pola `wait`; sygnał na końcu
│   „Następny: krok poranny 3”            │
└────────────────────────────────────────┘
```

- **Przyrząd: trzy pierścienie pór** (rano / w ciągu dnia / wieczór) z liczbą kroków; bieżąca pora wyróżniona.
- **Tryb rutyny** (nowy, na wzór trybu skupienia Treningu i Nauki — wspólna powłoka `focus.js`): jeden krok naraz, duży tekst, ostrzeżenie,
  produkt; „Gotowe” zapisuje `care.done`; jeśli krok ma `wait`, **automatyczny pierścień odliczania** do następnego kroku (sygnał dźwiękowy
  z `signal.js`, ekran nie gaśnie — Wake Lock). Wszystko z istniejących danych planu.
- **Wiersz kroku**: ikona obszaru (twarz, włosy, ciało, jama ustna…), produkt jako „etykieta butelki” ze stanem (używany / zapas / skończony),
  reguła dni jako **siedem kropek tygodnia** zamiast tekstu „PN i PT do 25.10”; kroki doraźne w osobnej, cichszej grupie.
- **Tydzień**: **macierz kroki × dni** (kropki jak w nawykach) zamiast siedmiu kart; dotknięcie dnia — przejście; na komputerze cały tydzień
  na jednym ekranie.
- **Produkty**: „półka” — karty produktów pogrupowane wg stanu, z liczbą użyć i datą ostatniego użycia (z `care.done`). Bez dat ważności —
  nie ma ich w danych (byłyby nowym polem planu — §9).
- **Plan**: **oś czasu okresów** (od–do) każdego kroku — widać, co się kończy i zaczyna (dziś informacja jest rozproszona w tekstach).
- **Prywatność bez zmian**: treść planu tylko w danych użytkownika; testy i zrzuty wyłącznie z `fixtures.synthetic_care_plan()`.

### 4.3 Nauka (CFA i MPW — wspólny moduł) — „teraz”, ścieżka do egzaminu i mapa materiału

```
 Dzień (telefon)
┌────────────────────────────────────────┐
│ CFA · egzamin 13.05 · 170 dni   1/451  │ ← zwija się do paska
│ ┌ TERAZ ─────────────────────────────┐ │
│ │ E · 12:20–13:13            LEKTURA  │ │
│ │ The Time Value of Money in Finance  │ │ ← tytuł = temat
│ │ Vol 1 · Quantitative Methods · s. 147–158 │ ← zamiast nazwy pliku
│ │ [ ▶ Start 53 min ] [ Skupienie ] [✓]│ │
│ └─────────────────────────────────────┘ │
│ Dziś  E ●  F ○  G ○           0 z 3     │ ← oś bloków dnia (dotknięcie = blok)
│  F 13:30  The Time Value…   s. 159–170 │
│  G 14:30  …                             │
│ ⚑ Zaległe: 11 bloków   [ Plan nadrabiania ] │ ← jeden pasek, lista w arkuszu
│ QM ▓▓░░░░░ 6 z 52 bloków · do 04.12     │ ← bieżący dział
└────────────────────────────────────────┘
```

- **Dzień**: „Teraz / Następny” na górze z minutnikiem 53 min i trybem skupienia; **oś bloków dnia** (litery na osi godzin); **zaległe jako jeden
  pasek** z arkuszem „Plan nadrabiania” (lista od najstarszych; bez zmian w danych — tylko inny układ, zaległe dalej odhacza się tak samo).
- **Wiersz bloku 2.0**: litera + godziny jako „pigułka czasu”; tytuł = temat; linia źródła sparsowana z `zrodlo` / `do_przeczytania`
  („Vol 1 · Quantitative Methods · s. 147–158 (12 s.)”); LOS / KNF i priorytet jako ciche znaczniki; „Zadania bloku” rozwijane w miejscu
  (płynna wysokość) lub w arkuszu.
- **Harmonogram → Ścieżka do egzaminu**: pionowa oś tygodni z **pasmami faz** (lektura → pierwsze podejście → powtórka → mocki → egzamin),
  kamienie milowe (mocki, egzamin, koniec działu), znacznik „dziś”; dni minione zwinięte do jednej linii z wynikiem dnia; filtr i wyszukiwanie
  jak dziś. Długa lista (451 / 392 bloki) z `content-visibility` (budżet węzłów DOM).
- **Kalendarz → heatmapa**: nasycenie koloru = część bloków dnia wykonana (zamiast „0/3” w każdej komórce), mocki i egzamin jako znaki;
  dotknięcie dnia — podgląd (popover z kotwicą, na telefonie arkusz).
- **Plan → Mapa materiału**: kafle działów (CFA: 10 działów; MPW: źródła / kategorie) z wypełnieniem = bloki działu wykonane, liczbą stron i datami;
  opis „4 z 52 bloków do końca lektury” zamiast samego %. Poziomy wyłącznie z planu (nie przerobione / w toku / przerobione) — **nie** „opanowane”,
  bo nie mamy wyników testów. Wykres tempa (plan vs wykonane) z odczytem pod palcem + **szacunek** „przy obecnym tempie: koniec ok. …” (decyzja §9).
  Mocki jako oś z wynikami odhaczeń zamiast listy linków; statystyki jako kafle (bento).
- **Error log**: karty z kolorem rodzaju błędu, szybki wpis z trybu skupienia, filtr rodzaju jako pasek; (powtórki w rosnących odstępach — nowy stan, §9).
- **Dwa plany naraz** (do 21.03): zostają dwa osobne moduły (bez usuwania zakładek — zasada §3.10); w „Dzień” każdego planu krótka
  wzmianka o drugim („MPW dziś: A–C od 15:30”) z przejściem jednym dotknięciem.
- **Komputer**: lewa kolumna — dzień / ścieżka; prawa — przyrząd (odliczanie do egzaminu, mapa materiału w miniaturze, tempo).

---

## 5. Wspólne komponenty i technika

| Komponent | Plik | Technika | Używa |
|---|---|---|---|
| Wiersz 2.0 (`row`) | `src/ui/components.js` | `h()`, gest `swipeRow`, haptyka, domknięcie `linear()` | wszystkie 4 moduły |
| Zwijana grupa „zrobione” | `components.js` | `<details>` + `@starting-style`; stan rozwinięcia po kluczu (T2) | Suplementacja, Pielęgnacja, Nauka |
| Pierścień segmentów | `src/ui/dial.js` (rozszerzenie) | SVG, rola `slider`/przyciski łuków | Suplementacja, Pielęgnacja |
| Heatmapa 2.0 | `src/ui/charts.js` | SVG, komórki ≥ 12 px, popover z kotwicą, klawiatura | regularność, kalendarz nauki |
| Oś / ścieżka (`pathTimeline`) | `src/ui/charts.js` lub nowy `timeline.js` | HTML + `content-visibility`, sticky nagłówki tygodni | Nauka (Ścieżka), Pielęgnacja (Plan) |
| Arkusz z przejściem | `components.js` (`sheet`) | View Transitions (`view-transition-name` na wierszu), zapas bez animacji | szczegóły dawki, kroku, bloku |
| Nagłówek kompaktowy | `instrument.css` | `animation-timeline: scroll()` (Safari 26) w `@supports`; bez JS | wszystkie 4 |
| Haptyka | `src/ui/haptic.js` (nowy, mały) | ukryty `<input type=checkbox switch>` + `label.click()` w zdarzeniu dotyku; preferencja `p2027.haptics` | odhaczenia |
| Tryb rutyny | `src/modules/care_focus.js` (nowy) na powłoce `focus.js` | jak `study_focus.js`; Wake Lock | Pielęgnacja |
| Ikona preparatu | `src/ui/icons.js` + mapowanie jednostek | SVG Lucide (`pill`, `tablets`, `flask-conical`…) | Suplementacja, Dziś |

- **Tokeny** (tylko `tokens.css`): krzywe ruchu `--ease-spring` (`linear()` z zapasem `cubic-bezier`), czasy `--t-check`, `--t-collapse`;
  kolory preparatów jako 8 odcieni domeny w OKLCH.
- **Reguły** (tylko `instrument.css`): nowe klasy obok istniejących; stare klasy testowe zachowane jako punkty zaczepienia.
- **Wydajność**: budżety bez zmian (JS ≤ 1400 KB, węzły DOM listy ≤ 8500, dotknięcie → zmiana ≤ 250 ms); długie listy z `content-visibility`;
  animacje tylko `transform` / `opacity`; zero kodu w zdarzeniu `scroll`.
- **Dostępność**: cele ≥ 44 px, kontrast AA w obu motywach, role i etykiety dla pierścieni i heatmap, „ogranicz ruch”, pełna obsługa klawiatury
  na komputerze (strzałki w osi, Enter = odhacz).

---

## 6. Proces i etapy

| Etap | Zakres | Kryterium ukończenia | Rozmiar |
|---|---|---|---|
| **1. Fundament** | wiersz 2.0, grupa „zrobione”, arkusz z przejściem, nagłówek kompaktowy, haptyka (z wyłącznikiem w Ustawieniach), heatmapa 2.0, tokeny ruchu | komponenty w testach jednostkowych i E2E; moduły bez zmian wyglądu poza nowymi elementami | M |
| **2. Prototyp** | **Suplementacja** (całość) + **Nauka → Dzień** (CFA i MPW) | zrzuty 375/390/1280/1440 × ciemny/jasny + podgląd; **Twoja akceptacja na iPhonie** | M |
| **3. Reszta** | Pielęgnacja (z trybem rutyny), Nauka: Ścieżka, Kalendarz, Mapa materiału, Error log; układ dwukolumnowy na komputerze | wszystkie widoki 4 modułów w nowym języku; budżety i a11y zielone | L |
| **4. Domknięcie** | regresja (lint, typy, jednostkowe, E2E Chromium i WebKit, a11y, budżety, strażnik wizualny), raport, decyzja D-1xx | „Publikuj” | S |

Kolejność uzasadnienie: Suplementacja jest używana najczęściej (8 pór dziennie), a Nauka „Dzień” — codziennie do 13.05.2027; to one
najbardziej zyskują na „teraz na górze” i domykaniu.

---

## 7. Testy i zabezpieczenia
- Dotychczasowe testy zostają; zmiany struktury → aktualizacja testu w tym samym kroku (zasada §3.9) i opis w raporcie.
- Nowe testy E2E: tryb rutyny z odliczaniem (zegar Playwright), „Przyjmij wszystkie” i zwijanie pór, arkusz z przejściem i bez (zapas),
  heatmapa z prawdziwych odhaczeń, nagłówek kompaktowy (WebKit), haptyka tylko po dotknięciu (brak błędów na komputerze).
- Pielęgnacja: wyłącznie `fixtures.synthetic_care_plan()`; żadnych treści planu w zrzutach.
- Strażnik wizualny: nowe zrzuty wzorcowe po akceptacji prototypu (zmiana wyglądu — bez znacznika „[wygląd bez zmian]”).

## 8. Ryzyka
- **Animacje `linear()` w Safari** mogą gubić klatki (WebKit 312407) — tylko krótkie domknięcia; w razie problemu `cubic-bezier`.
- **View Transitions w Safari 18.4** — znany błąd z nazwami przejść przy jednoczesnym wczytaniu CSS (WebKit 290146) — przejście uruchamiane
  po wyrenderowaniu; zapas bez animacji.
- **Haptyka** to obejście (nie standard) — WebKit może w przyszłości wymagać aktywacji użytkownika (zgłoszenie 285120); dlatego wywołanie
  wyłącznie w zdarzeniu dotyku i wyłącznik w Ustawieniach.
- **Zakres**: przebudowa 4 modułów to ok. 3 etapy; prototyp ogranicza ryzyko, że kierunek się nie spodoba.

## 9. Decyzje do podjęcia
1. **Kierunek wizualny**: (a) **„Instrument+”** — spójnie z „Dziś” i Treningiem (rekomendacja); (b) „miękki” — pastele i ilustracje jak
   aplikacje pielęgnacyjne, osobny charakter dla Pielęgnacji i Suplementacji; (c) mieszany — Nauka w „Instrument+”, Pielęgnacja i Suplementacja „miękkie”.
2. **Prototyp**: Suplementacja + Nauka „Dzień” (rekomendacja) — czy inna kolejność?
3. **Haptyka na iPhonie**: domyślnie włączona z wyłącznikiem w Ustawieniach (rekomendacja) / domyślnie wyłączona / wcale.
4. **Szacunek tempa nauki** („przy obecnym tempie koniec ok. …”, z prawdziwych odhaczeń): pokazywać (rekomendacja) / nie.
5. **Nowe dane (osobna zgoda — zmiana modelu danych):** „pominięte” jako trzeci stan dawki i kroku (jak „Pominięte” w Apple Zdrowie);
   powtórki wpisów error logu w rosnących odstępach; daty ważności produktów pielęgnacji. Rekomendacja: wrócić do tego po etapie 3.

---

## 10. Źródła (research 22.11.2026)

Dawki i leki: [Apple — Add and log medications](https://support.apple.com/en-ca/105064) · [Apple — Track your medications in Health](https://support.apple.com/en-bw/guide/iphone/iph811670c81/ios) ·
[TidBITS — iOS 16 Medications](https://tidbits.com/2022/10/07/an-apple-a-day-ios-16-medications-feature-provides-alerts-logging-and-peace-of-mind/) ·
[Stanford CS147 — Pill Pal (2025)](https://stanford.edu/class/cs147/projects/DesigningVoiceAIforEverydayValue/PillPal/week11-report.pdf)

Rutyny i nawyki: [The Sweet Setup — Streaks](https://thesweetsetup.com/apps/best-habit-tracking-app-ios/) · [Tiimo — App Store Awards 2025](https://www.tiimoapp.com/resource-hub/tiimo-finalist-2025-app-store-awards) ·
[Tiimo — App Store](https://apps.apple.com/app/id1480220328) · [SkinJourney](https://apps.apple.com/us/app/id6763944250) · [Skincare Routine: AM PM](https://apps.apple.com/app/id6769088962) ·
[Mimoglow](https://apps.apple.com/us/app/id1510650964) · [Things 3 — design study](https://blakecrosley.com/blog/design-study-things) ·
[Apple — Behind the Design: Gentler Streak](https://developer.apple.com/news/?id=3m0ht22s) · [Duolingo — Improving the streak](https://blog.duolingo.com/improving-the-streak)

Nauka: [UWorld — funkcje](https://Medical.UWorld.com/usmle/features/) · [AMBOSS — Analysis](https://support.amboss.com/hc/en-us/articles/42885439769233) ·
[Khan Academy — mastery](https://support.khanacademy.org/hc/en-us/articles/48411237993357-How-is-my-mastery-percentage-calculated) ·
[FSRS — optimal retention](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-optimal-retention) · [Oura — new app experience](https://ouraring.com/blog/new-oura-app-experience/) ·
[9to5Google — Oura redesign](https://9to5google.com/2025/10/20/oura-app-redesign/)

Rzemiosło: [Linear — behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh) · [Linear — UI refresh 2026-03-12](https://linear.app/changelog/2026-03-12-ui-refresh) ·
[Rauno Freiberg — Invisible Details of Interaction Design](https://rauno.me/craft/interaction-design) · [Vercel — Web Interface Guidelines](https://vercel.com/design/guidelines) ·
[Emil Kowalski — Great Animations](https://emilkowal.ski/ui/great-animations) · [SaaSFrame — Bento grids 2026](https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide) ·
[Apple — Liquid Glass](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)

Platforma: [WebKit — Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) · [WebKit — Safari 26.2](https://webkit.org/?p=17640) ·
[WebKit — Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/) · [WebKit — WWDC26](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/) ·
[WebKit — STP 234 (wątkowe animacje przewijania)](https://webkit.org/blog/17674/release-notes-for-safari-technology-preview-234/) ·
[Chrome — View transitions 2025](https://developer.chrome.com/blog/view-transitions-in-2025) · [WebKit 290146](https://bugs.webkit.org/show_bug.cgi?id=290146) ·
[Chrome — linear()](https://developer.chrome.com/docs/css-ui/css-linear-easing-function) · [WebKit 312407](https://bugs.webkit.org/show_bug.cgi?id=312407) ·
[web.dev — entry animations](https://web.dev/blog/baseline-entry-animations) · [WebKit — scroll-driven animations](https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/) ·
[Chrome — shrinking header](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-atoms/shrinking-header-on-scroll) ·
[WebKit — HTML switch](https://webkit.org/?p=15054) · [WebKit — haptyka switch (commit)](https://lists.webkit.org/pipermail/webkit-changes/2023-December/294748.html) ·
[WebKit 285120](https://bugs.webkit.org/show_bug.cgi?id=285120) · [ios-haptics](https://unpkg.com/ios-haptics@3.1.1/README.md) ·
[MDN — Invoker Commands](https://developer.mozilla.org/docs/Web/API/Invoker_Commands_API) · [MacRumors — Safari w iOS 26](https://www.macrumors.com/2025/06/18/safari-changes-on-ios-26/) ·
[WebKit — Badging](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/)

Status weryfikacji: strony webkit.org i część stron producentów nie były osiągalne bezpośrednio z sesji — fakty o wersjach i funkcjach
pochodzą z wyników wyszukiwania (streszczenia źródeł powyżej); przed wdrożeniem każdej funkcji platformy — test w WebKit (`npm run e2e:webkit`).
