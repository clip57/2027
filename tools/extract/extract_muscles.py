#!/usr/bin/env python3
"""Mięśnie pracujące w ćwiczeniach -> src/data/muscles.json.
Źródło: free-exercise-db (github.com/yuhonas/free-exercise-db), licencja Unlicense (domena publiczna).
Pobranie: curl -L -o fedb.json https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
Uruchomienie: FEDB=fedb.json python3 tools/extract/extract_muscles.py
Mapowanie ćwiczeń jest jawne; 'match' = exact (ten sam ruch) lub closest (najbliższy odpowiednik — oznaczany w aplikacji)."""
import json, os, sys

FEDB = os.environ.get("FEDB") or sys.exit("Ustaw FEDB (ścieżka do exercises.json)")
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "muscles.json")
MAP = {
    "Wyciskanie sztangi leżąc": ("Barbell_Bench_Press_-_Medium_Grip", "exact"),
    "Wiosłowanie siedząc (V-grip)": ("Seated_Cable_Rows", "exact"),
    "Wyciskanie hantli nad głowę": ("Dumbbell_Shoulder_Press", "exact"),
    "Ściąganie drążka": ("Wide-Grip_Lat_Pulldown", "exact"),
    "Face pull": ("Face_Pull", "exact"),
    "Rozpiętki bramka": ("Cable_Crossover", "exact"),
    "Wznosy bokiem": ("Side_Lateral_Raise", "exact"),
    "Triceps na linkach": ("Triceps_Pushdown", "exact"),
    "Uginanie EZ": ("EZ-Bar_Curl", "exact"),
    "Wyciskanie sztangi na skosie": ("Barbell_Incline_Bench_Press_-_Medium_Grip", "exact"),
    "Wiosłowanie sztangą": ("Bent_Over_Barbell_Row", "exact"),
    "Wyciskanie nad głowę (OHP)": ("Standing_Military_Press", "exact"),
    # Rekord Band_Assisted_Pull-Up pomija biceps; ruch jest ten sam co w podciąganiu — przyjęto Pullups.
    "Podciąganie z asystą": ("Pullups", "closest"),
    "Odwodzenie w opadzie (wyciąg)": ("Cable_Rear_Delt_Fly", "exact"),
    "Wyciskanie francuskie leżąc": ("EZ-Bar_Skullcrusher", "exact"),
    "Uginanie hantlami": ("Dumbbell_Bicep_Curl", "exact"),
    "Reverse crunch": ("Reverse_Crunch", "exact"),
    "Levitation crunch": ("Crunches", "closest"),
    "Plank": ("Plank", "exact"),
    "Side plank": ("Side_Bridge", "exact"),
    "Suwnica (leg press)": ("Leg_Press", "exact"),
    "Martwy ciąg rumuński": ("Romanian_Deadlift", "exact"),
    "Prostowanie nóg": ("Leg_Extensions", "exact"),
    "Spanish squat / wall-sit": ("Bodyweight_Squat", "closest"),
    "Łydki stojąc": ("Standing_Calf_Raises", "exact"),
    "Hip thrust": ("Barbell_Hip_Thrust", "exact"),
    "Uginanie nóg": ("Lying_Leg_Curls", "exact"),
    "Step-up / bułgarski": ("Dumbbell_Step_Ups", "exact"),
    "Suwnica (stopy wyżej)": ("Leg_Press", "closest"),
    "Odwodzenie biodra": ("Thigh_Abductor", "exact"),
    "Łydki siedząc": ("Seated_Calf_Raise", "exact"),
}
db = {e["id"]: e for e in json.load(open(FEDB, encoding="utf8"))}
training = json.load(open(os.path.join(os.path.dirname(OUT), "training.json"), encoding="utf8"))
names = {e["name"] for day in training["days"].values() for e in day}
missing = sorted(names - set(MAP))
if missing:
    sys.exit(f"Brak mapowania dla: {missing}")
out = {}
for name, (fid, match) in MAP.items():
    e = db.get(fid) or sys.exit(f"Brak rekordu {fid} w zbiorze")
    out[name] = {"primary": e["primaryMuscles"], "secondary": [m for m in e["secondaryMuscles"] if m not in e["primaryMuscles"]],
                 "src": fid, "src_name": e["name"], "match": match}
json.dump({"schema": 1, "source": "free-exercise-db (github.com/yuhonas/free-exercise-db)", "license": "Unlicense (domena publiczna)",
           "exercises": out}, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"muscles.json: {len(out)} ćwiczeń ({sum(v['match'] == 'exact' for v in out.values())} dokładnych, "
      f"{sum(v['match'] == 'closest' for v in out.values())} najbliższych odpowiedników)")
