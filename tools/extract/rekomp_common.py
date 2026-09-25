"""Wspólny parser PLAN_REKOMPOZYCJI (ekstraktor modułu + generator pakietu prywatnego).
Wrażliwe zdania wykrywane OGÓLNYMI wzorcami (jednostki badań, nazwy badań i rozpoznań, format pomiarów ciała),
bez wpisywania jakichkolwiek wartości użytkownika do repozytorium (D-035).
"""
import re
from bs4 import BeautifulSoup, Comment, NavigableString

SENSITIVE = re.compile(
    r"ng/ml|% ?RDA|cynk[a-z]* \d+[,.]\d+ mg|U/l\b|mg/dl|µmol|mmol|ferrytyn|25\(OH\)D\s*\d|chondropat|\bMRI\b|rezonans|Wiberg|TT-TG|szczelin[a-z]* śródłąkotk|"
    r"\b\d{2}[- ]lat(?:a|ka)?\b|\b\d{2,3} ?cm\b|\bWHtR[^.]{0,20}\d[,.]\d{2,3}|\b\d{2,3}/\d{3} =|"
    r"[−+-]?\d+[,.]\d ?kg\b(?! ?/)|masa \d+[,.]\d|tkanka tłuszczowa \d", re.I)
PRIVATE_SECTIONS = {"s1", "s21"}  # w całości w pakiecie prywatnym (D-035)

# Zaakceptowane zmiany treści (ETAP6_ZMIANY_TRESCI_do_akceptacji.md, akceptacja 23.09.2026; Q1/Q2 — D-049, D-050)
REPLACE = [
    ("zmierzona termometrem: ≥75 °C przy pakowaniu", "prosto z patelni", "A1.1", 1),
    ("przy bazie 75 °C danie trafiało do termosu w ok. 57 °C, poniżej progu bezpiecznego przechowywania na gorąco",
     "dodanie skyru rano zbijało temperaturę dania poniżej progu bezpiecznego przechowywania na gorąco (63 °C)", "A1.2", 1),
    ("Próg krytyczny: 60 °C. Wynik ≥60 °C", "Próg krytyczny: temperatura powyżej 63 °C podczas jedzenia. Wynik powyżej 63 °C", "A1.3", 1),
    ("Wynik <60 °C", "Wynik 63 °C lub niższy", "A1.3", 1),
    ("Odżywka białkowa (serwatka)", "Białko WPC", "A3.1", 1),
    ("Chleb żytni razowy", "Chleb żytni na zakwasie", "A3.2", 1),
    ("2–3 g suszonej melisy", "2 g suszonej melisy", "A3.3", 1),
    ("Sucha mieszanka śniadaniowa w słoikach na cały tydzień; ryż/makaron w partiach; kurczak i warzywa na 2–3 dni",
     "Sucha mieszanka śniadaniowa w słoikach na cały tydzień; obiad gotowany codziennie", "A3.5", 1),
    ("Gotuj ryż i makaron partiami, schładzaj w lodówce ≥12 h przed spożyciem", "Obiad gotowany codziennie (D-022)", "A3.4", 1),
    ("Codziennie przez 4–8 tygodni, potem odstawić i sprawdzić, czy rytm się utrzymuje.", "1 mg codziennie o 22:00 (SUPLEMENTACJA).", "A2.4", 1),
    ("Ale dzień rozpoczęcia ma znaczenie : kreatyna podnosi kreatyninę, więc nie zaczynaj jej przed pobraniem krwi z tygodnia 0 (sekcja 21)",
     "Przyjmowana codziennie o 20:15 (SUPLEMENTACJA). Uwaga do badań: kreatyna podnosi stężenie kreatyniny we krwi — uwzględnij to przy interpretacji wyniku", "A2.6", 1),
    ("przekąska zamieniona na odżywkę + orzech brazylijski; kolagen i witaminę C bierzesz o dowolnej porze, tauryna odpada (brak treningu)",
     "przekąska to orzech brazylijski, białko WPC o 20:15 po saunie; kolagen, witamina C i tauryna o 17:15 jak w pozostałe dni", "A2.8", 1),
    ("Przejście między fazami zależy od odpowiedzi organizmu, nie od kalendarza .",
     "Fazy zmieniają się według kalendarza: Faza 1 od 12.10.2026, Faza 2 od 16.11.2026 (D-017). Kryteria poniżej są listą kontrolną:", "A4.1", 1),
    ("Jeśli po trzech tygodniach kolano nie jest stabilnie zielone — zostajesz w Fazie 0 kolejny tydzień. Jeśli w szczycie sesji egzaminacyjnej regeneracja siada — cofasz się o fazę. Cofnięcie nie jest porażką, jest częścią systemu.",
     "jeśli kolano nie jest stabilnie zielone albo regeneracja siada w szczycie sesji egzaminacyjnej, zmiana dat faz wymaga Twojej decyzji.", "A4.1", 1),
    ("0,5–1 mg o 22:00", "1 mg o 22:00", "A2.4b", 1),
    ("melatonina 0,5–1 mg", "melatonina 1 mg", "A2.4c", 1),
    ("Glukozamina · chondroityna · Boswellia", "Glukozamina · chondroityna · Boswellia — do wyczerpania zapasu (ostatni dzień 25.03.2027), potem niekontynuowane", "A2.1", 1),
    # D-086 (P-2): start planu 25.09.2026 — Faza 0 trwa 17 dni; fazy opisane datami zamiast tygodni
    ("Faza 0 (tygodnie 1–3)", "Faza 0 (25.09–11.10)", "D-086", 2),
    ("Faza 1 (tygodnie 4–8)", "Faza 1 (12.10–15.11)", "D-086", 2),
    ("Faza 2 (tygodnie 9+)", "Faza 2 (od 16.11)", "D-086", 2),
    ("Sukces = ukończenie 3 tygodni bez objawów", "Sukces = ukończenie Fazy 0 bez objawów", "D-086", 1),
    ("Ukończone 3 tygodnie · ≥80% sesji", "Ukończona Faza 0 · ≥80% sesji", "D-086", 1),
    ("Tygodnie", "Okres", "D-086", 1),
]
# A2.9 (akceptacja 23.09.2026, D-053): komórki tabel suplementów — (początek 1. kolumny wiersza, nr kolumny, stara, nowa)
TABLE_CELLS = [
    ("Kreatyna monohydrat", 2, "dowolnie start: po badaniach z tyg. 0", "20:15, z posiłkiem potreningowym"),
    ("Kreatyna monohydrat", 3, "Obojętne", "Tak — posiłek potreningowy"),
    ("Omega-3", 2, "09:00 lub 21:00 (z posiłkiem tłuszczowym)", "09:00, ze śniadaniem"),
    ("Hydrolizat kolagenu", 2, "Codziennie. W dni treningowe 17:15 — dokładnie 60 min przed sesją. W dzień wolny dowolnie", "17:15 codziennie"),
    ("Melatonina", 1, "0,5–1 mg", "1 mg"),
    ("Cynk pikolinian", 2, "2 × w tygodniu czwartek i niedziela, ze śniadaniem", "07:00, na czczo, czwartek i niedziela"),
    ("Faza 0 wejściowa", 1, "1–3", "25.09–11.10"),   # D-086 (P-2)
    ("Faza 1 adaptacji", 1, "4–8", "12.10–15.11"),
    ("Faza 2 docelowa", 1, "9+", "od 16.11"),
    ("L-tauryna", 2, "17:15, przedtreningowo", "17:15, codziennie (także w czwartek)"),
]
# Zmiany w sekcjach prywatnych (s1, s21) — stosowane przez generator pakietu prywatnego
REPLACE_PRIVATE = [("Po odstawieniu suplementu cynku nie ma rutynowego wskazania", "Cynk jest kontynuowany 2×/tydz. — rutynowe badanie nie jest wymagane", "A2.7")]
# Zdania „Z posiłkiem, nie na czczo…” (A2.5) i uzasadnienie stacku (A2.3) -> sekcja „Pierwotne uzasadnienie” (D-050)
ORIGINAL_ONLY = [re.compile(r"^Cynk odchodzi, bo podaż łączna"), re.compile(r"^Stack finalny:")]
NOTE_BEFORE = {
    "Cynk odchodzi, bo podaż łączna": "Obowiązuje decyzja użytkownika (D-001, D-015, D-016): cynk kontynuowany 2×/tydz. (07:00, na czczo, czw. i nd.); glukozamina, chondroityna i Boswellia do wyczerpania zapasu (25.03.2027); tauryna codziennie o 17:15.",
    "Stack finalny:": "Plan dzienny: 17 dawek w 8 porach według SUPLEMENTACJI_2027. Cynk: czwartek i niedziela. Glukozamina, chondroityna, Boswellia: do 25.03.2027.",
}

norm = lambda t: re.sub(r"\s+", " ", t).strip()


def parse(path):
    soup = BeautifulSoup(open(path, encoding="utf8").read(), "html.parser")
    for t in soup(["style", "script"]):
        t.decompose()
    wrap = soup.find(id="s1").parent
    applied = {r[2] + ":" + r[0][:20]: 0 for r in REPLACE}
    applied.update({f"A2.9:{f}:{c}": 0 for f, c, _o, _n in TABLE_CELLS})
    sensitive = []

    def fix(text):
        t = norm(text)
        for old, new, rid, _n in REPLACE:
            if old in t:
                applied[rid + ":" + old[:20]] += 1
                t = t.replace(old, new)
        if SENSITIVE.search(t):
            parts = re.findall(r"[^.!?]+(?:[.!?]+|$)", t)
            for i, sent in enumerate(parts):
                s = sent.strip()
                if s and SENSITIVE.search(s):
                    if s not in sensitive:
                        sensitive.append(s)
                    parts[i] = f" {{private:{sensitive.index(s) + 1}}} "
            t = norm("".join(parts))
        return t

    sections, cur = [], None
    for el in wrap.children:
        if isinstance(el, Comment) or isinstance(el, NavigableString):
            continue
        cls = " ".join(el.get("class") or [])
        if el.name == "h2":
            num = el.find(class_="num")
            cur = {"id": el.get("id"), "num": norm(num.get_text()) if num else "", "title": norm(el.get_text(" ").replace(num.get_text(), "", 1) if num else el.get_text(" ")),
                   "private": el.get("id") in PRIVATE_SECTIONS, "blocks": []}
            sections.append(cur)
            continue
        if cur is None or cur["private"]:
            continue
        b = cur["blocks"]
        if el.name in ("h3", "h4"):
            b.append({"type": el.name, "text": fix(el.get_text(" "))})
        elif el.name == "p":
            txt = norm(el.get_text(" "))
            key = next((k for k in NOTE_BEFORE if txt.startswith(k)), None)
            if key:
                b.append({"type": "decision", "text": NOTE_BEFORE[key]})
                b.append({"type": "original", "text": fix(txt)})
            else:
                b.append({"type": "small" if "small" in cls else "p", "text": fix(txt)})
        elif el.name in ("ul", "ol"):
            b.append({"type": "list", "ordered": el.name == "ol", "items": [fix(li.get_text(" ")) for li in el.find_all("li", recursive=False)]})
        elif "tw" in cls:
            tb = el.find("table")
            rows = [[fix(c.get_text(" ")) for c in tr.find_all(["th", "td"])] for tr in tb.find_all("tr")]
            cap = el.find(class_="cap") or tb.find("caption")
            after = []
            for r in rows[1:]:
                for first, col, old, new in TABLE_CELLS:
                    if r and r[0].startswith(first) and col < len(r) and r[col] == old:
                        r[col] = new; applied[f"A2.9:{first}:{col}"] = 1
                for ci, c in enumerate(r):  # A2.5 także w komórkach tabel
                    if "Z posiłkiem, nie na czczo" in c:
                        head_, tail = c.split("Z posiłkiem, nie na czczo", 1)
                        r[ci] = head_.strip() + " Przyjmowany o 07:00, na czczo (SUPLEMENTACJA) — uzasadnienie pierwotne pod tabelą."
                        after.append({"type": "original", "text": f"{r[0]}: Z posiłkiem, nie na czczo{tail}"}); applied["A2.5:tabela"] = 1
            b.append({"type": "table", "head": rows[0], "rows": rows[1:], "caption": fix(cap.get_text(" ")) if cap else None})
            b.extend(after)
        elif cls.startswith("box"):
            kind = cls.split()[-1]
            lab = el.find(class_="lbl")
            body = norm(el.get_text(" ").replace(lab.get_text(), "", 1)) if lab else norm(el.get_text(" "))
            key = next((k for k in NOTE_BEFORE if body.startswith(k)), None)
            if key:
                b.append({"type": "decision", "text": NOTE_BEFORE[key]})
                b.append({"type": "original", "label": norm(lab.get_text()) if lab else None, "text": fix(body)})
            else:
                b.append({"type": "box", "kind": kind, "label": norm(lab.get_text()) if lab else None, "text": fix(body)})
        elif cls in ("day", "metrics") or el.name == "div":
            b.append({"type": "p", "text": fix(el.get_text(" "))})
    # A2.5: zdanie o przyjmowaniu cynku z posiłkiem -> „Pierwotne uzasadnienie”
    for s in sections:
        out = []
        for blk in s["blocks"]:
            if blk.get("type") in ("p", "box") and "Z posiłkiem, nie na czczo" in blk.get("text", ""):
                head, tail = blk["text"].split("Z posiłkiem, nie na czczo", 1)
                blk = {**blk, "text": head.strip() + " Przyjmowany o 07:00, na czczo, w czwartki i niedziele (SUPLEMENTACJA)."}
                out += [blk, {"type": "original", "text": "Z posiłkiem, nie na czczo" + tail}]
                applied["A2.5:zinc"] = 1
            else:
                out.append(blk)
        s["blocks"] = out
    return sections, applied, sensitive
