"""D-120 (23.11.2026, decyzje użytkownika): godziny bloków CFA i MPW dopasowane do planu dnia, dni bez treningu i „Praca” w dni robocze 2027.

Pliki planów (`cfa.json`, `mpw.json`) zostają bez zmian (kopia plików użytkownika). Nowe daty i godziny bloków zapisuje ten skrypt jako mapę
`week.json` → `studyMoves` (numer bloku → „RRRR-MM-DD GG:MM” — początek bloku; długość bez zmian), stosowaną w `src/core/data.js` (jak
`mpwShift`, D-097). Idempotentny — liczy zawsze od godzin z planu.

Reguły (wiadomości użytkownika 23.11.2026):
  • dni robocze: MPW A 15:30, B 16:40 (po przerwie obiadowej), C 22:00 — a gdy tego dnia jest CFA J 21:00: MPW C 21:00, CFA J 22:00;
    blok dodatkowy CFA 21:00 (ciągłość materiału), CFA J 22:00; czwartki z zakupami (od 07.01, MPW 16:00/17:00/18:00) — tylko CFA J na 22:00;
  • weekendy: wszystkie bloki CFA/MPW o jeden slot wcześniej (CFA od 11:20 zamiast 12:20); praca dyplomowa skrócona do 08:00–11:03;
  • weekendy zjazdowe: sobota 15:30, 16:40; ostatni blok soboty → niedziela 15:30; niedziela 16:40, 21:00, 22:00 (chronologicznie);
  • 06.03 i 13.03: symulacja MPW 13:30–16:30, P6 17:00, P7 22:00, trening 18:00–20:30; 07.03 i 14.03: C 22:00; 20.03: C 17:40, bez siłowni;
  • 21.02 i 17.03: symulacja 16:40–19:40, bez basenu / roweru; 27.02: symulacja 11:20–14:20, lunch 14:20, CFA 14:30, 15:30, 16:40;
  • dni bez treningu (21.02, 17.03, 20.03): dieta NT, brak sesji; posiłek „po treningu” diety NT (białko) zostaje;
  • dni robocze 2027 (bez świąt): „Czas własny” 08:00–15:23 → „Praca”.
"""
import copy
import datetime as dt
import json
import pathlib

DATA = pathlib.Path(__file__).resolve().parents[2] / "src/data"
DEC = "D-120"
FROM = "2026-11-23"   # decyzja od dnia podjęcia — dni minione (historia odhaczeń) bez zmian
GRID = ["08:00", "09:10", "10:10", "11:20", "12:20", "13:30", "14:30", "15:30", "16:40", "17:40"]
ZJAZD_SAT = ["2026-11-28", "2027-01-09", "2027-02-06", "2027-04-03", "2027-04-24"]   # sobota zjazdu, niedziela = +1 dzień
SIM_EVE = ["2027-02-21", "2027-03-17"]          # symulacja 16:40–19:40
SIM_SAT = ["2027-03-06", "2027-03-13"]          # symulacja 13:30–16:30, P6 17:00, P7 22:00
P_SUN = ["2027-03-07", "2027-03-14"]            # powtórka całości: A 15:30, B 16:40, C 22:00
LAST = "2027-03-20"                             # powtórka całości: A 15:30, B 16:40, C 17:40, bez siłowni
SIM_MORNING = "2027-02-27"                      # symulacja 11:20–14:20, potem CFA
# Święta państwowe 2027 w dni robocze — bez „Pracy” (Nowy Rok, Trzech Króli, Poniedziałek Wielkanocny, 3 Maja, Boże Ciało, Wszystkich Świętych,
# Święto Niepodległości, Wigilia) — sloty zostają „Czas własny”
HOLIDAYS_2027 = ["2027-01-01", "2027-01-06", "2027-03-29", "2027-05-03", "2027-05-27", "2027-11-01", "2027-11-11", "2027-12-24"]
DAYS_PL = ["poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"]


def load(p):
    return json.loads((DATA / p).read_text(encoding="utf-8"))


def dump(p, o):
    (DATA / p).write_text(json.dumps(o, ensure_ascii=False, indent=1), encoding="utf-8")


def mins(t):
    return int(t[:2]) * 60 + int(t[3:5])


def hm(n):
    return f"{n // 60:02d}:{n % 60:02d}"


def length(b):
    a, z = b["godz"].split("–")
    return mins(z) - mins(a)


def day(s):
    return dt.date.fromisoformat(s)


def plus(s, n):
    return (day(s) + dt.timedelta(days=n)).isoformat()


def moves(cfa, mpw, shift):
    """Nowy początek każdego bloku: {plan: {nr: (data, GG:MM)}} — tylko bloki, które zmieniają datę lub godzinę."""
    by = lambda bl: {d: [b for b in bl if b["data"] == d] for d in sorted({b["data"] for b in bl})}
    C, M = by(cfa), by(mpw)
    out = {"cfa": {}, "mpw": {}}

    def put(plan, b, date, start):
        if (date, start) != (b["data"], b["godz"][:5]):
            out[plan][str(b["nr"])] = f"{date} {start}"

    thu = lambda d, b: (shift and d >= shift["from"] and day(d).isoweekday() in shift["weekdays"] and not b["blok"].startswith("P"))
    for d in sorted(x for x in set(C) | set(M) if x >= FROM):
        wd = day(d).isoweekday()
        c, m = C.get(d, []), M.get(d, [])
        J = next((b for b in c if b["blok"] == "J"), None)
        dod = next((b for b in c if b["blok"] == "Dodatkowy"), None)
        thu_day = any(thu(d, b) for b in m)
        if d == SIM_MORNING:
            for i, b in enumerate(m):
                put("mpw", b, d, hm(mins("11:20") + 60 * i))
            for b, t in zip(c, ["14:30", "15:30", "16:40"]):
                put("cfa", b, d, t)
            continue
        if d in SIM_EVE:
            for i, b in enumerate(m):
                put("mpw", b, d, hm(mins("16:40") + 60 * i))
            continue
        if d in SIM_SAT:
            sims = [b for b in m if not b["blok"].startswith("P")]
            for b in m:
                if b["blok"] == "P6":
                    put("mpw", b, d, "17:00")
                elif b["blok"] == "P7":
                    put("mpw", b, d, "22:00")
            for i, b in enumerate(sims):
                put("mpw", b, d, hm(mins("13:30") + 60 * i))
            continue
        if d in P_SUN or d == LAST:
            for b in m:
                if not b["blok"].startswith("P"):
                    put("mpw", b, d, {"A": "15:30", "B": "16:40", "C": "17:40" if d == LAST else "22:00"}[b["blok"]])
            continue
        zsat = d in ZJAZD_SAT
        zsun = plus(d, -1) in ZJAZD_SAT
        if zsat or zsun:   # bloki po zjeździe (MPW A–C, CFA H/I/dodatkowy); CFA w godzinach zjazdu — jak dotąd (pierwszeństwo zjazdu)
            for plan, lst in (("mpw", m), ("cfa", [b for b in c if b["blok"] in ("H", "I", "Dodatkowy")])):
                for i, b in enumerate(lst):
                    if zsat:
                        put(plan, b, d, "15:30") if i == 0 else put(plan, b, d, "16:40") if i == 1 else put(plan, b, plus(d, 1), "15:30")
                    else:
                        put(plan, b, d, ["16:40", "21:00", "22:00"][i])
            continue
        if wd >= 6:   # weekend: o jeden slot wcześniej
            for plan, lst in (("cfa", c), ("mpw", m)):
                for b in lst:
                    f = b["godz"][:5]
                    f = {"16:30": "16:40", "17:30": "17:40"}.get(f, f)
                    i = GRID.index(f)
                    put(plan, b, d, GRID[i - 1] if i > 0 else f)
            continue
        # dni robocze
        mpw_c = any(b["blok"] == "C" for b in m) and not thu_day
        for b in c:
            if b is dod:
                put("cfa", b, d, "21:00")
            elif b is J and (dod or thu_day or mpw_c):
                put("cfa", b, d, "22:00")
        if not thu_day:
            for b in m:
                if b["blok"] == "B":
                    put("mpw", b, d, "16:40")
                elif b["blok"] == "C":
                    put("mpw", b, d, "21:00" if J else "22:00")
    return out


def slot(tpl, sid, nid, frm, to, **kw):
    """Kopia slotu szablonu (zadania, posiłki, rola) z nowym identyfikatorem i godzinami."""
    s = copy.deepcopy(tpl[sid])
    s.update(id=nid, **{"from": frm, "to": to}, decision=DEC)
    for k, v in kw.items():
        if k == "meal_time":
            for i in s["items"]:
                if i["kind"] == "meal":
                    i["time"] = v
        else:
            s[k] = v
    return s


def study(nid, frm, to, title="Nauka MPW"):
    return {"id": nid, "from": frm, "to": to, "domain": "cfa", "title_src": title, "badges_src": [], "desc_src": "", "role": "cfa", "key": None,
            "items": [], "mpwSlot": True, "decision": DEC}


def free(nid, frm, to, title):
    return {"id": nid, "from": frm, "to": to, "domain": "regen", "title_src": title, "badges_src": [], "desc_src": "", "role": "static", "key": None,
            "items": [], "decision": DEC}


def variants(t):
    base = {s["id"]: s for s in t["slots"]}
    tpl = {**base, **{s["id"]: s for s in t["variants"]["basen"]["slots"]}}
    no_supp = lambda s: {**s, "items": [i for i in s["items"] if i["kind"] != "supp"]}
    sims = lambda frm, ids: [study(f"slot.{hm(mins(frm) + 60 * i).replace(':', '')}.s120", hm(mins(frm) + 60 * i), hm(mins(frm) + 60 * (i + 1)), "Symulacja MPW") for i in range(3)]
    v = {}
    # 06.03 i 13.03 (sobota): symulacja 13:30–16:30, obiad 16:45, P6 17:00, trening 18:00–20:30, posiłek 20:30, relaks z kolacją 21:00–21:53, P7 22:00
    v["d120_sym"] = {"decision": DEC, "replaces": ["slot.1330", "slot.1423", "slot.1430", "slot.1523", "slot.1530", "slot.1623", "slot.1640", "slot.1733",
                                                    "slot.1745", "slot.1805", "slot.1815", "slot.1935", "slot.1945", "slot.2005", "slot.2015", "slot.2035",
                                                    "slot.2045", "slot.2100", "slot.2145"],
                     "slots": [*sims("13:30", None),
                               slot(tpl, "slot.1523", "slot.1630.v120", "16:30", "16:45"),
                               slot(tpl, "slot.1623", "slot.1645.v120", "16:45", "17:00", meal_time="16:45"),
                               {**study("slot.1700.v120", "17:00", "17:53"), "items": []},
                               slot(tpl, "slot.1733", "slot.1753.v120", "17:53", "18:00"),
                               slot(tpl, "slot.1745", "slot.1800.v120", "18:00", "18:20"),
                               slot(tpl, "slot.1805", "slot.1820.v120", "18:20", "18:30"),
                               slot(tpl, "slot.1815", "slot.1830.v120", "18:30", "19:50"),
                               slot(tpl, "slot.1935", "slot.1950.v120", "19:50", "20:00"),
                               slot(tpl, "slot.1945", "slot.2000.v120", "20:00", "20:20"),
                               slot(tpl, "slot.2005", "slot.2020.v120", "20:20", "20:30"),
                               slot(tpl, "slot.2015", "slot.2030.v120", "20:30", "20:40", meal_time="20:30"),
                               slot(tpl, "slot.2035", "slot.2040.v120", "20:40", "20:45"),
                               slot(tpl, "slot.2045", "slot.2045.v120", "20:45", "21:00"),
                               slot(tpl, "slot.2100", "slot.2100.v120", "21:00", "21:53"),
                               slot(tpl, "slot.2145", "slot.2153.v120", "21:53", "22:00")]}
    # 21.02 (niedziela, zjazd, bez basenu — dieta NT): symulacja 16:40–19:40, zmywanie 19:40, relaks z białkiem 19:52–20:15, prysznic całego ciała 20:15
    v["d120_2102"] = {"decision": DEC, "replaces": ["slot.1640", "slot.1733", "slot.1745", "slot.1805", "slot.1815", "slot.1935", "slot.1945", "slot.2005",
                                                     "slot.2015", "slot.2035"],
                      "slots": [*sims("16:40", None),
                                slot(tpl, "slot.1733", "slot.1940.v120", "19:40", "19:52"),
                                slot(tpl, "slot.1930n", "slot.1952.v120", "19:52", "20:15", title_src="Relaks · białko (dieta NT)", meal_time="19:52"),
                                slot(tpl, "slot.2015n", "slot.2015n.v120", "20:15", "20:45")]}
    # 27.02 (sobota, praca dyplomowa 08:00–11:03): symulacja 11:20–14:20, lunch 14:20–14:30, CFA 14:30, 15:30, 16:40
    v["d120_2702"] = {"decision": DEC, "replaces": ["slot.1120", "slot.1213", "slot.1220", "slot.1313", "slot.1330", "slot.1423"],
                      "slots": [*sims("11:20", None),
                                slot(tpl, "slot.1313", "slot.1420.v120", "14:20", "14:30", meal_time="14:20")]}
    # 17.03 (środa, bez roweru i sauny — dieta NT): symulacja 16:40–19:40, zmywanie 19:40, czas wolny z białkiem 19:52–20:35
    v["d120_1703"] = {"decision": DEC, "replaces": ["slot.1640", "slot.1733", "slot.1745", "slot.1805", "slot.1815", "slot.1935", "slot.1945", "slot.2005",
                                                     "slot.2015"],
                      "slots": [*sims("16:40", None),
                                slot(tpl, "slot.1733", "slot.1940.v120", "19:40", "19:52"),
                                slot(tpl, "slot.2015", "slot.1952.v120", "19:52", "20:35", title_src="Czas wolny · białko (dieta NT)")]}
    # 20.03 (sobota przed egzaminem, bez siłowni — dieta NT): zmywanie 17:33–17:40, MPW C 17:40–18:33, czas wolny do 20:15, białko 20:15
    v["d120_2003"] = {"decision": DEC, "replaces": ["slot.1733", "slot.1745", "slot.1805", "slot.1815", "slot.1935", "slot.1945", "slot.2005", "slot.2015"],
                      "slots": [slot(tpl, "slot.1733", "slot.1733.v120", "17:33", "17:40"),
                                {**study("slot.1740.v120", "17:40", "18:33"), "mpwSlot": False},   # nazwa „Nauka MPW” jak bloki A i B
                                free("slot.1833.v120", "18:33", "20:15", "Czas wolny"),
                                slot(tpl, "slot.2015", "slot.2015.v120", "20:15", "20:35", title_src="Białko (dieta NT)")]}
    for k in v:   # kopie slotów bez podpunktów „supp” (dawki — wyłącznie z SUPLEMENTACJI, D-001)
        v[k]["slots"] = [no_supp(s) for s in v[k]["slots"]]
    return v


def main():
    cfa, mpw, wk, t = load("cfa.json"), load("mpw.json"), load("week.json"), load("day_template.json")
    mv = moves(cfa["D"]["bloki"], mpw["D"]["bloki"], wk.get("mpwShift"))
    wk["studyMoves"] = {"decision": f"{DEC}: godziny bloków CFA i MPW dopasowane do planu dnia (numer bloku → „data godzina” początku; długość bez zmian)",
                        "cfa": mv["cfa"], "mpw": mv["mpw"]}
    free_day = {"decision": DEC, "dayType": "free", "session": None, "sessionName": "Bez treningu", "sauna": 0, "diet": "NT"}
    exc = {
        "2027-02-21": {**free_day, "variant": "d120_2102", "doseTimes": {"19:30": "19:52"}, "note": "Symulacja MPW 16:40–19:40 — bez basenu (dieta NT)"},
        "2027-03-17": {**free_day, "variant": "d120_1703", "note": "Symulacja MPW 16:40–19:40 — bez roweru i sauny (dieta NT)"},
        "2027-03-20": {**free_day, "variant": "d120_2003", "note": "Dzień przed egzaminem MPW — bez siłowni (dieta NT)"},
        "2027-02-27": {"decision": DEC, "variant": "d120_2702", "doseTimes": {"13:20": "14:20"}, "note": "Symulacja MPW 11:20–14:20, lunch 14:20"},
        "2027-03-06": {"decision": DEC, "variant": "d120_sym", "doseTimes": {"20:15": "20:30"}, "note": "Symulacja MPW 13:30–16:30; trening 18:30–19:50"},
        "2027-03-13": {"decision": DEC, "variant": "d120_sym", "doseTimes": {"20:15": "20:30"}, "note": "Symulacja MPW 13:30–16:30; trening 18:30–19:50"},
    }
    for d, x in exc.items():
        if wk["exceptions"].get(d) and wk["exceptions"][d].get("decision") != DEC:
            raise SystemExit(f"{d}: istniejący wyjątek {wk['exceptions'][d]} — scal ręcznie")
        wk["exceptions"][d] = x
    n_thesis = 0
    for d, b in wk["blocks"].items():
        if b.get("kind") == "praca":
            b.update(title="Pisanie pracy dyplomowej", short="Praca dyplomowa 8:00–11:03", until="11:03",
                     decision=b["decision"] if DEC in b["decision"] else f"{b['decision']}, {DEC}")
            n_thesis += 1
    wk["work"] = {"decision": f"{DEC}: „Czas własny” 08:00–15:23 w dni robocze 2027 (poza świętami) → „Praca”",
                  "from": "2027-01-01", "slotFrom": "08:00", "slotTo": "15:23", "holidays": HOLIDAYS_2027}
    if DEC not in wk["blocks_decision"]:
        wk["blocks_decision"] += f"; {DEC}: praca dyplomowa 08:00–11:03 (nazwa „Pisanie pracy dyplomowej”)"
    dump("week.json", wk)
    t["variants"].update(variants(t))
    dump("day_template.json", t)
    print(f"week.json: przesunięte bloki CFA {len(mv['cfa'])}, MPW {len(mv['mpw'])}; wyjątki {len(exc)}; praca dyplomowa {n_thesis} dni; "
          f"day_template.json: warianty {', '.join(k for k in t['variants'] if k.startswith('d120'))}")


if __name__ == "__main__":
    main()
