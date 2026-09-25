#!/usr/bin/env python3
"""SUPLEMENTACJA_2027 (w projekcie: tekst/Markdown) -> src/data/supplements.json.

Struktura dawek jest zapisana jawnie poniżej; skrypt SPRAWDZA, że każdy fragment
tekstu źródłowego ('evidence') występuje w pliku źródłowym (po usunięciu znaczników **, *).
Dodatki spoza pliku źródłowego mają pole 'decision' (D-015, D-016, D-030).
"""
import json, os, re, sys

SRC = os.environ.get("SOURCES_DIR") or sys.exit("Ustaw SOURCES_DIR")
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "supplements.json")
raw = open(os.path.join(SRC, "SUPLEMENTACJA_2027.docx"), encoding="utf8").read()
flat = re.sub(r"\s+", " ", raw.replace("*", "")).strip()
ALL = [1, 2, 3, 4, 5, 6, 7]  # 1 = poniedziałek

SUPPS = {  # katalog preparatów: id jak w ZAPASY tam, gdzie pozycja istnieje
    "chondroityna": {"name": "Chondroityna", "form": "Siarczan chondroityny 500 mg", "unit": "kaps.", "new": True},
    "cynk": {"name": "Cynk", "form": "Cynk pikolinian 15 mg", "unit": "kaps.", "new": True},
    "boswellia": {"name": "Boswellia Serrata", "form": "Boswellia Serrata, kwasy bosweliowe (65%) 650 mg", "unit": "kaps.", "new": True},
    "d3_k2": {"name": "D3 + K2", "form": "2 kaps. = 4000 IU D3 + 100 µg K2", "unit": "kaps."},
    "omega3": {"name": "Omega-3", "form": "Omega 3 Extreme Ostrovit; 2 kaps. = 1000 mg EPA + 500 mg DHA", "unit": "kaps."},
    "witamina_c": {"name": "Witamina C", "form": "L-askorbinian sodu 100 mg", "unit": "g"},
    "l_teanina": {"name": "L-teanina", "form": "L-teanina 200 mg", "unit": "kaps."},
    "glukozamina": {"name": "Glukozamina", "form": "Siarczan glukozaminy 2 KCL 1400 mg", "unit": "kaps.", "new": True},
    "kolagen": {"name": "Kolagen", "form": "Hydrolizat kolagenu Fortigel 5000 mg", "unit": "g"},
    "tauryna": {"name": "Tauryna", "form": "L-tauryna 2000 mg", "unit": "g"},
    "kreatyna": {"name": "Kreatyna", "form": "Kreatyna monohydrat 5000 mg, w tym kreatyna 4400 mg", "unit": "g"},
    "glicyna": {"name": "Glicyna", "form": "Glicyna 3000 mg", "unit": "g"},
    "magnez_glicynian": {"name": "Magnez", "form": "Glicynian magnezu (2 kaps.) = 266 mg magnezu", "unit": "kaps."},
    "melatonina": {"name": "Melatonina", "form": "Melatonina 1 mg (1 kaps.)", "unit": "kaps."},
}

# (godzina, sytuacja, supp, liczba/ilość w jednostce magazynu, etykieta dawki, dni, evidence[])
D = [
    ("07:00", "Pobudka — woda z solą (500 ml, 40°C, 0,5 g soli)", "chondroityna", 1, "1 kaps.", ALL, ["Siarczan chondroityny 500 mg (1 kaps.)", "na czczo"]),
    ("07:00", "Pobudka — woda z solą (500 ml, 40°C, 0,5 g soli)", "cynk", 1, "1 kaps.", [4, 7], ["Cynk (1 kaps. – czwartek i niedziela)", "Cynk pikolinian 15 mg (1 kaps.)"]),
    ("09:00", "Śniadanie", "boswellia", 1, "1 kaps.", ALL, ["Boswellia Serrata (1 kaps.)", "650 mg (1 kaps.)"]),
    ("09:00", "Śniadanie", "d3_k2", 2, "2 kaps.", ALL, ["D3+K2 (2 kaps.)", "4000 IU D3 + 100 µg K2"]),
    ("09:00", "Śniadanie", "omega3", 2, "2 kaps.", ALL, ["Omega-3 (2 kaps.)", "1000 mg EPA + 500 mg DHA"]),
    ("09:00", "Śniadanie", "witamina_c", 0.1, "100 mg", ALL, ["Witamina C (100 mg)"]),
    ("10:30", "Kawa — espresso + 100 ml mleka 0,5%", "l_teanina", 1, "1 kaps. (200 mg)", ALL, ["L-teanina (1 kaps.)", "L-teanina 200 mg (1 kaps.)"]),
    ("13:20", "Lunch", "glukozamina", 1, "1 kaps.", ALL, ["Glukozamina (1 kaps.)", "Siarczan glukozaminy 2 KCL 1400 mg (1 kaps.)"]),
    ("13:20", "Lunch", "witamina_c", 0.1, "100 mg", ALL, ["Witamina C (100 mg)"]),
    ("17:15", "Pre-trening — 60 minut przed treningiem", "kolagen", 5, "5 g", ALL, ["Kolagen (5 g)", "Fortigel 5000 mg"]),
    ("17:15", "Pre-trening — 60 minut przed treningiem", "witamina_c", 0.1, "100 mg", ALL, ["Witamina C (100 mg)"]),
    ("17:15", "Pre-trening — 60 minut przed treningiem", "tauryna", 2, "2 g", ALL, ["Tauryna (2 g)", "L-tauryna 2000 mg"]),
    ("20:15", "Posiłek potreningowy — banan + białko", "kreatyna", 5, "5 g", ALL, ["Kreatyna (5g)", "Kreatyna monohydrat 5000 mg, w tym kreatyna 4400 mg"]),
    ("21:00", "Kolacja", "chondroityna", 1, "1 kaps.", ALL, ["Siarczan chondroityny 500 mg (1 kaps.)"]),
    ("22:00", "Melisa 200 ml", "glicyna", 3, "3 g", ALL, ["Glicyna (3g)", "Glicyna 3000 mg"]),
    ("22:00", "Melisa 200 ml", "magnez_glicynian", 2, "2 kaps. (266 mg Mg)", ALL, ["Magnez (2 kaps.)", "= 266 mg magnezu"]),
    ("22:00", "Melisa 200 ml", "melatonina", 1, "1 kaps. (1 mg)", ALL, ["Melatonina (1 kaps.)", "Melatonina 1 mg (1 kaps.)"]),
]
NOTES = {  # uwagi ze źródła przypięte do dawek
    ("07:00", "chondroityna"): "na czczo",
    ("07:00", "cynk"): "na czczo",
    ("20:15", "kreatyna"): "z węglowodanami z banana — lepsza retencja",
}
THURSDAY_NOTE = {("20:15", "kreatyna"): {"decision": "D-030", "note": "w czwartek bez banana (dieta NT)"}}
VALID = {  # D-015: do wyczerpania zapasu; przyjmowanie 25.09.2026–21.03.2027 (D-087; koniec jak w I-9)
    "chondroityna": {"from": "2026-09-25", "until": "2027-03-21", "decision": "D-015"},
    "boswellia": {"from": "2026-09-25", "until": "2027-03-21", "decision": "D-015"},
    "glukozamina": {"from": "2026-09-25", "until": "2027-03-21", "decision": "D-015"},
}
OTHER_ROWS = [  # wiersze bez suplementów, zachowane dla pełności harmonogramu
    ("11:15", "Przekąska — kefir 1,5% + siemię + ostropest + kakao + orzech brazylijski"),
    ("12:20", "Kawa — espresso + 100 ml mleka 0,5%"),
    ("15:00", "Zielona herbata 400 ml z cytryną, imbirem i miodem"),
    ("16:20", "Obiad — ryż paraboiled, kurczak, warzywa, brokuły, buraczki, ogórek kiszony"),
    ("18:15", "Trening (FBW/Cardio/Sauna) — W trakcie treningu: woda + elektrolity (sól)"),
    ("23:00", "Sen (do 07:00 = 8 h w łóżku)"),
]

missing = []
for t, sit, sid, *_rest, ev in D:
    for e in ev:
        if e not in flat:
            missing.append((t, sid, e))
for t, sit in OTHER_ROWS:
    key = sit.split(" — W trakcie")[0]
    if key not in flat:
        missing.append((t, "row", key))
if missing:
    for m in missing:
        print("BRAK W ŹRÓDLE:", m)
    sys.exit(1)

doses = []
for t, sit, sid, qty, label, days, ev in D:
    d = {"time": t, "situation_src": sit, "supp": sid, "qty": qty, "label": label, "weekdays": days,
         "src": f"SUPL:{t}/{sid}"}
    if (t, sid) in NOTES:
        d["note"] = NOTES[(t, sid)]
    if (t, sid) in THURSDAY_NOTE:
        d["thursday"] = THURSDAY_NOTE[(t, sid)]
    if sid in VALID:
        d["validity"] = VALID[sid]
    doses.append(d)

out = {"schema": 1, "generated_from": "SUPLEMENTACJA_2027 (D-001)", "supplements": SUPPS,
       "doses": doses, "other_rows": [{"time": t, "text": s} for t, s in OTHER_ROWS],
       "decisions": {"D-014": "tauryna codziennie, także w czwartek",
                     "D-015": "chondroityna, boswellia, glukozamina od 25.09.2026 do 21.03.2027 (D-087; I-9)",
                     "D-016": "cynk kontynuowany; stan nieśledzony"}}
json.dump(out, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print("supplements.json:", len(doses), "dawek,", len(SUPPS), "preparatów — wszystkie fragmenty potwierdzone w źródle")
