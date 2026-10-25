# Raport D-111 — decyzje użytkownika z 25.10.2026 i dopracowanie

Odpowiedź użytkownika na listę otwartych spraw (`docs/PRZEKAZANIE.md` §4, 24.10.2026): „D1 na razie nie zmieniaj; założenia planu CFA V44
niech nadal obowiązują; nie, jest dobrze z tym blokiem J; usuń w ogóle kolano z dziennika sesji, nie chce tego; przypomnij mi co to było
D2, I9 i I12; zamknij [D-031]. Z rzeczy niezrobionych na 100%: rozwiąż problem skryptu i dodaj znacznik w pielęgnacji. Ponadto podnieś
wersje akcji z ostatniego punktu.”

## 1. Decyzje (bez zmian w kodzie)
| Sprawa | Decyzja |
|---|---|
| D1 — bloki MPW a plan dnia od 16.11 | na razie bez zmian (wrócić przed 16.11) |
| Założenia D-103 §5 (sauna w dni z M, posiłek 20:15, dawki 17:15, tekst kreatyny) | obowiązują nadal |
| D-099 §4 — 10 min „powrotu” w dni z blokiem J | bez zmian |
| G-20 — monitoring (kolano, waga, sen, obwody) | zamknięte: kolano usunięte, reszta poza aplikacją |
| D-031 — pliki postępu i error logu CFA v3 | zamknięte (nieaktualne po planie V44) |
| D2, I9, I12 (Etap 4 audytu 25.09.2026) | zamknięte bez wdrożenia (decyzja użytkownika 25.10.2026; opisy nie zachowały się w repozytorium) |

## 2. Zmiany
### Dziennik sesji bez kolana (`src/core/trainlog.js`, `src/modules/trening_log.js`)
- Sekcja `knee` usunięta z definicji pól, panelu „Dziennik sesji” i opisu dnia w Historii; sekcje: Basen / Rower / Sauna / Notatka.
- **Dane bez zmian:** dawne wpisy `knee` zostają w dzienniku zdarzeń (eksport, synchronizacja), walidacja zdarzenia w magazynie bez zmian
  (data + zwykły JSON); przy kolejnym zapisie dnia sekcja przechodzi dalej jak nieznana (`withValue`), nie jest pokazywana ani liczona
  (sesją jest tylko dzień z basenem lub rowerem — jak dotąd).
- Arkusz „System kolana” w Treningu (treść planu treningowego, D-105) — bez zmian.

### Podzbiór fontu skryptem (`tools/fonts.py`, `tools/fonts.json`, `public/fonts/*.woff2`, `src/ui/tokens.css`)
- Źródło: `inter-ui@4.1.1` z npm (Inter 4.001 — ta sama wersja co dotychczasowe pliki z Google Fonts), suma SHA-256 pakietu sprawdzana;
  oś opsz ustalona na 14, wght zmienny 100–900; szerokości znaków i metryki typo identyczne — **porównanie renderowania polskiego tekstu
  (3 grubości × 3 rozmiary): 0 różnych pikseli**.
- `inter-latin.woff2` — cały Latin-1 i interpunkcja ogólna (282 znaki, wcześniej 116: m.in. ’ “ € é ü § © ²); `inter-latin-ext.woff2` —
  Latin Extended-A, ș ț, znaki łączące (tekst NFD), symbole używane w aplikacji (← ↔ ↩ ≈ ≠ ≤ ≥ ⌘ ▶ ✓ ⁴ ⁷ ⁹; 155 znaków, wcześniej 19);
  `unicode-range` tej reguły zapisuje skrypt. Pliki: 32 → 61 KB (wariant z Latin Extended-B: 92 KB — odrzucony).
- Emoji i znaki z selektorem emoji (np. „⚠️”) zostają przy foncie systemowym; znaki bez glifu w Inter — lista w `tools/fonts.json` (51).
- Wynik powtarzalny (bez znacznika czasu); strażnik `tests/unit/fonts.test.mjs`: sumy plików, `unicode-range`, każdy znak ze źródeł aplikacji
  w podzbiorze albo na liście fontu systemowego (sprawdzone: wstawiony nowy znak jest wykrywany).

### Znacznik pielęgnacji (`src/core/calc/care.js`, `src/modules/dzis.js`, `src/modules/pielegnacja.js`)
- Krok przypięty do slotu, którego w danym dniu nie ma (inny wariant dnia), pokazuje postęp w slocie dnia obejmującym godzinę przypiętego
  slotu (`placeSlotProgress`), a gdy żaden jej nie obejmuje — w ostatnim wcześniejszym. Przypadek z `RAPORT_D097.md` §4: niedziele świąteczne
  27.12 i 28.03 bez wariantu „basen” — krok z `slot.2015n` w zwykłym slocie 20:15. Definicje slotów wspólne (`slotDefs`).

### Akcje GitHub (`.github/workflows/testy.yml`, `pages.yml`)
- `actions/checkout@v7`, `actions/setup-node@v7`, `actions/setup-python@v7`, `actions/upload-pages-artifact@v5` (`include-hidden-files: true` —
  `.nojekyll` w paczce jak dotąd), `actions/deploy-pages@v5` — wersje na Node 24 (ostrzeżenie o Node 20 w CI). Node projektu bez zmian (22).
  `pages.yml` sprawdzi dopiero publikacja na `main`.

## 3. Testy
Przebieg 25.10.2026 (oba warianty buildu, dane syntetyczne D-065): `npm test` 253 — 252 zaliczone, 1 pominięty (migracja kopii ZAPASY —
pliki użytkownika); `plan_check.mjs` 0 błędów (3 znane ostrzeżenia); `verify_all.py --data-only` 0 błędów; `cfa_smoke.py` 0 błędów;
`npm run e2e` 1519/1519; `npm run a11y` 0 naruszeń; `npm run e2e:trening` 0 błędów; `npm run e2e:sync` 23/23; `npm run e2e:cloud` 100/100.
Testy zmienione: `trainlog.test.mjs` (sekcje bez kolana, dawne wpisy kolana tolerowane), `tests/e2e/trening_log.py` (bez kroków kolana,
kontrola braku sekcji); nowe: `fonts.test.mjs`, test D-111 w `care.test.mjs`, kontrola 27.12 w `e2e.py`.

## 4. Do sprawdzenia na urządzeniach
- Trening → dziennik sesji: brak sekcji „Kolano”; dawne wpisy kolana nie pojawiają się w Historii.
- Tekst z polskimi literami bez zmian wyglądu; strzałki (←, ↔), ≤ ≥, ✓ i ⌘ — teraz krojem Inter (wcześniej fontem systemowym).
- „Dziś” 27.12 lub 28.03 (przewiń daty) — przy slocie 20:15 znacznik kroków pielęgnacji przypiętych do niedzieli z basenem.
