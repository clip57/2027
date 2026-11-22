"""D-117 (22.11.2026, decyzja użytkownika): „Termin egzaminu załóż 13.05, na zjeździe IX mnie nie będzie, więc zostaw bloki w planie,
suplementy czasowe nie były dotychczas używane, więc jest ich pod dostatkiem. […] Zajmij się rozbudowaniem kalendarza do końca roku 2027,
zachowując analogiczne rozplanowanie treningu, diety i rutyny przez cały rok.”

Uruchamiać po `plan_d116.py` (idempotentny — kolejne uruchomienie niczego nie zmienia):
  • cfa.json — egzamin CFA Level I 2027-05-13 (dzień po ostatnim bloku planu), bez notatki „termin do uzupełnienia”;
  • week.json — bez zjazdu IX (08–09.05.2027): w tych dniach bloki CFA w swoich slotach;
  • phases.json — koniec planu 31.12.2027 (Faza 2 i tydzień bazowy do końca roku);
  • supplements.json — preparaty czasowe do 31.12.2027 (zapas — wg użytkownika wystarczający; stany w Zapasach bez zmian).
"""
import json
import pathlib

DATA = pathlib.Path(__file__).resolve().parents[2] / "src/data"
CFA_EXAM, PLAN_END, OLD_END = "2027-05-13", "2027-12-31", "2027-06-30"
SKIP_STUDY = ("2027-05-08", "2027-05-09")   # zjazd IX — użytkownik nie bierze udziału


def load(p):
    return json.loads((DATA / p).read_text(encoding="utf-8"))


def dump(p, o):
    (DATA / p).write_text(json.dumps(o, ensure_ascii=False, indent=1), encoding="utf-8")


def tag(text, add="D-117"):
    return text if add in (text or "") else (f"{text}, {add}" if text else add)


def main():
    cfa = load("cfa.json")
    cfa["exam"] = CFA_EXAM
    cfa.pop("examNote", None)
    cfa["generated_from"] = tag(cfa.get("generated_from", ""), "egzamin 13.05.2027 — D-117")
    dump("cfa.json", cfa)

    wk = load("week.json")
    for d in SKIP_STUDY:
        if wk["blocks"].get(d, {}).get("kind") == "studia":
            del wk["blocks"][d]
    if "D-117" not in wk["blocks_decision"]:
        wk["blocks_decision"] += "; D-117: bez zjazdu IX (08–09.05.2027 — bloki CFA w planie)"
    dump("week.json", wk)

    ph = load("phases.json")
    ph["end"] = PLAN_END
    if "D-117" not in ph["decision"]:
        ph["decision"] += "; D-117: plan do 31.12.2027 (dotychczasowe schematy, Faza 2 do końca)"
    dump("phases.json", ph)

    su = load("supplements.json")
    n = 0
    for x in su["doses"]:
        v = x.get("validity")
        if v and v.get("until") in (OLD_END, PLAN_END):
            n += v["until"] == OLD_END
            v["until"] = PLAN_END
            v["decision"] = tag(v.get("decision", ""))
    dump("supplements.json", su)
    print(f"cfa.json: egzamin {CFA_EXAM}; week.json: bez zjazdu IX; phases.json: koniec {PLAN_END}; supplements.json: {n} dawek przedłużonych")


if __name__ == "__main__":
    main()
