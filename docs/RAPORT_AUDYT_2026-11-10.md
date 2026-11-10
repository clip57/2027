# Audyt 10.11.2026 — „baza na dekadę”: produkt, architektura, design i rozszerzenia

Polecenie użytkownika (10.11.2026): „Chciałbym, żeby design i funkcjonalność mojej aplikacji była na możliwie najwyższym możliwym poziomie
osiągalnym dla najlepszych deweloperów stron na świecie. Przeprowadź bardzo zaawansowany audyt co można poprawić, jakie funkcje dodać czy
potencjalne rozszerzenia zewnętrzne stosowania, żeby była to baza do zarządzania życiem na następną dekadę. Chcę żeby design był niezwykle
profesjonalny, interaktywny i futurystyczny.”

**Ten dokument to audyt i plan — kod aplikacji nie był zmieniany.** Wdrożenie po Twoich decyzjach z §11 (jak przy audycie 31.10: plan →
prototyp do akceptacji → reszta).

Poprzednie audyty szukały błędów w tym, co jest. Ten odpowiada na inne pytanie: **czego brakuje, żeby aplikacja była narzędziem na 10 lat,
a nie na jeden sezon** — i co dzieli ją od najwyższej półki pod względem wyglądu i interakcji. Identyfikatory w tym raporcie (S, T, M, E)
są lokalne; decyzje w §11 mają numery 1–10.

---

## 0. Najważniejsze w skrócie

| | |
|---|---|
| **Stan dziś** | Aplikacja jest stabilna i bardzo szybka: start 154 ms, od dotknięcia do zmiany na ekranie 20–49 ms (mediana), 266 testów jednostkowych, 1577 kontroli E2E, 0 naruszeń dostępności, synchronizacja szyfrowana od końca do końca. To jest poziom, którego nie wolno zepsuć (§2). |
| **Największy problem** | **Aplikacja jest odtwarzaczem jednego planu, który kończy się 28.03.2027 — za 138 dni.** Sprawdziłem ją z zegarem ustawionym na 05.04.2027 i 01.03.2028: „Dziś”, „Tydzień”, „Trening” i „Suplementacja” pokazują „Poza planem”, a Dieta i Zapasy — niespójne resztki (§3 S1). |
| **Przyczyna** | **Plan jest częścią programu.** 68% kodu JavaScript w pakiecie to dane tego jednego okresu życia; każda zmiana planu wymagała skryptu dewelopera i publikacji (8 wersji planu CFA między 25.09 a 16.10, 26 skryptów w `tools/extract`). Repozytorium jest publiczne, więc treść planu też (§3 S2). |
| **Dekada danych** | Bez zmian w magazynie start wydłuży się z 0,15 s do 4,8 s (17 s na czterokrotnie wolniejszym procesorze), pamięć z 5 do 241 MB, a plik synchronizacji urośnie do 104 MB (model: 133 zdarzenia dziennie; §3 S4). |
| **Pasywność** | Aplikacja nigdy sama się nie odzywa: zero powiadomień, plakietki na ikonie i blokady wygaszania ekranu, choć iPhone pozwala na to aplikacjom z ekranu początkowego (§3 S5). |
| **Design** | Spójny i nowoczesny, ale bez własnej sygnatury, prawie bez ruchu i bez gestów; 5 modułów jest tylko „przemalowanych”; style to trzy nałożone na siebie generacje (§6.1, §4 T1). |
| **Propozycja designu** | **System 4.0** — trzy kierunki do wyboru; rekomenduję „Instrument” (tarcza dnia, pigułka „na żywo”, gesty, tryby skupienia, ruch jako odpowiedź) i w drugim kroku „Horyzont” — jedną oś czasu od minuty do dekady (§6). |
| **Funkcje** | Jedna zasada porządkująca — **plan + odstępstwa = rzeczywistość** — i ponad 30 propozycji w modułach; do tego „rdzeń życia”: zadania, cele, pomiary, terminy, przeglądy (§7). |
| **Rozszerzenia** | 12 mostów na zewnątrz; większość bez serwera i bez kosztów (Kalendarz, Skróty, widżety, Zdrowie przez Skróty, asystent AI na Macu). Powiadomienia push wymagają Twojej decyzji, bo potrzebują nadawcy (§8). |
| **Plan** | 9 etapów (§10). Twardy termin: **silnik planów musi działać przed 28.03.2027**. |
| **Decyzje** | 10 (§11), w tym pilna i zaległa: **D1 — popołudnie od 16.11**. |

### Ocena względem najlepszych aplikacji tej klasy (skala 1–5, ocena audytora)

| Wymiar | Dziś | Co o tym decyduje |
|---|---|---|
| Szybkość dziś | **5** | start 154 ms; dotknięcie → zmiana 20–49 ms; 26–68 ms przy czterokrotnie wolniejszym procesorze |
| Niezawodność i bezpieczeństwo danych | **4,5** | dziennik zdarzeń, zgodność w przód, kwarantanna, szyfrowanie; brakuje testów w silniku Safari, dziennika błędów, prośby o trwały magazyn |
| Inżynieria | **4** | 0 zależności uruchomieniowych, pokrycie rdzenia 95–100%; brakuje typów, lintera, testów wizualnych, budżetów wydajności |
| Rzemiosło designu | **3,5** | spójna paleta i krój, czytelne „Teraz”; brak sygnatury, ruchu, gestów; nierówny poziom modułów |
| Zakres „zarządzania życiem” | **2** | pięć obszarów jednego okresu (dzień, dieta, trening, nauka, zapasy); brak zadań, celów, pomiarów, terminów |
| Otwartość na inne narzędzia | **2** | tylko wyjścia: `.ics`, raport tekstowy, plik synchronizacji; brak wejść i stałych mostów |
| Trwałość produktu (dekada) | **1,5** | plan kończy się 28.03.2027 i jest wkompilowany w program |
| Szybkość za 10 lat (bez zmian) | **1** | start 4,8–17 s, 241 MB pamięci |
| Proaktywność | **1** | zero powiadomień; minutnik słychać tylko przy włączonym ekranie |

Wniosek: **najwięcej do zyskania jest nie w poprawianiu tego, co jest (to już jest dobre), tylko w trzech brakujących warstwach — trwałości,
proaktywności i zakresie — oraz w podniesieniu designu z „porządnego” do „rozpoznawalnego”.**

---

## 1. Metoda

- **Pakiet i kod:** skład pakietu z metadanych esbuild, liczba linii, zależności, wystąpienia interfejsów platformy (`grep` po `src`).
- **Style:** analiza 4 plików CSS (selektory powtarzane między warstwami, liczba różnych wartości rozmiaru, promieni, odstępów).
- **Dekada danych:** generator zdarzeń (133 dziennie: trening 5 × w tygodniu po 24 serie × 4 zapisy, 16 dawek, 3 bloki nauki, 8 kroków
  pielęgnacji, 20 kroków meal prep, zakupy w czwartek 30 pozycji). Pomiar `reduce()` w Node oraz **prawdziwej bazy IndexedDB w Chromium**
  (wariant web, 390 px) dla 0, 1, 3 i 10 lat, także z procesorem spowolnionym czterokrotnie. **To model, nie pomiar Twoich danych.**
- **Czas reakcji:** od dotknięcia do widocznej zmiany w DOM plus jedna klatka; 8 typowych akcji × 5 prób × 2 poziomy procesora.
- **Koniec planu:** zegar przeglądarki 05.04.2027 i 01.03.2028, 11 widoków, treść i błędy JavaScript.
- **Wygląd:** 28 ekranów 390 px (ciemny, 10.11) i 56 zrzutów z 31.10 (1440 px ciemny, 390 px jasny), dane syntetyczne z `fixtures.py`.
- **Przegląd kodu:** magazyn (`store.js`), synchronizacja (`cloud.js`, `cloud-local.js`), `resolver.js`, powłoka (`app.js`), style.
- **Platformy:** weryfikacja w źródłach internetowych 10.11.2026 (§12); część stron źródłowych była niedostępna z tej sesji, więc każda
  informacja ma status: potwierdzona / do sprawdzenia na urządzeniu.
- **Ograniczenia:** dane syntetyczne; silnik Chromium, nie Safari; brak pomiaru na prawdziwym iPhonie.

---

## 2. Co już jest na najwyższym poziomie — zostaje bez zmian

1. **Szybkość.** Start 154 ms (472 ms przy procesorze × 4). Dotknięcie → zmiana na ekranie: odhaczenie serii 49 ms, dawki 42–45 ms, bloku
   41 ms, „+ opakowanie” 42 ms, zmiana zakładki 23–26 ms, arkusz 20 ms; przy procesorze × 4 mediany 26–68 ms, maksimum 116 ms. Granica
   odczucia „natychmiast” to 100 ms — jest zapas na bogatszy ruch (Załącznik D).
2. **Model danych.** Dziennik zdarzeń (nic nie ginie, wszystko da się odtworzyć), zgodność w przód (D-056), kwarantanna, kopie, „Cofnij”
   całych operacji. To najlepsza możliwa podstawa na dekadę — trzeba ją tylko nauczyć skali (S4).
3. **Prywatność i bezpieczeństwo.** Szyfrowanie po stronie urządzenia (PBKDF2-SHA256 600 tys. iteracji → AES-GCM-256, identyfikatory przez
   HMAC), wiersze w chmurze tylko dopisywane, RLS; CSP dopuszcza wyłącznie własne skrypty i style.
4. **Niezależność.** Zero zależności uruchomieniowych, trzy deweloperskie (esbuild, axe-core, lucide-static). Wariant jednoplikowy
   `2027.html` (1,5 MB) działa bez serwera i bez instalacji — żadna inna cecha nie daje lepszej gwarancji, że aplikacja uruchomi się za 10 lat.
5. **Testy.** 266 jednostkowych w 39 plikach (pokrycie: 89% linii ogółem, rdzeń 95–100%), 1577 kontroli E2E, dostępność w 48 stanach × 2
   szerokości × 2 motywy, synchronizacja 23 / 23 i 100 / 100.
6. **Kod sterowany danymi.** W całym kodzie JavaScript poza `src/data` są tylko 3 daty wpisane na sztywno. Problemem nie jest więc kod,
   tylko to, gdzie mieszkają dane planu (S2).
7. **Zasady płynności z D-112** (bez animacji nieskończonych, bez kodu w czasie przewijania) — nowy design musi je utrzymać.

---

## 3. Ustalenia strategiczne — sześć rzeczy, które dzielą aplikację od „bazy na dekadę”

### S1. Urwisko 28.03.2027 (za 138 dni)

**Fakt.** `phases.json → end = 2027-03-28`, `inPlan()` w `resolver.js:31`. Po tej dacie (sprawdzone 05.04.2027 i 01.03.2028, 0 błędów JS):

| Widok | Co pokazuje po końcu planu |
|---|---|
| Dziś | „Poza planem. Plan zakończył się 28 marca 2027…” i przycisk „Przejdź do 28.03” |
| Tydzień | 7 × „poza planem” |
| Trening, Suplementacja | „Poza planem”; w Suplementacji „0 dawek w 0 porach” i równocześnie „do uzupełnienia: 10” |
| Kalendarz | otwiera marzec 2027 zamiast bieżącego miesiąca; nie da się przejść dalej |
| **Dieta** | nadal „DNI TRENINGOWE + CARDIO (Faza 2) **obowiązuje dziś** · 5 kwietnia 2027” i „Następny posiłek 11:15” |
| **Zapasy** | nadal „Faza 2 · dzień treningowy” i „Najbliższe zakupy czw 08.04 za 3 dni · 0 pozycji”, choć planu już nie ma |

**Skutek.** 29.03.2027 aplikacja staje się archiwum. Żeby działała dalej, ktoś musi przygotować nowe dane, zmienić kod i opublikować wersję —
tak jak przy każdej dotychczasowej zmianie planu.

**Kierunek.** Silnik planów 2.0 (§9.1): plan jako **Twoje dane** podzielone na rozdziały, wyjątki dnia edytowane w aplikacji, sensowny
tryb podstawowy między rozdziałami. Termin: przed 28.03.2027.

### S2. Plan jest częścią programu

**Fakty.**
- Pakiet `app.js` ma 1 086 994 B (274 KB po kompresji gzip). **742 354 B, czyli 68,3%, to dane z `src/data`**: plan MPW 196 KB, plan CFA
  184 KB, Rekompozycja 95 KB, dieta 61 KB, trening 55 KB, poradnik 43 KB. Moduły to 17%, rdzeń 8,5%, interfejs 4,8% (Załącznik A).
- Plan CFA (184 KB) po egzaminie 12.11.2026 będzie martwym ciężarem w każdym pobraniu aplikacji.
- Zmiana planu = skrypt w `tools/extract` (26 skryptów, w tym 11 `day_plan_dXXX.py`) + budowa + publikacja. Między 25.09 a 16.10 plan CFA
  miał 8 wersji (v5, v7, v9, v12, v13, v14, V3, V44) — każda była wydaniem programu.
- Jednorazowe zmiany dnia („17.10 bez treningu”, „31.12 bez zakupów”, „zakupy w czwartek”) też są zmianami kodu i danych w repozytorium.
- Repozytorium `clip57/2027` jest **publiczne**: jadłospis, plan treningowy, suplementacja i plan nauki są publicznie czytelne. Pielęgnacja
  i pakiet prywatny już dziś są poza repozytorium (D-091, D-094) — to wzorzec, który działa.
- Testy E2E są przypięte do kalendarza 2026/27 (jawne daty), więc każda zmiana planu oznacza poprawianie testów.

**Skutek.** Aplikacja nie jest narzędziem, w którym układasz życie — jest wydrukiem jednego planu, który deweloper co kilka dni
przedrukowuje. Na dekadę to się nie skaluje ani kosztowo, ani organizacyjnie.

**Kierunek.** Repozytorium = silnik (kod, publiczny). Plan = pakiety danych użytkownika (prywatne, w dzienniku zdarzeń, szyfrowane w
chmurze), importowane tak jak dziś `2027-pielegnacja.json`. Obecne `src/data` zostaje jako wbudowany „rozdział 2026/27”, więc do 28.03.2027
nic się nie zmienia w działaniu.

### S3. Model danych skrojony pod obecne moduły

**Fakty.** 21 typów zdarzeń, każdy przypisany do konkretnego modułu. Od D-089 nowe zapisy trafiają do typu `setting` pod kluczami tekstowymi
(`cfa.recall:<data>`, `supp.dose:<data>|<godz>|<preparat>`, `zapasy.shop:<data>|<pozycja>`), bo lista typów jest zamrożona zasadą §3.1.
W modelu dekady obiekt `settings` ma **70 380 kluczy** i jest kopiowany przy każdym zapisie. Nie istnieje pojęcie zadania, celu, notatki,
pomiaru ani terminu; punktu planu dnia (np. „Sauna”, „Zmywanie”) nie da się oznaczyć jako wykonany, pominięty ani przesunięty.

**Skutek.** Każda nowa dziedzina życia wymaga albo nowych typów zdarzeń (decyzja i wydanie), albo dalszego obciążania `setting`.

**Kierunek.** Jedna para ogólnych typów „rekord” (§9.2) — dodanie, nie zmiana: istniejące typy i dane zostają nietknięte, a starsze wersje
aplikacji zachowają nowe zdarzenia i je pominą (D-056).

### S4. Dziennik zdarzeń a dekada

**Pomiar w przeglądarce** (prawdziwa IndexedDB, wariant web, 390 px):

| Lata | Zdarzeń | Baza | Start | Start, procesor × 4 | Pamięć JS |
|---|---|---|---|---|---|
| 0 | 0 | 0 MB | 154 ms | 472 ms | 5 MB |
| 1 | 48 055 | 5 MB | 699 ms | 1 827 ms | 21 MB |
| 3 | 144 339 | 12 MB | 2 098 ms | 4 005 ms | 85 MB |
| **10** | **481 229** | **33 MB** | **4 843 ms** | **17 006 ms** | **241 MB** |

W Node po 10 latach: pełne przeliczenie stanu 759 ms, historia ćwiczeń 444 ms, **plik synchronizacji 104 MB**, 46% zdarzeń to wpisy już
nadpisane nowszymi (Załącznik C).

**Przyczyny w kodzie:**
1. `Store.open()` wczytuje cały dziennik do pamięci, klasyfikuje każde zdarzenie i przelicza stan od zera (`store.js:152–188`).
2. `allEvents()` kopiuje cały dziennik przy zwykłych renderach — „Wymaga uwagi” w „Dziś”, ostatnia operacja w Zapasach, stan chmury
   (`store.js:286`, `cloud-local.js:84`).
3. `cloud.acked` to **jeden rekord z identyfikatorami wszystkich wysłanych zdarzeń**, zapisywany po każdej partii wysyłki i czytany przy
   każdym renderze „Dziś” oraz paska górnego (`cloud.js:107–119`, `cloud-local.js:78`).
4. Kopie (`Store.backup()`) to pełne duplikaty dziennika — do 5 sztuk.
5. Eksport do pliku sortuje, zamienia na tekst i haszuje całość naraz.
6. Chmura tylko dopisuje: ok. 484 tys. wierszy po 10 latach przy limicie bazy 500 MB w planie bezpłatnym; nowe urządzenie pobiera
   i odszyfrowuje wszystko, po 1000 wierszy.

**Skutek.** Nie dziś i nie za rok — ale to dług, który rośnie po cichu: po 3 latach aplikacja z ekranu początkowego wstaje 2–4 s.

**Kierunek.** §9.3: migawka stanu + ogon dziennika (bez zmiany formatu i wyniku), znacznik postępu zamiast listy potwierdzeń, usunięcie
kopiowania z renderów, kopie przyrostowe, eksport przyrostowy, test skali w CI. Cel: start poniżej 0,5 s przy 500 tys. zdarzeń.

### S5. Aplikacja jest pasywna

**Fakty.** W `src` jest 0 użyć powiadomień (`Notification`, `PushManager`), 0 plakietki ikony (`setAppBadge`), 0 blokady wygaszania
(`wakeLock`). Sygnał końca przerwy działa tylko przy włączonym ekranie (ograniczenie opisane w `RAPORT_D113.md` §5). Jedyna dziś droga do
przypomnień to ręczny eksport `.ics` z alarmami (I1) i import do Kalendarza po każdej zmianie planu.

**Co platforma już umożliwia** (aplikacja z ekranu początkowego): powiadomienia Web Push i plakietka ikony od iOS 16.4, uproszczone
„Declarative Web Push” od iOS 18.4, blokada wygaszania ekranu od iOS 18.4. Bez serwera nie da się tylko jednego: wysłać powiadomienia
o zadanej godzinie, gdy aplikacja jest zamknięta.

**Kierunek.** Trzy poziomy do wyboru (§8, decyzja 6): mosty bez serwera → push przez Twój projekt Supabase → aplikacja natywna.

### S6. Adres i tożsamość

**Fakty.** Dane w przeglądarce są przypięte do adresu `clip57.github.io`, wspólnego dla wszystkich stron GitHub Pages konta
(`docs/SYNC_CHMURA.md`). Safari i aplikacja z ekranu początkowego to dwie osobne bazy. Aplikacja nazywa się „2027”, baza `p2027`.

**Skutek.** Zmiana adresu (inna nazwa konta lub repozytorium, inny dostawca) oznacza nową, pustą bazę na każdym urządzeniu — dane trzeba
wtedy przenieść chmurą albo plikiem. Im później, tym więcej urządzeń i danych.

**Kierunek.** Świadoma decyzja o adresie na dekadę (decyzja 7). Własna domena uniezależnia adres od dostawcy (można zmienić hosting bez
utraty lokalnych baz), ale to opłata roczna — wyjątek od D-034. Nazwa bazy `p2027` zostaje bez względu na decyzję (zasada §3.1).

---

## 4. Inżynieria — co dzieli kod od najwyższej półki

Rozmiar: **S** = jedna sesja (jak D-109), **M** = 2–3 sesje (jak D-107 / D-108), **L** = duży etap (jak D-113).

| # | Ustalenie | Dowód | Propozycja | Rozmiar |
|---|---|---|---|---|
| T1 | **Trzy generacje stylów nałożone na siebie** | 4 pliki, 2 443 linie, 212 KB źródła; 1 570 selektorów, z czego **230 zdefiniowanych w ≥ 2 plikach, 39 w ≥ 3** (`.btn`, `.panel`, `.slot`, `.stat`, `h1`…); 43 różne rozmiary pisma, 24 warianty promienia, 193 z 1 106 odstępów wpisane liczbą zamiast tokenu, 14 × `!important` | jedno źródło w warstwach `@layer`, usunięcie reguł nadpisanych (szacunek: 35–45% mniej CSS), strażnik „tylko tokeny” w testach | L (razem z 4.0) |
| T2 | **Przerysowywanie całego widoku** | `ctx.rerender()` w 8 modułach (Zapasy 13 ×), punktowe odświeżanie tylko w 5; z tego wynika co najmniej 8 pozycji tabeli pułapek (zamykające się sekcje, utrata wpisu w polu, skoki przewinięcia, przyciski działające na starym stanie) | rozszerzenie `patch.js` o łatanie po kluczach — elementy zachowują tożsamość, więc można je animować; bez frameworka | M |
| T3 | **Brak typów i lintera** | 8 054 linie JS bez kontroli typów; zasady (bez `innerHTML`, bez `append(cond && x)`, bez `Number('')`) pilnowane opisem i testami | `// @ts-check` + typy JSDoc dla zdarzeń i stanu, `tsc --noEmit` w CI; ESLint z regułami kodującymi tabelę pułapek | M |
| T4 | **Testy tylko w Chromium** | celem jest Safari; problemy z D-112 (szarpane przewijanie, arkusz na zdarzeniach wskaźnika) znalazłeś ręcznie na iPhonie | silnik WebKit w E2E i a11y w workflow „Testy 2027” | M |
| T5 | **Brak testów wizualnych** | wygląd chronią tylko kontrasty, szerokości i ręczne zrzuty | zrzuty wzorcowe (ok. 30 ekranów × 2 motywy × 2 szerokości) porównywane w CI | M |
| T6 | **Brak budżetów wydajności** | rozmiar pakietu i czas startu nie są sprawdzane | limity w CI: rozmiar pakietu, start przy 500 tys. zdarzeń, liczba węzłów DOM, czas reakcji | S |
| T7 | **Błędy znikają po cichu** | 0 × `unhandledrejection`, 0 × globalnej obsługi `error` | lokalny dziennik błędów (bufor w `meta`), widoczny w Diagnostyce i dołączany do „Raportu”; bez usług zewnętrznych | S |
| T8 | **Utwardzenie bezpieczeństwa** | brak Trusted Types (Safari 26 już je obsługuje); `navigator.storage.persist()` nigdy niewywoływane; plik `2027-sync.json` nieszyfrowany (znane, opisane w „Dane”) | `require-trusted-types-for 'script'` w CSP (kod i tak nie używa `innerHTML`); prośba o trwały magazyn; opcjonalny eksport szyfrowany | S |
| T9 | **Instrukcja dla sesji AI urosła** | `CLAUDE.md` ma 48 KB (258 linii, 69 pozycji tabeli pułapek) — szacunkowo kilkanaście tysięcy tokenów wczytywanych na początku **każdej** sesji | rdzeń ok. 10 KB (zasady, architektura, komendy), historia decyzji i pułapki w `docs/` czytane w razie potrzeby; pułapki zamienione na reguły lintera (T3). Efekt uboczny: mniejsze zużycie limitu w każdej sesji | S |
| T10 | **Pakiet** | 1,09 MB JS, z tego 742 KB danych wczytywanych zawsze | dane modułów doładowywane przy wejściu (wzorzec `plan-mpw.json` już jest); znika samo po S2 | S |

**Czego nie rekomenduję:** przepisywania na framework (React i podobne) ani na TypeScript — zysk jest mniejszy niż koszt i ryzyko, a brak
zależności to jeden z największych atutów na dekadę (typy z komentarzy JSDoc dają tę samą kontrolę bez zmiany kodu i budowy); własnego
serwera aplikacji; zewnętrznej analityki i zewnętrznego raportowania błędów.

---

## 5. Drobne błędy i niespójności znalezione przy okazji

| # | Gdzie | Co | Rozmiar |
|---|---|---|---|
| M1 | Bezpieczeństwo żywności, 390 px | w siatce faktów karty etykiety „PO PRZYGOTOWANIU” i „PO ROZMROŻENIU” nachodzą na siebie | S |
| M2 | Trening (3 widoki) | brak nagłówka `<h1>` — ekran zaczyna się od przełącznika „WIDOK” (struktura nagłówków, czytniki ekranu) | S |
| M3 | Trening → Statystyki | oś wykresów obejmuje tygodnie sprzed startu planu (17.08–12.10); przy braku danych widać pustą oś z „1” zamiast opisu | S |
| M4 | Trening, Rekompozycja | emoji jako ikony („🦵 System kolana”, „♨️ Sauna”, 🔒) — reszta aplikacji ma ikony Lucide i plakietki bez emoji (D-113) | S |
| M5 | Po końcu planu | niespójności z tabeli S1 (Dieta „obowiązuje dziś”, Zapasy z fazą i datą zakupów, Kalendarz na marcu, „do uzupełnienia: 10”) | S |
| M6 | Manifest | brak `id`, `shortcuts` (skróty z ikony: Zakupy, Trening, Dziś), `screenshots`, `categories`; opis kończy się na „…trening i CFA” | S |
| M7 | Uruchamianie z ekranu początkowego | brak obrazu startowego (`apple-touch-startup-image`) — do sprawdzenia na telefonie, czy przy starcie widać pusty ekran | S |
| M8 | „Dziś”, karta „Teraz” | dwa wskaźniki postępu obok siebie (pasek punktu i pierścień dnia) bez wyraźnej różnicy znaczeń | w 4.0 |

---

## 6. Design — ocena i kierunek „System 4.0”

### 6.1 Ocena stanu po „Precision”

**Działa:** grafitowa paleta i akcenty, krój Inter Display w nagłówkach, karta „Teraz”, plakietki stanu, układ kafli na komputerze,
personalizacja akcentu i gęstości, kontrasty AA w obu motywach.

**Co dzieli od najwyższej półki** (każdy punkt z przeglądu zrzutów lub pomiaru):

1. **Brak sygnatury.** Aplikacja wygląda jak bardzo porządny panel administracyjny. Najlepsze produkty mają jeden–dwa elementy, po których
   poznaje się je w sekundę. Tu jedynym własnym znakiem jest logo.
2. **Statyczność.** Stan zmienia się przez podmianę elementów. W całej aplikacji jest 10 animacji kluczowych (wejście ekranu, arkusz,
   komunikat, motyw) i 32 proste przejścia. Liczby nie „dochodzą”, pierścienie nie rosną, odhaczony wiersz nie reaguje, przejście
   lista → szczegół nie ma ciągłości.
3. **Tylko dotknięcie.** Poza przeciąganiem arkusza nie ma żadnego gestu: przesunięcia wiersza, długiego naciśnięcia, przeciągania kolejności,
   przesuwania palcem po wykresie. Na komputerze: brak podglądu po najechaniu, menu kontekstowych, przeciągania; skróty klawiaturowe
   (⌘K, „/”, „?”, strzałki, „g + litera”) służą tylko do nawigacji — żadnego działania (odhacz, dodaj, cofnij) nie da się wykonać z klawiatury.
4. **Trzy różne anatomie strony.** Tytuł + data (Dziś, Zapasy, Kalendarz, Dane); karta-bohater z nadtytułem wersalikami (CFA, MPW, Meal
   Prep, Rekompozycja); przełącznik bez tytułu (Trening). Przełączniki widoków i nawigacja dni są za każdym razem w innym miejscu.
5. **Za dużo równorzędnych ramek.** Karty w kartach (dzień CFA: wiersze bloków jako obramowane karty w karcie „Zaległe”), żółte krawędzie
   na każdym wierszu „Składników na jutro”, wiersze skrótów powtarzające nawigację.
6. **Nagłówek zjada ekran telefonu.** W „Dziś” tytuł, data, faza i wiersz skrótów zajmują ok. 200 px — prawie jedną czwartą ekranu —
   zanim zacznie się treść.
7. **Wykresy są, ale martwe.** Małe, bez odczytu wartości, bez wyboru zakresu; na początku planu — puste linie w kaflach i puste osie.
8. **Nierówny poziom modułów.** Meal Prep, Pielęgnacja, Rekompozycja, Dane i „Więcej” mają tylko wspólną warstwę. Rekompozycja to dokument
   z harmonijką, „Dane” — ściana akapitów w wąskiej kolumnie (przy 1440 px prawa połowa ekranu pusta).
9. **Sztywna nawigacja.** Pięć stałych zakładek; codzienne Zapasy i Suplementacja są pod „Więcej” (dwa dotknięcia). Minutnik działa
   globalnie, ale widać go tylko w module, w którym został uruchomiony.
10. **Brak trybów skupienia.** Trening i nauka odbywają się w tej samej przewijanej stronie co reszta — z paskiem, zakładkami i drobnymi celami.
11. **Tydzień i podsumowania jako tekst.** „Serie 0/10 · CFA 0/11 · Dawki 0/16” — dane, które powinny być obrazem.
12. **Stany skrajne nieprojektowane.** Puste wykresy, pierwsze uruchomienie, okres poza planem — ślepe uliczki.

### 6.2 Trzy kierunki do wyboru

| | **A. „Instrument”** | **B. „Horyzont”** | **C. „Płynne szkło”** |
|---|---|---|---|
| Idea | aplikacja jako precyzyjny przyrząd: tarcze, skale, świecące dane na głębokiej czerni | czas jako przestrzeń: jedna oś, po której się przybliżasz i oddalasz — od minuty do dekady | materiał iOS 26: półprzezroczyste, płynnie przekształcające się powierzchnie |
| Sygnatura | tarcza dnia 24 h, pigułka „na żywo”, cyfry tabelaryczne, podziałki | zoom semantyczny (szczypanie, ⌘ + kółko), przejścia przestrzenne między poziomami | pływające kontrolki, które się zlewają i rozdzielają |
| Mocne strony | czytelność i charakter przy niskim koszcie wydajności; naturalne rozwinięcie „Precision” | unikalna struktura na dekadę; łączy Dziś, Tydzień i Kalendarz w jedno | „natywny” wygląd na iPhonie |
| Ryzyka | tarcza musi być użyteczna, nie ozdobna (test na dniu z 33 punktami) | duża przebudowa nawigacji; błyszczy dopiero przy danych wieloletnich | kosztowne filtry (D-110 celowo ograniczył szkło), słabszy kontrast, szybko się starzeje |
| Rekomendacja | **tak — język wizualny 4.0, od razu** | **tak — jako drugi krok w 2027**, gdy będzie silnik planów | nie jako motyw główny; szkło zostaje tylko na elementach pływających, jak dziś |

### 6.3 Zasady Systemu 4.0

1. **Jeden przyrząd na ekran.** Każdy moduł ma jednego bohatera (tarcza, oś zapasu, licznik bloku), który odpowiada na pytanie „co teraz?”.
2. **Ruch jest odpowiedzią, nie ozdobą.** Animuje się tylko to, co właśnie zmieniłeś albo co właśnie się zmieniło. Nic nie pulsuje w tle.
3. **Bezpośrednia manipulacja.** To, co widać, da się przesunąć, przytrzymać, przeciągnąć — a każdy gest ma też zwykły przycisk.
4. **Dane świecą, reszta milczy.** Kolor oznacza domenę albo stan, nigdy dekorację. Tło i ramki cofają się do granicy widoczności.
5. **Czas jest zawsze widoczny.** Gdziekolwiek jesteś, wiesz, co trwa i ile zostało.
6. **Szybkość jest częścią wyglądu.** Żadna ozdoba nie może kosztować więcej niż 100 ms reakcji przy procesorze × 4.

### 6.4 Elementy sygnaturowe

| # | Element | Co robi | Technika | Zabezpieczenie |
|---|---|---|---|---|
| 1 | **Tarcza dnia** („Dziś”) | 24-godzinny pierścień: łuki punktów planu w kolorach domen, część miniona przygaszona, wskazówka „teraz”, w środku bieżący punkt i odliczanie. Dotknięcie łuku pokazuje punkt; przesuwanie palcem po obwodzie przewija listę dnia | SVG jak dzisiejsze wykresy; odświeżanie co 30 s przez istniejące `ctx.tick` | bez animacji ciągłej; lista dnia zostaje pod tarczą; do 280 px na telefonie; zastępuje dwa wskaźniki z M8 |
| 2 | **Pigułka „na żywo”** | stały element powłoki: bieżący punkt planu albo działający minutnik (przerwa, blok 53 min, sauna), widoczny w każdym module; rozwija się do sterowania (+30 s, pomiń, zakończ). Na komputerze także w tytule karty | rozszerzenie `signal.js` — minutniki już są globalne, brakuje wspólnego wskaźnika | tekst odświeżany co sekundę tylko wtedy, gdy minutnik działa |
| 3 | **Gesty** | przesunięcie wiersza w prawo = wykonane (dawka, blok, krok, seria), w lewo = opcje (pomiń, przesuń, notatka); długie naciśnięcie = menu; przeciąganie = kolejność listy zakupów | zdarzenia dotyku wg wzorca `dragToClose` z D-112 | każdy gest ma odpowiednik przyciskiem; cofnięcie komunikatem z akcją |
| 4 | **Ruch jako odpowiedź** | znak odhaczenia rysuje się, liczby przewijają się cyfra po cyfrze, pierścień dochodzi łukiem, wykonany wiersz się zwija, przejście lista → szczegół zachowuje element | CSS na `transform` i `opacity`, Web Animations API; ciągłość elementu przez pomiar położenia przed i po zmianie (technika FLIP) — bez View Transitions przy zmianie trasy (lekcja z D-110) | zero pętli (strażnik z `run_d110` zostaje), `prefers-reduced-motion`, wymaga T2 |
| 5 | **Tryby skupienia** | pełny ekran dla jednej czynności: Trening (jedna seria naraz, cyfry ok. 96 px, duże cele, automatyczna przerwa), Nauka (licznik 53 min, zadanie bloku, szybki wpis do error logu), Zakupy, Gotowanie (krok po kroku, minutniki równoległe) | nowe widoki na istniejących danych; blokada wygaszania ekranu | wyjście jednym gestem; zapis do dziennika jak dziś |
| 6 | **Wykresy interaktywne** | celownik i wartość pod palcem, wybór zakresu (4 tyg. / 3 mies. / rok / wszystko), porównanie z planem; opis zamiast pustej osi | rozszerzenie `charts.js` (SVG + zdarzenia wskaźnika) | wyłącznie prawdziwe dane (zasada §3.6) |
| 7 | **Świecące dane** | głęboka czerń (dodatkowy motyw OLED), dane w kolorze domeny z delikatną, stałą poświatą, linie 1 px, podziałki, cyfry tabelaryczne | tokeny; Inter ma potrzebne cechy OpenType — bez nowego fontu | pary kontrastu w `tokens.test.mjs` |
| 8 | **Jedna anatomia strony** | pasek tytułu (tytuł + data z przewijaniem dni) → przyrząd → lista główna → reszta; przełącznik widoków zawsze w tym samym miejscu; bez kart w kartach | wspólny szablon strony w `components.js` | zmiana struktury = aktualizacja testów klas w tym samym kroku (zasada §3.9) |
| 9 | **Własny pasek i pulpit** | wybór 4 zakładek paska dolnego, kolejność i widoczność kafli na komputerze | `prefs.js` (preferencje urządzenia, poza dziennikiem) | — |
| 10 | **Dźwięk** | trzy krótkie, syntetyzowane dźwięki (odhaczenie, koniec minutnika — już jest, domknięcie dnia), domyślnie włączony tylko minutnik | `signal.js` | haptyka: iPhone nie daje jej przeglądarce oficjalnie, więc projekt się na niej nie opiera |

**„Horyzont” (krok drugi)** — sześć poziomów tej samej osi: **Teraz** (minuty, tarcza) → **Dzień** (lista punktów) → **Tydzień** (siedem
kolumn wykonania) → **Miesiąc** (mapa ciepła zamiast siatki kropek) → **Rok** (53 tygodnie, fazy i rozdziały jako pasma) → **Dekada**
(rozdziały życia, cele i egzaminy na jednej linii). Wchodzisz głębiej szczypnięciem albo dotknięciem, wracasz gestem; to samo miejsce
w czasie zostaje pod palcem.

### 6.5 Fundament (to, czego nie widać, a decyduje o jakości)

- Jedno źródło stylów w warstwach `@layer reset, tokens, base, components, modules, utilities` — koniec nadpisywania między generacjami (T1).
- Skale zamiast wartości: 8 stopni pisma (dziś 43 wartości), 4 promienie (dziś 24 warianty), odstępy wyłącznie z tokenów.
- Kolory zapisane w OKLCH i mieszane `color-mix()` (dziś projekt w OKLCH, zapis szesnastkowy); trzeci motyw „OLED”.
- Strona wzorcowa wszystkich komponentów we wszystkich stanach — cel testów wizualnych (T5) i dostępności.
- Zapytania kontenerowe zamiast progów okna; natywne `popover` i pozycjonowanie względem kotwicy dla menu i podpowiedzi.

### 6.6 Czego nie robić

Animowanych teł i shaderów, paralaksy, neonu na wszystkim, pochylanych kart 3D, szkła na kartach z treścią, „oddychających” pętli, własnych
kursorów, wykresów bez danych i „wniosków AI” bez danych (zasada §3.6). Każda z tych rzeczy wygląda futurystycznie przez tydzień, a potem
męczy i kosztuje baterię — i każda łamie D-112.

### 6.7 Proces i kryteria akceptacji

Jak przy D-113: **prototyp dwóch ekranów — „Dziś” (tarcza, pigułka, gesty) i tryb skupienia Treningu** — na 390 i 1440 px, w obu motywach,
do sprawdzenia przez Ciebie na iPhonie, zanim ruszę pozostałe moduły. Kryteria: 0 animacji nieskończonych; dotknięcie → zmiana ≤ 100 ms
przy procesorze × 4; 0 naruszeń dostępności; wszystkie dotychczasowe testy zielone; zrzuty wzorcowe zapisane jako strażnik.

---

## 7. Funkcje

### 7.1 Zasada porządkująca: plan + odstępstwa = rzeczywistość

Dziś aplikacja zakłada, że dzień przebiegł zgodnie z planem (zużycie w Zapasach liczone z planu), a odhaczasz tylko dawki, serie, bloki
i kroki. Brakuje jednego mechanizmu „było inaczej”: **pominąłem / przesunąłem / zamieniłem** — dla dowolnego punktu dnia. Jeden rodzaj
zapisu daje naraz: prawdziwe wykonanie planu (statystyki z danych, nie z założeń), dokładniejsze Zapasy (pominięty posiłek nie zużywa
składników), przesunięcie reszty dnia przy spóźnieniu i przeniesienie treningu bez udziału dewelopera. Wymaga nowego rodzaju danych (decyzja 5).

### 7.2 Propozycje w istniejących modułach

| Moduł | Funkcja | Dane | Rozmiar |
|---|---|---|---|
| Dziś | odstępstwa dla dowolnego punktu: wykonane / pomiń / przesuń o ± N min | nowe | M |
| Dziś | „Jestem spóźniony o N min” — przesunięcie reszty dnia z zachowaniem punktów stałych | nowe | M |
| Dziś | poranny przegląd i wieczorne domknięcie dnia (co zostało, co jutro, czego zabraknie) | istniejące | S |
| Trening | tryb skupienia: seria po serii, automatyczna przerwa, ekran nie gaśnie | istniejące | M |
| Trening | podpowiedź obciążenia z historii (ostatnio, najlepsza seria, zakres z planu) — informacja, bez zmiany planu | istniejące | S |
| Trening | kalkulator talerzy; notatka do ćwiczenia; zamiennik ćwiczenia z własnej listy | częściowo nowe | S–M |
| Trening | przeniesienie treningu na inny dzień | nowe (odstępstwo) | M |
| Dieta | posiłek pominięty albo zamieniony → Zapasy liczą prawdę | nowe (odstępstwo) | M |
| Meal Prep | tryb gotowania: krok po kroku, minutniki równoległe, ekran nie gaśnie | istniejące | M |
| Zapasy | daty ważności i partie + reguły z Bezpieczeństwa żywności („po otwarciu X dni”) → „zużyj do” | nowe | M |
| Zapasy | ceny, koszt tygodnia, historia cen | nowe | M |
| Zapasy | kolejność sklepu w trybie zakupów, szablony zakupów | nowe | S |
| Zapasy | skan kodu kreskowego dla pozycji własnych (E8) | nowe + biblioteka | L, opcjonalne |
| Nauka | plan nauki z pakietu użytkownika — kolejne egzaminy bez dewelopera | pakiet planu | w silniku planów |
| Nauka | powtórki z error logu w rosnących odstępach | istniejące wpisy + stan powtórki | M |
| Nauka | „Rozłóż zaległe” — propozycja rozłożenia zaległych bloków na wolne sloty, do Twojej akceptacji | odstępstwa | M |
| Pielęgnacja | uogólnienie na „Rutyny” — silnik reguł już istnieje (kroki, sloty, cykle) | istniejące typy `care.*` lub rekord | M |
| Kalendarz | własne zdarzenia i wyjątki dnia (dzień wolny, wyjazd, zakupy w inny dzień) — dziś robi to skrypt dewelopera | nowe | L, rdzeń silnika planów |
| Kalendarz | nakładka z pliku `.ics` (zdarzenia z innego kalendarza, tylko odczyt) | lokalne | M |
| ⌘K | polecenia z działaniem: „+ mleko 2 l”, „odhacz 09:00”, „przerwa 90 s” (dziś tylko nawigacja) | istniejące | M |
| System | „Cofnij” globalne (wzorzec `op` / `undo` z Zapasów dla wszystkich modułów) | istniejące | M |
| System | wehikuł czasu: stan na dowolny dzień i historia zmian („co zmieniłem 3.11?”) — naturalna zaleta dziennika zdarzeń | istniejące | M |
| System | „zdrowie danych”: wiek kopii, wiek synchronizacji, zajęte miejsce, dziennik błędów | lokalne | S |
| System | blokada aplikacji Face ID / Touch ID (opcjonalna) | lokalne | M |

### 7.3 „Rdzeń życia” — nowe obszary (każdy tylko, jeśli go chcesz — decyzja 8)

| Obszar | Co daje | Uwagi |
|---|---|---|
| **Skrzynka i zadania** | szybkie dodanie z każdego miejsca (⌘K, przycisk „+”, Skrót Siri), terminy, powtarzanie, projekty; zadania z terminem widać w „Dziś” | największa brakująca funkcja „zarządzania życiem” |
| **Cele i etapy** | cel (egzamin, kwalifikacja, masa ciała) → etapy → powiązane plany i wskaźniki z prawdziwych danych; podstawa widoku „Dekada” | CFA 12.11 i MPW 21.03 to pierwsze dwa cele |
| **Pomiary** | masa, obwody, tętno spoczynkowe, sen — wpis ręczny albo wklejenie ze Skrótu „Zdrowie” (E6); wykres na tle faz Rekompozycji | dane tylko lokalnie i w chmurze szyfrowanej |
| **Terminy** | sprawy cykliczne (badania, przeglądy, ubezpieczenia, dokumenty, urodziny) z wyprzedzeniem | bez załączników na start |
| **Notatki i dziennik dnia** | krótki wpis przy domknięciu dnia, wyszukiwanie | — |
| **Przeglądy** | tydzień / miesiąc / kwartał / rok generowane z dziennika, z miejscem na wnioski; eksport jako samodzielny plik (E11) | tylko prawdziwe dane |
| **Finanse** | budżet i wydatki, zaczynając od cen w Zapasach | opcjonalnie, bez połączeń z bankiem |

---

## 8. Rozszerzenia zewnętrzne

Zasada: aplikacja zostaje w pełni sprawna bez żadnego z nich (offline-first, D-034). Kolumna „Zasady” mówi, czy coś wymaga wyjątku.

| # | Rozszerzenie | Do czego | Jak | Serwer i koszt | Zasady | Status |
|---|---|---|---|---|---|---|
| E1 | **Kalendarz systemowy** | plan i alarmy w Kalendarzu iPhone’a i Maca | dziś: ręczny eksport `.ics` z alarmami (jest). Nowość: stały adres subskrypcji generowany przy publikacji albo plik w iCloud Drive | brak, 0 zł | tylko szkielet planu, bez treści prywatnych | alarmy w kalendarzu subskrybowanym — do sprawdzenia na telefonie (ustawienie „Usuń alarmy”) |
| E2 | **Skróty Apple** | „Co teraz?” głosem; poranna automatyzacja tworząca Przypomnienia z alarmami; tryb skupienia iOS według planu | Skrót czyta plik dnia (JSON) i działa natywnie | brak, 0 zł | jw. | automatyzacja „Pora dnia” może działać bez potwierdzenia; niezawodność do sprawdzenia |
| E3 | **Widżety** (Scriptable) | „Teraz / Następnie”, odliczanie do egzaminu, trening dnia — ekran początkowy i ekran blokady | skrypt widżetu czyta ten sam plik dnia | brak, 0 zł (darmowa aplikacja zewnętrzna) | jw. | Scriptable aktualny (wersja z 03.2026); częstotliwość odświeżania ustala iOS |
| E4 | **Powiadomienia push** | przypomnienia o dawkach, blokach, zakupach; koniec przerwy przy zgaszonym ekranie | Web Push w aplikacji z ekranu początkowego. Potrzebny nadawca: (a) funkcja + harmonogram w Twoim projekcie Supabase, (b) Cloudflare Worker, (c) harmonogram GitHub Actions — tylko zgrubne pory (najwyżej co 5 min, z opóźnieniami) | plan bezpłatny | **wyjątek od D-034 („bez własnego backendu”) — decyzja 6**; na serwer trafiają tylko pory i ogólne tytuły | możliwości platformy potwierdzone; całość do prototypu na Twoim iPhonie |
| E5 | **Plakietka i ekran** | liczba spraw na ikonie; ekran nie gaśnie w trybach skupienia | Badging API, Screen Wake Lock | brak | — | iOS 16.4+ / 18.4+; plakietka na iOS prawdopodobnie wymaga zgody na powiadomienia — do potwierdzenia przy wdrożeniu |
| E6 | **Apple Zdrowie** | masa ciała, sen, kroki, tętno → Pomiary | Skrót „Znajdź próbki zdrowia” → schowek → przycisk „Wklej ze Zdrowia” w aplikacji | brak | dane zdrowotne tylko lokalnie i szyfrowane | przeglądarka nie ma dostępu do Zdrowia — to jedyna droga bez aplikacji natywnej |
| E7 | **Asystent AI** | pytania o własne dane, przegląd tygodnia, przygotowanie pakietu planu | (a) „Raport” (jest) wklejany do Claude; (b) lokalny serwer MCP na MacBooku czytający plik synchronizacji, tylko odczyt; (c) asystent w aplikacji z kluczem API | (a), (b): nic ponad to, co masz; (c): płatne za użycie | (c) narusza D-034 — nie rekomenduję | (b) do zaprojektowania |
| E8 | **Open Food Facts** | nazwa i wartości odżywcze po kodzie kreskowym | publiczne API bez klucza; skaner jako biblioteka WASM (Safari na iPhonie nie ma wbudowanego czytnika kodów) | brak | funkcja tylko online, opcjonalna | limit ok. 15 zapytań na minutę; dostęp z przeglądarki (CORS) do sprawdzenia |
| E9 | **Mac: aplikacja w Docku** | osobne okno, powiadomienia i plakietka na Macu | Safari → „Dodaj do Docka” | brak | osobna baza danych — konfiguracja chmury jak na telefonie | do sprawdzenia przez Ciebie, razem z otwartą kontrolą Safari na Macu (D-113) |
| E10 | **Plik pomostowy** | źródło dla E1–E3, gdy plany będą prywatne | aplikacja zapisuje do iCloud Drive szkielet planu na N dni | brak | Ty decydujesz o zawartości | — |
| E11 | **Raport dla specjalisty** | okres dla trenera, dietetyka, lekarza | samodzielny plik HTML z wybranym zakresem | brak | Ty wybierasz zakres | — |
| E12 | **Aplikacja natywna** (powłoka Capacitor) | powiadomienia lokalne bez serwera, Zdrowie, widżety systemowe, Live Activities | powłoka iOS wokół tej samej aplikacji | Apple Developer Program 99 USD rocznie, Mac z Xcode | narusza D-034; trzecia baza danych na telefonie | nie rekomenduję teraz; wrócić, jeśli E4 nie wystarczy |

**Uwagi.**
- Otwarcie aplikacji z ekranu początkowego prosto ze Skrótu: według doniesień użytkowników działa schemat adresu `webapp://`, ale nie
  znalazłem potwierdzenia Apple — do sprawdzenia na telefonie. Bez tego Skrót otwiera Safari, czyli inną bazę danych.
- Źródło danych dla E1–E3: dziś mogą to być pliki statyczne publikowane razem z aplikacją (plan i tak jest publiczny). Po przeniesieniu
  planów do danych prywatnych (decyzja 4) — plik pomostowy E10.
- Kolejność według zysku do kosztu: E5 → E1 / E2 / E3 → E6 → E4 → E7(b) → E8 → E12.

---

## 9. Architektura docelowa

```
 Mosty:    pliki · Kalendarz · Skróty · widżety · push · MCP
 Widoki:   Czas (Teraz · Dzień · Tydzień · Miesiąc · Rok · Dekada)  ×  Obszary (moduły)
 Plan:     rozdziały → pakiety → wyjątki dnia → odstępstwa → plan dnia
 Stan:     migawka + ogon dziennika zdarzeń (IndexedDB)
 Wymiana:  plik (pełny i przyrostowy) · chmura szyfrowana
 ───────────────────────────────────────────────────────────────────────
 kod = repozytorium (publiczne)        dane = Twoje (prywatne, szyfrowane)
```

### 9.1 Silnik planów 2.0
- **Rozdział** = okres z kompletem pakietów (plan dnia z wariantami, dieta, trening, suplementy, nauka, dokumenty). Obecne `src/data` staje
  się wbudowanym „rozdziałem 2026/27” — **zero zmian w działaniu do 28.03.2027**, co da się udowodnić testem (te same wyniki `resolveDay`
  dla każdej daty planu przed i po).
- **Pakiet planu** = plik JSON importowany w „Dane”, zapisywany w dzienniku, szyfrowany w chmurze — dokładnie jak dziś plan pielęgnacji.
  Walidacja przy imporcie tym samym kodem co `plan_check`, z czytelną listą błędów.
- **Wyjątki dnia i odstępstwa** edytowane w aplikacji (dzień wolny, wyjazd, przeniesienie zakupów, zamiana treningów).
- **Poza rozdziałem** — tryb podstawowy (zadania, rutyny, zapasy ręczne, pomiary) zamiast pustych ekranów.
- **Przygotowanie pakietu** — jak dziś, z Twoich dokumentów źródłowych w sesji z Claude, ale wynikiem jest plik dla Ciebie, a nie zmiana
  w publicznym repozytorium i publikacja.
- **Testy** na planie syntetycznym (jak `synthetic_care_plan`) — niezależne od kalendarza 2026/27.

### 9.2 Model danych 2.0
- Istniejące typy zdarzeń, klucze, baza i `reduce()` dla dotychczasowych danych — **bez zmian** (zasada §3.1).
- Jedna nowa para typów „rekord ogólny” (zapis / usunięcie; pola: rodzaj, identyfikator, treść; ostatni zapis wygrywa) dla zadań, celów,
  pomiarów, notatek, terminów i odstępstw. Starsze wersje aplikacji zachowają te zdarzenia i je pominą (D-056).
- Nowych danych nie dokładamy już do `setting`; dawki i lista zakupów zostają tam, gdzie są — bez migracji.

### 9.3 Skalowanie dziennika (kolejność według zysku)
1. **Migawka + ogon:** zapis stanu `Reducer` co N zdarzeń; otwarcie = migawka + nowsze zdarzenia. Wynik identyczny — test równoważności
   obok `reduce-incremental.test.mjs`.
2. **`cloud.acked`:** znacznik postępu i mały zbiór oczekujących zamiast listy wszystkich identyfikatorów.
3. **Rendery bez `allEvents()`:** wskaźnik ostatniej operacji i licznik oczekujących utrzymywane przyrostowo.
4. **Kopie:** jedna pełna + przyrostowe, kompresja (`CompressionStream`), limit rozmiaru.
5. **Eksport przyrostowy** („od ostatniego eksportu”) — **format `2027-sync.json` bez zmian**: import jest idempotentny, więc plik
   z podzbiorem zdarzeń jest już dziś poprawnym plikiem.
6. **Test skali w CI:** 500 tys. zdarzeń syntetycznych, limit czasu startu.
7. **Punkt kontrolny w chmurze** (zaszyfrowana migawka dla nowych urządzeń) — zmiana protokołu synchronizacji, osobna decyzja; nie wcześniej
   niż za rok.

### 9.4 Trwałość
- Prośba o trwały magazyn (`navigator.storage.persist()`).
- Coroczne archiwum: bieżący `2027.html` + pełny eksport + opis formatu — do otwarcia za 10 lat bez serwera i bez tej aplikacji.
- Eksport czytelny dla człowieka (CSV / JSON dla każdego obszaru).
- Próba odtworzenia z kopii raz na kwartał — przycisk „Sprawdź kopię” w „Dane”.
- Decyzja o adresie (S6).

### 9.5 Bezpieczeństwo
- Trusted Types w CSP; opcjonalna blokada aplikacji; opcjonalny szyfrowany eksport do pliku.
- Opisana procedura na wypadek utraty hasła chmury: dane zostają na urządzeniach, nowy projekt lub hasło i ponowna wysyłka.

---

## 10. Mapa drogowa

Do egzaminu MPW (21.03.2027) priorytetem jest stabilność: każde wydanie małe i odwracalne, przy zielonych testach, a żadna zmiana codziennych
czynności nie wchodzi bez Twojej akceptacji prototypu.

| Etap | Kiedy | Zakres | Kryterium ukończenia | Rozmiar |
|---|---|---|---|---|
| **0. Pilne** | do 15.11 | D1 po Twojej decyzji; drobne M1–M7 | popołudnie od 16.11 zgodne z blokami MPW | S |
| **1. Fundament jakości** | XI–XII | WebKit w CI, testy wizualne, typy i linter, dziennik błędów, Trusted Types, trwały magazyn, budżety, odchudzenie `CLAUDE.md` (T3–T9) | te same ekrany, mocniejsze zabezpieczenia; 0 zmian w danych | M |
| **2. System 4.0 — prototyp** | XII | konsolidacja stylów (`@layer`), szablon strony, łatanie po kluczach (T1, T2); prototyp „Dziś” + tryb skupienia Treningu | Twoja akceptacja na iPhonie | L |
| **3. System 4.0 — moduły** | I | wszystkie moduły, w tym 5 dotąd tylko „przemalowanych”; wykresy interaktywne; własny pasek | zrzuty wzorcowe jako strażnik | L |
| **4. Proaktywność** | XII–I, równolegle | E5 (plakietka, ekran), E1–E3 (Kalendarz, Skróty, widżety); push po decyzji 6 | przypomnienie dociera przy zgaszonym ekranie | M (+ M push) |
| **5. Silnik planów 2.0** | I–II, **najpóźniej 14.03.2027** | rozdziały, pakiety, wyjątki dnia i odstępstwa w aplikacji, tryb podstawowy, plan syntetyczny w testach | 29.03.2027 aplikacja działa dalej; zmiana planu bez publikacji | L |
| **6. Skalowanie** | II–III | §9.3 punkty 1–6 | start < 0,5 s przy 500 tys. zdarzeń i procesorze × 4 | M |
| **7. Rdzeń życia** | od IV 2027 | rekord ogólny; wybrane obszary z §7.3, zaczynając od zadań i pomiarów | pierwsze obszary niezależne od planu | L × kilka |
| **8. Horyzont** | druga połowa 2027 | oś czasu z zoomem, widoki Rok i Dekada, cele; E7(b) | — | L |

---

## 11. Decyzje potrzebne od Ciebie

1. **D1 — popołudnie od 16.11 (pilne, zaległe od 23.10).** Bloki MPW 15:30 / 16:30 / 17:30 kolidują z planem dnia w 108 ze 119 dni
   (przerwa obiadowa, zmywanie, dojazd na siłownię, rozgrzewka, początek treningu). Potrzebuję nowego rozkładu popołudnia — np. trening
   później albo blok C wcześniej. Bez decyzji od poniedziałku 16.11 plan dnia i karta „Nauka MPW” pokazują nakładające się godziny.
2. **Kierunek designu:** A „Instrument” / B „Horyzont” / C „Płynne szkło” / zostaje „Precision” z dopracowaniem.
   *Rekomendacja: A teraz, B jako drugi krok.*
3. **Silnik planów 2.0** — plany jako Twoje dane, wyjątki i odstępstwa w aplikacji. To zmiana architektury, więc pytam wprost.
   *Rekomendacja: tak; etap 5, przed 28.03.2027.*
4. **Gdzie mieszka treść planu:** kolejne rozdziały prywatnie (pakiety) czy dalej w publicznym repozytorium?
   *Rekomendacja: prywatnie od następnego rozdziału; obecny zostaje, jak jest.*
5. **Nowe rodzaje danych:** rekord ogólny i odstępstwa (dodanie typów; istniejące bez zmian). *Rekomendacja: tak.*
6. **Powiadomienia:** poziom 1 — Kalendarz, Skróty, widżety, bez serwera; poziom 2 — dodatkowo push przez Twój projekt Supabase (wyjątek
   od D-034); poziom 3 — aplikacja natywna (99 USD rocznie). *Rekomendacja: 1 od razu; 2 po krótkim prototypie na Twoim iPhonie.*
7. **Adres i nazwa na dekadę:** zostaje `clip57.github.io/2027` (bez kosztów) / własna domena (opłata roczna, wyjątek od D-034).
   *Rekomendacja: rozstrzygnąć przed etapem 7; własna domena uniezależnia od dostawcy.*
8. **Zakres „rdzenia życia”:** które obszary chcesz mieć — zadania, cele, pomiary, terminy, notatki, przeglądy, finanse?
9. **Asystent AI:** (a) zostaje sam „Raport”; (b) lokalny serwer MCP na MacBooku; (c) nic więcej. *Rekomendacja: (b) w etapie 8.*
10. **Start:** czy mogę od razu zacząć etap 1 (fundament jakości — bez zmian w danych i w wyglądzie), a etap 0 po decyzji 1?
    *Rekomendacja: tak.*

Jeśli odpowiesz „akceptuję rekomendacje”, potrzebuję jeszcze tylko odpowiedzi na 1 (rozkład popołudnia) i 8 (zakres).

---

## 12. Ograniczenia, status weryfikacji, źródła

**Potwierdzone w źródłach (10.11.2026):** Web Push i plakietka ikony dla aplikacji z ekranu początkowego od iOS 16.4; Declarative Web Push
od iOS 18.4; blokada wygaszania w aplikacjach z ekranu początkowego od iOS 18.4; Trusted Types od Safari 26; rozszerzenie PRF w WebAuthn od
iOS 18 (zalecane 18.4+, z ostrzeżeniami co do używania go jako jedynego klucza do danych); Safari na iOS bez wbudowanego `BarcodeDetector`;
harmonogram GitHub Actions — najwyżej co 5 min, z opóźnieniami, wyłączany po 60 dniach bez aktywności w repozytorium publicznym; Supabase
w planie bezpłatnym — baza 500 MB, wstrzymanie projektu po 7 dniach bez aktywności, funkcje brzegowe i harmonogram dostępne; Scriptable
aktualny; Open Food Facts bez klucza; Apple Developer Program 99 USD rocznie.

**Założenie:** iPhone z iOS 18.4 lub nowszym (blokada wygaszania, Declarative Web Push), a dla Trusted Types i pozycjonowania względem
kotwicy — iOS 26. Jeśli masz starszy system, daj znać — część propozycji trzeba wtedy przesunąć albo zastąpić.

**Do sprawdzenia na urządzeniu lub przy wdrożeniu:** alarmy w subskrybowanym kalendarzu iOS; schemat `webapp://` w Skrótach; niezawodność
automatyzacji „Pora dnia”; dostęp do Open Food Facts z przeglądarki (CORS); obraz startowy na iPhonie; wszystko, co dotyczy rzeczywistej
płynności — testy były w Chromium na danych syntetycznych.

**Niedostępne z tej sesji:** strony `webkit.org`, `supabase.com` i `firt.dev` (sieć sesji ich nie dopuszcza) — informacje z tych źródeł
pochodzą z wyników wyszukiwania, nie z bezpośredniej lektury.

**Źródła (odnośniki z wyszukiwania 10.11.2026):**
- Trusted Types w Safari 26: <https://groups.google.com/a/mozilla.org/g/dev-platform/c/WA8vLAbvzB0>, <https://web.dev/articles/trusted-types>
- WebAuthn PRF: <https://www.corbado.com/blog/passkeys-prf-webauthn>, <https://developer.apple.com/forums/thread/733413>,
  <https://lilting.ch/en/articles/passkeys-prf-extension-encryption-risk>
- BarcodeDetector w Safari: <https://caniuse.com/mdn-api_barcodedetector>, <https://bugs.webkit.org/show_bug.cgi?id=281848>
- Harmonogram GitHub Actions: <https://github.com/orgs/community/discussions/185355>, <https://runhooks.app/blog/github-actions-scheduled-workflows-unreliable/>
- Schemat `webapp://`: <https://meta.discourse.org/t/pwa-launched-via-webapp-always-loads-homepage-not-intended-path/375036>,
  <https://community.glideapps.com/t/ios-26-beta-opening-an-installed-web-app-with-an-open-url-action/82464>
- Pozostałe (Web Push, Declarative Web Push, Wake Lock, Supabase, Scriptable, Open Food Facts) — z wyszukiwania wcześniej tego dnia;
  nazwy źródeł: blog WebKit, dokumentacja Supabase, App Store, dokumentacja Open Food Facts.

---

## Załącznik A — pakiet (10.11.2026)

| Plik | Rozmiar | gzip |
|---|---|---|
| `app.js` | 1 086 994 B | 274 293 B |
| `app.css` | 165 984 B | 30 025 B |
| `plan-mpw.json` (doładowywany) | 122 277 B | 11 722 B |
| fonty (3 × woff2) | 88 104 B | — |
| `2027.html` (wariant jednoplikowy) | 1 511 359 B | — |

Skład `app.js`: dane `src/data` 742 354 B (68,3%) · moduły 184 426 B (17,0%) · rdzeń 91 887 B (8,5%) · interfejs 51 799 B (4,8%) · inne 16 486 B.
Największe: `mpw.json` 195 787 · `cfa.json` 184 222 · `rekomp.json` 94 555 · `diet.json` 61 152 · `training.json` 54 955 · `guide.json` 42 994.
Kod źródłowy: 8 054 linie JS w `src`.

## Załącznik B — style

4 pliki (tokens 132 linie · styles 956 · system 907 · precision 448) = 2 443 linie, 212 KB źródła. 1 570 unikalnych selektorów; 230 w ≥ 2
plikach, 39 w ≥ 3. 43 wartości `font-size` (19 poza tokenami), 8 grubości pisma, 24 warianty `border-radius`, 193 z 1 106 deklaracji
odstępów liczbą, 14 × `!important`. Ruch: 10 `@keyframes`, 32 deklaracje `transition`.

## Załącznik C — model dekady w Node

| Lata | Zdarzeń | Pełne przeliczenie | Historia ćwiczeń × 8 | Plik synchronizacji | Pamięć procesu | Nadpisane |
|---|---|---|---|---|---|---|
| 1 | 48 315 | 120 ms | 22 ms | 10,4 MB | 73 MB | 45% |
| 3 | 145 121 | 191 ms | 83 ms | 31,2 MB | 169 MB | 45% |
| 10 | 483 836 | 759 ms | 444 ms | 104 MB | 727 MB | 46% |

Po 10 latach: 62 568 rekordów treningu, 70 380 kluczy w `settings`.

## Załącznik D — czas od dotknięcia do zmiany na ekranie (390 px, mediana z 5 prób)

| Akcja | Procesor × 1 | Procesor × 4 | Maksimum × 4 |
|---|---|---|---|
| Trening: odhaczenie serii | 49 ms | 65 ms | 73 ms |
| Zapasy: + opakowanie | 42 ms | 59 ms | 116 ms |
| Suplementacja: odhaczenie dawki | 45 ms | 59 ms | 82 ms |
| Dziś: odhaczenie dawki | 42 ms | 68 ms | 69 ms |
| Nauka: odhaczenie bloku | 41 ms | 54 ms | 76 ms |
| Zakładka Dziś → Trening | 26 ms | 29 ms | 32 ms |
| Zakładka Trening → Dieta | 23 ms | 27 ms | 29 ms |
| Trening: arkusz techniki | 20 ms | 26 ms | 33 ms |

Pomiar przy małym dzienniku (dane syntetyczne). Przy dzienniku z 10 lat przejścia między modułami rosną do 85–173 ms (S4).

## Załącznik E — możliwości platformy nieużywane dziś

Brak w `src`: powiadomienia i push, plakietka ikony, blokada wygaszania, synteza mowy, kamera, WebAuthn, `content-visibility`, globalna
obsługa błędów, `ResizeObserver`, prośba o trwały magazyn. Używane: wibracja (1 miejsce), udostępnianie systemowe (3), schowek (4),
View Transitions przy zmianie motywu (2), `IntersectionObserver` (2). Gesty: tylko przeciąganie arkusza.
