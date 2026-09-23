#!/usr/bin/env python3
"""MEAL_PREP.html -> src/data/mealprep.json.

Zasady:
1. Gramatury zależne od fazy są zastępowane odwołaniami {produkt} — moduł podstawia wartość
   z planu diety dla aktywnej fazy i wariantu dnia (D-003).
2. Decyzje (D-013, D-020, D-022, D-001, I-3) są stosowane jako jawne podmiany; brak dopasowania = błąd.
3. Zdania z wynikami badań trafiają do pakietu prywatnego (D-035) i są zastępowane znacznikiem {private}.
Uruchomienie: SOURCES_DIR=... python3 tools/extract/extract_mealprep.py
"""
import json, os, re, sys
from bs4 import BeautifulSoup

SRC = os.environ.get("SOURCES_DIR") or sys.exit("Ustaw SOURCES_DIR")
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
DATA = os.path.join(ROOT, "src", "data")
norm = lambda t: re.sub(r"\s+", " ", t).replace(" ,", ",").replace(" .", ".").strip()

# --- podmiany wynikające z decyzji: (fragment, nowy tekst, decyzja, wymagana liczba wystąpień)
REPLACE = [
    ("Próg pakowania: ≥ 85 °C.", "Danie trafia do termosu prosto z patelni.", "D-013", 1),
    ("próg 85 °C przy pakowaniu lunchu", "kontrola > 63 °C w termosie przed jedzeniem", "D-013", 1),
    ("w 63–85 °C", "powyżej 63 °C", "D-013", 2),
    ("≥ 63 °C", "> 63 °C", "D-013", 1),
    ("Przy bazie 85 °C danie po wymieszaniu trafiałoby w okolice graniczne, a przy niższych temperaturach spadało natychmiast poniżej progu bezpiecznego przechowywania na gorąco (63 °C).",
     "Skyr dodany rano obniżyłby temperaturę dania, które przez kilka godzin musi utrzymać się powyżej progu bezpiecznego przechowywania na gorąco (63 °C).", "D-013", 1),
    ("melatonina 0,5–1 mg", "melatonina 1 mg", "D-001", 1),
    ("Odżywka białkowa po treningu", "Białko WPC po treningu", "D-020", 1),
    ("Skyr do lunchu z askorbinianem · wieczorem: rozmrażanie szpinaku", "Skyr do lunchu z askorbinianem", "I-3", 1),
    ("Pomidorki cherry 85 g", "Pomidorki koktajlowe 80 g", "D-022", 1),
    # Zamiana przypisania kubków (I-3) przez znacznik pośredni, żeby reguły się nie cofały.
    ("Kawa mrożona. Schładzany lodem", "@@SWAP@@", "I-3", 1),
    ("Zielona herbata. Wygrzewany wrzątkiem", "Kawa mrożona. Schładzany lodem", "I-3", 1),
    ("@@SWAP@@", "Zielona herbata. Wygrzewany wrzątkiem", "I-3", 1),
]
# --- zdania z wynikami badań -> pakiet prywatny (D-035).
# Wykrywane wzorcem, a nie wpisane wprost: treść wrażliwa nie może być w repozytorium.
SENSITIVE = re.compile(r"ng/ml|ferrytyn|% RDA|\bmmol\b|µg/l", re.I)
PRIVATE_COUNT = 2  # kontrola: zmiana liczby zdań wymaga świadomej decyzji
# --- gramatury zależne od fazy/wariantu: (wzorzec, produkt)
PARAMS = [
    (r"płatki owsiane 70 g", "platki_owsiane"), (r"pestki dyni 15 g", "pestki_dyni"), (r"słonecznik 15 g", "slonecznik"),
    (r"nasiona chia 10 g", "chia"), (r"Kurczak 150 g", "kurczak"), (r"Szpinak mrożony 100 g", "szpinak_mrozony"),
    (r"Makaron penne 70 g", "penne"), (r"Ryż 70 g", "ryz_parboiled"), (r"Skyr 100 g", "skyr"),
    (r"Brokuły 130 g", "brokuly"), (r"Chleb żytni 35 g", "chleb_zytni"), (r"Twaróg 125 g", "twarog"),
    (r"kefir 200 g", "kefir"), (r"makaron penne 70 g", "penne"), (r"Ryż parboiled 70 g", "ryz_parboiled"),
    (r"Szpinak 100 g", "szpinak_mrozony"), (r"borówki 60 g", "borowki"), (r"Mieszanka warzyw 130 g", "mieszanka_warzyw"),
    (r"Buraczki 100 g", "buraczki"), (r"marchew 50 g", "marchew"), (r"Papryka 70 g", "papryka"),
    (r"Pomidorki koktajlowe 80 g", "pomidorki_kokt"),
]

soup = BeautifulSoup(open(os.path.join(SRC, "MEAL_PREP.html"), encoding="utf8").read(), "html.parser")
for t in soup(["style", "script"]):
    t.decompose()

applied = {r[0]: 0 for r in REPLACE}
params_used = {}
private_found = []


def split_sentences(t):
    return re.findall(r"[^.!?]+[.!?]|[^.!?]+$", t)


def transform(text):
    t = norm(text)
    for old, new, dec, _n in REPLACE:
        if old in t:
            applied[old] += t.count(old)
            t = t.replace(old, new)
    if SENSITIVE.search(t):
        parts = split_sentences(t)
        for i, sent in enumerate(parts):
            if SENSITIVE.search(sent):
                if sent.strip() not in private_found:
                    private_found.append(sent.strip())
                parts[i] = f" {{private:{private_found.index(sent.strip()) + 1}}}"
        t = norm("".join(parts))
    for pat, prod in PARAMS:
        m = re.search(pat, t)
        if m:
            name = re.sub(r"\s*\d+\s*(g|ml)$", "", m.group(0))
            t = t[:m.start()] + f"{name} {{{prod}}}" + t[m.end():]
            params_used.setdefault(prod, 0)
            params_used[prod] += 1
    return t


def blocks_of(card):
    out = []
    for el in card.find_all(["ul", "ol", "div", "p"], recursive=False):
        cls = el.get("class") or []
        if el.name in ("ul", "ol"):
            out.append({"type": "check" if "check" in cls else "steps",
                        "items": [transform(li.get_text(" ")) for li in el.find_all("li", recursive=False)]})
        elif "safe" in cls or "crit" in cls or "sci" in cls:
            out.append({"type": "safe" if "safe" in cls else "crit" if "crit" in cls else "sci", "text": transform(el.get_text(" "))})
        elif el.name == "p":
            out.append({"type": "p", "text": transform(el.get_text(" "))})
    return out


phases, cards, current = [], [], None
for el in soup.select(".phase, .card"):
    cls = el.get("class") or []
    if "phase" in cls:
        current = {"title": norm(el.get_text(" ")), "cards": []}
        phases.append(current)
    else:
        title_el = el.select_one(".card-title")
        icon = title_el.select_one("span")
        num_title = norm(title_el.get_text(" ").replace(icon.get_text(" ") if icon else "", ""))
        card = {"id": el.get("id"), "icon": norm(icon.get_text()) if icon else "", "title": num_title,
                "time": norm(el.select_one(".badge.time").get_text()) if el.select_one(".badge.time") else None,
                "blocks": blocks_of(el), "why": (el.select_one(".why-link") or {}).get("href", None)}
        cards.append(card)
        (current["cards"] if current else []).append(card["id"])

tables = []
for tb in soup.find_all("table"):
    rows = [[transform(c.get_text(" ")) for c in tr.find_all(["th", "td"])] for tr in tb.find_all("tr")]
    tables.append({"head": rows[0], "rows": rows[1:]})

why = []
for el in soup.find_all(id=re.compile("^d-")):
    body = []
    for sib in el.next_siblings:
        if getattr(sib, "name", None) in ("h3", "h2") or (getattr(sib, "get", lambda *_: None)("id") or "").startswith("d-"):
            break
        if getattr(sib, "name", None) in ("p", "ul", "ol", "div"):
            body.append(transform(sib.get_text(" ")))
    why.append({"id": el.get("id"), "title": norm(el.get_text(" ")), "body": [b for b in body if b]})

errs = [f"nie znaleziono fragmentu (decyzja {d}): {o[:60]}" for o, _n, d, cnt in REPLACE if applied[o] < cnt]
if len(private_found) != PRIVATE_COUNT:
    errs.append(f"liczba zdań z danymi badań zmieniła się: {len(private_found)} (oczekiwano {PRIVATE_COUNT})")
if errs:
    sys.exit("\n".join(errs))

out = {"schema": 1,        "generated_from": "MEAL_PREP.html + D-013/D-020/D-022/D-001/I-3/D-035",
       "phases": phases, "cards": cards, "tables": tables, "why": why,
       "params": sorted(params_used), "decisions": {o: d for o, _n, d, _c in REPLACE},
       "private_fragments": len(private_found), "private_marker": "{private:N}"}
# Kontrola D-013: po podmianach nie może zostać żaden próg 85 °C ani 75 °C przy pakowaniu (185 °C = air fryer).
blob = json.dumps({k: out[k] for k in ("phases", "cards", "tables", "why")}, ensure_ascii=False)
left = re.findall(r".{60}(?<!1)\b(?:85|75) ?°C.{40}", blob)
if left:
    sys.exit("Pozostał próg temperatury pakowania (D-013):\n" + "\n".join(left))
json.dump(out, open(os.path.join(DATA, "mealprep.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"mealprep.json: {len(cards)} kart w {len(phases)} fazach, {len(tables)} tabele, {len(why)} uzasadnień, "
      f"parametry: {len(params_used)}, podmiany: {sum(applied.values())}, fragmenty prywatne: {len(private_found)}")
