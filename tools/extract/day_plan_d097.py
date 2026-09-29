"""D-097 (decyzje użytkownika 29.09.2026): zakupy w czwartki, Dzień zero, koniec planu 28.03.2027.

1. Zakupy w czwartki po saunie (zamiast sobót 12:13–13:13 — plan CFA v12 odzyskuje blok E w sobotę):
   - do 06.01.2027 (wariant „czwartek”): 17:45–17:55 transport, 17:55–19:05 sauna (z przygotowaniem i prysznicem),
     19:05–20:35 zakupy; posiłek po saunie i kreatyna bez zmian o 20:15 (w czasie slotu zakupów); od 20:35 bez zmian;
   - od 07.01.2027 (wariant „czwartek_st”, wyjątki dat): 15:30–16:00 zakupy, bloki MPW 30 min później (A 16:00, B 17:00,
     C 18:00–18:53 — przesunięcie w `week.mpwShift`, dane planu MPW bez zmian), obiad 16:53, suplementy przed sauną 17:45,
     transport 18:53–19:05, sauna 19:05–20:15, powrót i posiłek po saunie 20:15–20:35 jak dotąd;
   - w tygodniu 28.09–04.10.2026 bez zakupów (czwartek 01.10 — LOWER 1, sobota 03.10 — 2 × sauna).
2. Dzień zero 29.09.2026: start planu — bez diety, treningu, nauki i suplementów (pielęgnacja tak). Plan do 28.03.2027
   (180 dni od 30.09); Faza 0 od 30.09; preparaty czasowe (D-015) 30.09.2026–28.03.2027.
Funkcje działają na danych po D-086, D-087, D-094 i D-096."""

THU_FROM = "2027-01-07"
PLAN = {"zero": "2026-09-29", "phase0": "2026-09-30", "end": "2027-03-28"}
SUPP_FROM, SUPP_UNTIL = "2026-09-30", "2027-03-28"
SHOP_TASK = "Zakupy według listy „Do kupienia” w module Zapasy"


def _slot(id_, frm, to, domain, title, role="static", key=None, items=(), badges=(), **k):
    return {"id": id_, "from": frm, "to": to, "domain": domain, "title_src": title, "badges_src": list(badges), "desc_src": "",
            "role": role, "key": key, "items": list(items), "decision": "D-097", **k}


def _task(text):
    return {"kind": "task", "src": text, "text": text, "decision": "D-097"}


def thursday_variants(slots):
    by_id = {s["id"]: s for s in slots}
    evening = ["slot.1745", "slot.1805", "slot.1815", "slot.1935", "slot.1945", "slot.2005", "slot.2015"]
    got = [(by_id[i]["from"], by_id[i]["to"]) for i in evening]
    if got[0] != ("17:45", "18:05") or got[-1] != ("20:15", "20:35"):
        raise ValueError(f"D-097: oczekiwano slotów 17:45–20:35 z D-086, są {got}")
    post = by_id["slot.2015"]["items"][0]
    if post.get("meal") != "post" or post.get("time") != "20:15":
        raise ValueError("D-097: brak posiłku potreningowego 20:15")
    sid = lambda frm, sfx: f"slot.{frm.replace(':', '')}{sfx}"   # „c” — czwartek do 06.01, „j” — od 07.01
    sauna = lambda frm, to, sfx: _slot(sid(frm, sfx), frm, to, "train", "Sauna", role="activity", key="main",
                                  items=[_task("Przygotowanie, rundy sauny i prysznic w czasie sauny")], badges=["SAUNA"])
    transport = lambda frm, to, sfx: _slot(sid(frm, sfx), frm, to, "train", "Transport na siłownię",
                                      badges=["Dojazd"])
    shop = lambda frm, to, sfx, extra=(): _slot(sid(frm, sfx), frm, to, "prep", "Zakupy", items=[_task(SHOP_TASK), *extra],
                                           badges=["Zakupy"], shop=True)
    until_jan = {"decision": "D-097", "replaces": evening, "slots": [
        transport("17:45", "17:55", "c"), sauna("17:55", "19:05", "c"),
        shop("19:05", "20:35", "c", [dict(post, decision="D-097")]),   # posiłek po saunie o 20:15 bez zmian (decyzja użytkownika)
    ]}
    # Od 07.01: zakupy 15:30, bloki MPW i obiad 30 min później, sauna po bloku C; od 20:15 bez zmian
    afternoon = ["slot.1530", "slot.1623", "slot.1640", "slot.1733", *evening[:-1]]
    dinner = by_id["slot.1623"]
    if dinner["key"] != "dinner" or dinner["from"] != "16:23":
        raise ValueError("D-097: brak przerwy obiadowej 16:23")
    mpw = lambda key, frm, to: _slot(sid(frm, "j"), frm, to, "cfa", f"Blok MPW {key}", role="cfa", key=key,
                                     badges=["MPW"], mpwSlot=True)
    from_jan = {"decision": "D-097", "replaces": afternoon, "slots": [
        shop("15:30", "16:00", "j"),
        mpw("A", "16:00", "16:53"),
        _slot("slot.1653j", "16:53", "17:00", "diet", "Przerwa obiadowa", role="meal", key="dinner", badges=list(dinner["badges_src"]),
              items=[{"kind": "meal", "src": "Obiad (16:53)", "text": "Obiad (16:53)", "meal": "dinner", "time": "16:53", "decision": "D-097"}]),
        mpw("B", "17:00", "17:53"),
        _slot("slot.1753j", "17:53", "18:00", "regen", "Przerwa kognitywna", badges=["Przerwa"]),
        mpw("C", "18:00", "18:53"),
        transport("18:53", "19:05", "j"), sauna("19:05", "20:15", "j"),
    ]}
    return {"czwartek": until_jan, "czwartek_st": from_jan}


def apply_template_d097(template):
    template["variants"].pop("zakupy", None)   # soboty bez zakupów — blok E wraca (plan CFA v12)
    template["variants"].update(thursday_variants(template["slots"]))
    return template


def apply_week_d097(week):
    from datetime import date, timedelta
    week["days"]["6"].pop("variant", None)
    week["days"]["4"]["variant"] = "czwartek"
    exc = week.get("exceptions", {})
    for d in ("2026-09-27", "2026-09-28", "2026-09-29"):   # przed Dniem zero lub Dzień zero (D-097)
        exc.pop(d, None)
    if "2026-10-01" in exc:
        exc["2026-10-01"]["variant"] = None                  # LOWER 1 w czwartek — bez sauny i zakupów
    d, end = date.fromisoformat(THU_FROM), date.fromisoformat(PLAN["end"])
    while d <= end:
        k = d.isoformat()
        if k in exc:
            raise ValueError(f"D-097: czwartek {k} ma już wyjątek")
        exc[k] = {"decision": "D-097", "variant": "czwartek_st"}
        d += timedelta(days=7)
    week["exceptions"] = dict(sorted(exc.items()))
    week["mpwShift"] = {"weekdays": [4], "from": THU_FROM, "minutes": 30, "decision": "D-097"}
    week["variant_decision"] = ("D-097: czwartki — sauna 17:55–19:05 i zakupy 19:05–20:35, od 07.01 zakupy 15:30–16:00 i bloki MPW +30 min; "
                                "soboty bez zakupów; D-094: niedziele — basen 18:15–19:30, posiłek 19:30, relaks, prysznic 20:15–20:45; "
                                "nie dotyczy dnia mocka")
    return week


def apply_phases_d097(phases):
    phases["start"] = PLAN["zero"]
    phases["zero"] = PLAN["zero"]
    phases["end"] = PLAN["end"]
    phases["phases"][0]["from"] = PLAN["phase0"]
    phases["decision"] = ("D-017, D-097 (Dzień zero 29.09.2026 — bez diety, treningu, nauki i suplementów; Faza 0 od 30.09; "
                          "plan do 28.03.2027; dni wcześniejsze i późniejsze poza planem, D-088)")
    return phases


def apply_supplements_d097(doses):
    """Preparaty czasowe (D-015) 30.09.2026–28.03.2027 (180 dni: 180 kaps. boswellii, 360 chondroityny, 180 glukozaminy).
    Suplementy przed sauną w czwartki od 07.01.2027 o 17:45 zamiast 17:15 (obiad i bloki MPW 30 min później)."""
    out = []
    for d in doses:
        if d.get("validity", {}).get("decision") == "D-015":
            d = {**d, "validity": {**d["validity"], "from": SUPP_FROM, "until": SUPP_UNTIL}}
        if d["time"] == "17:15" and 4 in d["weekdays"] and not d.get("validity"):
            rest = [w for w in d["weekdays"] if w != 4]
            if rest:
                out.append({**d, "weekdays": rest})
            out.append({**d, "weekdays": [4], "validity": {"until": "2027-01-06", "decision": "D-097"}})
            out.append({**d, "weekdays": [4], "time": "17:45", "validity": {"from": THU_FROM, "until": SUPP_UNTIL, "decision": "D-097"},
                        "src": f"{d.get('src', '')} (D-097: czwartek od 07.01 — 17:45)", "decision": "D-097"})
            continue
        out.append(d)
    return out
