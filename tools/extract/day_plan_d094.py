"""D-094 (decyzja użytkownika 28.09.2026): niedziela z basenem — wariant szablonu dnia „basen”.
- 18:15–19:30 basen (zamiast 18:15–19:35), 19:30–19:45 powrót do domu i posiłek potreningowy o 19:30,
  19:45–20:15 relaks, 20:15–20:45 prysznic całego ciała i pielęgnacja ciała (moduł Pielęgnacja) — zamiast prysznica na siłowni,
  sauny/wolnego, chłodzenia, powrotu z posiłkiem o 20:15 i wieczornego mycia głowy. Od 20:45 bez zmian.
- Wyjątek 27.09.2026 (dzień sauny, D-087) — bez wariantu.
Bez nazw produktów: treść planu pielęgnacji jest wyłącznie w danych użytkownika (D-035). Funkcje działają na danych po D-086/D-087."""

REPLACES = ["slot.1815", "slot.1935", "slot.1945", "slot.2005", "slot.2015", "slot.2035"]


def sunday_variant(slots):
    """Wariant „basen”: sloty zastępowane (ciągłe 18:15–20:45) i nowe sloty niedzieli."""
    by_id = {s["id"]: s for s in slots}
    got = [(by_id[i]["from"], by_id[i]["to"]) for i in REPLACES if i in by_id]
    want = [("18:15", "19:35"), ("19:35", "19:45"), ("19:45", "20:05"), ("20:05", "20:15"), ("20:15", "20:35"), ("20:35", "20:45")]
    if got != want:
        raise ValueError(f"D-094: oczekiwano slotów 18:15–20:45 z D-086, są {got}")
    main, post = by_id["slot.1815"], by_id["slot.2015"]
    if post["key"] != "post" or post["role"] != "meal":
        raise ValueError("D-094: slot 20:15 nie jest posiłkiem potreningowym")
    shower = "Prysznic całego ciała i pielęgnacja ciała (moduł Pielęgnacja)"
    slot = lambda **k: {"desc_src": "", "items": [], "key": None, "decision": "D-094", **k}
    return {"decision": "D-094", "replaces": list(REPLACES), "slots": [
        slot(id="slot.1815n", **{"from": "18:15", "to": "19:30"}, domain=main["domain"], title_src=main["title_src"],
             badges_src=list(main["badges_src"]), role="activity", key="main"),
        slot(id="slot.1930n", **{"from": "19:30", "to": "19:45"}, domain=post["domain"], title_src="Powrót do domu",
             badges_src=list(post["badges_src"]), role="meal", key="post",
             items=[{"kind": "meal", "src": "Posiłek potreningowy (19:30)", "text": "Posiłek potreningowy (19:30)", "meal": "post",
                     "time": "19:30", "decision": "D-094"}]),
        slot(id="slot.1945n", **{"from": "19:45", "to": "20:15"}, domain="regen", title_src="Relaks", badges_src=["Relaks"], role="static"),
        slot(id="slot.2015n", **{"from": "20:15", "to": "20:45"}, domain="regen", title_src="Prysznic całego ciała", badges_src=["Higiena"],
             role="static", items=[{"kind": "task", "src": shower, "text": shower, "decision": "D-094"}]),
    ]}


def apply_week_d094(week):
    week["days"]["7"]["variant"] = "basen"
    week["variant_decision"] = ("D-087: soboty — 12:13–13:13 zakupy (bez bloku E); D-094: niedziele — basen 18:15–19:30, posiłek 19:30, "
                                "relaks, prysznic całego ciała 20:15–20:45; nie dotyczy dnia mocka")
    for x in week.get("exceptions", {}).values():
        x["variant"] = None   # wyjątek daty (np. 27.09.2026 — dzień sauny) bez wariantu dnia tygodnia
    return week


def apply_supplements_d094(doses):
    """Niedziela z basenem: posiłek potreningowy o 19:30, więc kreatyna (przyjmowana z tym posiłkiem) w niedzielę o 19:30,
    w pozostałe dni bez zmian o 20:15 (decyzja użytkownika 28.09.2026). Ilość i opis dawki bez zmian (D-001)."""
    out = []
    for d in doses:
        if d["supp"] == "kreatyna" and d["time"] == "20:15" and 7 in d["weekdays"]:
            out.append({**d, "weekdays": [w for w in d["weekdays"] if w != 7]})
            out.append({**d, "time": "19:30", "weekdays": [7],
                        "src": f"{d['src']} (D-094: niedziela 19:30)", "decision": "D-094"})
        else:
            out.append(d)
    return out
