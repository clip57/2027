"""D-101, D-102 (decyzje użytkownika 13–15.10.2026): plan CFA V3 (od 13.10, bloki J, K, L, M) i dostosowanie kalendarza, treningu, diety i zakupów.

1. Początek planu i pierwszy dzień liczenia wszystkiego poza CFA: **15.10.2026** (`phases.json` → `start`, `realStart`, `dietStart`); dni wcześniejsze (w tym 12–14.10) są
   historią — poza planem (dane zostają w bazie, bez planu dnia, treningu, suplementacji i zużycia). Plan CFA ma własny zakres od 13.10 (recall z `nightRecall`).
2. 15.10 — dzień nietreningowy z dietą NT; regularny przebieg treningowo-dietetyczny od 16.10 (Faza 0: 16–22.10, Faza 1 od 23.10, Faza 2 od 23.11); brak treningu 03–11.11
   (także sauny i basenu), dieta NT; 05.11 bez zakupów (wariant czwartkowy usunięty); plan CFA ma w 03–11.11 bloki K, L, M po południu.
3. Czwartki 15.10, 22.10 i 29.10 — wariant `czwartek_k`: zakupy 19:05–19:30, mycie głowy 19:30–19:40, posiłek po saunie (20:15) bez zmian
   w osobnym slocie 19:40–20:45 (22.10 i 29.10 pokrywa się z blokiem M 19:40–20:33).
4. 12–15.11 — nominalny tydzień treningowy bez wyjątków (wyjątki z pierwszej wersji D-101 usunięte; zakupy w czwartek 12.11 jak dotąd).
5. Preparaty czasowe (D-015): okres 15.10.2026–28.03.2027 (165 dni planu; zapas 180 kapsułek starcza z nadwyżką).
Plan CFA (`cfa.json`) generuje `extract_static.mjs`, MPW bez zmian. Skrypt jest idempotentny."""
import copy
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
PH, WK, SP, TP = (ROOT / f"src/data/{n}.json" for n in ("phases", "week", "supplements", "day_template"))

START = "2026-10-15"   # D-102: początek planu i pierwszy dzień liczenia wszystkiego poza CFA
FREE = {"decision": "D-101", "dayType": "free", "session": None, "sessionName": "Bez treningu", "sauna": 0, "diet": "NT", "variant": None}


def dump(p, o):
    p.write_text(json.dumps(o, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    ph = json.loads(PH.read_text(encoding="utf-8"))
    ph["decision"] = ("D-017, D-097, D-100, D-101 (kalendarz, dieta, trening i realny początek planu od 12.10.2026; dni wcześniejsze poza planem; "
                      "regularny trening i dieta od 16.10: Faza 0 do 22.10, Faza 1 od 23.10, Faza 2 od 23.11; plan do 28.03.2027; dni wcześniejsze i późniejsze poza planem, D-088)")
    ph["start"] = ph["realStart"] = ph["dietStart"] = ph["trainStart"] = START
    ph["trainStart"] = "2026-10-16"   # regularny trening i dieta od 16.10 (12–15.10 — dni nietreningowe, dieta NT)
    ph["phases"] = [{"phase": 0, "from": START}, {"phase": 1, "from": "2026-10-23"}, {"phase": 2, "from": "2026-11-23"}]
    dump(PH, ph)

    wk = json.loads(WK.read_text(encoding="utf-8"))
    ex = wk["exceptions"]
    for d in ("2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"):
        ex.pop(d, None)   # dni przed startem planu (D-101)
    note = "Bez treningu, dieta NT: regularny przebieg od 16.10 (D-101)"
    for d in ("2026-10-12", "2026-10-13", "2026-10-14"):
        ex.pop(d, None)   # D-102: dni przed startem planu (15.10) — historia, bez planu dnia
    ex["2026-10-15"] = {**FREE, "variant": "czwartek_k", "note": note + "; zakupy 19:05–19:30, mycie głowy 19:30–19:40"}
    for d in ("2026-10-22", "2026-10-29"):
        ex[d] = {"decision": "D-101", "variant": "czwartek_k", "note": "Zakupy 19:05–19:30, mycie głowy 19:30–19:40 (D-101)"}
    for d in ("2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"):
        ex[d] = {**FREE, "note": f"Wyjątek {d[8:]}.{d[5:7]}.2026: bez treningu, dieta NT jak w czwartek (D-101)"}   # 05.11 — także bez zakupów
    for d in ("2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"):
        ex.pop(d, None)   # nominalny trening i dieta (usunięte wyjątki z pierwszej wersji D-101)
    wk["exceptions"] = dict(sorted(ex.items()))
    wk["decision"] = "D-018 (+ REKOMPOZYCJA s.7, TRENING), D-100, D-101"
    dump(WK, wk)

    sp = json.loads(SP.read_text(encoding="utf-8"))

    def walk(o):
        if isinstance(o, dict):
            if o.get("from") in ("2026-10-08", "2026-10-12") and "until" in o:
                o["from"] = START
            for k, v in o.items():
                if isinstance(v, str) and ("od 08.10.2026 do 28.03.2027" in v or "od 12.10.2026 do 28.03.2027" in v):
                    o[k] = "chondroityna, boswellia, glukozamina od 15.10.2026 do 28.03.2027 (D-102; wcześniej D-101, D-100, D-097; D-087, D-090, I-9)"
                else:
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(sp)
    dump(SP, sp)

    tp = json.loads(TP.read_text(encoding="utf-8"))
    base = {s["id"]: s for s in tp["slots"]}
    cz = tp["variants"]["czwartek"]
    c = {s["id"]: copy.deepcopy(s) for s in cz["slots"]}
    shop = copy.deepcopy(c["slot.1905c"])
    shop.update({"from": "19:05", "to": "19:30", "decision": "D-101"})
    shop["items"] = [i for i in shop["items"] if i["kind"] != "meal"]           # posiłek po saunie przeniesiony do własnego slotu
    mycie = copy.deepcopy(base["slot.2035"])
    mycie.update({"from": "19:30", "to": "19:40", "decision": "D-101"})          # id slot.2035 — kroki pielęgnacji przypięte do slotu zostają
    post = copy.deepcopy(base["slot.2015"])
    post.update({"id": "slot.1940c", "from": "19:40", "to": "20:45", "title_src": "Posiłek po saunie", "desc_src": "", "decision": "D-101"})
    tp["variants"]["czwartek_k"] = {
        "decision": "D-101",
        "replaces": cz["replaces"] + ["slot.2035"],
        "slots": [c["slot.1745c"], c["slot.1755c"], shop, mycie, post],
    }
    dump(TP, tp)
    print("phases.json, week.json, supplements.json, day_template.json zaktualizowane (D-101)")


if __name__ == "__main__":
    main()
