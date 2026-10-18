"""D-104 (polecenie użytkownika 17.10.2026): **skyr 75 g** w śniadaniu i w lunchu (zamiast 100 g), we wszystkich 6 planach diety (T/NT × Faza 0–2).

Przeliczane jest wszystko, co zależy od skyru, jedną arytmetyką (ta sama co w PDF-ach: pozycje → posiłek → plan → Atwater 4/4/9 → procenty):
- `diet.json`: pozycje skyru (75 g: 67 kcal/100 g → 50 kcal [50,25 zaokrąglone do pełnych kcal jak większość pozycji], B 9,0, W 2,9 [2,85], T 0), sumy posiłków (śniadanie, lunch), sumy planu,
  `atwater_kcal`, `pct`; `use.qty` = 75 g (z tego liczy się zużycie dzienne, zapasy, prognozy, lista zakupów, meal prep);
- `catalog.json` (Zapasy): zużycie dzienne skyru 150 g (75 + 75), limit zapasu 12 dni = 1800 g (było 2400 g = 12 × 200 g), opis pozycji;
- `rekomp.json` (Rekompozycja): tabele składu dni T i NT w 3 fazach, tabele „Parametr” (energia, białko, węglowodany, tłuszcz, rozkład energii, tygodniowa podaż), „Kaloryczność startowa”,
  sumy dobowe w tekstach i tabelach tygodnia, wyliczone pochodne w zdaniach (różnica względem punktu wyjścia, deficyt względem TDEE), zdania o 100 g skyru; `mealprep.json`, `guide.json`: zdania o 100 g skyru.
Uruchamiać PO ekstrakcji `extract_diet.py` (PDF-y mają 100 g) i po rekomp/mealprep. Skrypt jest idempotentny.
"""
import json
import pathlib
from decimal import Decimal as D, ROUND_HALF_UP

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / "src/data"
DIET, CAT, RK, MP, GD = (DATA / f"{n}.json" for n in ("diet", "catalog", "rekomp", "mealprep", "guide"))

PORTION = 75
SKYR = {"label": "75", "kcal": 50.0, "p": 9.0, "c": 2.9, "f": 0.0}    # 75 g: 67 · 0,75 = 50,25 → 50; 3,8 · 0,75 = 2,85 → 2,9
BODY_KG = D("87.4")                                                     # masa ciała z tabel g/kg w Rekompozycji (190,5 g = 2,18 g/kg itd.)
KCAL_TOKENS = {  # sumy dobowe (T, NT) i średnie tygodniowe w tekstach i tabelach tygodnia — stare → nowe (liczone niżej)
}


def q(x, nd=1):
    return D(str(x)).quantize(D(1).scaleb(-nd), rounding=ROUND_HALF_UP)


def f1(x):
    return float(q(x, 1))


def dump(p, o):
    p.write_text(json.dumps(o, ensure_ascii=False, indent=1), encoding="utf-8")


def pl(x, nd=1, zero="0"):
    """Liczba po polsku (przecinek); zero zapisywane jako „0”."""
    if D(str(x)) == 0:
        return zero
    return f"{q(x, nd)}".replace(".", ",")


def pl_kcal(x):
    d = D(str(x))
    return str(int(d)) if d == d.to_integral_value() else pl(d)


# ---------- diet.json ----------
def recompute_diet(diet):
    changed = 0
    for p in diet["plans"]:
        for m in p["meals"]:
            for it in m["items"]:
                if it.get("prod") != "skyr":
                    continue
                if it["use"]["qty"] != PORTION:
                    changed += 1
                it.update({k: v for k, v in SKYR.items()})
                it["use"] = {**it["use"], "qty": float(PORTION)}
                it["portion_decision"] = "D-104"
            m["total"] = {k: f1(sum(D(str(i[k])) for i in m["items"])) for k in ("kcal", "p", "c", "f")}
        p["total"] = {k: f1(sum(D(str(m["total"][k])) for m in p["meals"])) for k in ("kcal", "p", "c", "f")}
        t = p["total"]
        p["atwater_kcal"] = f1(4 * D(str(t["p"])) + 4 * D(str(t["c"])) + 9 * D(str(t["f"])))
        at = D(str(p["atwater_kcal"]))
        p["pct"] = {"p": f1(100 * 4 * D(str(t["p"])) / at), "c": f1(100 * 4 * D(str(t["c"])) / at), "f": f1(100 * 9 * D(str(t["f"])) / at)}
    return changed


def plan_of(diet, variant, phase):
    return next(p for p in diet["plans"] if p["variant"] == variant and p["phase"] == phase)


# ---------- tabele Rekompozycji (budowane z diet.json; sprawdzone na starych danych — odtwarzają stare tabele) ----------
def energy_table(diet, phase):
    T, N = plan_of(diet, "T", phase)["total"], plan_of(diet, "NT", phase)["total"]
    avg = lambda k: (6 * D(str(T[k])) + D(str(N[k]))) / 7
    kg = lambda x: pl(q(D(str(x)) / BODY_KG, 2), 2)
    kcal_avg = avg("kcal")
    macro = lambda k: [f"{pl(T[k])} g · {kg(T[k])} g/kg", f"{pl(N[k])} g · {kg(N[k])} g/kg", f"{pl(q(avg(k), 1))} g · {kg(avg(k))} g/kg"]
    pct = lambda k, mult: int(q(100 * mult * avg(k) / kcal_avg, 0))
    return {
        "Energia": [f"{pl_kcal(T['kcal'])} kcal", f"{pl_kcal(N['kcal'])} kcal", f"{int(q(kcal_avg, 0))} kcal"],
        "Białko": macro("p"), "Węglowodany": macro("c"), "Tłuszcz": macro("f"),
        "Rozkład energii": f"B {pct('p', 4)}% · W {pct('c', 4)}% · T {pct('f', 9)}%",
        "Tygodniowa podaż": f"{int(6 * D(str(T['kcal'])) + D(str(N['kcal'])))} kcal",
    }, int(q(kcal_avg, 0))


def apply_rekomp(rk, diet):
    sec2, sec3 = rk["sections"][2]["blocks"], rk["sections"][3]["blocks"]
    avgs = {}
    for ph, bi in ((0, 2), (1, 4), (2, 6)):
        tab, avgs[ph] = energy_table(diet, ph)
        for row in sec2[bi]["rows"]:
            k = row[0]
            if k in ("Energia", "Białko", "Węglowodany", "Tłuszcz"):
                row[1:4] = tab[k]
            elif k == "Rozkład energii":
                row[1] = tab[k]
            elif k == "Tygodniowa podaż":
                row[1] = tab[k]
    # tabele składu dnia T (3, 10, 17) i różnice dnia NT (6, 13, 20)
    for ph, ti, ni in ((0, 3, 6), (1, 10, 13), (2, 17, 20)):
        T = plan_of(diet, "T", ph)
        meal = {m["id"]: m for m in T["meals"]}
        for row in sec3[ti]["rows"]:
            if row[0] == "Skyr naturalny":
                row[1:8] = ["75 g", "—", pl_kcal(SKYR["kcal"]), pl(SKYR["p"]), pl(SKYR["c"]), "0", "0"]   # [nazwa, ilość, uwaga, kcal, B, W, T, Bł.]
            for label, mid in (("Razem śniadanie", "breakfast"), ("Razem lunch", "lunch")):
                if row[0] == label:
                    t = meal[mid]["total"]
                    row[1:5] = [pl_kcal(t["kcal"]), pl(t["p"]), pl(t["c"]), pl(t["f"])]
            if row[0].startswith("RAZEM DZIEŃ TRENINGOWY"):
                t = T["total"]
                row[1:5] = [pl_kcal(t["kcal"]), pl(t["p"]), pl(t["c"]), pl(t["f"])]
        N = plan_of(diet, "NT", ph)["total"]
        for row in sec3[ni]["rows"]:
            if row[0].startswith("RAZEM DZIEŃ NIETRENINGOWY"):
                row[1:5] = [pl_kcal(N["kcal"]), pl(N["p"]), pl(N["c"]), pl(N["f"])]
    # „Kaloryczność startowa” (Faza 0)
    for row in rk["sections"][1]["blocks"][1]["rows"]:
        if row[0] == "Kaloryczność startowa":
            row[1] = f"{avgs[0]} kcal śr. tyg."
    return avgs


def replace_tokens(obj, mapping):
    if isinstance(obj, dict):
        return {k: replace_tokens(v, mapping) for k, v in obj.items()}
    if isinstance(obj, list):
        return [replace_tokens(v, mapping) for v in obj]
    if isinstance(obj, str):
        for a, b in mapping:
            obj = obj.replace(a, b)
    return obj


def main():
    diet = json.loads(DIET.read_text(encoding="utf-8"))
    old = {(p["variant"], p["phase"]): p["total"]["kcal"] for p in diet["plans"]}
    old_avg = {ph: int(q((6 * D(str(old[("T", ph)])) + D(str(old[("NT", ph)]))) / 7, 0)) for ph in (0, 1, 2)}
    old_week = {ph: int(6 * D(str(old[("T", ph)])) + D(str(old[("NT", ph)]))) for ph in (0, 1, 2)}
    changed = recompute_diet(diet)
    dump(DIET, diet)

    cat = json.loads(CAT.read_text(encoding="utf-8"))
    for it in cat["items"]:
        if it["id"] == "skyr":
            it.update({"daily_v31": 2 * PORTION, "maxLimit": 12 * 2 * PORTION, "note": f"{PORTION} g Śniad. + {PORTION} g Lunch"})
    dump(CAT, cat)

    # tokeny kcal w tekstach i tabelach tygodnia (tylko przy pierwszym uruchomieniu różnią się stare od nowych; kolizji starych z nowymi nie ma)
    if changed:
        mapping = []
        for ph in (0, 1, 2):
            new_t, new_nt = plan_of(diet, "T", ph)["total"]["kcal"], plan_of(diet, "NT", ph)["total"]["kcal"]
            _, new_avg = energy_table(diet, ph)
            mapping += [(pl_kcal(old[("T", ph)]), pl_kcal(new_t)), (pl_kcal(old[("NT", ph)]), pl_kcal(new_nt)), (str(old_avg[ph]), str(new_avg)),
                        (f"{old_week[ph]} kcal", f"{int(6 * D(str(new_t)) + D(str(new_nt)))} kcal")]
        rk = json.loads(RK.read_text(encoding="utf-8"))
        rk = replace_tokens(rk, mapping)
        apply_rekomp(rk, diet)
        # wyliczone pochodne w zdaniach: różnica względem „punktu wyjścia” (2587 + 179 = 2766 kcal) i deficyt względem prawdopodobnego TDEE (2750 / 2950 / 3100 kcal)
        tdee = {0: 2750, 1: 2950, 2: 3100}
        new_avg = {ph: energy_table(diet, ph)[1] for ph in (0, 1, 2)}
        pct = lambda avg: {ph: int(q(100 * D(tdee[ph] - avg[ph]) / D(tdee[ph]), 0)) for ph in (0, 1, 2)}
        po, pn = pct(old_avg), pct(new_avg)
        baseline = old_avg[0] + 179
        rk = replace_tokens(rk, [
            (f"To o {baseline - old_avg[0]} kcal mniej niż punkt wyjścia", f"To o {baseline - new_avg[0]} kcal mniej niż punkt wyjścia"),
            (f"~{po[0]}% (Faza 0) → ~{po[1]}% (Faza 1) → ~{po[2]}% (Faza 2)", f"~{pn[0]}% (Faza 0) → ~{pn[1]}% (Faza 1) → ~{pn[2]}% (Faza 2)"),
            (f"Deficyt jest niewielki (~{po[0]}% w Fazie 0)", f"Deficyt jest niewielki (~{pn[0]}% w Fazie 0)")])
        rk = replace_tokens(rk, [("100 g skyru pakujesz osobno", "75 g skyru pakujesz osobno"), ("Dodanie 100 g produktu chłodzonego", "Dodanie 75 g produktu chłodzonego")])
        dump(RK, rk)

        mp = json.loads(MP.read_text(encoding="utf-8"))
        mp = replace_tokens(mp, [("Dodaj skyr 100 g,", "Dodaj skyr {skyr},"), ("Dlaczego skyr nie wchodzi do termosu. 100 g produktu chłodzonego", "Dlaczego skyr nie wchodzi do termosu. 75 g produktu chłodzonego")])
        dump(MP, mp)

        gd = json.loads(GD.read_text(encoding="utf-8"))
        gd = replace_tokens(gd, [("Skyr 400 g = dwie porcje dzienne.", "Skyr 400 g = ok. 2,7 dnia (150 g dziennie: 75 g w śniadaniu i 75 g w lunchu).")])
        dump(GD, gd)
    print(f"diet.json, catalog.json, rekomp.json, mealprep.json, guide.json: skyr {PORTION} g (D-104), zmienionych pozycji: {changed}")


if __name__ == "__main__":
    main()
