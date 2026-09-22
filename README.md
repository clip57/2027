# 2027

Osobista platforma: plan dnia, dieta, suplementacja, meal prep, zapasy, trening i nauka CFA. Działa offline, instaluje się na ekranie początkowym iPhone'a i w Docku macOS, dane synchronizuje przez plik w iCloud Drive. Bez płatnych usług.

**Stan:** Etap 2 (rdzeń) — dane, obliczenia, zapis, synchronizacja, migracja i szkielet interfejsu. Moduły docelowe powstają w Etapach 3–6 (`docs/SPEC_2027_etap1_v1.1.md`, sekcja 9).

## Zasady danych
- `src/data/*.json` — dane źródłowe, tylko do odczytu, każda wartość ma pochodzenie (`src`) lub decyzję (`docs/DECYZJE_2027.md`).
- Dane użytkownika (stany, postęp, dzienniki) żyją wyłącznie w przeglądarce (IndexedDB) i w plikach kopii. **Nigdy w repozytorium.**
- Pliki źródłowe z projektu i pakiet prywatny (`2027-prywatne.json`) są poza repozytorium (D-035). Repozytorium może być publiczne.

## Struktura
```
src/data      dane źródłowe (wygenerowane narzędziami z tools/extract, zweryfikowane)
src/core      logika bez interfejsu: daty, resolver dnia, obliczenia, zapis, synchronizacja, migracje
src/ui        tokeny wyglądu, budowanie DOM bez innerHTML
src/modules   moduły interfejsu (moduły nie importują siebie nawzajem)
tools         ekstrakcja, weryfikacja, budowa
tests/unit    testy logiki (node --test)
tests/e2e     testy w przeglądarce (Playwright, Python)
```

## Polecenia
```bash
npm ci
npm test                 # testy jednostkowe
npm run build            # dist/web (GitHub Pages) i dist/single/2027.html (jeden plik)
SOURCES_DIR=… npm run verify                          # weryfikacja danych ze źródłami (wymaga plików projektu)
SOURCES_DIR=… python3 tools/extract/build_private_pack.py ~/iCloud/2027/2027-prywatne.json
```

## Publikacja (GitHub Pages, bezpłatnie)
1. Utwórz publiczne repozytorium i wypchnij tę zawartość do gałęzi `main`.
2. Settings → Pages → Source: **GitHub Actions**.
3. Workflow `.github/workflows/pages.yml` uruchomi testy, zbuduje aplikację i opublikuje `dist/web`.
4. Adres pojawi się w zakładce Actions/Pages. Strona ma `noindex` — nie trafia do wyszukiwarek, ale jest dostępna dla każdego, kto zna adres. Nie zawiera żadnych Twoich danych.

Uwaga: wszystkie strony GitHub Pages jednego konta mają wspólne pochodzenie przeglądarki. Jeśli publikujesz tam inne projekty, rozważ osobne konto dla tej aplikacji.

## Synchronizacja (wariant A, D-033)
Dane → „Wyślij do iCloud” zapisuje `2027-sync.json`; na drugim urządzeniu „Pobierz z iCloud” scala zmiany. Import jest idempotentny, konflikty rozstrzyga późniejsza zmiana (przegrana zostaje w historii), przed każdym importem powstaje kopia.
