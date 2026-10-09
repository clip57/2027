"""D-100 (decyzje użytkownika 08.10.2026): nowy start planu, dieta, treningu i faz — zmiana danych `phases.json` i `week.json`.

1. Kalendarz zaczyna się 08.10.2026 (dni do 07.10 włącznie poza planem — jakby ich nie było; Dzień zero 29.09 usunięty);
   08–09.10 — bez diety i bez treningu; dieta, trening i **realny początek planu 10.10.2026** (`dietStart`, `trainStart`, `realStart`).
2. Trening: UPPER 1 + sauna w sobotę 10.10 (zamiast poniedziałku), poniedziałek 12.10 — 2 × sauna (dieta NT); 08–09.10 bez treningu
   i bez diety; pozostałe dni jak dotąd.
3. Fazy diety i treningu: Faza 1 od 19.10 (było 12.10), Faza 2 od 23.11 (było 16.11); Faza 0 od początku kalendarza.
4. 07–11.11.2026: bez treningu (także bez sauny i basenu), dieta NT (jak w czwartek).
5. Usunięte wyjątki D-096 z 30.09–03.10 (dni poza planem).
6. Preparaty czasowe (D-015): okres 08.10.2026–28.03.2027 (było od 30.09; 172 dni planu, zapas 180 kapsułek starcza z nadwyżką).
Plan CFA, MPW i szablon dnia bez zmian. Skrypt jest idempotentny."""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
PH, WK, SP = ROOT / "src/data/phases.json", ROOT / "src/data/week.json", ROOT / "src/data/supplements.json"

START, DIET, TRAIN = "2026-10-08", "2026-10-10", "2026-10-10"
F1, F2 = "2026-10-19", "2026-11-23"
FREE = {"decision": "D-100", "dayType": "free", "session": None, "sessionName": "Bez treningu", "sauna": 0, "diet": "NT", "variant": None}


def main():
    ph = json.loads(PH.read_text(encoding="utf-8"))
    ph["decision"] = ("D-017, D-097, D-100 (kalendarz od 08.10.2026; 08–09.10 bez diety i treningu, dieta i trening od 10.10 = realny początek planu; "
                      "Faza 1 od 19.10, Faza 2 od 23.11; plan do 28.03.2027; dni wcześniejsze i późniejsze poza planem, D-088)")
    ph["start"] = START
    ph["realStart"] = TRAIN
    ph["dietStart"] = DIET
    ph["trainStart"] = TRAIN
    ph["phases"] = [{"phase": 0, "from": START}, {"phase": 1, "from": F1}, {"phase": 2, "from": F2}]
    ph.pop("zero", None)   # Dzień zero 29.09 usunięty z kalendarza (D-100)
    PH.write_text(json.dumps(ph, ensure_ascii=False, indent=1), encoding="utf-8")

    wk = json.loads(WK.read_text(encoding="utf-8"))
    ex = wk["exceptions"]
    for d in ("2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"):
        ex.pop(d, None)   # D-096: przesunięte treningi pierwszego tygodnia — dni poza planem
    base = {k: v for k, v in FREE.items() if k != "variant"}
    ex["2026-10-08"] = {**base, "note": "Bez diety i bez treningu: dieta i trening od 10.10 (D-100)"}                      # czwartek: wariant „czwartek” (zakupy) zostaje
    ex["2026-10-09"] = {**FREE, "note": "Bez diety i bez treningu: dieta i trening od 10.10 (D-100)"}
    ex["2026-10-10"] = {"decision": "D-100", "dayType": "strength_sauna", "session": "pon", "sessionName": "UPPER 1", "sauna": 1, "diet": "T",
                        "note": "Wyjątek 10.10.2026: UPPER 1 + sauna (przesunięte z poniedziałku; start treningów)"}
    ex["2026-10-12"] = {"decision": "D-100", "dayType": "rest_sauna2", "session": None, "sessionName": "Bez treningu, 2 × sauna", "sauna": 2, "diet": "NT",
                        "note": "Wyjątek 12.10.2026: 2 × sauna bez treningu (dieta NT; UPPER 1 przeniesiony na 10.10)"}
    for d in ("2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"):
        ex[d] = {**FREE, "note": f"Wyjątek {d[8:]}.{d[5:7]}.2026: bez treningu, dieta NT jak w czwartek (D-100)"}
    wk["exceptions"] = dict(sorted(ex.items()))
    wk["decision"] = "D-018 (+ REKOMPOZYCJA s.7, TRENING), D-100"
    WK.write_text(json.dumps(wk, ensure_ascii=False, indent=1), encoding="utf-8")
    sp = json.loads(SP.read_text(encoding="utf-8"))
    def walk(o):
        if isinstance(o, dict):
            if o.get("from") == "2026-09-30" and "until" in o:
                o["from"] = START
            for k, v in o.items():
                if isinstance(v, str) and "od 30.09.2026 do 28.03.2027" in v:
                    o[k] = v.replace("od 30.09.2026 do 28.03.2027 (D-097;", "od 08.10.2026 do 28.03.2027 (D-100; wcześniej D-097;")
                else:
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(sp)
    SP.write_text(json.dumps(sp, ensure_ascii=False, indent=1), encoding="utf-8")
    print("phases.json, week.json, supplements.json zaktualizowane (D-100)")


if __name__ == "__main__":
    main()
