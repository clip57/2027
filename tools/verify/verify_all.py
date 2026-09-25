#!/usr/bin/env python3
"""Niezależna weryfikacja src/data/*.json względem plików źródłowych.
Każda różnica musi mieć przypisaną decyzję (D-xxx / I-x); inaczej test kończy się błędem.
Wynik: docs/VERIFY.md oraz kod wyjścia 0/1.
"""
import json, os, re, sys, zipfile
from collections import defaultdict

SRC = os.environ.get("SOURCES_DIR") or sys.exit("Ustaw SOURCES_DIR")
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
D = lambda f: json.load(open(os.path.join(ROOT, "src", "data", f), encoding="utf8"))
report, fails = [], []


def check(ok, msg):
    report.append(("OK  " if ok else "BŁĄD") + " " + msg)
    if not ok:
        fails.append(msg)


# ---------- dieta ----------
diet = D("diet.json")
check(len(diet["plans"]) == 6, "dieta: 6 planów")
EXPECTED_TOTALS = {("NT", 0): 2332, ("NT", 1): 2487, ("NT", 2): 2668, ("T", 0): 2629, ("T", 1): 2784, ("T", 2): 2965}
for p in diet["plans"]:
    key = (p["variant"], p["phase"])
    txt = zipfile.ZipFile(os.path.join(SRC, p["src"])).read("1.txt").decode("utf8").replace("\r", "")
    flat = re.sub(r"\s+", " ", txt)
    for m in p["meals"]:
        s = {k: round(sum(i[k] for i in m["items"]), 1) for k in ("kcal", "p", "c", "f")}
        check(all(abs(s[k] - m["total"][k]) < 0.051 for k in s), f"dieta {key} {m['id']}: suma pozycji = suma sekcji {m['total']}")
        for it in m["items"]:
            check(f"{it['name_src']} {it['label']}" in flat, f"dieta {key}: pozycja '{it['name_src']} {it['label']}' w tekście źródła")
    tot = {k: round(sum(m["total"][k] for m in p["meals"]), 1) for k in ("kcal", "p", "c", "f")}
    check(tot == p["total"], f"dieta {key}: RAZEM = suma sekcji ({p['total']['kcal']} kcal)")
    check(p["total"]["kcal"] == EXPECTED_TOTALS[key], f"dieta {key}: RAZEM zgodne z audytem Etapu 0")
    at = round(4 * p["total"]["p"] + 4 * p["total"]["c"] + 9 * p["total"]["f"], 1)
    check(abs(at - p["atwater_kcal"]) < 0.051, f"dieta {key}: kcal z makro (4/4/9) = {p['atwater_kcal']}")
    check(len(p["spices_raw"]) == 18 and len(p["optional"]) == 10, f"dieta {key}: 18 przypraw, 10 zamienników")

# ---------- suplementy ----------
sup = D("supplements.json")
raw = open(os.path.join(SRC, "SUPLEMENTACJA_2027.docx"), encoding="utf8").read()
flat = re.sub(r"\s+", " ", raw.replace("*", ""))
check(len(sup["doses"]) == 17, "suplementy: 17 dawek")
times_src = set(re.findall(r"\b(\d\d:\d\d)\b", flat))
for d in sup["doses"]:
    check(d["time"] in times_src, f"suplementy: godzina {d['time']} ({d['supp']}) występuje w źródle")
check(abs(sum(d["qty"] for d in sup["doses"] if d["supp"] == "witamina_c") - 0.3) < 1e-9, "suplementy: witamina C 3 × 100 mg")
tau = [d for d in sup["doses"] if d["supp"] == "tauryna"][0]
check(4 in tau["weekdays"], "suplementy: tauryna także w czwartek (D-014)")
zn = [d for d in sup["doses"] if d["supp"] == "cynk"][0]
check(zn["weekdays"] == [4, 7], "suplementy: cynk czwartek i niedziela")
for s_id in ("chondroityna", "boswellia", "glukozamina"):
    check(all(d.get("validity", {}).get("until") == "2027-03-25" and d["validity"].get("from") == "2026-09-25" for d in sup["doses"] if d["supp"] == s_id),
          f"suplementy: {s_id} 25.09.2026–25.03.2027 (D-015, D-086)")

# ---------- zużycie F0/T vs ZAPASY v31 ----------
cat = {c["id"]: c for c in D("catalog.json")["items"]}


def consumption(variant, phase, weekday):
    use = defaultdict(float)
    plan = next(p for p in diet["plans"] if p["variant"] == variant and p["phase"] == phase)
    for m in plan["meals"]:
        for it in m["items"]:
            if it.get("prod") and it.get("use"):
                use[it["prod"]] += it["use"]["qty"]
    for d in sup["doses"]:
        if weekday in d["weekdays"]:
            use[d["supp"]] += d["qty"]
    use["imbir"] += 5  # D-021 (herbata; PDF nie wydziela imbiru)
    return use


u = consumption("T", 0, 1)
EXPECTED_DIFF = {"szczypiorek": ("D-021", 3, 5), "melisa": ("D-021", 3, 2)}
for pid, c in cat.items():
    if c.get("daily_v31") is None:
        continue
    new = round(u.get(pid, 0), 6)
    old = round(c["daily_v31"], 6)
    if pid in EXPECTED_DIFF:
        dec, a, b = EXPECTED_DIFF[pid]
        check(old == a and new == b, f"zużycie F0/T {pid}: {old} → {new} ({dec})")
    else:
        check(abs(new - old) < 1e-6, f"zużycie F0/T {pid}: {new} = ZAPASY v31 {old}")
for pid in ("chondroityna", "glukozamina", "boswellia"):
    check(u.get(pid) in (1, 2), f"zużycie F0/T {pid}: {u.get(pid)} (nowa pozycja, D-015)")

# czwartek (NT) — co odpada względem dnia T
t, nt = consumption("T", 0, 1), consumption("NT", 0, 4)
dropped = sorted(k for k in t if round(t[k] - nt.get(k, 0), 6) > 0 and k != "cynk")
skip_v31 = ["banan", "kakao", "kefir", "ostropest", "siemie_lniane", "wanilia"]
check(dropped == sorted(skip_v31 + ["cynamon"]),
      f"czwartek: odpada {dropped} — względem v31 dochodzi cynamon 2 g (błąd S-1 audytu); tauryna zostaje (D-014)")
check(abs(t["cynamon"] - nt["cynamon"] - 2) < 1e-9, "czwartek: cynamon −2 g")

# ---------- trening ----------
tr = D("training.json")["days"]
sums = {ph: sum(e["series"][str(ph)] for l in tr.values() for e in l) for ph in (0, 1, 2)}
check(sums[0] == 34 and sums[2] == 93, f"trening: suma serii F0 = 34, F2 = 93 (audyt; F1 = {sums[1]})")
check(sum(len(l) for l in tr.values()) == 32, "trening: 32 ćwiczenia")

# ---------- CFA ----------
cfa = D("cfa.json")["D"]
B = cfa["bloki"]
check(len(B) == 432 and [b["nr"] for b in B] == list(range(1, 433)), "CFA: 432 bloki 1–432 (D-086)")
check(len({b["data"] for b in B}) == 48 and min(b["data"] for b in B) == "2026-09-25", "CFA: 48 dni od 25.09.2026 (D-086)")
check(max(b["data"] for b in B if b["tryb"] == "FIRST PASS") == "2026-11-04", "CFA: first pass do 04.11 (D-086)")
check(cfa["mockCFA"] == ["2026-10-26", "2026-10-30", "2026-11-03", "2026-11-07"], "CFA: 4 mocki")
cfa_src = os.path.join(SRC, os.environ.get("CFA_PLAN", "PLAN_NAUKI_CFA_LEVEL_I.html"))
if os.path.exists(cfa_src):
    js = re.findall(r"<script[^>]*>([\s\S]*?)</script>", open(cfa_src, encoding="utf8").read())[0].strip()
    check(json.loads(re.sub(r"^const D\s*=\s*", "", js).rstrip().rstrip(";")) == cfa, "CFA: cfa.json = obiekt D z PLAN_NAUKI_CFA_LEVEL_I.html (D-086)")
else:
    check(False, "CFA: brak PLAN_NAUKI_CFA_LEVEL_I.html w SOURCES_DIR (D-086)")

# ---------- bezpieczeństwo ----------
saf = D("safety.json")["rows"]
check(len([r for r in saf if not r.get("user_decision")]) == 70, "bezpieczeństwo: 70 wierszy ze źródła")
check(not any("mrożone" in r["Produkt"] and "rokuł" in r["Produkt"] for r in saf), "bezpieczeństwo: brak wiersza brokułów mrożonych (D-028)")
check(any(r["Produkt"] == "Lunch w termosie" and "> 63 °C" in r["FINALNY LIMIT"] for r in saf), "bezpieczeństwo: termos > 63 °C (D-013)")
check(not any(re.search(r"\b8[05] ?°C|≥ ?75 ?°C", json.dumps(r, ensure_ascii=False)) for r in saf), "bezpieczeństwo: brak progu pakowania termosu")

# ---------- szablon ----------
tpl = D("day_template.json")["slots"]
check(len(tpl) == 34 and tpl[0]["from"] == "07:00" and tpl[-1]["from"] == "23:00", "szablon dnia: 34 sloty 07:00–23:00 (D-086)")
check([s["from"] for s in tpl if s["role"] == "cfa"] == ["08:00", "09:10", "10:10", "11:20", "12:20", "13:30", "14:30", "15:30", "16:40"],
      "szablon dnia: 9 slotów CFA A–I (D-086)")

os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
with open(os.path.join(ROOT, "docs", "VERIFY.md"), "w", encoding="utf8") as fh:
    fh.write("# Weryfikacja danych źródłowych\n\n")
    fh.write(f"Kontroli: {len(report)} · błędów: {len(fails)}\n\n```\n" + "\n".join(report) + "\n```\n")
print(f"Kontroli: {len(report)}, błędów: {len(fails)}")
for f in fails:
    print("BŁĄD:", f)
sys.exit(1 if fails else 0)
