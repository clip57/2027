"""D-103 (decyzje użytkownika 16.10.2026): plan CFA V44 (od 16.10, 313 bloków, SchweserNotes 2026) i dostosowanie kalendarza, treningu, diety i zakupów.

1. Treningi od 17.10.2026 (`trainStart`); 16.10 — dzień nietreningowy z dietą NT (jak 15.10). Faza 0 do 11.11 (treningi 17.10–02.11; 03–11.11 bez treningu, dieta
   nietreningowa Fazy 0 — wyjątki z D-101), Faza 1 od 12.11 do 10.12, Faza 2 od 11.12.
2. Dni z blokiem M 19:40–20:33 (poza czwartkami i dniami z K/L): trening 18:15–19:15, „Powrót do domu” 19:15–19:25 z posiłkiem potreningowym o 19:15 (zamiast 20:15),
   „Prysznic i mycie głowy” 19:25–19:40. Sauna, chłodzenie i dawne mycie głowy odpadają (nie mieszczą się przed blokiem M) — szablon `mTraining`, układ w `resolver.js`.
3. Czwartki 22.10 i 29.10 (bloki L 18:40–19:33 i M 19:40–20:33): bez sauny, zakupy 17:45–18:40, mycie głowy 19:33–19:40 między blokami L i M (wariant `czwartek_zl`);
   posiłek 20:15 bez zmian (slot 20:15–20:35, jak w dniach 03–11.11).
4. 23.10 (piątek; plan CFA ma K 17:40–18:33 i L 18:40–19:33 w oknie treningowym, bez M/J i recallu): bez treningu, dieta NT — DO POTWIERDZENIA przez użytkownika.
5. 24.12 — czwartek bez zakupów (wariant `czwartek_bz`: sauna i powrót z posiłkiem 20:15); 25.12 — dzień całkowicie wolny jak 26.12 i 27.12 (bez treningu, bloków i zakupów).
Plan CFA (`cfa.json`) generuje `extract_static.mjs`. Skrypt jest idempotentny.
"""
import copy
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
PH, WK, TP = (ROOT / f"src/data/{n}.json" for n in ("phases", "week", "day_template"))

START = "2026-10-15"
FREE = {"decision": "D-103", "dayType": "free", "session": None, "sessionName": "Bez treningu", "sauna": 0, "diet": "NT", "variant": None}


def dump(p, o):
    p.write_text(json.dumps(o, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    ph = json.loads(PH.read_text(encoding="utf-8"))
    ph["decision"] = ("D-017, D-097, D-100, D-101, D-103 (kalendarz, dieta i realny początek planu od 15.10.2026; dni wcześniejsze poza planem; treningi od 17.10; "
                      "Faza 0 do 11.11 — treningi 17.10–02.11, 03–11.11 bez treningu z dietą nietreningową Fazy 0; Faza 1 od 12.11 do 10.12, Faza 2 od 11.12; "
                      "plan do 28.03.2027; dni wcześniejsze i późniejsze poza planem, D-088)")
    ph["trainStart"] = "2026-10-17"
    ph["phases"] = [{"phase": 0, "from": START}, {"phase": 1, "from": "2026-11-12"}, {"phase": 2, "from": "2026-12-11"}]
    dump(PH, ph)

    wk = json.loads(WK.read_text(encoding="utf-8"))
    ex = wk["exceptions"]
    ex["2026-10-16"] = {**FREE, "note": "Bez treningu, dieta NT: regularne treningi od 17.10 (D-103)"}
    for d in ("2026-10-22", "2026-10-29"):
        ex[d] = {**FREE, "variant": "czwartek_zl", "note": "Bez sauny: zakupy 17:45–18:40, bloki L 18:40–19:33 i M 19:40–20:33, mycie głowy 19:33–19:40 (D-103)"}
    ex["2026-10-23"] = {**FREE, "note": "Bez treningu: bloki K 17:40–18:33 i L 18:40–19:33 zajmują okno treningowe (D-103 — do potwierdzenia), dieta NT"}
    ex["2026-12-24"] = {"decision": "D-103", "variant": "czwartek_bz", "note": "Bez zakupów (D-103): sauna, powrót do domu z posiłkiem 20:15"}
    ex["2026-12-25"] = {**FREE, "decision": "D-103", "note": "Boże Narodzenie: dzień całkowicie wolny — bez bloków, treningu i zakupów (dieta NT)"}
    wk["exceptions"] = dict(sorted(ex.items()))
    blocks = wk["blocks"]
    blocks["2026-12-25"] = {**blocks["2026-12-26"], "decision": "D-103"}
    wk["blocks"] = dict(sorted(blocks.items()))
    wk["decision"] = "D-018 (+ REKOMPOZYCJA s.7, TRENING), D-100, D-101, D-103"
    dump(WK, wk)

    tp = json.loads(TP.read_text(encoding="utf-8"))
    base = {s["id"]: s for s in tp["slots"]}
    cz = tp["variants"]["czwartek"]
    c = {s["id"]: copy.deepcopy(s) for s in cz["slots"]}
    k = {s["id"]: copy.deepcopy(s) for s in tp["variants"]["czwartek_k"]["slots"]}

    # czwartek_zl: zakupy 17:45–18:40 (blok L 18:40–19:33 i M 19:40–20:33 dokłada resolver), mycie głowy 19:33–19:40, posiłek 20:15 w osobnym slocie (jak D-101)
    shop = copy.deepcopy(k["slot.1905c"])
    shop.update({"id": "slot.1745z", "from": "17:45", "to": "18:40", "decision": "D-103"})
    mycie = copy.deepcopy(k["slot.2035"])
    mycie.update({"from": "19:33", "to": "19:40", "decision": "D-103"})
    post = copy.deepcopy(k["slot.1940c"])
    # slot posiłku zaczyna się o 20:15 (jak w dniach 03–11.11), a nie o 19:40 — dzięki temu karta „Teraz” wskazuje blok M do 20:15 (godzina posiłku bez zmian)
    post.update({"id": "slot.2015z", "from": "20:15", "title_src": "Powrót do domu", "decision": "D-103"})
    tp["variants"]["czwartek_zl"] = {"decision": "D-103", "replaces": tp["variants"]["czwartek_k"]["replaces"], "slots": [shop, mycie, post]}

    # czwartek_bz: jak „czwartek”, ale bez zakupów — po saunie powrót do domu z posiłkiem 20:15
    home = copy.deepcopy(c["slot.1905c"])
    home.update({"id": "slot.1905b", "title_src": "Powrót do domu", "badges_src": ["230 kcal"], "decision": "D-103"})
    home.pop("shop", None)
    home["items"] = [i for i in home["items"] if i["kind"] == "meal"]
    tp["variants"]["czwartek_bz"] = {"decision": "D-103", "replaces": cz["replaces"], "slots": [c["slot.1745c"], c["slot.1755c"], home]}

    # mTraining: wieczór w dni treningowe z blokiem M (układa `trainingBeforeM` w resolver.js)
    meal = {"kind": "meal", "src": "Posiłek potreningowy (19:15)", "text": "Posiłek potreningowy (19:15)", "meal": "post", "time": "19:15", "decision": "D-103"}
    tp["mTraining"] = {
        "decision": "D-103", "trainTo": "19:15",
        "home": {"id": "slot.1915m", "from": "19:15", "to": "19:25", "domain": "diet", "title_src": "Powrót do domu", "badges_src": ["230 kcal"], "desc_src": "",
                 "role": "meal", "key": "post", "items": [meal], "decision": "D-103"},
        "wash": {"id": "slot.1925m", "from": "19:25", "to": "19:40", "domain": "regen", "title_src": "Prysznic i mycie głowy", "badges_src": ["Higiena"], "desc_src": "",
                 "role": "static", "key": None, "items": [], "decision": "D-103"},
    }
    dump(TP, tp)
    print("phases.json, week.json, day_template.json zaktualizowane (D-103)")


if __name__ == "__main__":
    main()
