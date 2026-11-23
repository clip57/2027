"""D-121 (23.11.2026, decyzje użytkownika): nowy początek planu — Dzień zero 23.11.2026, czysta karta od dziś.

  • `phases.json`: kalendarz od 23.11.2026 (Dzień zero — bez diety, suplementów i treningu; nauka działa, pielęgnacja tylko wieczorna),
    dieta, suplementacja i trening od 24.11; Faza 0 24.11–06.12, Faza 1 07.12–10.01, Faza 2 od 11.01.2027 do końca kalendarza;
  • `week.json`: wyjątki dat i bloki weekendów sprzed 23.11 usunięte (dni sprzed startu są poza planem — ukryte, zdarzenia zostają w dzienniku);
    12.12 (LOWER 2) i 24.12 (sauna) — dni bez treningu, dieta NT;
  • nauka — pełna chronologia materiału: bloki od 20.11 przesunięte kolejno w miejsca bloków od 23.11; 9 zaległych bloków MPW nadrabiane w
    porannych slotach 08:00 / 09:10 / 10:10 w dni 14–16.12, CFA — 17–18.12 i 24.12; 24.12 bloki MPW 12:20 / 13:30 / 14:30. MPW wraca do układu
    D-120 od popołudnia 16.12, CFA od 25.12 (dalej `studyMoves` z D-120 bez zmian);
  • `supplements.json`: chondroityna (07:00, 21:00), boswellia (09:00), glukozamina (13:20) od 24.11.2026 do 30.04.2027 włącznie;
  • `rekomp.json`: daty faz w tekście (tak samo `UPGRADE` w `private_pack_lib.py` dla pakietu prywatnego).

Idempotentny: najpierw uruchamia `plan_d120.py` (odtwarza `studyMoves` D-120 z planów z pliku) i liczy zawsze od jego wyniku.
"""
import json
import pathlib
import subprocess
import sys

DATA = pathlib.Path(__file__).resolve().parents[2] / "src/data"
DEC = "D-121"
ZERO = "2026-11-23"
START = "2026-11-24"
PHASES = [{"phase": 0, "from": START}, {"phase": 1, "from": "2026-12-07"}, {"phase": 2, "from": "2027-01-11"}]
EXTRA = {"mpw": ["2026-12-14", "2026-12-15", "2026-12-16"], "cfa": ["2026-12-17", "2026-12-18", "2026-12-24"]}
MORNING = ["08:00", "09:10", "10:10"]
MPW_2412 = ["12:20", "13:30", "14:30"]
SUPPS = {"chondroityna", "boswellia", "glukozamina"}
SUPP_UNTIL = "2027-04-30"
FREE = {"dayType": "free", "session": None, "sessionName": "Bez treningu", "sauna": 0, "diet": "NT", "variant": None}
TEXT = [   # rekomp.json — daty faz (kolejność: dłuższe najpierw)
    ("Faza 1 od 12.11.2026, Faza 2 od 11.12.2026 (D-017, D-100, D-101, D-103)", "Faza 1 od 07.12.2026, Faza 2 od 11.01.2027 (D-017, D-121)"),
    ("Faza 0 (18.10–02.11)", "Faza 0 (24.11–06.12)"),
    ("Faza 1 (12.11–10.12)", "Faza 1 (07.12–10.01)"),
    ("Faza 2 (od 11.12)", "Faza 2 (od 11.01)"),
    ('"18.10–02.11"', '"24.11–06.12"'),
    ('"12.11–10.12"', '"07.12–10.01"'),
    ('"od 11.12"', '"od 11.01"'),
]


def load(p):
    return json.loads((DATA / p).read_text(encoding="utf-8"))


def dump(p, o):
    (DATA / p).write_text(json.dumps(o, ensure_ascii=False, indent=1), encoding="utf-8")


def phases():
    ph = load("phases.json")
    ph.update({"start": ZERO, "zero": ZERO, "realStart": START, "dietStart": START, "trainStart": START, "phases": PHASES,
               "decision": "D-121 (nowy początek planu: Dzień zero 23.11.2026 — bez diety, suplementów i treningu, z nauką i wieczorną pielęgnacją; dieta, "
                           "suplementy i treningi od 24.11; Faza 0 24.11–06.12, Faza 1 07.12–10.01, Faza 2 od 11.01.2027 do końca kalendarza; dni wcześniejsze "
                           "poza planem — ukryte; wcześniej D-017, D-088, D-097, D-100…D-103c, D-116, D-117)"})
    dump("phases.json", ph)


def supplements():
    s = load("supplements.json")
    n = 0
    for d in s["doses"]:
        if d["supp"] in SUPPS and d.get("validity"):
            d["validity"] = {"from": START, "until": SUPP_UNTIL, "decision": "D-015, D-121"}
            n += 1
    assert n == 4, n
    s["D-015"] = "chondroityna, boswellia, glukozamina od 24.11.2026 do 30.04.2027 (D-121; wcześniej D-117, D-116, D-103c, D-087, D-090, I-9)"
    dump("supplements.json", s)


def study(week):
    """Pełna chronologia: bloki w kolejności numerów trafiają kolejno w miejsca bloków od 23.11 + sloty poranne, do dnia wyrównania."""
    base = week["studyMoves"]
    moves = {"cfa": dict(base["cfa"]), "mpw": dict(base["mpw"])}
    for plan in ("cfa", "mpw"):
        bl = load(f"{plan}.json")["D"]["bloki"]
        pos = {b["nr"]: tuple(base[plan].get(str(b["nr"]), f"{b['data']} {b['godz'][:5]}").split(" ")) for b in bl}
        extra = [(d, t) for d in EXTRA[plan] for t in MORNING]
        cut = max(extra)
        slots = sorted([p for p in pos.values() if ZERO <= p[0] and p <= cut] + extra)
        todo = sorted(nr for nr, p in pos.items() if p <= cut)
        assert len(slots) == len(todo), (plan, len(slots), len(todo))
        assert sum(1 for p in pos.values() if p[0] < ZERO) == len(extra), plan
        for nr, (d, t) in zip(todo, slots):
            raw = next(b for b in bl if b["nr"] == nr)
            if (d, t) == (raw["data"], raw["godz"][:5]):
                moves[plan].pop(str(nr), None)
            else:
                moves[plan][str(nr)] = f"{d} {t}"
        if plan == "mpw":   # 24.12: bloki MPW 12:20 / 13:30 / 14:30
            day = sorted((p, nr) for nr, p in pos.items() if p[0] == "2026-12-24")
            assert len(day) == 3, day
            for (_, nr), t in zip(day, MPW_2412):
                moves[plan][str(nr)] = f"2026-12-24 {t}"
    week["studyMoves"] = {k: dict(sorted(v.items(), key=lambda x: int(x[0]))) for k, v in moves.items()}
    week["studyMoves"]["decision"] = "D-120, D-121"


def week_json():
    w = load("week.json")
    w["exceptions"] = {d: x for d, x in w["exceptions"].items() if d >= ZERO}
    w["blocks"] = {d: x for d, x in w["blocks"].items() if d >= ZERO}
    w["exceptions"]["2026-12-12"] = {"decision": DEC, **FREE, "note": "Bez treningu (D-121): LOWER 2 odwołany, dieta NT"}
    w["exceptions"]["2026-12-24"] = {"decision": DEC, **FREE, "note": "Wigilia: bez treningu i sauny (D-121), dieta NT; rano nadrabianie CFA, bloki MPW 12:20–15:23"}
    w["exceptions"] = dict(sorted(w["exceptions"].items()))
    study(w)
    dump("week.json", w)


def rekomp():
    p = DATA / "rekomp.json"
    t = p.read_text(encoding="utf-8")
    for a, b in TEXT:
        t = t.replace(a, b)
    p.write_text(t, encoding="utf-8")


if __name__ == "__main__":
    subprocess.run([sys.executable, str(pathlib.Path(__file__).with_name("plan_d120.py"))], check=True)
    phases()
    supplements()
    week_json()
    rekomp()
    print("D-121: phases, supplements, week (studyMoves, wyjątki), rekomp — zapisane")
