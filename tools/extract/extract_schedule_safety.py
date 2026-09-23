#!/usr/bin/env python3
"""Tabela bezpieczeństwa -> safety.json; PLAN_DNIA -> day_template.json; decyzje -> week.json, phases.json."""
import json, os, re, sys
from bs4 import BeautifulSoup

SRC = os.environ.get("SOURCES_DIR") or sys.exit("Ustaw SOURCES_DIR")
DATA = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data")
w = lambda f, o: json.dump(o, open(os.path.join(DATA, f), "w", encoding="utf8"), ensure_ascii=False, indent=1)

# ---------------- Tabela bezpieczeństwa ----------------
soup = BeautifulSoup(open(os.path.join(SRC, "Tabela_bezpieczen_stwa_przechowywania.html"), encoding="utf8").read(), "html.parser")
cols = ["Produkt", "Forma", "Opakowanie", "Gdzie", "Temp.", "Po otwarciu", "Po przygot.", "Po rozmroż.",
        "FINALNY LIMIT", "Próżnia", "Prep", "Najważniejsze ryzyko"]
RENAME = [  # D-020 (brokuły świeże zostają — D-028)
    (r"Jogurt 0% wysokobiałkowy", "Skyr"), (r"WPC / KFD", "Białko WPC"),
    (r"z jogurtem", "ze skyrem"), (r"etykieta jogurtu", "etykieta skyru"),
]
rows, section = [], None
for tr in soup.find_all("tr"):
    cells = tr.find_all(["td", "th"])
    if len(cells) == 1:
        section = cells[0].get_text(" ", strip=True); continue
    if len(cells) < 10 or tr.find("th"):
        continue
    vals = [c.get_text(" ", strip=True) for c in cells]
    row = dict(zip(cols, vals))
    changes = []
    for k in cols:
        for pat, rep in RENAME:
            if re.search(pat, row[k]):
                row[k + "_src"] = row[k]
                row[k] = re.sub(pat, rep, row[k]); changes.append("D-020")
    rows.append({"section": section, **row, **({"decisions": sorted(set(changes))} if changes else {})})
legend = soup.get_text(" ", strip=True)
rows.append({"section": "Posiłki przygotowane — decyzje użytkownika", "Produkt": "Lunch w termosie",
             "Forma": "danie gorące", "Opakowanie": "termos wygrzany wrzątkiem", "Gdzie": "termos",
             "Temp.": "> 63 °C podczas jedzenia", "Po otwarciu": "—", "Po przygot.": "prosto z patelni do termosu",
             "Po rozmroż.": "—", "FINALNY LIMIT": "> 63 °C w chwili jedzenia (13:20)", "Próżnia": "—", "Prep": "—",
             "Najważniejsze ryzyko": "spadek temperatury poniżej 63 °C", "decisions": ["D-013"], "user_decision": True})
w("safety.json", {"schema": 1, "generated_from": "Tabela_bezpieczeństwa_przechowywania.html + D-013/D-020/D-028",
                  "columns": cols, "rows": rows, "product_links": {"brokuly": "Brokuły"},
                  "product_links_decision": "D-028"})
print("safety.json:", len(rows), "wierszy (70 ze źródła + 1 z D-013)")

# ---------------- PLAN_DNIA -> szablon ----------------
soup = BeautifulSoup(open(os.path.join(SRC, "PLAN_DNIA.html"), encoding="utf8").read(), "html.parser")
ROLE = {  # godzina startu -> rola slotu (przypisanie zawartości zmiennej)
    "08:00": ("cfa", "A"), "09:10": ("cfa", "B"), "10:10": ("cfa", "C"), "11:20": ("cfa", "D"),
    "13:30": ("cfa", "E"), "14:30": ("cfa", "F"), "15:30": ("cfa", "G"), "16:40": ("cfa", "H"),
    "08:53": ("meal", "breakfast"), "11:03": ("meal", "snack"), "12:13": ("meal", "lunch"),
    "16:23": ("meal", "dinner"), "20:15": ("meal", "post"), "21:00": ("meal", "supper"),
    "18:05": ("activity", "warmup"), "18:15": ("activity", "main"), "19:45": ("activity", "sauna"),
    "22:00": ("recall", None),
}
DOMAIN = {"cfa-block": "cfa", "diet-block": "diet", "prep-block": "prep", "train-block": "train", "regen-block": "regen"}
slots = []
for sl in soup.select(".slot"):
    t = sl.select_one(".slot-time").get_text(" ", strip=True)
    m = re.match(r"(\d\d:\d\d)–(\d\d:\d\d)", t)
    frm, to = m.group(1), m.group(2)
    desc = sl.select_one(".slot-desc")
    role = ROLE.get(frm, ("static", None))
    slots.append({"id": "slot." + frm.replace(":", ""), "from": frm, "to": to,
                  "domain": DOMAIN[[c for c in sl.get("class") if c.endswith("-block")][0]],
                  "title_src": sl.select_one(".slot-title").get_text(" ", strip=True),
                  "badges_src": [b.get_text(strip=True) for b in sl.select(".badge")],
                  "desc_src": desc.get_text(" ", strip=True) if desc else "", "role": role[0], "key": role[1]})

# Podpunkty slotów (przejrzystość widoku „Dziś”). kind:
#   task  — pokazywany; meal — posiłek (nazwa i kcal z resolvera); supp — ukryty, bo suplementy wylicza
#   resolver z SUPLEMENTACJI (D-001, usunięcie dublowania); derived — ukryty, bo wylicza go resolver.
# 'src' = dokładny fragment tekstu źródłowego; kontrola niżej sprawdza, że fragmenty odtwarzają cały opis.
ITEMS = {
  "07:00": [("task", "Odsłonięcie okien, złożenie łóżka i nastawienie wody."), ("task", "Zakroplenie oczu, skrobak i irygator."),
            ("task", "Pomiar wagi na czczo po toalecie.", "Pomiar wagi i ciśnienia na czczo po toalecie.", "D-038"),
            ("task", "Wypicie 500 ml ciepłej wody z 0,5 g soli jodowanej."),
            ("supp", "Suplementy (na czczo): Siarczan chondroityny + Cynk pikolinian (w czwartki i niedziele)."), ("task", "Poranna pielęgnacja.")],
  "08:53": [("supp", "Suplementy: Boswellia Serrata Witamina D3 + K2 Omega-3 Askorbinian sodu")],
  "10:10": [("task", "Kawa Mrożona (10:30)", "Kawa mrożona (10:30)"), ("supp", "+ L-teanina")],
  "11:03": [("meal", "Przekąska (11:15)", None, None, "snack", "11:15")],
  "12:13": [("task", "Druga Kawa (12:20)", "Druga kawa (12:20)"), ("task", "Spacer regeneracyjny (12:30–13:20)"),
            ("meal", "Lunch (13:20)", None, None, "lunch", "13:20"), ("supp", "Siarczan glukozaminy")],
  "14:30": [("task", "Zielona Herbata (15:00)", "Zielona herbata (15:00)")],
  "16:23": [("meal", "Obiad (16:23)", None, None, "dinner", "16:23")],
  "16:40": [("supp", "Pre-trening (17:15): Kolagen + Askorbinian sodu + Tauryna")],
  "19:35": [("task", "Ciepły prysznic z żelem całego ciała, dokładne wytarcie skóry do sucha.")],
  "20:05": [("task", "10 min wychłodzenia w spoczynku, letni prysznic bez żelu."), ("task", "Wypicie 1 bidonu wody z sodem."),
            ("task", "Przebranie się w ubranie wyjściowe.")],
  "20:15": [("meal", "Posiłek potreningowy (20:15)", None, None, "post", "20:15")],
  "21:00": [("meal", "Kolacja (21:00)", None, None, "supper", "21:00"), ("supp", "Siarczan chondroityny")],
  "21:45": [("task", "1. Przygotowanie melisy", "Przygotowanie melisy"), ("task", "2. Wieczorna pielęgnacja", "Wieczorna pielęgnacja"),
            ("task", "3. Rozmrażanie & overnight oats", "Rozmrażanie i overnight oats")],
  "22:00": [("task", "22:00 Melisa", "Melisa (22:00)"), ("supp", "i suplementy: Glicyna Magnez glicynian Melatonina"),
            ("derived", "(W piątki i soboty: brak sesji recall — wieczór wolny).")],
  "22:53": [("task", "Mycie zębów, przewietrzenie sypialni, całkowite zaciemnienie okien, odłożenie telefonu z dala od łóżka.")],
  "23:00": [("task", "Stabilna pora spoczynku (23:00 ± 30 min, także w weekendy).")],
}
MEAL_KEY_BY_SLOT = {"08:53": ("breakfast", "09:00")}  # śniadanie: posiłek jest w tytule slotu
squash = lambda t: re.sub(r"[\s·]", "", t)
for sl in slots:
    spec = ITEMS.get(sl["from"], [])
    if squash(" ".join(x[1] for x in spec)) != squash(sl["desc_src"]):
        sys.exit(f"Podpunkty slotu {sl['from']} nie odtwarzają tekstu źródłowego: {sl['desc_src']!r}")
    items = []
    for x in spec:
        kind, src = x[0], x[1]
        it = {"kind": kind, "src": src, "text": (x[2] if len(x) > 2 and x[2] else src)}
        if len(x) > 3 and x[3]: it["decision"] = x[3]
        if kind == "meal": it["meal"], it["time"] = x[4], x[5]
        if kind in ("supp", "derived"): it["hidden_reason"] = "D-001: suplementy z SUPLEMENTACJI" if kind == "supp" else "wyliczane przez resolver"
        items.append(it)
    if sl["from"] in MEAL_KEY_BY_SLOT:
        k, t = MEAL_KEY_BY_SLOT[sl["from"]]
        items.insert(0, {"kind": "meal", "src": sl["title_src"], "text": sl["title_src"], "meal": k, "time": t})
    sl["items"] = items
w("day_template.json", {"schema": 1, "generated_from": "PLAN_DNIA.html (godziny niezmienne — D-004)", "slots": slots,
                        "note": "Pola *_src to tekst źródłowy. Wartości kcal, suplementy i bloki CFA są wyliczane (resolver)."})
print("day_template.json:", len(slots), "slotów")

# ---------------- tydzień, fazy (decyzje) ----------------
week = {"schema": 1, "decision": "D-018 (+ REKOMPOZYCJA s.7, TRENING)", "days": {
    "1": {"dayType": "strength_sauna", "session": "pon", "sessionName": "UPPER 1", "sauna": 1, "diet": "T", "recall": True},
    "2": {"dayType": "strength", "session": "wt", "sessionName": "LOWER 1", "sauna": 0, "diet": "T", "recall": True},
    "3": {"dayType": "cardio_sauna", "session": "sr", "sessionName": "Rower + ABS", "sauna": 1, "diet": "T", "recall": True},
    "4": {"dayType": "rest_sauna2", "session": None, "sessionName": "Bez treningu, 2 × sauna", "sauna": 2, "diet": "NT", "recall": True},
    "5": {"dayType": "strength", "session": "pt", "sessionName": "UPPER 2", "sauna": 0, "diet": "T", "recall": False},
    "6": {"dayType": "strength_sauna", "session": "sob", "sessionName": "LOWER 2", "sauna": 1, "diet": "T", "recall": False},
    "7": {"dayType": "swim", "session": "nd", "sessionName": "Basen", "sauna": 0, "diet": "T", "recall": True},
}, "activity": {  # zawartość slotów okna 17:45–20:15 wg typu dnia (D-018)
    "strength_sauna": {"warmup": "Rozgrzewka", "main": "Trening siłowy", "sauna": "Sauna"},
    "strength": {"warmup": "Rozgrzewka", "main": "Trening siłowy", "sauna": "Wolne"},
    "cardio_sauna": {"warmup": "Rower (początek sesji)", "main": "Rower 55 min + ABS", "sauna": "Sauna"},
    "rest_sauna2": {"warmup": "Sauna — przygotowanie", "main": "2 rundy sauny wg protokołu", "sauna": "Wolne"},
    "swim": {"warmup": "Basen (przygotowanie)", "main": "Basen 55 min", "sauna": "Wolne"},
}, "mock": {"decision": "D-019", "replace": {"A": "S1", "B": "S1", "C": "S2", "D": "S2"},
            "free_when_no_block": "D-036"}}
w("week.json", week)
w("phases.json", {"schema": 1, "decision": "D-017", "start": "2026-09-21",
                  "phases": [{"phase": 0, "from": "2026-09-21"}, {"phase": 1, "from": "2026-10-12"}, {"phase": 2, "from": "2026-11-16"}]})
w("seeds.json", {"schema": 1, "note": "Stany z decyzji użytkownika (nie z pliku kopii)", "counts": [
    {"prod": "chondroityna", "qty": 360, "date": "2026-09-22", "decision": "D-015"},
    {"prod": "glukozamina", "qty": 180, "date": "2026-09-22", "decision": "D-015"},
    {"prod": "boswellia", "qty": 180, "date": "2026-09-22", "decision": "D-015"}]})
print("week.json, phases.json, seeds.json zapisane")
