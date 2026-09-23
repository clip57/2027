# Projekt „2027” — raport końcowy (Etap 6 i podsumowanie, 23.09.2026)

## Etap 6 — część 3
- **A2.9 (D-053):** 7 komórek tabel suplementów w REKOMPOZYCJI s.6 zgodnych z SUPLEMENTACJĄ (podmiany przypisane do konkretnego wiersza — np. „Obojętne” zmienione tylko dla kreatyny, magnez bez zmian). Zdanie o przyjmowaniu cynku z posiłkiem, które było w komórce tabeli, trafiło do „Pierwotnego uzasadnienia” pod tabelą (A2.5 — wcześniej obsłużone tylko w akapitach). **Uzupełnienie A2.4:** dawka melatoniny 0,5–1 mg występowała jeszcze w s.18 i s.22 — zmieniona na 1 mg (ta sama decyzja).
- **Spójność prywatności:** zdanie o podaży cynku względem RDA przeniesione do pakietu prywatnego, tak jak analogiczne zdanie w Meal Prep (D-045). Pakiet: 4 sekcje, 30 fragmentów Rekompozycji. **Wymaga ponownego importu.**
- **Poradnik Bezpieczne v3** w module Bezpieczeństwo (widok „Poradnik”): 11 sekcji, korekty z audytu i kroki procesu jako karty, oznaczenia statusu (PRAWO, ORGAN, PARAMETR, MOJA REK., ✅ bez zmian, ⚠️ korekta) jako kolorowe plakietki. Zastosowane: B1.1 (usunięta korekta o 85 °C, numeracja 1–10), B1.2, B1.3, B1.4, B2 (skyr w poprawnej odmianie, białko WPC), Q1 (usunięte zalecenie powtarzania testu). Zmiana redakcyjna E-1 (D-054): odesłanie do pliku Tabeli → do zakładki „Tabela”.
- **Audyt dostępności i responsywności (axe-core, WCAG 2.1 A/AA):** 20 widoków × 390/1280 px × motyw jasny/ciemny. Wykryto 2 typy naruszeń: kontrast (54 miejsca — kolory statusów wpisane na sztywno, zbyt ciemne w motywie ciemnym i za słabe na barwionych tłach) oraz przewijane obszary niedostępne z klawiatury (20). Po wprowadzeniu semantycznych tokenów kolorów i dostępu z klawiatury (D-055): **0 naruszeń, 0 przypadków przewijania w poziomie.**

## Testy (stan końcowy)
| Zestaw | Wynik |
|---|---|
| Weryfikacja danych ze źródłami | 407 / 0 |
| Jednostkowe | 65 / 65 |
| E2E (web i jeden plik × 390 / 1280 px) | 784 / 0 |
| Dostępność (axe-core WCAG 2.1 A/AA, 80 przebiegów) | 0 naruszeń |

## Podsumowanie projektu
Jedna aplikacja offline (GitHub Pages + wariant jednoplikowy), jedna warstwa danych z weryfikowanym zapisem i synchronizacją przez iCloud Drive, 10 modułów: Dziś, Dieta, Suplementacja, Zapasy, Meal Prep, Trening, CFA, Bezpieczeństwo żywności, Rekompozycja, Dane i synchronizacja. Rejestr 55 decyzji w `DECYZJE_2027.md`; każda różnica danych względem źródeł ma przypisaną decyzję (`ZMIANY_DANYCH.md`, raporty etapów).

## Otwarte (poza zakresem wykonanych etapów)
- **G-20:** dziennik kolana i monitoring (waga, sen, obwody) wymagane przez REKOMPOZYCJĘ — nie zdecydowano, czy mają być częścią aplikacji.
- **D-031:** import Twojego postępu i error logu z pliku CFA v3 — funkcje importu gotowe (moduł Dane / CFA), czeka na pliki.
- Workflow GitHub Actions działa u Ciebie (potwierdzone w teście akceptacyjnym Etapu 2); nowe testy E2E i a11y uruchamiane są lokalnie (wymagają Playwright), nie w workflow publikacji.

## Aktualizacja na urządzeniach
1. Wypchnij `2027-repo.zip` do `main` (GitHub Pages) lub podmień `2027.html` w Readdle.
2. **Zaimportuj nowy `2027-prywatne.json`** na iPhonie i Macu (moduł Dane) — bez tego część treści Rekompozycji i Meal Prep pokazuje znacznik 🔒.
