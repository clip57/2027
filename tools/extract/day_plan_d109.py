"""D-109 (decyzja użytkownika 24.10.2026 do punktu D3 audytu z 23.10.2026) — uruchamiać PO pozostałych skryptach planu dnia (`day_plan_d103c.py`).

1. Sylwester, czwartek 31.12.2026: **bez zakupów** — wariant `czwartek_bz` jak 24.12 (D-103): sauna jak w każdy czwartek, potem powrót do domu
   z posiłkiem 20:15. Razem z 24.12: zakupy 17.12, potem dopiero czwartek 07.01.2027 (wariant `czwartek_st`, zakupy 15:30–16:00) — bez zmian.
2. Nowy Rok, piątek 01.01.2027: **bez treningu** (UPPER 2 pominięty) — dzień nietreningowy z dietą nietreningową (NT), jak inne dni wyjątkowo bez
   treningu (D-103b); piątek nie ma sauny. Bloki MPW (A–C) bez zmian — plan MPW (`mpw.json`) ma własny harmonogram.
3. Środa 06.01.2027: rower i sauna bez zmian (brak wyjątku).
Skrypt jest idempotentny.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
WK = ROOT / "src/data/week.json"

EXCEPTIONS = {
    "2026-12-31": {"decision": "D-109", "variant": "czwartek_bz",
                   "note": "Sylwester: bez zakupów (D-109) — sauna, powrót do domu z posiłkiem 20:15; następne zakupy 07.01"},
    "2027-01-01": {"decision": "D-109", "dayType": "free", "session": None, "sessionName": "Bez treningu", "sauna": 0, "diet": "NT", "variant": None,
                   "note": "Nowy Rok: bez treningu (D-109), dieta NT; bloki MPW bez zmian"},
}


def dump(p, o):
    p.write_text(json.dumps(o, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    wk = json.loads(WK.read_text(encoding="utf-8"))
    ex = wk["exceptions"]
    for d, x in EXCEPTIONS.items():
        ex[d] = dict(x)
    wk["exceptions"] = dict(sorted(ex.items()))
    if "D-109" not in wk["decision"]:
        wk["decision"] += ", D-109"
    dump(WK, wk)
    print("week.json zaktualizowany (D-109): 31.12 bez zakupów, 01.01 bez treningu")


if __name__ == "__main__":
    main()
