#!/usr/bin/env python3
"""Kontrola spójności danych repozytorium i opcjonalne porównanie z plikami źródłowymi.

Użyj --data-only, aby pominąć porównanie wymagające SOURCES_DIR.
"""
import argparse
import csv
from datetime import date as Date
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(os.environ["SOURCES_DIR"]).expanduser() if os.environ.get("SOURCES_DIR") else None
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--data-only", action="store_true", help="sprawdź dane repozytorium bez źródeł użytkownika")
ARGS = parser.parse_args()
checks, errors, skipped = [], [], []


def data(name):
    return json.loads((ROOT / "src" / "data" / name).read_text(encoding="utf8"))


def check(ok, message):
    checks.append(("OK" if ok else "BŁĄD", message))
    if not ok:
        errors.append(message)


def skip(message):
    checks.append(("POMINIĘTO", message))
    skipped.append(message)


def source(name, required=True):
    if SRC is None:
        return None
    path = SRC / name
    if path.is_file():
        return path
    if required:
        check(False, f"brak pliku źródłowego: {name}")
    else:
        skip(f"opcjonalne źródło niedostępne: {name}")
    return None


def html_data(path):
    scripts = re.findall(r"<script[^>]*>([\s\S]*?)</script>", path.read_text(encoding="utf8"))
    if not scripts:
        raise ValueError("brak skryptu z obiektem D")
    script = re.sub(r"^const D\s*=\s*", "", scripts[0].strip()).rstrip().rstrip(";")
    return json.loads(script)


def js_string(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, list):
        return ",".join("" if x is None else str(x) for x in value)
    return "[object Object]" if isinstance(value, dict) else str(value)


def compare_csv(path, blocks, label):
    with path.open(encoding="utf8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    columns = [k for k in (rows[0].keys() if rows else []) if any(k in b for b in blocks)]
    diffs = []
    if not columns:
        diffs.append("brak wspólnych kolumn")
    if len(rows) != len(blocks):
        diffs.append(f"wierszy: {len(rows)} ≠ {len(blocks)}")
    for i, (row, block) in enumerate(zip(rows, blocks), 1):
        for key in columns:
            if js_string(block.get(key)) != (row.get(key) or ""):
                diffs.append(f"wiersz {i}, kolumna {key}")
                if len(diffs) >= 5:
                    break
        if len(diffs) >= 5:
            break
    check(not diffs, f"{label}: CSV zgodny ({len(rows)} wierszy, {len(columns)} wspólnych kolumn)" if not diffs
          else f"{label}: różnice CSV ({'; '.join(diffs)})")


# Dieta D-104
diet = data("diet.json")
expected_plans = {(variant, phase) for variant in ("T", "NT") for phase in (0, 1, 2)}
actual_plans = {(plan.get("variant"), plan.get("phase")) for plan in diet["plans"]}
check(actual_plans == expected_plans, "dieta: kompletność wariantów i faz")
diet_consistent = True
for plan in diet["plans"]:
    for meal in plan["meals"]:
        sums = {k: round(sum(i[k] for i in meal["items"]), 1) for k in ("kcal", "p", "c", "f")}
        diet_consistent &= all(abs(sums[k] - meal["total"][k]) < .051 for k in sums)
    summed = {k: round(sum(m["total"][k] for m in plan["meals"]), 1) for k in ("kcal", "p", "c", "f")}
    diet_consistent &= summed == plan["total"]
    atwater = round(4 * summed["p"] + 4 * summed["c"] + 9 * summed["f"], 1)
    diet_consistent &= abs(atwater - plan["atwater_kcal"]) < .051
    diet_consistent &= isinstance(plan.get("spices_raw"), list) and isinstance(plan.get("optional"), list)
check(diet_consistent, "dieta: sumy, makroskładniki i listy składników są spójne")


# Suplementacja i okres planu
doses = data("supplements.json")["doses"]
doses_valid = bool(doses)
for dose in doses:
    days = dose.get("weekdays", [])
    doses_valid &= (isinstance(dose.get("supp"), str) and bool(dose["supp"])
                    and isinstance(dose.get("qty"), (int, float)) and dose["qty"] > 0
                    and bool(re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", dose.get("time", "")))
                    and bool(days) and all(isinstance(day, int) and 1 <= day <= 7 for day in days))
    validity = dose.get("validity", {})
    try:
        start, end = validity.get("from"), validity.get("until")
        start_date = Date.fromisoformat(start) if start else None
        end_date = Date.fromisoformat(end) if end else None
        if start_date and end_date:
            doses_valid &= start_date <= end_date
    except (TypeError, ValueError):
        doses_valid = False
check(doses_valid, "suplementy: format dawek, godzin, dni i zakresów obowiązywania")


# Trening i bezpieczeństwo żywności
training = data("training.json")["days"]
training_valid = bool(training) and all(isinstance(day, list) for day in training.values())
training_valid &= all(isinstance(exercise.get("series"), dict)
                      and all(str(phase) in exercise["series"]
                              and isinstance(exercise["series"][str(phase)], int)
                              and exercise["series"][str(phase)] >= 0 for phase in (0, 1, 2))
                      for day in training.values() for exercise in day)
check(training_valid, "trening: struktura sesji i liczby serii")
safety = data("safety.json")["rows"]
check(bool(safety) and all(isinstance(row, dict) and "Produkt" in row and "FINALNY LIMIT" in row for row in safety),
      "bezpieczeństwo: struktura tabeli i wymagane kolumny")


# Kalendarz i fazy
ph = data("phases.json")
try:
    phase_dates = [Date.fromisoformat(x["from"]) for x in ph["phases"]]
    plan_start, plan_end = Date.fromisoformat(ph["start"]), Date.fromisoformat(ph["end"])
    phases_valid = bool(phase_dates) and phase_dates[0] == plan_start and phase_dates == sorted(set(phase_dates))
    phases_valid &= all(plan_start <= day <= plan_end for day in phase_dates)
    phases_valid &= all(Date.fromisoformat(ph[key]) == plan_start for key in ("realStart", "dietStart", "trainStart"))
except (KeyError, TypeError, ValueError):
    phases_valid = False
check(phases_valid, "plan: spójny zakres kalendarza i faz")


# CFA V44
cfa = data("cfa.json")["D"]
blocks = cfa["bloki"]
dates = sorted({b["data"] for b in blocks})
stat = cfa.get("stat", {})
check(cfa.get("version") == "CFA_20261016_SCHWESER2026_V44_FINAL"
      and len(blocks) == 313 and [b["nr"] for b in blocks] == list(range(1, 314))
      and len(dates) == 27 and dates[0] == "2026-10-16" and dates[-1] == "2026-11-11"
      and cfa.get("mockCFA") == ["2026-11-04", "2026-11-05", "2026-11-10"]
      and stat.get("kat", {}).get("SchweserNotes") == 118 and stat.get("tryb", {}).get("PRACTICE") == 127
      and stat.get("tryb", {}).get("MOCK") == 18 and stat.get("tryb", {}).get("ANALIZA BŁĘDÓW") == 12,
      "CFA: wersja, numeracja, kalendarz i statystyki harmonogramu")


# MPW i plan dnia
mpw = data("mpw.json")
mb = mpw["D"]["bloki"]
md = sorted({b["data"] for b in mb})
check(len(mb) == 392 and [b["nr"] for b in mb] == list(range(1, 393))
      and len(md) == 119 and md[0] == "2026-11-16" and md[-1] == "2027-03-20"
      and mpw.get("exam") == "2027-03-21", "MPW: numeracja, kalendarz i data egzaminu")
tpl = data("day_template.json")
slots = tpl["slots"]
check(bool(slots) and all(re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", s.get("from", "")) for s in slots),
      "szablon dnia: kompletność i format slotów")
z = tpl["variants"].get("czwartek_zl", {})
check(z.get("decision") == "D-103" and any(s["from"] == "17:45" and s["to"] == "18:40"
      and s["title_src"] == "Zakupy" for s in z.get("slots", [])), "szablon dnia: wariant zakupów w czwartek")
sun = tpl["variants"].get("basen", {})
check(sun.get("decision") == "D-094" and bool(sun.get("replaces")) and bool(sun.get("slots")),
      "szablon dnia: wariant niedzielny i lista zastępowanych slotów")
exc = data("week.json")["exceptions"]
check(isinstance(exc, dict) and all(re.fullmatch(r"\d{4}-\d{2}-\d{2}", d) for d in exc),
      "tydzień: poprawne daty wyjątków")


# Porównanie źródeł z katalogu jawnie wskazanego przez użytkownika
if SRC is None:
    if ARGS.data_only:
        skip("porównanie ze źródłami pominięte (--data-only)")
    else:
        check(False, "brak SOURCES_DIR; podano tylko kontrolę repozytorium")
else:
    for name in sorted({p["src"] for p in diet["plans"]}):
        path = source(name)
        if path:
            try:
                with zipfile.ZipFile(path) as zf:
                    text = re.sub(r"\s+", " ", zf.read("1.txt").decode("utf8").replace("\r", ""))
                p = next(x for x in diet["plans"] if x["src"] == name)
                source_matches = all(f"{item['name_src']} {item['label']}" in text
                                     for meal in p["meals"] for item in meal["items"])
                check(source_matches, "dieta: pozycje zgodne ze wskazanym źródłem")
            except (KeyError, OSError, zipfile.BadZipFile, UnicodeDecodeError) as exc:
                check(False, f"dieta {name}: nie można odczytać źródła ({type(exc).__name__})")

    sp = source("SUPLEMENTACJA_2027.docx", required=False)
    if sp:
        try:
            with zipfile.ZipFile(sp) as zf:
                xml = ET.fromstring(zf.read("word/document.xml"))
            text = re.sub(r"\s+", " ", " ".join(node.text or "" for node in xml.iter()
                                                   if node.tag.endswith("}t")).replace("*", ""))
        except (OSError, KeyError, zipfile.BadZipFile, ET.ParseError) as exc:
            check(False, f"suplementy: nie można odczytać DOCX ({type(exc).__name__})")
            text = ""
        times = set(re.findall(r"\b(\d\d:\d\d)\b", text))
        check(all(dose["time"] in times for dose in doses), "suplementy: harmonogram zgodny ze wskazanym źródłem")

    cp = source(os.environ.get("CFA_PLAN", "PLAN_CFA_FINAL_V44.html"))
    if cp:
        try:
            source_cfa = html_data(cp)
            check(source_cfa == cfa and len(source_cfa.get("bloki", [])) == 313,
                  "CFA: HTML źródłowy zgodny z V44 w src/data/cfa.json")
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            check(False, f"CFA: nie można odczytać HTML ({type(exc).__name__})")
    cc = source(os.environ.get("CFA_CSV", "MASTER_CFA_FINAL_V44.csv"), required=False)
    if cc:
        compare_csv(cc, blocks, "CFA")

    mp = source(os.environ.get("MPW_PLAN", "PLAN_NAUKI_MPW.html"))
    if mp:
        try:
            check(html_data(mp) == mpw["D"], "MPW: HTML źródłowy zgodny z mpw.json")
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            check(False, f"MPW: nie można odczytać HTML ({type(exc).__name__})")
    mc = source(os.environ.get("MPW_CSV", "MASTER_SCHEDULE_MPW.csv"), required=False)
    if mc:
        compare_csv(mc, mb, "MPW")


(ROOT / "docs" / "VERIFY.md").write_text(
    "# Weryfikacja danych\n\n"
    f"Kontroli: {len(checks)} · błędów: {len(errors)} · pominięto: {len(skipped)}\n\n" +
    "\n".join(f"- **{status}** {message}" for status, message in checks) + "\n",
    encoding="utf8")
print(f"Kontroli: {len(checks)}, błędów: {len(errors)}, pominięto: {len(skipped)}")
for error in errors:
    print("BŁĄD:", error)
if skipped:
    print(f"Pominięto: {len(skipped)} kontroli źródłowych")
sys.exit(1 if errors else 0)
