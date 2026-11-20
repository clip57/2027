"""D-116 (polecenie użytkownika 20.11.2026) — uruchamiać PO pozostałych skryptach planu (ostatni w kolejności).

Pliki źródłowe użytkownika (poza repozytorium): SOURCES_DIR/MASTER_SCHEDULE_MPW.csv (plan MPW v8 przesunięty) i
SOURCES_DIR/MASTER_SCHEDULE_CFA_451.csv (nowy plan CFA Level I 2027). Ścieżki można podać też argumentami: plan_d116.py <mpw.csv> <cfa.csv>.

1. Plan MPW — „zmiana kosmetyczna”: te same 392 bloki o tej samej treści i numeracji; bloki 1–114 o 4 dni później (start 20.11.2026 zamiast
   16.11, ostatnie z nich 24–27.12.2026). Skrypt przenosi tylko datę, dzień i godziny z CSV i sprawdza, że reszta pól jest identyczna
   (odhaczenia `mpw.done` zostają przy tych samych blokach); zadania bloków z CSV (16 odsyłaczy do daty bloku luki 21.12 → 25.12).
   Statystyki, faza 1 i obszary KNF przeliczone.
2. Nowy plan CFA Level I 2027: 451 bloków, 20.11.2026–12.05.2027 (lektura Curriculum 2027, bank pytań, powtórki, 2 mocki z analizą).
   Zastępuje plan V44 (zakończony 11.11): `CFA_PLAN_VERSION` 16 w kodzie — dawne odhaczenia zostają w dzienniku, ale się nie liczą.
   Bez sesji recall 22:00 i bez szablonu dnia mocka (bloki mocka mają zwykłe litery slotów).
3. Kalendarz do 30.06.2027 (`phases.end`) z dotychczasowymi schematami: tydzień bazowy (czwartek: sauna i zakupy 19:05), Faza 2 diety
   i treningu, preparaty czasowe (ważność 28.03 → 30.06).
4. Studia podyplomowe wg harmonogramu (edycja XIII): zjazdy I–V i VII–X, egzamin końcowy 05.06.2027, obrony 21–22.06.2027; godziny w aplikacji
   bez zmian (8:00–15:23). Zjazd VI (20–21.03.2027) pominięty (użytkownik nieobecny — nauka MPW i egzamin). Usunięte: dawny „zjazd 2” 05–06.12.2026
   i rozmowa kwalifikacyjna 28–29.11.2026 (w tym terminie zjazd II).
5. Święta: 25–27.12 (nowe bloki MPW) i 27–28.03 (bloki CFA) — bez treningu jak dotąd, ale nie „bez bloków”.
Skrypt jest idempotentny.
"""
import csv
import datetime as dt
import json
import os
import pathlib
import sys
from collections import Counter, OrderedDict

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / "src/data"
SRC_DIR = pathlib.Path(os.environ.get("SOURCES_DIR", "."))
MPW_CSV = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else SRC_DIR / "MASTER_SCHEDULE_MPW.csv"
CFA_CSV = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else SRC_DIR / "MASTER_SCHEDULE_CFA_451.csv"
PLAN_END = "2027-06-30"
OLD_END = "2027-03-28"
THU_ST_END, THU_BASE_FROM = "2027-03-18", "2027-03-19"   # ostatni czwartek planu MPW (wariant `czwartek_st`, D-097) i dzień po nim
CFA_VERSION = "CFA_L1_2027_451_20261120"
BLOCK_MIN = 53


def load(p):
    return json.loads((DATA / p).read_text(encoding="utf-8"))


def dump(p, o, indent=1):
    (DATA / p).write_text(json.dumps(o, ensure_ascii=False, indent=indent), encoding="utf-8")


def rows(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def d(s):
    return dt.date.fromisoformat(s)


# ---------- 1. MPW
def mpw():
    j = load("mpw.json")
    D = j["D"]
    new = rows(MPW_CSV)
    if len(new) != len(D["bloki"]):
        raise SystemExit(f"MPW: {len(new)} wierszy w CSV, w planie {len(D['bloki'])}")
    moved, tasks = {}, 0
    for b, r in zip(D["bloki"], new):
        if int(r["nr"]) != b["nr"]:
            raise SystemExit(f"MPW: kolejność numerów różna przy nr {b['nr']}")
        for k in ("egzamin", "kategoria", "tryb", "zrodlo", "do_przeczytania", "objetosc_zrodla", "temat", "knf", "priorytet"):
            if str(b.get(k, "")) != r[k]:
                raise SystemExit(f"MPW nr {b['nr']}: pole {k} różni się od planu w aplikacji — to nie jest samo przesunięcie dat")
        if b["data"] != r["data"]:
            moved.setdefault(b["data"], r["data"])
        if str(b.get("zadania", "")) != r["zadania"]:
            tasks += 1   # zadania z CSV: w 16 blokach odsyłacz „blok luki 21.12” → „25.12” (wynik przesunięcia)
        b.update(data=r["data"], dzien=r["dzien"], blok=r["blok"], godz=r["godz"], zadania=r["zadania"])
    # przesunięcie dat w polach opisowych planu (obszary KNF, faza 1) — wg mapy dat bloków (jednoznaczna: +4 dni dla 16.11–23.12)
    shift = {}
    for a, b in moved.items():
        shift[a] = b
    delta = {(d(b) - d(a)).days for a, b in shift.items()}
    if len(delta) > 1:
        raise SystemExit(f"MPW: niejednolite przesunięcie dat {delta}")
    lo, hi = (min(shift), max(shift)) if shift else (None, None)
    step = delta.pop() if delta else 0
    mv = lambda s: (d(s) + dt.timedelta(days=step)).isoformat() if shift and lo <= s <= hi else s
    for t in D.get("cfa", []):
        t["start"], t["koniecd"] = mv(t["start"]), mv(t["koniecd"])
    days = sorted({b["data"] for b in D["bloki"]})
    st = D["stat"]
    st.update(start=days[0], end=days[-1], dni=len(days), bloki=len(D["bloki"]),
              godziny=round(len(D["bloki"]) * BLOCK_MIN / 60, 2), kat=dict(Counter(b["kategoria"] for b in D["bloki"])),
              tryb=dict(Counter(b["tryb"] for b in D["bloki"])))
    for k, f in D.get("faza", {}).items():
        f["od"] = mv(f["od"])
        inside = [b for b in D["bloki"] if f["od"] <= b["data"] <= f["do"]]
        f["dni"], f["bl"] = len({b["data"] for b in inside}), len(inside)
    D["mockCFA"] = [mv(x) for x in D.get("mockCFA", [])]
    D["simTest"] = {mv(k): v for k, v in D.get("simTest", {}).items()}
    D["mockCov"] = {mv(k): v for k, v in D.get("mockCov", {}).items()}
    D["fpEnd"] = mv(D["fpEnd"])
    j["generated_from"] = ("PLAN_NAUKI_MPW.html (plan MPW 2027 v8, 392 bloki) — obiekt D (D-095, D-096); "
                           f"D-116: daty z MASTER_SCHEDULE_MPW.csv — start {days[0]}, bloki 24–27.12.2026")
    dump("mpw.json", j)
    print(f"mpw.json: {len(D['bloki'])} bloków, {days[0]}–{days[-1]}, przesunięte daty: {len(shift)} dni (+{step}), zmienione zadania: {tasks}")


# ---------- 2. CFA
TOPICS = {"QM": "Quantitative Methods", "EC": "Economics", "CI": "Corporate Issuers", "FSA": "Financial Statement Analysis",
          "EQ": "Equity Investments", "FI": "Fixed Income", "DER": "Derivatives", "AI": "Alternative Investments",
          "PM": "Portfolio Management", "ETH": "Ethical and Professional Standards"}


def cfa():
    src = rows(CFA_CSV)
    if [int(r["nr"]) for r in src] != list(range(1, len(src) + 1)):
        raise SystemExit("CFA: numeracja bloków nieciągła")
    bloki = []
    for r in src:
        b = OrderedDict((k, v) for k, v in r.items() if v != "")
        b["nr"] = int(r["nr"])
        b["zakres"] = r["do_przeczytania"]
        if r["tryb"] == "LEKTURA" and r["dzial_cfa"] in TOPICS:
            b["topic"] = r["dzial_cfa"]   # pierwsze przejście działu (widok „Plan” — postęp działów)
        bloki.append(b)
    days = sorted({b["data"] for b in bloki})
    per_day = Counter(b["data"] for b in bloki)
    first, last, pages = {}, {}, Counter()
    for b in bloki:
        if b.get("topic"):
            first.setdefault(b["topic"], b["data"]); last[b["topic"]] = b["data"]; pages[b["topic"]] += int(b.get("liczba_stron") or 0)
    topics = [{"kod": k, "tytul": TOPICS[k], "waga": "", "strony": pages[k], "start": first[k], "koniecd": last[k]}
              for k in sorted(first, key=lambda x: first[x])]
    mocks = sorted({b["data"] for b in bloki if b["tryb"] == "SYMULACJA"})
    D = OrderedDict(
        version=CFA_VERSION, previousVersion=None, bloki=bloki, cfa=topics, mockCFA=mocks,
        mockSessions=False,   # D-116: bloki mocka mają zwykłe litery slotów (bez szablonu dnia mocka S1/S2 — D-019)
        nightRecall=[],       # D-116: plan bez sesji recall 22:00
        stat=OrderedDict(
            bloki=len(bloki), dni=len(days), godziny=round(len(bloki) * BLOCK_MIN / 60, 2), cfa=len(bloki), mpw=0,
            kat=dict(Counter(b["kategoria"] for b in bloki)), tryb=dict(Counter(b["tryb"] for b in bloki)),
            recall=0, recallEvening=0, recallFinal=0, start=days[0], end=days[-1],
            uklad=f"{len(days)} dni · {min(per_day.values())}–{max(per_day.values())} bloków dziennie"),
    )
    dump("cfa.json", {"schema": 1, "generated_from": f"MASTER_SCHEDULE_CFA_451.csv (plan CFA Level I 2027, {len(bloki)} bloków, "
                      f"{days[0]}–{days[-1]}) — D-116", "exam": None, "examNote": f"termin egzaminu do uzupełnienia (plan kończy się {days[-1]})", "D": D})
    print(f"cfa.json: {len(bloki)} bloków, {days[0]}–{days[-1]}, {len(days)} dni, mocki {mocks}")


# ---------- 3–5. kalendarz, suplementy, tydzień
STUDY = [  # (sobota, niedziela, nr zjazdu, online)
    ("2026-11-14", "2026-11-15", "I", False), ("2026-11-28", "2026-11-29", "II", True), ("2027-01-09", "2027-01-10", "III", True),
    ("2027-02-06", "2027-02-07", "IV", False), ("2027-02-20", "2027-02-21", "V", False), ("2027-04-03", "2027-04-04", "VII", False),
    ("2027-04-24", "2027-04-25", "VIII", True), ("2027-05-08", "2027-05-09", "IX", False), ("2027-05-29", "2027-05-30", "X", False)]
TITLE = "Wycena przedsiębiorstwa i modelowanie finansowe - studia"


def calendar():
    ph = load("phases.json")
    ph["end"] = PLAN_END
    if "D-116" not in ph["decision"]:
        ph["decision"] += "; D-116: plan do 30.06.2027 (dotychczasowe schematy, Faza 2 do końca)"
    dump("phases.json", ph)

    su = load("supplements.json")
    n = 0
    for x in su["doses"]:
        v = x.get("validity")
        if v and v.get("until") == OLD_END:
            v["until"] = PLAN_END; v["decision"] = (v.get("decision", "") + ", D-116").strip(", ") if "D-116" not in v.get("decision", "") else v["decision"]; n += 1
    # Czwartki: dawki przed sauną o 17:45 (D-097, wariant `czwartek_st`) tylko do ostatniego czwartku planu MPW (18.03); od 19.03 czwartek jak
    # w tygodniu bazowym — te same dawki o 17:15 (kopie wpisów D-097 „do 06.01” z okresem od 19.03)
    for x in su["doses"]:
        v = x.get("validity") or {}
        if x.get("weekdays") == [4] and v.get("from") == "2027-01-07":
            v["until"] = THU_ST_END; v["decision"] = "D-097, D-116"
    early = [x for x in su["doses"] if x.get("weekdays") == [4] and (x.get("validity") or {}).get("until") == "2027-01-06"]
    for x in early:
        twin = {**x, "validity": {"from": THU_BASE_FROM, "decision": "D-116"}}
        if not any(y.get("supp") == x["supp"] and y.get("time") == x.get("time") and y.get("validity") == twin["validity"] for y in su["doses"]):
            su["doses"].insert(su["doses"].index(x) + 1, twin)
    dump("supplements.json", su)

    wk = load("week.json")
    bl = wk["blocks"]
    for k in [k for k, v in bl.items() if v.get("kind") == "studia"]:
        del bl[k]
    for k in ("2026-11-28", "2026-11-29"):
        bl.pop(k, None)   # rozmowa kwalifikacyjna — w tym terminie zjazd II
    for sat, sun, no, online in STUDY:
        for day in (sat, sun):
            bl[day] = {"kind": "studia", "title": TITLE, "short": "Studia 8:00–15:23",
                       "desc": f"Studia podyplomowe — zjazd {no}{' (online)' if online else ''}", "decision": "D-116"}
    bl["2027-06-05"] = {"kind": "studia", "title": TITLE, "short": "Studia — egzamin końcowy",
                        "desc": "Studia podyplomowe — egzamin końcowy (online)", "decision": "D-116"}
    for day in ("2027-06-21", "2027-06-22"):
        bl[day] = {"kind": "studia", "title": TITLE, "short": "Studia — obrony",
                   "desc": "Studia podyplomowe — obrony prac (online, 21 lub 22.06 wg przydziału)", "decision": "D-116"}
    # święta: bez treningu jak dotąd, ale z blokami nauki z planów MPW (24–27.12) i CFA (27–28.03)
    for day, what in (("2026-12-25", "Boże Narodzenie"), ("2026-12-26", "Boże Narodzenie"), ("2026-12-27", "Boże Narodzenie")):
        bl[day] = {**bl[day], "short": f"{what} — wolne", "desc": f"{what} — wolne przed południem; po południu nauka MPW wg planu (D-116)"}
        wk["exceptions"][day]["note"] = f"{what}: bez treningu i zakupów (dieta NT); bloki MPW 15:30–18:23 wg planu (D-116)"
    for day in ("2027-03-27", "2027-03-28"):
        bl[day] = {**bl[day], "short": "Wielkanoc — wolne", "desc": "Wielkanoc — wolne poza blokami nauki CFA (D-116)"}
        wk["exceptions"][day]["note"] = "Wielkanoc: bez treningu (dieta NT); bloki CFA wg planu (D-116)"
    wk["blocks"] = dict(sorted(bl.items()))
    # Czwartki po planie MPW: zwykły wariant `czwartek` z tygodnia bazowego (sauna, zakupy 19:05) — `czwartek_st` (D-097) przesuwał tylko bloki MPW
    # (zakupy 15:30 nakładałyby się na blok CFA H). Wcześniejsze uruchomienia skryptu dopisywały tu `czwartek_st` — usuwane.
    wk["exceptions"] = dict(sorted((k, v) for k, v in wk["exceptions"].items() if v.get("decision") != "D-116"
                                   and not (v.get("variant") == "czwartek_st" and k > THU_ST_END)))   # 25.03 — już bez MPW
    if "D-116" not in wk["blocks_decision"]:
        wk["blocks_decision"] += "; D-116: zjazdy wg harmonogramu (I–V, VII–X, egzamin 05.06, obrony 21–22.06), bez zjazdu VI i bez 05–06.12"
    dump("week.json", wk)
    print(f"phases.json: koniec {PLAN_END}; supplements.json: {n} dawek do {PLAN_END}; week.json: {sum(1 for v in wk['blocks'].values() if v['kind'] == 'studia')} dni studiów")


if __name__ == "__main__":
    mpw()
    cfa()
    calendar()
