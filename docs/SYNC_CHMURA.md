# Synchronizacja przez chmurę (Supabase) — audyt, Etap 1 (rdzeń), Etap 2 (interfejs), synchronizacja automatyczna (24–25.09.2026)

Kierunek zaakceptowany przez użytkownika (D-078): **Supabase**, IndexedDB pozostaje źródłem prawdy, ręczna synchronizacja
`2027-sync.json` zostaje jako mechanizm awaryjny. Etap 1 = rdzeń bez interfejsu (§3). Etap 2 = interfejs w module Dane,
konfiguracja na urządzeniu i instrukcja uruchomienia (§5). **Szybki start: §5.2.**

## 1. Audyt doprecyzowujący

### 1.1 Wspólna domena GitHub Pages i tokeny
- `clip57.github.io/<repo>` — **wszystkie** strony GitHub Pages konta mają to samo pochodzenie przeglądarki: wspólne
  `localStorage` i IndexedDB. Skrypt innej strony z tego konta mógłby odczytać sesję chmury (i już dziś — dane lokalne).
- Ochrona w projekcie:
  1. **Szyfrowanie po stronie urządzenia** — token daje dostęp wyłącznie do szyfrogramów; bez hasła szyfrowania nie da się ich
     odczytać. Klucze są **nieeksportowalne** (`CryptoKey`, `extractable: false`) — skrypt może ich użyć, ale nie może ich
     skopiować poza przeglądarkę.
  2. Token dostępu ważny 1 h, token odświeżania **jednorazowy** (rotacja przy każdym odświeżeniu, wykrywanie ponownego użycia po stronie Supabase).
  3. **Rejestracja wyłączona** w projekcie — klucz „anon” nie pozwala założyć konta.
  4. Brak `innerHTML` z danymi (zasada 8) — mała powierzchnia XSS.
- **Zalecenie (do decyzji użytkownika):** nie publikować innych projektów na koncie `clip57` albo przenieść aplikację na osobne
  konto / własną domenę (uwaga była już w README). Najgorszy przypadek przy przejęciu tokenu: usunięcie danych w chmurze —
  dane lokalne i pliki `2027-sync.json` pozostają nienaruszone.
- Sesja i klucze trzymane w magazynie `meta` IndexedDB (nie w pliku synchronizacji, nie w repozytorium).

### 1.2 Model szyfrowania (`src/core/sync/crypto.js`)
| Element | Wybór | Uzasadnienie |
|---|---|---|
| Wyprowadzenie klucza | PBKDF2-HMAC-SHA256, **600 000 iteracji**, sól losowa 16 B per użytkownik | zalecenie OWASP; WebCrypto nie ma Argon2. Ok. 0,3 s na komputerze (zmierzone w Chromium), ok. 1 s na iPhonie — raz na urządzenie |
| Klucze | klucz główny 256 bit → HKDF-SHA256 → **AES-GCM-256** (treść) + **HMAC-SHA256** (identyfikator) | rozdzielenie kluczy do różnych zastosowań |
| Szyfrowanie | AES-GCM, IV 96 bit losowy dla każdego zapisu, AAD = `p2027.c1|<sid>` | integralność; szyfrogramu nie da się przenieść pod inny identyfikator |
| Identyfikator w chmurze | `sid` = HMAC(`id` zdarzenia) | deduplikacja bez ujawniania `id` (zawiera typ zdarzenia i np. nazwę produktu: `v31:…:count:banan`) |
| Weryfikator | szyfrogram stałej wartości w `sync_keys` | wykrywa błędne hasło na nowym urządzeniu |
| Hasło | min. 12 znaków (zalecane: fraza z 4+ słów) | przy wycieku bazy możliwy atak słownikowy offline |
| Granice | iteracje z serwera ≥ 310 000, sól ≥ 16 B | serwer nie może osłabić parametrów |

**Konfiguracja nowego urządzenia:** logowanie (e-mail + hasło konta) → pobranie `sync_keys` (sól, iteracje, weryfikator) →
hasło szyfrowania → wyprowadzenie kluczy → sprawdzenie weryfikatorem → zapis kluczy (nieeksportowalnych) w `meta` → pierwsza
synchronizacja (pobranie wszystkiego, wysłanie brakujących). Pierwsze urządzenie tworzy `sync_keys`; równoczesne „pierwsze”
urządzenia rozstrzyga klucz główny tabeli (test).

### 1.3 Utrata hasła, wyczyszczenie danych Safari, ponowna instalacja PWA
| Sytuacja | Skutek | Postępowanie |
|---|---|---|
| Utrata **hasła szyfrowania** | dane w chmurze nie do odczytania (z założenia — brak odzyskiwania) | dane lokalne i pliki bez zmian; „Usuń moje dane z chmury” → nowe hasło → wysłanie z urządzenia z pełnymi danymi |
| Utrata **hasła konta** | brak logowania | reset hasła w panelu Supabase (Authentication → Users); szyfrowanie bez zmian |
| Safari usunął dane strony (ITP, ok. 7 dni bez użycia) | brak danych lokalnych, sesji i kluczy | logowanie + hasło szyfrowania → pełne pobranie z chmury (**odtworzenie, którego dziś nie ma**) |
| Ponowna instalacja PWA | jw. | jw. |
| Hasło utracone **i** dane Safari usunięte | chmura nieczytelna, lokalnie pusto | inne urządzenie albo ostatni `2027-sync.json` (import ręczny) |
| Zgubione urządzenie | sesja na urządzeniu | panel Supabase → wylogowanie sesji / zmiana hasła konta; dane w chmurze zaszyfrowane |

### 1.4 RLS i minimalny zakres danych (`tools/supabase/schema.sql`)
- Tabele: `events (user_id, sid, seq, blob, created_at)`, `sync_keys (user_id, salt, iterations, verifier, created_at)`.
- RLS włączone i wymuszone; polityki `select / insert / delete` tylko dla `user_id = auth.uid()`; **brak UPDATE** (wiersze niezmienne);
  rola `anon` bez uprawnień; `events.seq` nadaje serwer (identity).
- Serwer zna: e-mail konta, liczbę i rozmiar zdarzeń, czasy zapisu. **Nie zna:** typów zdarzeń, identyfikatorów, nazw
  produktów, dawek, wyników treningów, pakietu prywatnego.

### 1.5 Deduplikacja, kursor, ponowne pobieranie (`src/core/sync/cloud.js`)
- **Serwer:** klucz główny `(user_id, sid)`, wstawianie `on_conflict=user_id,sid` + `Prefer: resolution=ignore-duplicates` —
  ponowne wysłanie tego samego zdarzenia niczego nie zmienia.
- **Urządzenie:** `appendMany` przyjmuje tylko `id` nieobecne lokalnie; walidacja `classifyEvent` jak przy imporcie pliku
  (zdarzenia z nowszej wersji przyjmowane — D-056); uszkodzone / nieodszyfrowane wiersze odrzucane i raportowane, nie trafiają do bazy.
- **Kursor:** `cloud.cursor` = najwyższy widziany `seq`. Numery nadawane są przy wstawieniu, ale transakcje mogą zostać
  zatwierdzone w innej kolejności — każde pobranie czyta ponownie ostatnie **1000** numerów (`OVERLAP` ≥ partia 250 × liczba
  urządzeń). Test pokazuje, że bez zapasu wiersz „spóźniony” zostałby pominięty.
- **Kolejność zapisu:** pobrane zdarzenia zapisane → dopiero wtedy przesunięcie kursora (przerwanie = powtórzenie, bez utraty).
- **Wysyłka:** `cloud.acked` = `id` potwierdzone przez chmurę (także pobrane z chmury); wysyłane partiami po 250, stan zapisywany
  po każdej partii (przerwana wysyłka wznawia się).
- **Kopia przed pobraniem:** najwyżej raz dziennie (`appendMany(…, { backup: false })` w pozostałych rundach); import pliku bez zmian — zawsze z kopią.
- Konflikty treści: bez zmian — `reduce()` (późniejszy HLC wygrywa, przegrana w historii).

### 1.6 Limity i warunki planu bezpłatnego (weryfikacja 24.09.2026)
Strony supabase.com są zablokowane w środowisku pracy (proxy) — dane z wyników wyszukiwania wskazujących na oficjalną
dokumentację Supabase (źródła niżej); **do potwierdzenia przez użytkownika przy zakładaniu projektu.**

| Warunek | Wartość | Znaczenie dla 2027 |
|---|---|---|
| Baza danych | 500 MB | ok. 10–20 MB zdarzeń rocznie (z szyfrowaniem) — wystarczy na dziesiątki lat |
| Transfer wychodzący | 5 GB / mies. | pełne pobranie kilkanaście MB; runda ~ setki KB (zapas kursora) |
| Zapytania API | bez limitu | — |
| Opłaty | plan Free bez karty — **brak opłat za przekroczenia**, zamiast tego ograniczenie usługi | brak ryzyka rachunku |
| Wstrzymanie projektu | po **7 dniach** niskiej aktywności bazy; kilka zapytań dziennie wystarcza; wstrzymany projekt można przywrócić w ciągu **90 dni** | codzienne użycie utrzymuje projekt; w razie wstrzymania — aplikacja działa lokalnie, wznowienie w panelu |
| Wbudowana poczta Auth | **2 e-maile / godz.**, wyłącznie do członków zespołu projektu | **logowanie kodem z e-maila odrzucone** (3 miejsca logowania = 3 e-maile) → e-mail + hasło, konto zakładane w panelu |
| Kod OTP (gdyby użyty) | 1 prośba / 60 s, ważność 1 h | nie dotyczy |

## 2. Etap 0 — przygotowanie projektu (użytkownik, przed Etapem 2)
1. supabase.com → nowa organizacja (plan Free, **bez karty**) → nowy projekt, region UE (np. Frankfurt), silne hasło bazy (tylko w menedżerze haseł).
2. SQL Editor → wklej `tools/supabase/schema.sql` → Run.
3. Authentication → Users → Add user: e-mail + hasło konta, „Auto confirm”.
4. Authentication → Sign In / Providers: **wyłącz rejestrację nowych użytkowników**; e-mail/hasło włączone.
5. Zanotuj **Project URL** (Project Settings → Data API albo przycisk „Connect”) i **Publishable Key**
   (Project Settings → API Keys, zaczyna się od `sb_publishable_`; starszy klucz „anon (public)” też zadziała). Wpiszesz je
   w aplikacji (§5.2). Nigdy nie używaj klucza sekretnego (`sb_secret_…`) ani `service_role` — aplikacja je odrzuca.
6. (Zalecane) SQL Editor → wklej `tools/supabase/check.sql` → Run: każdy wiersz powinien mieć `ok = true`.

## 3. Etap 1 — co powstało (bez interfejsu, bez zmian w działaniu aplikacji)
| Plik | Zawartość |
|---|---|
| `src/core/sync/crypto.js` | PBKDF2 → HKDF → AES-GCM / HMAC, `seal/open`, `cloudId`, weryfikator |
| `src/core/sync/cloud-api.js` | klient REST Supabase bez SDK: logowanie hasłem, odświeżanie z rotacją, ponowienie po 401, `pullEvents`, `pushEvents`, `sync_keys`, `deleteAll` |
| `src/core/sync/cloud.js` | `setupKeys` (pierwsze / kolejne urządzenie), `syncOnce` (pobranie z zapasem kursora → zapis → wysyłka partiami), `forgetCloudState` |
| `src/core/storage/store.js` | `appendMany(list, reason, { backup })` — opcjonalne pominięcie kopii; domyślnie bez zmian |
| `tools/supabase/schema.sql` | tabele, RLS, uprawnienia |
| `tests/unit/helpers/fake-supabase.mjs` | lokalny fałszywy serwer (Auth + PostgREST + RLS + opóźnione zatwierdzenie) |
| `tests/unit/cloud-crypto.test.mjs`, `cloud-sync.test.mjs` | 22 testy |

Moduły chmury **nie są importowane przez aplikację** — rozmiar paczki i działanie bez zmian do Etapu 2.

## 4. Nierozwiązane ryzyka (stan po Etapie 2)
| Ryzyko | Stan |
|---|---|
| Test na prawdziwym projekcie Supabase | **do wykonania przez użytkownika** (§5.6) — testy automatyczne używają fałszywego serwera odwzorowującego podzbiór REST; komunikaty błędów prawdziwego serwera mogą się różnić treścią |
| Safari/WebKit: WebCrypto i zapis `CryptoKey` w IndexedDB | Chromium: sprawdzone w teście przeglądarkowym (klucze po przeładowaniu, `extractable: false`). Safari na iPhonie — **kontrola ręczna** (§5.6). Gdy przeglądarka nie zapisze klucza, aplikacja trzyma go tylko do zamknięcia karty i informuje o tym |
| `cloud.acked` rośnie z liczbą zdarzeń | ~40 tys. identyfikatorów ≈ 1–1,5 MB; od D-084 zapisywana **tylko przy zmianie** (A2) — nadal odczyt przy każdej rundzie |
| Zapas kursora | od D-084 okno czytane jako lekki indeks numerów (~12 B/wiersz), treść tylko dla nowych/spóźnionych wierszy (A1); własne wiersze nie wracają |
| Wspólna domena GitHub Pages | bez zmian — decyzja użytkownika (§1.1) |
| Pierwsza synchronizacja z dużą bazą (tysiące zdarzeń) | szyfrowanie i wysyłka partiami po 250; przerwana runda wznawia się od miejsca przerwania |

## 5. Etap 2 — interfejs, konfiguracja i uruchomienie

### 5.1 Co powstało
| Plik | Zawartość |
|---|---|
| `src/core/sync/cloud-local.js` | warstwa urządzenia: `checkConfig` (walidacja adresu i klucza, **odrzucenie `sb_secret_…` i `service_role`**), `saveConfig`, `cloudStatus`, `signIn`, `unlock` (hasło szyfrowania; pierwsze urządzenie z powtórzeniem), `signOut`, `resetDevice`, `syncNow` (jedna runda naraz, także między kartami — Web Locks), `describeError` / `describeResult` (komunikaty po polsku) |
| `src/modules/dane-cloud.js` | sekcja „Synchronizacja w chmurze” w module Dane (pod sekcją iCloud Drive — ta bez zmian) |
| `src/modules/dane.js` | włączenie sekcji; dwa zdania opisu uzupełnione o synchronizację w chmurze |
| `src/ui/styles.css`, `tools/icons.mjs` → `src/ui/icons.js` | style `dn-cloud*` (wspólne z `dn-sync`), 6 ikon (`cloud`, `cloud-check`, `cloud-off`, `lock`, `log-in`, `log-out`) |
| `tools/supabase/check.sql` | kontrola zabezpieczeń w SQL Editor (tylko odczyt) |
| `tests/unit/cloud-local.test.mjs` | 9 testów warstwy urządzenia (fałszywy serwer) |
| `tests/e2e/fake_supabase.py`, `tests/e2e/cloud_sync.py` | fałszywy serwer HTTP z CORS i test w przeglądarce (`npm run e2e:cloud`) |

Model danych, `reduce()`, typy zdarzeń, format `2027-sync.json`, IndexedDB (nazwa, wersja, magazyny) — **bez zmian**.
Stan chmury per urządzenie w istniejącym magazynie `meta`: `cloud.config` (adres + Publishable Key), `cloud.session`
(tokeny), `cloud.keys` (nieeksportowalne `CryptoKey`), `cloud.owner`, `cloud.cursor`, `cloud.acked`, `cloud.lastSync`,
`cloud.lastBackup`; od D-084 także `cloud.auto` (przełącznik), `cloud.seen` (numery z okna zapasu kursora, których treść
urządzenie już ma), `cloud.expired` (sesja wygasła). Żaden z nich nie trafia do `2027-sync.json` (eksport zawiera wyłącznie zdarzenia — test).

### 5.2 Uruchomienie — krok po kroku (na każdym urządzeniu i w każdym sposobie uruchomienia)
Safari, aplikacja z ekranu początkowego, przeglądarka na Macu i plik `2027.html` mają **osobne bazy** — każde miejsce
konfigurujesz raz.
1. **Dane → Synchronizacja w chmurze**: wklej **Project URL** (`https://<projekt>.supabase.co`) i **Publishable Key**
   (`sb_publishable_…`) → „Zapisz konfigurację”.
2. **E-mail i hasło konta** (utworzonego w Authentication → Users) → „Zaloguj”.
3. **Hasło szyfrowania** (min. 12 znaków, inne niż hasło konta; zapisz je w menedżerze haseł):
   - na **pierwszym** urządzeniu aplikacja poprosi o powtórzenie i utworzy parametry szyfrowania w chmurze;
   - na kolejnych — to samo hasło; błędne jest wykrywane od razu (weryfikator), nic nie jest pobierane.
4. Po poprawnym haśle pierwsza synchronizacja uruchamia się **sama** (D-084). „Synchronizuj teraz” — pobiera zmiany z innych
   urządzeń, zapisuje je lokalnie, wysyła zmiany z tego urządzenia — od razu, na żądanie.
   Zalecana kolejność pierwszej synchronizacji: najpierw urządzenie z **pełnymi** danymi, potem pozostałe.
5. Kolejne razy: nic nie trzeba robić — synchronizacja automatyczna (§6). Sesja i klucze pozostają na urządzeniu; token
   odświeżany automatycznie.

Przełącznik **„Synchronizuj automatycznie”** (per urządzenie, domyślnie włączony) — wyłączony przywraca zachowanie z Etapu 2:
nic nie jest wysyłane ani pobierane bez kliknięcia (sprawdzone testem: zmiana, przeładowanie → zero zapytań do tabel).

### 5.3 Publishable Key w statycznej aplikacji — decyzja i konsekwencje (D-081)
- **Klucza nie ma w repozytorium ani w paczce** — wpisujesz go lokalnie (§5.2). Powód: repozytorium i GitHub Pages są
  publiczne, a adres projektu i klucz nie są potrzebne nikomu poza Tobą. Koszt: jednorazowe wklejenie na każdym urządzeniu.
- Publishable Key jest **z założenia publiczny** (Supabase projektuje go do umieszczania w przeglądarce). Nawet gdyby wyciekł,
  dane chronią trzy niezależne warstwy:
  1. **RLS** (`schema.sql`, kontrola: `check.sql`): rola `anon` (sam klucz, bez logowania) nie ma żadnych uprawnień;
     zalogowany użytkownik widzi i usuwa wyłącznie własne wiersze; brak UPDATE.
  2. **Wyłączona rejestracja**: z samym kluczem nie da się założyć konta (bez tego obcy mógłby założyć konto i zapisywać
     własne dane w Twoim limicie 500 MB — Twoich danych i tak by nie odczytał).
  3. **Szyfrowanie na urządzeniu**: nawet z tokenem konta serwer oddaje tylko szyfrogramy.
- Co może zrobić ktoś z samym kluczem: próbować logowania (ograniczenia liczby prób po stronie Supabase — stosuj silne hasło
  konta), generować ruch do limitów planu bezpłatnego (skutek: odrzucane zapytania, **nie** opłaty — plan Free bez karty).
- **Klucze omijające RLS** (`sb_secret_…`, `service_role`) są odrzucane przez aplikację (`checkConfig`, test) — nie mogą
  trafić na urządzenie.
- Alternatywa (niewybrana): wstrzyknięcie adresu i klucza przy budowie (zmienne środowiskowe w workflow) — wygodniejsze,
  ale wiąże publiczną paczkę z konkretnym projektem; możliwe później bez zmian w rdzeniu.

### 5.4 Sesja i klucze na urządzeniu (D-082)
- **Sesja**: token dostępu (1 h) i jednorazowy token odświeżania w `meta.cloud.session`; odświeżenie minutę przed
  wygaśnięciem i po odpowiedzi 401. Nieważny token odświeżania → komunikat „Sesja wygasła — zaloguj się ponownie”;
  klucze tego samego konta zostają (bez ponownego hasła szyfrowania).
- **Hasło konta i hasło szyfrowania nie są nigdzie zapisywane** (test: brak w `meta`). Zapisywane są wyłącznie
  wyprowadzone, **nieeksportowalne** `CryptoKey`, przypisane do konta (`user`).
- **Wyloguj**: usuwa sesję i klucze z urządzenia, unieważnia sesję na serwerze; kursor zostaje (to samo konto nie pobiera
  wszystkiego ponownie). Logowanie **innym** kontem zeruje kursor i potwierdzenia.
- **Odłącz to urządzenie** (w „Konfiguracja projektu”): usuwa konfigurację, sesję, klucze i stan synchronizacji. Dane lokalne
  i dane w chmurze bez zmian. Zmiana adresu projektu działa tak samo (inny serwer = od nowa).

### 5.5 Działanie offline, błędy, konflikty
| Sytuacja | Zachowanie |
|---|---|
| Brak internetu | aplikacja działa jak dotąd; „Synchronizuj teraz” → „Brak połączenia z chmurą. Dane są bezpieczne na tym urządzeniu…”; zmiany czekają (licznik „Do wysłania do chmury”) |
| Przerwanie w trakcie rundy | kursor przesuwany dopiero po zapisie pobranych zdarzeń; potwierdzenia wysyłki po każdej partii — następna runda kontynuuje bez utraty i bez duplikatów |
| Konflikt (ta sama rzecz zmieniona na dwóch urządzeniach) | oba zdarzenia trafiają do obu baz; niezmieniony `reduce()` wybiera nowszą zmianę (HLC), starsza zostaje w historii — jak przy imporcie pliku (test: zbieżność 222/222) |
| Dwie karty naraz | jedna runda naraz (Web Locks); druga karta: „Synchronizacja już trwa…” |
| Zły klucz / adres | „Serwer odrzucił klucz projektu…” / „Nie można połączyć się z serwerem… sprawdź adres” |
| Brak tabel (404) | „Uruchom tools/supabase/schema.sql…” |
| RLS odmawia (403) | „Serwer odmówił dostępu (zasady RLS)…” |
| Projekt wstrzymany (5xx) | „…mógł zostać wstrzymany po 7 dniach bez aktywności — wznowisz go w panelu Supabase” |
| Wpis w chmurze nie do odczytania | pominięty, raportowany w wyniku; dane lokalne bez zmian |
| Kopia przed dopisaniem | najwyżej raz dziennie („Kopie automatyczne” w Dane) |

### 5.6 Testy i kontrola ręczna
```bash
npm test               # m.in. cloud-crypto (8), cloud-sync (14), cloud-local (9), cloud-auto (14)
npm run build && npm run e2e:cloud   # 2 profile Chromium + 2. karta + plik 2027.html, fałszywy serwer: 76 kontroli (w tym axe w każdym kroku)
```
Kontrola ręczna (wymaga Twojego projektu — nie do zautomatyzowania bez kluczy):
1. SQL Editor → `tools/supabase/check.sql` → wszystkie `ok = true`.
2. Mac (przeglądarka): konfiguracja → logowanie → hasło szyfrowania (pierwsze urządzenie) → „Synchronizuj teraz”.
   W panelu Supabase → Table Editor → `events`: kolumna `blob` zawiera wyłącznie `p2027.c1.…` (bez czytelnej treści).
3. iPhone **Safari** i osobno **aplikacja z ekranu początkowego**: konfiguracja → logowanie → to samo hasło szyfrowania →
   „Synchronizuj teraz” → porównaj stan wybranej pozycji w Zapasach z Makiem.
4. Zamknij i uruchom ponownie aplikację na iPhonie → w Dane powinien od razu być przycisk „Synchronizuj teraz” (klucze
   zapamiętane). Jeśli pojawi się informacja, że przeglądarka nie zapamiętuje kluczy — zgłoś (ograniczenie WebKit).
5. Tryb samolotowy → zmiana w Zapasach → „Synchronizuj teraz” (komunikat o braku połączenia) → wyłącz tryb → ponownie.

## 6. Synchronizacja automatyczna (D-084, 25.09.2026)

### 6.1 Zasada
Zapis lokalny kończy się **zanim** cokolwiek trafi do sieci — synchronizacja nigdy nie blokuje interfejsu, a brak internetu nie
grozi utratą danych. Harmonogram: `src/core/sync/cloud-auto.js` (bez DOM, testowany fałszywym zegarem), podłączenie: `src/app.js`.

| Wyzwalacz | Runda | Zasada |
|---|---|---|
| Zapis zmiany (w tym import pliku) | tylko wysyłka | 1,5 s po ostatniej zmianie, najpóźniej 15 s od pierwszej; seria zmian = jedno wysłanie; bez zmian do wysłania — zero zapytań (dopisanie zdarzeń z chmury nie zapętla) |
| Otwarcie aplikacji | pełna | 2,5 s po pierwszym widoku |
| Powrót do aplikacji (`visibilitychange`) | pełna | najwyżej raz na 60 s (od razu, jeśli czeka ponowienie po błędzie) |
| Powrót sieci (`online`) | pełna | od razu, licznik błędów od zera |
| Zejście do tła (`visibilitychange`/`pagehide`) | tylko wysyłka | od razu, jeśli zmiany czekały na odliczenie (bez gwarancji — iOS może wstrzymać stronę) |
| Po haśle szyfrowania, przełączniku, wylogowaniu | pełna | wznowienie po wstrzymaniu |
| „Synchronizuj teraz” | pełna | przejmuje oczekujące zmiany, czeka na trwającą rundę automatyczną |

Brak odpytywania co N minut (zmiany z innych urządzeń pojawiają się przy otwarciu / powrocie / ręcznie).

### 6.2 Równoległość, błędy, komunikaty
- Jedna runda naraz: flaga w karcie + Web Locks między kartami (odświeżanie tokenu też pod blokadą — rotacja tokenów bez
  wyścigu). Inna karta synchronizuje → ciche ponowienie po 5 s. Wyzwalacze w trakcie rundy łączone w jedną następną.
- Każda instancja magazynu dostaje słuchacza (`attachStore`) — **poprawka A4**: wcześniej po przeładowaniu bazy z powodu
  zmiany w innej karcie karta przestawała powiadamiać pozostałe.
- Błędy przejściowe (sieć, limit czasu 30 s, 5xx, 429): ponowienia po 15 s, 30 s, 1, 2, 5, 15 min — tylko przy aplikacji na
  ekranie; w tle nic (iOS i tak wstrzymuje zegary), przy powrocie od razu.
- Błędy wymagające działania (wygasła sesja, klucz, RLS, brak tabel, brak hasła szyfrowania): wstrzymanie bez ponowień do
  czasu działania użytkownika; **jeden** baner na sesję poza Dane („Przejdź do Dane” / „Zamknij”). Baner także wtedy, gdy
  zmiany czekają na wysłanie ponad dobę.
- Wygasła sesja (nieudane odświeżenie tokenu) jest zapamiętywana (`cloud.expired`) — baner wraca przy każdym uruchomieniu
  aplikacji aż do ponownego logowania (synchronizacja nie może „cicho” stanąć).
- Celowe wylogowanie, odłączenie, wyłączony przełącznik, brak konfiguracji: automat cicho nieaktywny (bez zapytań i banerów).
- Udana runda i brak sieci: **bez komunikatów** — w sekcji Dane jedno zdanie stanu na żywo („włączona · ostatnio 12:03”,
  „Brak połączenia — zmiany zostaną wysłane automatycznie…”, „Wstrzymana: …”) i licznik niewysłanych zmian.
- Zmiany pobrane z innego urządzenia odświeżają widok dopiero, gdy nie piszesz w polu i żadne okno nie jest otwarte
  (`softRender`) — wpis i otwarty arkusz nie giną.

### 6.3 Limity (plan Free)
- Runda „tylko wysyłka”: zwykle 1 zapytanie (+1 na każde kolejne 250 zdarzeń); odpowiedź = numery wstawionych wierszy.
- Runda pełna: indeks numerów z okna zapasu (~12 B/wiersz; w teście 784 B dla 61 wierszy) + treść tylko wierszy nieznanych
  lokalnie (A1); własne wysłane wiersze nie są pobierane z powrotem. Wcześniej ~400 B/wiersz × do 1000 wierszy w każdej rundzie.
- Szacunek: 4 miejsca uruchomienia × ~30 rund pełnych dziennie ≈ kilkadziesiąt–kilkaset MB miesięcznie przy limicie 5 GB.
- Zapis stanu w `meta` tylko przy zmianie (A2): pusta runda zapisuje jedynie `cloud.lastSync`.

### 6.4 Zgodność z Safari / iOS (analiza; środowisko testowe ma tylko Chromium)
| Element | Wymaganie | Stan |
|---|---|---|
| Web Locks (`navigator.locks`) | Safari 15.4+ | iOS 16+ w użyciu (build: `safari16`); bez API — zabezpieczenie w obrębie karty, duplikaty i tak pomija serwer |
| `BroadcastChannel` | Safari 15.4+ | jak wyżej (używane od Fazy 3) |
| Limit czasu zapytań | `AbortController` (Safari 12.1+) | celowo bez `AbortSignal.timeout` (Safari 16) |
| `visibilitychange`, `pagehide`, `online` | wszystkie wersje | PWA na iOS: wznowienie = `visibilitychange`; `navigator.onLine` bywa zawodne — wtedy błąd sieci i ponowienia |
| Zegary w tle | iOS wstrzymuje | wysyłka przy zejściu do tła + pełna runda przy powrocie / ponownym uruchomieniu |
| Duże zbiory w argumentach (`Math.max(...zbiór)`) | limit argumentów WebKit | nieużywane (pętla) |
| `CryptoKey` w IndexedDB | Safari | do potwierdzenia ręcznie (Etap 2, §5.6 pkt 4) |

### 6.5 Kontrola ręczna po wdrożeniu (iPhone Safari, PWA, Mac)
1. Dane → sekcja chmury: „Synchronizuj automatycznie” wciśnięty; zdanie „Synchronizacja automatyczna włączona · ostatnio …”.
2. Zmiana w Zapasach na Macu → po ~2 s w Dane na Macu „Wszystkie zmiany… są w chmurze” (bez klikania).
3. iPhone (PWA): przełącz na inną aplikację na ponad minutę i wróć → zmiana z Maca widoczna bez klikania.
4. Tryb samolotowy na iPhonie → zmiana → w Dane „Brak połączenia — zmiany zostaną wysłane automatycznie…”, bez banerów
   → wyłącz tryb → po chwili zmiana widoczna na Macu.
5. Szybka seria (np. kilka serii w Treningu) → w panelu Supabase (Logs / API) jedno wysłanie zamiast wielu.
6. Pisanie w polu podczas powrotu do aplikacji — wpis nie znika.

Źródła: [Supabase — Pricing](https://supabase.com/pricing) · [Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq) ·
[Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing) ·
[Paused Free Plan projects restorable for 90 days](https://supabase.com/changelog/27497-paused-free-plan-projects-are-restorable-for-90-days) ·
[Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits) ·
[Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless) ·
[PostgREST — Tables and Views (upsert, on_conflict)](https://docs.postgrest.org/en/latest/references/api/tables_views.html)
