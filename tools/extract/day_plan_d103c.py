"""D-103c (uzupełnienie D-103, polecenie użytkownika 17.10.2026) — uruchamiać PO `day_plan_d103.py` i `day_plan_d103b.py`.

Początek CAŁEGO planu (kalendarz, dieta, suplementy, zakupy i treningi) = **18.10.2026** (niedziela, pierwszy trening — basen). Dni 16.10 i 17.10 są poza planem (historia, jak 15.10):
bez diety, treningu, dawek, zużycia i zakupów; wyjątki dat 16.10 i 17.10 z D-103/D-103b usunięte. Plan CFA V44 (`cfa.json`) ma własny zakres (od 16.10) — bloki i recall CFA z 16–17.10
zostają w module CFA (licznik, tempo, zaległe), bo to osobny harmonogram nauki. Okres chondroityny, boswellii i glukozaminy od 18.10. Teksty faz w Rekompozycji: Faza 0 (18.10–02.11).
Skrypt jest idempotentny.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
PH, WK, SP, RK = (ROOT / f"src/data/{n}.json" for n in ("phases", "week", "supplements", "rekomp"))
START = "2026-10-18"


def dump(p, o):
    p.write_text(json.dumps(o, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    ph = json.loads(PH.read_text(encoding="utf-8"))
    ph["decision"] = ph["decision"].replace("D-103, D-103b (kalendarz, dieta i realny początek planu od 16.10.2026; dni wcześniejsze poza planem, 15.10 usunięty; treningi od 17.10, wyjątkowo bez 17.10, 01.11 i 02.11;",
                                            "D-103, D-103b, D-103c (kalendarz, dieta, suplementy, zakupy i treningi — początek całego planu od 18.10.2026; dni wcześniejsze poza planem, 15–17.10 usunięte; wyjątkowo bez treningu 01.11 i 02.11;")
    ph["decision"] = ph["decision"].replace("Faza 0 do 11.11 — treningi 17.10–02.11,", "Faza 0 do 11.11 — treningi 18.10–31.10,")
    ph["start"] = ph["realStart"] = ph["dietStart"] = ph["trainStart"] = START
    ph["phases"][0]["from"] = START
    dump(PH, ph)

    wk = json.loads(WK.read_text(encoding="utf-8"))
    for d in ("2026-10-15", "2026-10-16", "2026-10-17"):
        wk["exceptions"].pop(d, None)
    wk["decision"] = "D-018 (+ REKOMPOZYCJA s.7, TRENING), D-100, D-101, D-103, D-103b, D-103c"
    dump(WK, wk)

    sp = json.loads(SP.read_text(encoding="utf-8"))
    for d in sp["doses"]:
        v = d.get("validity")
        if v and v.get("from") in ("2026-10-15", "2026-10-16"):
            v["from"] = START
    for k, v in sp["decisions"].items():
        if k == "D-015" and isinstance(v, str):
            sp["decisions"][k] = v.replace("od 16.10.2026 do 28.03.2027 (D-103b;", "od 18.10.2026 do 28.03.2027 (D-103c; wcześniej D-103b,").replace("D-103b, wcześniej D-102,", "D-103b, D-102,")
    dump(SP, sp)

    rk = RK.read_text(encoding="utf-8")
    rk = rk.replace("17.10–02.11", "18.10–02.11")    # „Faza 0 (…)” i komórka tabeli faz
    RK.write_text(rk, encoding="utf-8")
    print("phases.json, week.json, supplements.json, rekomp.json zaktualizowane (D-103c)")


if __name__ == "__main__":
    main()
