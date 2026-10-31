"""D-113 (audyt 31.10.2026, D12) — odstęp przed znakiem interpunkcyjnym w tekstach z ekstrakcji HTML.

Ekstrakcja łączyła węzły tekstu spacją, więc po wyróżnieniu (`<b>…</b>, …`) zostawała spacja przed przecinkiem:
„Listeria , drożdże”, „próżniowo , pojedynczo”, „szczelny pojemnik ; do zamrażarki”. Skrypt usuwa wyłącznie tę spację
(przed `, . ; : )`, gdy po znaku jest odstęp albo koniec tekstu) w `safety.json` (Bezpieczeństwo) i `rekomp.json`
(Rekompozycja). Treść, liczby i kolejność bez zmian. Pliki `cfa.json`, `mpw.json` (porównywane 1:1 ze źródłem) oraz
`guide.json` i `mealprep.json` (separator „ ; ” jest tam zapisem źródła) — bez zmian.
Uruchamiać PO `extract_schedule_safety.py`, `extract_rekomp.py`, `diet_skyr75.py` i skryptach planu dnia. Idempotentny.
"""
import json
import pathlib
import re

DATA = pathlib.Path(__file__).resolve().parents[2] / "src/data"
FILES = ("safety.json", "rekomp.json")
PAT = re.compile(r"(?<=\S) +([,.;:)])(?=\s|$)")


def fix(value, count):
    if isinstance(value, str):
        out, n = PAT.subn(r"\1", value)
        count[0] += n
        return out
    if isinstance(value, list):
        return [fix(v, count) for v in value]
    if isinstance(value, dict):
        return {k: fix(v, count) for k, v in value.items()}
    return value


def main():
    for name in FILES:
        path = DATA / name
        count = [0]
        data = fix(json.loads(path.read_text(encoding="utf-8")), count)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{name}: usunięte odstępy przed interpunkcją: {count[0]}")


if __name__ == "__main__":
    main()
