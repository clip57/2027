#!/usr/bin/env python3
"""Bezpieczne przechowywanie żywności v3 -> src/data/guide.json (poradnik w module Bezpieczeństwo).
Zmiany zaakceptowane 23.09.2026: B1.1–B1.4, B2 (ETAP6_ZMIANY_TRESCI_do_akceptacji.md), Q1 (D-049).
Każda zmiana ma wymaganą liczbę wystąpień; brak dopasowania = błąd."""
import json, os, re, sys
from bs4 import BeautifulSoup, NavigableString, Comment

SRC = os.environ.get("SOURCES_DIR") or sys.exit("Ustaw SOURCES_DIR")
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "guide.json")
norm = lambda t: re.sub(r"\s+", " ", t).replace(" ,", ",").replace(" .", ".").strip()

TEXT = [  # (stare, nowe, id, wymagana liczba wystąpień)
    ("Jedenaście twierdzeń zostało usuniętych", "Dziesięć twierdzeń zostało usuniętych", "B1.2", 1),
    ("Lunch do termosu — jedyny punkt wymagający zmiany", "Lunch do termosu", "B1.3", 1),
    ("Próg ≥ 63 °C", "Próg: powyżej 63 °C podczas jedzenia", "B1.4", 1),
    ("Jogurt naturalny 0 % wysokobiałkowy", "Skyr", "B2.1", 1),
    ("jogurt 0 % 400 g", "skyr 400 g", "B2.1", 1),
    ("Jogurt 0 %", "Skyr", "B2.1", 1),
    ("WPC / KFD w proszku", "Białko WPC w proszku", "B2.3", 1),
    ("Shake WPC", "Shake z białkiem WPC", "B2.4", 1),
    ("z mlekiem i WPC", "z mlekiem i białkiem WPC", "B2.4", 1),
    # Odesłanie do pliku, który w aplikacji jest zakładką (zmiana redakcyjna E-1, zgłoszona w raporcie)
    ("Tabela_bezpieczenstwa_przechowywania.html", "zakładce „Tabela” tego modułu", "E-1", 1),
]
DROP_P = [  # całe akapity do usunięcia
    ("Poprzednio podałem Ci próg pakowania 85 °C", "B1.3"),
    ("Oba testy wykonujesz raz", "Q1 / D-049"),
]
WORDS = [  # odmiana: jogurt -> skyr (B2.2), WPC w tekście ciągłym -> białko WPC (B2.4)
    (r"\bjogurtem\b", "skyrem"), (r"\bjogurtu\b", "skyru"), (r"\bjogurt\b", "skyr"), (r"\bJogurt\b", "Skyr"),
    (r"(?<![Bb]iałko )(?<![Bb]iałkiem )\bWPC\b", "białko WPC"),
]
count = {t[2] + ":" + t[0][:18]: 0 for t in TEXT}
dropped = {d[1]: 0 for d in DROP_P}
removed_rt = 0


def fix(t):
    t = norm(t)
    for old, new, rid, _n in TEXT:
        if old in t:
            count[rid + ":" + old[:18]] += t.count(old); t = t.replace(old, new)
    for pat, rep in WORDS:
        t = re.sub(pat, rep, t)
    return t.replace("Białko białko WPC", "Białko WPC").replace("białkiem białko WPC", "białkiem WPC").replace("z białkiem białko WPC", "z białkiem WPC")


soup = BeautifulSoup(open(os.path.join(SRC, "Bezpieczne_przechowywanie_z_ywnos_ci.html"), encoding="utf8").read(), "html.parser")
for t in soup(["style", "script"]):
    t.decompose()
wrap = soup.select_one("div.wrap")


def blocks_of(el):
    out = []
    for c in el.children:
        if isinstance(c, (Comment,)) or (isinstance(c, NavigableString) and not c.strip()):
            continue
        if isinstance(c, NavigableString):
            out.append({"type": "p", "text": fix(str(c))}); continue
        cls = " ".join(c.get("class") or [])
        txt = norm(c.get_text(" "))
        if c.name == "p" and any(k in txt for k, _ in DROP_P):
            dropped[next(r for k, r in DROP_P if k in txt)] += 1; continue
        if c.name in ("h3", "h4"):
            out.append({"type": c.name, "text": fix(txt)})
        elif c.name == "p":
            out.append({"type": "old" if "old" in cls else "small" if "small" in cls else "p", "text": fix(txt)})
        elif c.name in ("ul", "ol"):
            out.append({"type": "list", "ordered": c.name == "ol", "items": [fix(li.get_text(" ")) for li in c.find_all("li", recursive=False)]})
        elif c.name == "table" or c.find("table") and ("scroll" in cls):
            tb = c if c.name == "table" else c.find("table")
            rows = [[fix(x.get_text(" ")) for x in tr.find_all(["th", "td"])] for tr in tb.find_all("tr")]
            out.append({"type": "table", "head": rows[0], "rows": rows[1:]})
        elif "rt" in cls or "day" in cls:
            out.append({"type": "card", "kind": "rt" if "rt" in cls else "day", "blocks": blocks_of(c)})
        elif c.name == "div":
            out.extend(blocks_of(c))
    return out


intro, sections, cur = [], [], None
for el in wrap.children:
    if isinstance(el, Comment) or (isinstance(el, NavigableString) and not el.strip()):
        continue
    if getattr(el, "name", None) == "h2":
        cur = {"title": fix(el.get_text(" ")), "blocks": []}
        sections.append(cur); continue
    wrapper = soup.new_tag("div"); wrapper.append(el.__copy__())
    (cur["blocks"] if cur else intro).extend(blocks_of(wrapper))

# B1.1: usunięcie korekty o progu pakowania 85 °C i przenumerowanie kolejnych (3–11 -> 2–10)
for s in sections:
    keep = []
    for b in s["blocks"]:
        if b["type"] == "card" and b["kind"] == "rt" and b["blocks"] and b["blocks"][0]["text"].startswith("2. „Pakuj termos"):
            removed_rt += 1; continue
        if b["type"] == "card" and b["kind"] == "rt" and b["blocks"]:
            m = re.match(r"^(\d+)\. ", b["blocks"][0]["text"])
            if m and int(m.group(1)) >= 3:
                b["blocks"][0]["text"] = f"{int(m.group(1)) - 1}. " + b["blocks"][0]["text"][len(m.group(0)):]
        keep.append(b)
    s["blocks"] = keep

errs = [k for k, v in count.items() if v == 0] + [k for k, v in dropped.items() if v == 0] + (["B1.1"] if removed_rt != 1 else [])
blob = json.dumps({"intro": intro, "sections": sections}, ensure_ascii=False)
if re.search(r"(?<!1)\b85 ?°C", blob): errs.append("pozostał próg 85 °C")
if re.search(r"[Jj]ogurt|KFD", blob): errs.append("pozostała nazwa jogurt/KFD")
if "Powtórz go" in blob: errs.append("pozostało zalecenie powtarzania testu")
if errs:
    sys.exit("Błędy: " + ", ".join(errs))
json.dump({"schema": 1, "generated_from": "Bezpieczne_przechowywanie_żywności.html v3 + B1–B2, Q1 (D-049), E-1",
           "intro": intro, "sections": sections}, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"guide.json: {len(sections)} sekcji, zmian: {sum(count.values())}, usunięte akapity: {sum(dropped.values())}, usunięte korekty: {removed_rt}")
