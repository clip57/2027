# Raport D-117 — egzamin CFA 13.05.2027, bez zjazdu IX, kalendarz do 31.12.2027

Decyzja użytkownika (22.11.2026), dosłownie: „Termin egzaminu załóż 13.05, na zjeździe IX mnie nie będzie więc zostaw bloki w planie, suplementy czasowe
nie były dotychczas używane więc jest ich pod dostatkiem. Na resztę pytań odpowiem później. Obecnie zajmij się rozbudowaniem kalendarza do końca roku 2027
zachowując analogiczne rozplanowanie treningu, diety i rutyny przez cały rok. Resztę dostosujemy później.”

Dane: skrypt decyzji `tools/extract/plan_d117.py` (po `plan_d116.py`; idempotentny). **Bez zmian typów zdarzeń, `reduce()`, bazy i synchronizacji.**

| Zmiana | Wykonanie |
|---|---|
| Egzamin CFA | `cfa.json`: `exam = 2027-05-13` (bez notatki „termin do uzupełnienia”). Moduł CFA: „X dni do egzaminu”, egzamin w kalendarzu planu; „Wymaga uwagi” — zaległe bloki CFA do dnia egzaminu. |
| Zjazd IX (08–09.05.2027) | usunięty z `week.json` — w tych dniach bloki CFA B–I i dodatkowy w swoich slotach (bez kolizji). |
| Suplementy czasowe | bez zmian w Zapasach (wg użytkownika zapas wystarczający, preparaty dotąd nieużywane); okres przyjmowania do 31.12.2027. |
| Kalendarz do 31.12.2027 | `phases.json`: koniec 31.12.2027; Faza 2, tydzień bazowy treningu (pn UPPER 1 + sauna … nd basen), dieta T/NT, czwartek z sauną i zakupami 19:05, rutyna dnia i pielęgnacja wg szablonu — do końca roku. |

**Nie zmienione (do późniejszego dostosowania, zgodnie z poleceniem):** dni świąteczne po 28.03.2027 (m.in. 01.11, 11.11, 24–26.12, 31.12.2027) są zwykłymi
dniami tygodnia bazowego (z treningiem i zakupami); bez fazy po Fazie 2; otwarte sprawy z `RAPORT_D116.md` §3 (D1 — blok dodatkowy × trening, święta, dzień obrony).

Testy: jednostkowe zaktualizowane (koniec planu 31.12.2027, 440 dni preparatów czasowych, egzamin 13.05, 08.05 bez zjazdu); E2E — kalendarz CFA z egzaminem,
statystyki planu, dzień po końcu planu 01.01.2028; a11y — dodatkowo 31.12.2027 i grudzień 2027 w Kalendarzu.
