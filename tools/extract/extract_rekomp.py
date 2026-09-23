#!/usr/bin/env python3
"""PLAN_REKOMPOZYCJI -> src/data/rekomp.json (sekcje publiczne po zaakceptowanych zmianach; zdania wrażliwe jako {private:N})."""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from rekomp_common import parse, REPLACE

SRC = os.environ.get("SOURCES_DIR") or sys.exit("Ustaw SOURCES_DIR")
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "rekomp.json")
sections, applied, sensitive = parse(os.path.join(SRC, "PLAN_REKOMPOZYCJI.html"))
missing = [k for k, v in applied.items() if v == 0]
if missing:
    sys.exit("Nie zastosowano zmian: " + ", ".join(missing))
json.dump({"schema": 1, "generated_from": "PLAN_REKOMPOZYCJI.html + zmiany zaakceptowane 23.09.2026 (D-049, D-050)",
           "sections": sections, "private_fragments": len(sensitive), "private_sections": ["s1", "s21"]},
          open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"rekomp.json: {len(sections)} sekcji, {sum(len(s['blocks']) for s in sections)} bloków, zmian: {sum(applied.values())}, fragmentów prywatnych: {len(sensitive)}")
