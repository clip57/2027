"""D-103b (uzupełnienie D-103, polecenie użytkownika 17.10.2026) — uruchamiać PO `day_plan_d103.py` (który zostawia 15.10 jako początek planu).

1. Dzień 15.10.2026 usunięty z kalendarza: plan, dieta i realny początek planu od **16.10.2026** (pierwszy dzień planu CFA V44), `czwartek_k` (wariant tylko dla 15.10) zostaje w szablonie
   jako nieużywany; okres przyjmowania preparatów czasowych (chondroityna, boswellia, glukozamina) od 16.10.
2. Wyjątkowo bez treningu: sobota 17.10, niedziela 01.11 i poniedziałek 02.11 — dzień nietreningowy z dietą nietreningową (NT) Fazy 0, bez sauny i basenu; w tych dniach jest blok M,
   więc wieczór układa `mycieBeforeM` jak w innych dniach bez treningu (mycie głowy przed blokiem M, posiłek 20:15 w trakcie bloku). Pozostałe 10 dni treningowych z blokiem M bez zmian.
   `trainStart` zostaje 17.10 (pierwszy trening faktycznie 18.10).
Skrypt jest idempotentny.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
PH, WK, SP = (ROOT / f"src/data/{n}.json" for n in ("phases", "week", "supplements"))

START = "2026-10-16"
FREE = {"decision": "D-103b", "dayType": "free", "session": None, "sessionName": "Bez treningu", "sauna": 0, "diet": "NT", "variant": None}
NO_TRAINING = {
    "2026-10-17": "Bez treningu (wyjątek D-103b), dieta NT",
    "2026-11-01": "Bez treningu i basenu (wyjątek D-103b), dieta NT",
    "2026-11-02": "Bez treningu (wyjątek D-103b), dieta NT",
}


def dump(p, o):
    p.write_text(json.dumps(o, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    ph = json.loads(PH.read_text(encoding="utf-8"))
    ph["decision"] = ph["decision"].replace("D-103 (kalendarz, dieta i realny początek planu od 15.10.2026; dni wcześniejsze poza planem; treningi od 17.10;",
                                            "D-103, D-103b (kalendarz, dieta i realny początek planu od 16.10.2026; dni wcześniejsze poza planem, 15.10 usunięty; treningi od 17.10, wyjątkowo bez 17.10, 01.11 i 02.11;")
    ph["start"] = ph["realStart"] = ph["dietStart"] = START
    ph["phases"][0]["from"] = START
    dump(PH, ph)

    wk = json.loads(WK.read_text(encoding="utf-8"))
    ex = wk["exceptions"]
    ex.pop("2026-10-15", None)
    for d, note in NO_TRAINING.items():
        ex[d] = {**FREE, "note": note}
    wk["exceptions"] = dict(sorted(ex.items()))
    wk["decision"] = "D-018 (+ REKOMPOZYCJA s.7, TRENING), D-100, D-101, D-103, D-103b"
    dump(WK, wk)

    sp = json.loads(SP.read_text(encoding="utf-8"))
    for d in sp["doses"]:
        v = d.get("validity")
        if v and v.get("from") == "2026-10-15":
            v["from"] = START
    dec = sp.get("decisions", sp)
    for k, v in list(dec.items()) if isinstance(dec, dict) else []:
        if k == "D-015" and isinstance(v, str):
            dec[k] = v.replace("od 15.10.2026 do 28.03.2027 (D-102;", "od 16.10.2026 do 28.03.2027 (D-103b; wcześniej D-102,")  # „wcześniej D-102, wcześniej D-101…” poprawiane niżej
            dec[k] = dec[k].replace("D-102, wcześniej D-101,", "D-102, D-101,")
    dump(SP, sp)
    print("phases.json, week.json, supplements.json zaktualizowane (D-103b)")


if __name__ == "__main__":
    main()
