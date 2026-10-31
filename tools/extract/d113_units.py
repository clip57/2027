"""D-113 (decyzja użytkownika 31.10.2026, punkt 5 audytu z 31.10.2026) — jednostka „ml/g” w katalogu Zapasów → „ml”.

Dotyczy pozycji płynnych z kopii ZAPASY v31 (kefir, oliwa), w których jednostka „ml/g” wyglądała jak błąd. Ilości, opakowania i zużycie
bez zmian — wyłącznie opis jednostki. Uruchamiać PO `extract_static.mjs` i `diet_skyr75.py`. Skrypt jest idempotentny.
"""
import json
import pathlib

CAT = pathlib.Path(__file__).resolve().parents[2] / "src/data/catalog.json"


def main():
    cat = json.loads(CAT.read_text(encoding="utf-8"))
    changed = [it["id"] for it in cat["items"] if it.get("unit") == "ml/g"]
    for it in cat["items"]:
        if it.get("unit") == "ml/g":
            it["unit"] = "ml"
    CAT.write_text(json.dumps(cat, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"catalog.json: jednostka ml/g → ml: {', '.join(changed) or 'bez zmian (już ml)'}")


if __name__ == "__main__":
    main()
