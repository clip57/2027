# Pakiet prywatny — aktualizacja do bieżącej wersji planu (D-035, D-091)

Pakiet `2027-prywatne.json` zawiera treści z danymi osobowymi i medycznymi (REKOMPOZYCJA s.1 i s.21, zdania z wynikami badań
z Rekompozycji i Meal Prep). **Nie ma go w repozytorium** — powstaje i jest przechowywany wyłącznie u Ciebie (iCloud Drive, urządzenia).
Po zaimportowaniu podróżuje w pliku `2027-sync.json` i (zaszyfrowany) w chmurze.

## Co się zmieniło (D-091, 27.09.2026)
- Pakiet dostaje metadane wersji planu: `plan.start` (27.09.2026 — D-090), fazy i zakres planu CFA.
- Zaakceptowane zmiany treści planu (te same co w części publicznej Rekompozycji, m.in. fazy opisane datami „Faza 0 (27.09–11.10)”,
  koniec suplementów czasowych 21.03.2027) są stosowane także w tekstach prywatnych. Wyjątek: ogólna zamiana „Tygodnie” → „Okres”
  (dotyczy nagłówka jednej tabeli publicznej) nie jest stosowana w tekstach prywatnych.
- Kontrola zgodności z danymi aplikacji: każdy znacznik `{private:N}` w Rekompozycji (30) i Meal Prep (2) musi mieć fragment w pakiecie.
- Zdania z datami lub tygodniami są wypisywane **do ręcznego przejrzenia** (np. terminy badań kontrolnych) — skrypt ich nie zmienia,
  bo nie zna Twoich terminów.
- Aplikacja (Dane → Diagnostyka danych) pokazuje stan pakietu: aktualny / z wcześniejszej wersji planu / niepasujący do danych.
  Podgląd importu pokazuje, dla jakiego planu pakiet przygotowano. Stary pakiet działa dalej — nic nie zostaje ukryte.

## Jak zaktualizować (na Macu, w katalogu repozytorium)
**A. Istniejący pakiet — bez plików źródłowych** (wystarczy Python 3, bez dodatkowych bibliotek):
```bash
python3 tools/extract/private_pack_lib.py ~/Library/Mobile\ Documents/com~apple~CloudDocs/2027/2027-prywatne.json \
  ~/Library/Mobile\ Documents/com~apple~CloudDocs/2027/2027-prywatne-2026-09-27.json
```
Skrypt nie zmienia oryginału, odmawia zapisu w repozytorium i kończy się błędem, jeśli pakiet nie pasuje do danych aplikacji.

**B. Nowy pakiet ze źródeł** (`PLAN_REKOMPOZYCJI.html`, `MEAL_PREP.html`; wymaga `pip install beautifulsoup4`):
```bash
SOURCES_DIR=~/…/zrodla python3 tools/extract/build_private_pack.py ~/…/2027/2027-prywatne-2026-09-27.json
```

**Potem:** przejrzyj wypisane zdania „Do przejrzenia”, a nowy plik zaimportuj w module **Dane → Pobierz z iCloud lub importuj plik**
(na jednym urządzeniu; pozostałe dostaną go przez synchronizację). Nowy pakiet zastępuje poprzedni (wygrywa późniejsza zmiana).
W Dane → Diagnostyka danych powinno pojawić się „Pakiet prywatny aktualny (plan od 2026-09-27)”. Stary plik możesz zachować jako kopię.
