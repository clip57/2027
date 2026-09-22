# Zmiany w danych względem plików źródłowych

Każda różnica między `src/data/*.json` a plikami źródłowymi ma przypisaną decyzję. Kontrolę wykonuje `tools/verify/verify_all.py` (407 kontroli, 0 błędów, 22.09.2026).

| Dane | Źródło (przed) | Aplikacja (po) | Decyzja |
|---|---|---|---|
| Nazwa: Białko KFD (PDF, ZAPASY) | Białko KFD | Białko WPC | D-020 |
| Nazwa: Skyr naturalny (PDF, ZAPASY) | Skyr naturalny | Skyr | D-020 |
| Nazwa: Brokuły (PDF) / Brokuły (mrożone) (ZAPASY) | Brokuły | Brokuły mrożone | D-020 |
| Nazwa w PDF | Chleb żytni na zakwasie bez drożdzy | Chleb żytni na zakwasie bez drożdży | D-020 (literówka) |
| Nazwa w PDF | Pomidory szuszone · Ryż biały paraboiled | Pomidory suszone · Ryż biały parboiled | literówki w PDF |
| Tabela bezpieczeństwa | Jogurt 0% wysokobiałkowy · „z jogurtem” · „etykieta jogurtu” | Skyr · „ze skyrem” · „etykieta skyru” | D-020 |
| Tabela bezpieczeństwa | WPC / KFD proszek | Białko WPC proszek | D-020 |
| Tabela bezpieczeństwa | brak wiersza termosu | „Lunch w termosie”: prosto z patelni, > 63 °C podczas jedzenia | D-013 |
| Tabela bezpieczeństwa | Brokuły świeże | bez zmian; brokuły mrożone odsyłają do tej pozycji | D-028 |
| Zużycie: szczypiorek | 3 g/d (ZAPASY v31) | 5 g/d | D-021 |
| Zużycie: melisa | 3 g/d (ZAPASY v31) | 2 g/d | D-021 |
| Zużycie: czwartek | v31 nie pomijał 2 g cynamonu | 2 g cynamonu pomijane (dieta NT) | błąd S-1 audytu |
| Zużycie: fazy | stałe porcje F0 | porcje z PDF wg fazy (np. owies 70 → 85 g od 12.10) | D-003, D-017 |
| Katalog: miód | notatka „1/2 łyżeczki” | „1 łyżeczka (6 g)” | I-5 |
| Katalog: nowe pozycje | — | Chondroityna (60/op.), Glukozamina (90/op.), Boswellia (90/op.) — bez zakupów, do 21.03.2027 | D-015, I-9 |
| Katalog: cynk | — | Cynk (150/op.), nieśledzony | D-016 |
| Suplementy: tauryna | TRENING/REKOMPOZYCJA: „odpada w czwartek” | codziennie o 17:15 | D-014 |
| Suplementy: kreatyna | — | w czwartek opis bez banana | D-030 |
| Posiłek 20:15 w czwartek | PDF NT F1/F2: „PO TRENINGU” | „Posiłek po saunie” | D-018 |
| Plan dnia: sloty E/F w dniu mocka | — | „Wolne” | D-036 |

Zmiany w treści dokumentów (MEAL_PREP, REKOMPOZYCJA, Bezpieczne v3) — lista w `SPEC_2027_etap1_v1.1.md`, sekcja 3. Teksty „przed → po” zostaną przedstawione do akceptacji w Etapach 4 i 6.
