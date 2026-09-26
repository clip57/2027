"""D-087 (decyzja użytkownika 25.09.2026): plan CFA v5 (421 bloków) i wyjątki dni.
- Soboty (poza sobotą z mockiem, 07.11): blok E 12:20–13:13 wolny; w planie dnia 12:13–13:13 „Zakupy” (wg listy w Zapasach)
  zamiast przerwy kognitywnej 12:13–12:20 i bloku E. Druga kawa (12:20) bez zmian; przerwa na lunch 13:13–13:30 bez zmian.
- 25.09 i 26.09.2026 — wyjątki usunięte (D-090, 26.09.2026): plan zaczyna się 27.09.2026, dni wcześniejsze są poza planem (D-088).
- 27.09.2026 (niedziela): zamiast basenu dzień sauny jak czwartek — bez treningu, 2 × sauna, dieta NT.
Funkcje działają na danych po D-086 (extract_schedule_safety.py)."""


def saturday_variant(slots):
    """Wariant szablonu dnia „zakupy”: sloty zastępowane i slot zakupów (Druga kawa przeniesiona z bloku E)."""
    by_id = {s["id"]: s for s in slots}
    brk, e = by_id.get("slot.1213"), by_id.get("slot.1220")
    if not brk or not e or (brk["from"], brk["to"], e["from"], e["to"], e["key"]) != ("12:13", "12:20", "12:20", "13:13", "E"):
        raise ValueError("D-087: oczekiwano slotów 12:13–12:20 (przerwa) i 12:20–13:13 (blok E) z D-086")
    coffee = [x for x in e["items"] if x["src"].startswith("Druga Kawa")]
    if len(coffee) != 1:
        raise ValueError("D-087: brak podpunktu „Druga Kawa” w bloku E")
    task = "Zakupy według listy „Do kupienia” w module Zapasy"
    return {"decision": "D-087", "replaces": ["slot.1213", "slot.1220"],
            "slots": [{"id": "slot.1213z", "from": "12:13", "to": "13:13", "domain": "prep", "title_src": "Zakupy",
                       "badges_src": ["Zakupy"], "desc_src": "", "role": "static", "key": None,
                       "items": [{"kind": "task", "src": task, "text": task, "decision": "D-087"}, *coffee], "decision": "D-087"}]}


# Typ dnia „wolny”: okno treningowe bez zajęć (dni poza planem, D-088; dawniej 25.09.2026)
ACTIVITY_FREE = {"warmup": "Wolne", "main": "Wolne", "sauna": "Wolne"}

EXCEPTIONS = {
    "2026-09-27": {"decision": "D-087", "dayType": "rest_sauna2", "session": None, "sessionName": "Bez treningu, 2 × sauna",
                   "sauna": 2, "diet": "NT", "note": "Wyjątek 27.09.2026: zamiast basenu dzień sauny (bez treningu, dieta NT)"},
}


def apply_week_d087(week):
    week["days"]["6"]["variant"] = "zakupy"
    week["variant_decision"] = "D-087: soboty — 12:13–13:13 zakupy (bez bloku E); nie dotyczy dnia mocka"
    week["activity"]["free"] = dict(ACTIVITY_FREE)
    week["exceptions"] = {d: dict(x) for d, x in EXCEPTIONS.items()}
    return week
