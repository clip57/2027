#!/usr/bin/env python3
"""Ekstrakcja 6 planów diety (PDF w projekcie = ZIP: 1.jpeg + 1.txt) do src/data/diet.json.

Uruchomienie: SOURCES_DIR=/ścieżka/do/plików python3 tools/extract/extract_diet.py
Źródła NIE są częścią repozytorium (D-035). Wynik jest wersjonowany w repo.
Wartości liczbowe są przepisywane 1:1. Jedyne zmiany to nazwy kanoniczne (D-020)
i porcje logistyczne (D-021), zapisane w osobnych polach z ID decyzji.
"""
import json, os, re, sys, zipfile, io

SRC = os.environ.get("SOURCES_DIR")
if not SRC:
    sys.exit("Ustaw SOURCES_DIR")
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "diet.json")

SECTIONS = {
    "ŚNIADANIE": "breakfast", "LUNCH": "lunch", "PRZEKĄSKA": "snack",
    "PO TRENINGU": "post", "PO SAUNIE": "post", "OBIAD": "dinner",
    "KOLACJA": "supper", "NAPOJE": "drinks",
}
# nazwa w PDF -> (id produktu, ilość w jednostce produktu | None = nieśledzone, jednostka, uwaga)
# Id produktów = identyfikatory z ZAPASY (dane użytkownika są do nich przypięte).
MAP = {
    "Słonecznik łuskany": "slonecznik", "Nasiona chia": "chia", "Płatki owsiane zwykłe": "platki_owsiane",
    "Pestki dyni": "pestki_dyni", "Orzechy włoskie": "orzechy_wloskie", "Cynamon mielony": "cynamon",
    "Borówki": "borowki", "Skyr naturalny": "skyr", "Makaron penne pełnoziarnisty": "penne",
    "Pomidory szuszone": "pomidory_suszone", "Szpinak mrożony": "szpinak_mrozony", "Oliwa z oliwek": "oliwa",
    "Czosnek": "czosnek", "Kefir 1,5%": "kefir", "Siemię lniane": "siemie_lniane", "Ostropest plamisty": "ostropest",
    "Kakao": "kakao", "Ekstrakt z wanilii": "wanilia", "Orzech brazylijski": "orzech_brazylijski",
    "Białko KFD": "bialko_kfd", "Banan": "banan", "Ryż biały paraboiled": "ryz_parboiled",
    "Kurczak": "kurczak", "Mieszanka warzyw (po hiszpańsku)": "mieszanka_warzyw", "Brokuły": "brokuly",
    "Buraczki tarte (ze słoika)": "buraczki", "Marchew": "marchew", "Ogórek kiszony": "ogorek_kiszony",
    "Jajka": "jajka", "Twaróg chudy": "twarog", "Chleb żytni na zakwasie bez drożdzy": "chleb_zytni",
    "Szczypiorek": "szczypiorek", "Pomidorki koktajlowe": "pomidorki_kokt", "Papryka": "papryka",
    "Sól jodowana": None, "Woda": None, "Zielona herbata (imbir, miód, cytryna)": "herbata_zielona",
    "Mleko 0,5%": "mleko", "Kawa (espresso)": "kawa_ziarno", "Miód": "miod", "Sok z cytryny": "cytryna",
    "Melisa": "melisa",
}
# Ilość logistyczna (zużycie z magazynu), gdy etykieta PDF nie jest w jednostce produktu.
# Źródło każdej wartości podane w polu 'basis'.
LOGISTIC = {
    "jajka": (None, "szt.", "PDF: 3 szt."),               # liczba z etykiety
    "papryka": (1/3, "szt.", "PDF: 1/3 sztuki"),
    "wanilia": (0.25, "ml", "D-021: 0,25 ml (5 kropel)"),
    "herbata_zielona": (5, "g", "ZAPASY v31: 5 g/d (PDF: 1,5 łyżki suszu)"),
    "kawa_ziarno": (16, "g", "ZAPASY v31 / REKOMPOZYCJA: 2 × 8 g"),
    "cytryna": (1/7, "szt.", "D-021: 1/7 szt."),
    "melisa": (2, "g", "D-021: 2 g"),
    "szczypiorek": (5, "g", "D-021: 5 g"),
    "mleko": (200, "ml", "PDF: 200 ml"),
    "kefir": (200, "ml", "PDF: 200 g/ml"),
    "oliwa": (5, "ml", "PDF: 5"),
}
CANON = {  # D-020
    "Białko KFD": "Białko WPC", "Skyr naturalny": "Skyr",
    "Brokuły": "Brokuły mrożone", "Chleb żytni na zakwasie bez drożdzy": "Chleb żytni na zakwasie bez drożdży",
    "Pomidory szuszone": "Pomidory suszone", "Ryż biały paraboiled": "Ryż biały parboiled",
}
SPICES = sorted(["Cynamon", "Koperek", "Papryka słod.", "Czosnek granulowany", "Kurkuma", "Papryka węd.",
                 "Oregano", "Curry", "Chili", "Pieprz czarny", "Rozmaryn", "Bazylia", "Imbir",
                 "Natka pietruszki", "Szczypiorek", "Sól jodowana", "Zioła prowan.", "Tymianek"], key=len, reverse=True)
num = lambda s: float(s.replace(",", "."))


def read_txt(path):
    with zipfile.ZipFile(path) as z:
        return z.read("1.txt").decode("utf8").replace("\r", "")


def parse(text, variant, phase, fname):
    lines = [l for l in text.split("\n")]
    header = lines[1].strip()
    meals, cur, order = [], None, 0
    # linia 2 = nagłówek wariantu + nazwa pierwszej sekcji (np. "DNI TRENINGOWE … (Faza 0) ŚNIADANIE")
    for sec in SECTIONS:
        if header.endswith(" " + sec):
            header = header[: -len(sec)].strip()
            lines[1] = sec
            break
        if header.startswith(sec + " "):
            header = header[len(sec):].strip()
            lines[1] = sec
            break
    i = 1
    total = None
    while i < len(lines):
        l = lines[i].strip(); i += 1
        if not l:
            continue
        if l.startswith("RAZEM"):
            t = [num(x) for x in l.split()[1:5]]
            total = dict(zip(["kcal", "p", "c", "f"], t))
            pct_line = lines[i].strip(); i += 1
            v = [num(x.rstrip("%")) for x in pct_line.split()]
            atwater, pct = v[0], v[1:4]
            rest = lines[i:]
            break
        if l in SECTIONS:
            cur = {"id": SECTIONS[l], "label_src": l, "items": [], "total": None}
            meals.append(cur); continue
        toks = l.split()
        if len(toks) == 4 and all(re.fullmatch(r"[\d,]+", t) for t in toks):
            cur["total"] = dict(zip(["kcal", "p", "c", "f"], [num(t) for t in toks]))
            continue
        m = re.match(r"^(.*?)\s+(\S.*?)\s+(-?[\d,]+)\s+(-?[\d,]+)\s+(-?[\d,]+)\s+(-?[\d,]+)$", l)
        if not m:
            raise ValueError(f"{fname}: nie rozpoznano wiersza: {l!r}")
        # nazwa kończy się tam, gdzie zaczyna się znana nazwa z MAP (najdłuższe dopasowanie)
        name = max((k for k in MAP if l.startswith(k + " ")), key=len, default=None)
        if name is None:
            raise ValueError(f"{fname}: nieznana pozycja: {l!r}")
        tail = l[len(name):].strip()
        mm = re.match(r"^(.*?)\s+(-?[\d,]+)\s+(-?[\d,]+)\s+(-?[\d,]+)\s+(-?[\d,]+)$", tail)
        label, kcal, p, c, f = mm.group(1), *[num(x) for x in mm.groups()[1:]]
        prod = MAP[name]
        qty_num = None
        mg = re.search(r"\(([\d,]+)\s?g\)", label)      # np. "1 ząbek (5 g)" -> 5
        mq = re.match(r"^([\d,]+)(?:\s|$)", label)       # np. "40 (2 widelce)" -> 40
        if mg:
            qty_num = num(mg.group(1))
        elif mq:
            qty_num = num(mq.group(1))
        item = {"order": order, "name_src": name, "name": CANON.get(name, name), "label": label,
                "kcal": kcal, "p": p, "c": c, "f": f, "prod": prod,
                "src": f"PDF:{variant}_F{phase}#{cur['id']}/{name}"}
        if name in CANON:
            item["name_decision"] = "D-020" if name in ("Białko KFD", "Skyr naturalny", "Brokuły", "Chleb żytni na zakwasie bez drożdzy") else "literówka w PDF"
        if prod:
            if prod in LOGISTIC:
                q, unit, basis = LOGISTIC[prod]
                if q is None:  # jajka
                    q = qty_num
                item["use"] = {"qty": q, "unit": unit, "basis": basis}
            else:
                item["use"] = {"qty": qty_num, "unit": "g", "basis": "PDF: waga [g]"}
        order += 1
        cur["items"].append(item)
    # przyprawy i opcjonalne
    spices, optional = [], []
    mode = None
    for l in rest:
        s = l.strip()
        if not s:
            continue
        if s == "PRZYPRAWY":
            mode = "spices"; continue
        if s == "OPCJONALNIE":
            mode = "opt"; continue
        if mode == "spices":
            rest_line = s
            while rest_line:
                hit = next((k for k in SPICES if rest_line.startswith(k)), None)
                if hit is None:
                    raise ValueError(f"{fname}: nieznana przyprawa w: {s!r}")
                spices.append(hit)
                rest_line = rest_line[len(hit):].strip()
        elif mode == "opt":
            mo = re.match(r"^(.*?)\s+(\d[\d/,]*\s.*?|\d[\d,]*)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)$", s)
            if mo:
                optional.append({"name": mo.group(1), "label": mo.group(2), "kcal": num(mo.group(3)),
                                 "p": num(mo.group(4)), "c": num(mo.group(5)), "f": num(mo.group(6))})
    return {"variant": variant, "phase": phase, "header_src": header, "meals": meals,
            "total": total, "atwater_kcal": atwater, "pct": dict(zip(["p", "c", "f"], pct)),
            "spices_raw": spices, "optional": optional, "src": fname}


def main():
    plans = []
    for variant in ("T", "NT"):
        for phase in (0, 1, 2):
            fname = f"DIETA_PLAN_-_2027_{variant}_faza_{phase}.pdf"
            plans.append(parse(read_txt(os.path.join(SRC, fname)), variant, phase, fname))
    out = {"schema": 1, "generated_from": "6 × DIETA_PLAN (warstwa tekstowa)", "plans": plans}
    with open(OUT, "w", encoding="utf8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print("diet.json:", sum(len(m["items"]) for p in plans for m in p["meals"]), "pozycji w", len(plans), "planach")


if __name__ == "__main__":
    main()
