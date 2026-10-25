# Raport D-112 — iPhone: przewijanie, skoki strony, arkusz przeciągany w dół (25.10.2026)

Zgłoszenie użytkownika po publikacji D-110/D-111 (kontrola na iPhonie): „po przewinięciu pojawia się pasek tytułu; okna da się zamknąć
przeciągnięciem w dół — z tym jest problem. Przewijanie działa bardzo słabo i czasem też przewija na tę samą stronę, a przeciągnięcie w dół
nie działa. Pozostałe rzeczy są okej.”

Środowisko nie ma silnika WebKit — przyczyny ustalone pomiarem w Chromium (liczniki CDP `Performance.getMetrics`: przeliczenia stylów,
czas zadań wątku głównego; przewijanie zdarzeniami dotyku 390 px) i odtworzeniem scenariuszy, porównanie z wersją sprzed D-110 (`a824797`)
i opublikowaną (`5b45e6b`).

## 1. Przyczyny i poprawki
| # | Przyczyna | Pomiar przed | Poprawka | Po |
|---|---|---|---|---|
| 1 | Dwie nieskończone animacje „pulsu” w „Dziś” (`box-shadow`: kropka „Teraz”, węzeł osi czasu) — praca wątku głównego w każdej klatce, pod rozmytymi paskami (dock, pasek tytułu) | spoczynek 3 s: 181 przeliczeń stylów, 0,21 s zadań; przewijanie: 325 przeliczeń | puls usunięty (również wariant na samym `transform` dawał przeliczenia przy przewijaniu); kropka i węzeł ze stałą obwódką i poświatą | spoczynek: 0 / 0,011 s; przewijanie: 17 (jednorazowe przełączenie paska tytułu); inne moduły 15–17 |
| 2 | Obsługa przewijania (`scroll` + `requestAnimationFrame`) czytała położenie nagłówka w każdej klatce i zapisywała pozycję | czas skryptów przy przewijaniu 0,041 s | pasek tytułu przez `IntersectionObserver` nagłówka strony; pozycja opuszczanego widoku zapisywana przy zmianie trasy; `history.scrollRestoration = 'manual'` | 0,0035 s |
| 3 | Po zmianie modułu przewinięcie na górę wykonywane dopiero po (asynchronicznym) przerysowaniu — mogło „szarpnąć” stronę, którą już przewijano; przy „Wstecz” przeglądarka i aplikacja przewijały dwa razy | — | na górę od razu przy zmianie trasy; powrót do zapamiętanej pozycji tylko, gdy w międzyczasie nie było dotyku, kółka ani klawisza | — |
| 4 | Przerysowanie w miejscu (zmiana pobrana z chmury w tle, zmiana w innej karcie, zapis) w module rysowanym asynchronicznie skracało na chwilę stronę — przewinięcie spadało na początek tej samej strony | Dane, zmiana w drugiej karcie: 900 → 0 | `render(true)` przywraca pozycję sprzed przerysowania (bez dotyku w międzyczasie) | 900 → 900 |
| 5 | Przeciąganie arkusza na zdarzeniach wskaźnika — na iOS gest przejmowało przewijanie (zdarzenie `pointercancel`), arkusz się nie ruszał | — | zdarzenia dotyku, `preventDefault` w pierwszym i kolejnych `touchmove`; przeciąganie za nagłówek z uchwytem **albo za treść przewiniętą do góry** (jak arkusze iOS); ruch w górę za treść — zwykłe przewijanie | testy: oba warianty |

Ponadto: ponowne dotknięcie zakładki bieżącego modułu (pasek dolny, panel boczny) przewija na górę (konwencja iOS); przejście z widoku
dnia do modułu przez zakładkę — od góry; tło „aurora” o wysokości `100lvh` zamiast `inset: 0` (chowanie paska Safari przy przewijaniu nie zmienia
rozmiaru warstwy z gradientami).

## 2. Zmienione pliki
`src/ui/system.css` (bez animacji nieskończonych, tło `100lvh`), `src/app.js` (`watchTitle`, `navigate`, `render(true)` z zachowaniem
pozycji, `scrollRestoration`, zakładka bieżącego modułu), `src/ui/components.js` (`dragToClose` na zdarzeniach dotyku), `tests/e2e/e2e.py`
(`run_d110`: brak animacji nieskończonych w „Dziś”, przeciąganie za treść w dół zamyka i w górę nie zamyka, zakładka bieżącego modułu,
`scrollRestoration`). Dane, zdarzenia, synchronizacja — bez zmian.

## 3. Testy
Przebieg 25.10.2026 (oba warianty buildu, dane syntetyczne): `npm test` 253 — 252 zaliczone, 1 pominięty (pliki użytkownika);
`plan_check.mjs` 0 błędów (3 znane ostrzeżenia); `verify_all.py --data-only` 0 błędów; `cfa_smoke.py` 0 błędów; `npm run e2e` 1524/1524
(w tym nowe kontrole D-112 w `run_d110`); `npm run a11y` 0 naruszeń; `npm run e2e:trening` 0 błędów; `npm run e2e:sync` 23/23;
`npm run e2e:cloud` 100/100. Pomiary (§1) — skrypty poza repozytorium (liczniki CDP), wynik powtarzalny.

## 4. Do sprawdzenia na iPhonie
- Przewijanie „Dziś” i innych modułów — płynne; bez powrotu na początek strony po chwili (także przy włączonej synchronizacji w chmurze).
- Pasek tytułu pojawia się po przewinięciu poza nagłówek i znika po powrocie na górę.
- Arkusz (np. technika ćwiczenia w Treningu): przeciągnięcie w dół za uchwyt / nagłówek albo za treść, gdy jest na górze — zamyka;
  krótkie — wraca; przewijanie długiej treści w arkuszu działa normalnie.
- Dotknięcie zakładki modułu, w którym jesteś — przewija na górę.
