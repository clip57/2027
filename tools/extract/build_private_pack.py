#!/usr/bin/env python3
"""Pakiet prywatny (D-035): REKOMPOZYCJA s.1 (punkt startowy: antropometria, BIA, badania krwi, MRI, historia)
oraz s.21 (badania kontrolne) -> plik JSON POZA repozytorium.
Uruchomienie: SOURCES_DIR=... python3 tools/extract/build_private_pack.py /ścieżka/wyjściowa/2027-prywatne.json
Treść jest wyłącznie tekstem (bez HTML). Skrypt sprawdza kompletność: cały tekst sekcji musi trafić do pakietu."""
import json, os, re, sys
from bs4 import BeautifulSoup, NavigableString, Comment

SRC = os.environ.get("SOURCES_DIR") or sys.exit("Ustaw SOURCES_DIR")
if len(sys.argv) < 2: sys.exit("Podaj ścieżkę pliku wyjściowego (poza repozytorium)")
OUT = os.path.abspath(sys.argv[1])
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if OUT.startswith(REPO + os.sep): sys.exit("Odmowa: pakiet prywatny nie może być zapisany w repozytorium (D-035)")

soup = BeautifulSoup(open(os.path.join(SRC, "PLAN_REKOMPOZYCJI.html"), encoding="utf8").read(), "html.parser")
norm = lambda t: re.sub(r"\s+", " ", t).strip()
SECTIONS = [("s1", "rek-s1"), ("s21", "rek-s21")]


def section_nodes(sid):
    h = soup.find(id=sid)
    nodes = []
    for sib in h.next_siblings:
        if getattr(sib, "name", None) == "h2":
            break
        nodes.append(sib)
    return h, nodes


def blocks_of(node, out):
    if isinstance(node, Comment): return
    if isinstance(node, NavigableString):
        t = norm(str(node))
        if t: out.append({"type": "p", "text": t})
        return
    if node.name in ("script", "style"): return
    if node.name in ("h3", "h4", "h5"):
        out.append({"type": "h", "text": norm(node.get_text(" "))})
    elif node.name == "table":
        rows = [[norm(c.get_text(" ")) for c in tr.find_all(["th", "td"])] for tr in node.find_all("tr")]
        out.append({"type": "table", "rows": rows})
    elif node.name in ("ul", "ol"):
        out.append({"type": "list", "items": [norm(li.get_text(" ")) for li in node.find_all("li", recursive=False)]})
    elif node.name in ("p", "figcaption", "caption", "dt", "dd", "blockquote"):
        t = norm(node.get_text(" "))
        if t: out.append({"type": "p", "text": t})
    else:
        for ch in node.children: blocks_of(ch, out)


pack = {"format": "2027-private", "schema": 1, "created": "2026-09-22", "decision": "D-035",
        "source": "PLAN_REKOMPOZYCJI.html", "sections": []}
for sid, pid in SECTIONS:
    h, nodes = section_nodes(sid)
    blocks = []
    for n in nodes: blocks_of(n, blocks)
    src_text = norm(" ".join(n.get_text(" ") if hasattr(n, "get_text") else str(n) for n in nodes))
    pack_text = norm(" ".join(b.get("text") or " ".join(b.get("items", [])) or " ".join(" ".join(r) for r in b.get("rows", [])) for b in blocks))
    strip = lambda t: re.sub(r"\s", "", t)
    if strip(src_text) != strip(pack_text):
        sys.exit(f"Niekompletny pakiet dla {sid}: źródło {len(strip(src_text))} znaków, pakiet {len(strip(pack_text))}")
    pack["sections"].append({"id": pid, "title": norm(h.get_text(" ")), "blocks": blocks})
    print(f"{sid}: {len(blocks)} bloków, {len(strip(pack_text))} znaków — kompletne")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(pack, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print("zapisano", OUT)
