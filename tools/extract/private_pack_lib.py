#!/usr/bin/env python3
"""Pakiet prywatny (D-035) — dostosowanie do bieżącej wersji planu i danych aplikacji (D-091).

Używane przez build_private_pack.py (nowy pakiet ze źródeł) oraz samodzielnie — aktualizacja ISTNIEJĄCEGO pakietu bez plików
źródłowych:
    python3 tools/extract/private_pack_lib.py ~/iCloud/2027/2027-prywatne.json ~/iCloud/2027/2027-prywatne-2026-09-27.json
Wynik zawsze POZA repozytorium. Treść pozostaje tekstem (bez HTML); nic nie jest dopisywane poza zaakceptowanymi zmianami treści
planu (te same reguły co w części publicznej, rekomp_common.REPLACE) i metadanymi wersji planu.

Kontrole:
- znaczniki: fragmenty `rek-priv` i `mp-why` muszą pokrywać wszystkie znaczniki {private:N} z src/data/rekomp.json i mealprep.json
  (inaczej część treści w aplikacji zostałaby ukryta) — błąd;
- sekcje rek-s1 i rek-s21 muszą istnieć — błąd;
- zdania z datami lub tygodniami planu są wypisywane do ręcznego przejrzenia (bez automatycznej zmiany).
Bez zależności zewnętrznych (tylko biblioteka standardowa)."""
import ast, datetime, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))

DATA = lambda f: json.load(open(os.path.join(REPO, "src", "data", f), encoding="utf8"))
REQUIRED = ("rek-s1", "rek-s21", "mp-why", "rek-priv")

# Zmiany dat planu w tekstach wcześniej wygenerowanych pakietów (D-086 → D-087 → D-090): zawsze do stanu bieżącego
UPGRADE = [
    ("Faza 0 (25.09–11.10)", "Faza 0 (27.09–11.10)", "D-090"),
    ("Faza 0 (26.09–11.10)", "Faza 0 (27.09–11.10)", "D-090"),
    ("25.09–11.10", "27.09–11.10", "D-090"),
    ("26.09–11.10", "27.09–11.10", "D-090"),
    ("ostatni dzień 25.03.2027", "ostatni dzień 21.03.2027", "D-087"),
]
REVIEW = re.compile(r"\b\d{1,2}\.\d{2}(?:\.\d{4})?\b|tydzie|tygod|tydz\.", re.I)


def plan_meta():
    ph, cfa = DATA("phases.json"), DATA("cfa.json")["D"]["stat"]
    return {"start": ph["start"], "phases": ph["phases"], "cfa": {"bloki": cfa["bloki"], "start": cfa["start"], "end": cfa["end"]},
            "decision": "D-090"}


def app_markers():
    """Znaczniki {private:N} używane w danych aplikacji (Rekompozycja, Meal Prep)."""
    grab = lambda f: sorted({int(m) for m in re.findall(r"\{private:(\d+)\}", open(os.path.join(REPO, "src", "data", f), encoding="utf8").read())})
    return {"rek-priv": grab("rekomp.json"), "mp-why": grab("mealprep.json")}


def private_rules():
    """Zaakceptowane zmiany treści planu stosowane także w tekstach prywatnych. Bez reguły „Tygodnie” → „Okres”
    (dotyczy nagłówka jednej tabeli publicznej; w tekście prywatnym zmieniłaby sens zdań)."""
    # Stałe czytane bez importu modułu (rekomp_common importuje BeautifulSoup — tu bez zależności zewnętrznych)
    tree = ast.parse(open(os.path.join(HERE, "rekomp_common.py"), encoding="utf8").read())
    const = {t.id: ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign) for t in n.targets
             if isinstance(t, ast.Name) and t.id in ("REPLACE", "REPLACE_PRIVATE")}
    rules = [(o, n, r) for o, n, r, _ in const["REPLACE"] if o != "Tygodnie"] + list(const["REPLACE_PRIVATE"]) + UPGRADE
    return rules


def _texts(block):
    if block.get("text"): yield ("text", None)
    for i, _ in enumerate(block.get("items") or []): yield ("items", i)
    for i, row in enumerate(block.get("rows") or []):
        for j, _ in enumerate(row): yield ("rows", (i, j))


def _get(b, k, idx):
    return b["text"] if k == "text" else b["items"][idx] if k == "items" else b["rows"][idx[0]][idx[1]]


def _set(b, k, idx, v):
    if k == "text": b["text"] = v
    elif k == "items": b["items"][idx] = v
    else: b["rows"][idx[0]][idx[1]] = v


def apply_rules(pack, rules):
    """Zamiana tekstów w miejscu; zwraca {id reguły: liczba zastosowań}."""
    used = {}
    for s in pack["sections"]:
        for b in s["blocks"]:
            for k, idx in list(_texts(b)):
                t = _get(b, k, idx)
                for old, new, rid in rules:
                    if old in t:
                        used[rid] = used.get(rid, 0) + t.count(old)
                        t = t.replace(old, new)
                _set(b, k, idx, t)
    return used


def check(pack, markers=None):
    """Błędy blokujące: brak sekcji albo znaczników wymaganych przez dane aplikacji."""
    markers = markers or app_markers()
    errs = []
    if pack.get("format") != "2027-private" or not isinstance(pack.get("sections"), list):
        return ["to nie jest pakiet prywatny 2027 (format ≠ 2027-private)"]
    by = {s.get("id"): s for s in pack["sections"]}
    for sid in REQUIRED:
        if sid not in by: errs.append(f"brak sekcji {sid}")
    for sid, want in markers.items():
        have = {b.get("marker") for b in by.get(sid, {}).get("blocks", [])}
        miss = [m for m in want if m not in have]
        if miss: errs.append(f"{sid}: brak fragmentów dla znaczników {miss} — pakiet nie pasuje do danych aplikacji (wygeneruj go ze źródeł)")
    return errs


def review(pack):
    """Zdania z datami lub tygodniami — do ręcznego przejrzenia po zmianie planu (nie są zmieniane automatycznie)."""
    out = []
    for s in pack["sections"]:
        for b in s["blocks"]:
            for k, idx in _texts(b):
                t = _get(b, k, idx)
                if REVIEW.search(t): out.append((s["id"], t))
    return out


def finalize(pack, today=None):
    pack["created"] = today or datetime.date.today().isoformat()
    pack["plan"] = plan_meta()
    pack["schema"] = 1
    return pack


def upgrade(pack, today=None):
    """Istniejący pakiet → wersja zgodna z bieżącym planem. Zwraca (pakiet, użyte reguły, błędy, do przejrzenia)."""
    used = apply_rules(pack, private_rules())
    return finalize(pack, today), used, check(pack), review(pack)


def refuse_repo(path):
    out = os.path.abspath(path)
    if out == REPO or out.startswith(REPO + os.sep): sys.exit("Odmowa: pakiet prywatny nie może być zapisany w repozytorium (D-035)")
    return out


if __name__ == "__main__":
    if len(sys.argv) != 3: sys.exit("Użycie: python3 tools/extract/private_pack_lib.py <pakiet.json> <nowy-pakiet.json>  (oba poza repozytorium)")
    src, out = os.path.abspath(sys.argv[1]), refuse_repo(sys.argv[2])
    if src == out: sys.exit("Podaj inną ścieżkę wyjściową — oryginał zostaje bez zmian (kopia bezpieczeństwa)")
    pack, used, errs, rev = upgrade(json.load(open(src, encoding="utf8")))
    print("Zastosowane zmiany treści:", ", ".join(f"{k} ×{v}" for k, v in sorted(used.items())) or "brak")
    if rev:
        print(f"Do przejrzenia ({len(rev)} — daty lub tygodnie; bez automatycznej zmiany):")
        for sid, t in rev: print(f"  [{sid}] {t[:160]}")
    if errs: sys.exit("BŁĄD: " + "; ".join(errs))
    json.dump(pack, open(out, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(f"Zapisano {out} — plan od {pack['plan']['start']} ({pack['plan']['decision']}). Zaimportuj go w module Dane.")
