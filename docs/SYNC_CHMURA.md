# Synchronizacja przez chmurę (Supabase) — audyt doprecyzowujący i Etap 1 (24.09.2026)

Kierunek zaakceptowany przez użytkownika (D-078): **Supabase**, IndexedDB pozostaje źródłem prawdy, ręczna synchronizacja
`2027-sync.json` zostaje jako mechanizm awaryjny. Etap 1 = rdzeń bez interfejsu (ten dokument). Interfejs — Etap 2.

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
5. Project Settings → API: zanotuj **Project URL** i klucz **anon (public)** — wpiszesz je w aplikacji w Etapie 2. Nigdy nie
   używaj klucza `service_role` w aplikacji ani w repozytorium.

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

## 4. Nierozwiązane ryzyka (do Etapu 2+)
- Test na prawdziwym projekcie Supabase (fałszywy serwer odwzorowuje podzbiór REST; różnice komunikatów błędów możliwe).
- Safari/WebKit: WebCrypto (PBKDF2, HKDF, AES-GCM) sprawdzone w Chromium i Node; Safari — test na iPhonie w Etapie 2.
- Przechowywanie `CryptoKey` w IndexedDB (klonowanie strukturalne) — obsługiwane w przeglądarkach, sprawdzenie w Etapie 2.
- `cloud.acked` rośnie z liczbą zdarzeń (~40 tys. identyfikatorów ≈ 1–1,5 MB w `meta`, zapis przy każdej rundzie) —
  do optymalizacji, jeśli okaże się wolne (np. znacznik „wszystko do HLC X potwierdzone” + lista wyjątków).
- Zapas kursora = ponowne pobranie do 1000 wierszy w każdej rundzie (~400 KB) — do zmniejszenia po pomiarach.
- Wspólna domena GitHub Pages — decyzja użytkownika (§1.1).

Źródła: [Supabase — Pricing](https://supabase.com/pricing) · [Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq) ·
[Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing) ·
[Paused Free Plan projects restorable for 90 days](https://supabase.com/changelog/27497-paused-free-plan-projects-are-restorable-for-90-days) ·
[Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits) ·
[Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless) ·
[PostgREST — Tables and Views (upsert, on_conflict)](https://docs.postgrest.org/en/latest/references/api/tables_views.html)
