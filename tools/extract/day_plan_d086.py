"""D-086 (decyzja użytkownika 25.09.2026): rozkład dnia z 9 blokami CFA po 53 min (plan CFA „MASTER SCHEDULE FINAL”).
Slot „Długa przerwa” 12:13–13:30 z PLAN_DNIA (druga kawa, spacer regeneracyjny, lunch) zastąpiony trzema slotami:
  12:13–12:20 przerwa kognitywna · 12:20–13:13 CFA blok E (druga kawa 12:20) · 13:13–13:30 przerwa na lunch (lunch 13:20).
Spacer regeneracyjny odpada; kolejne bloki CFA dostają następne litery (13:30 F, 14:30 G, 15:30 H, 16:40 I).
Pozostałe godziny bez zmian (D-004). Funkcja działa na slotach już podzielonych na podpunkty (extract_schedule_safety.py)."""

LETTERS = "ABCDEFGHI"


def apply_d086(slots):
    i = next(k for k, s in enumerate(slots) if s["from"] == "12:13")
    long = slots[i]
    if (long["to"], long["role"], long["key"]) != ("13:30", "meal", "lunch"):
        raise ValueError(f"D-086: oczekiwano slotu „Długa przerwa” 12:13–13:30, jest {long['from']}–{long['to']} {long['title_src']}")
    coffee = [x for x in long["items"] if x["src"].startswith("Druga Kawa")]
    walk = [x for x in long["items"] if x["src"].startswith("Spacer regeneracyjny")]
    if len(coffee) != 1 or len(walk) != 1:
        raise ValueError("D-086: brak podpunktów „Druga Kawa” / „Spacer regeneracyjny” w slocie 12:13")
    lunch = [x for x in long["items"] if x not in coffee and x not in walk]
    slots[i:i + 1] = [
        {"id": "slot.1213", "from": "12:13", "to": "12:20", "domain": "regen", "title_src": "Przerwa kognitywna",
         "badges_src": ["Regeneracja"], "desc_src": "", "role": "static", "key": None, "items": [], "decision": "D-086"},
        {"id": "slot.1220", "from": "12:20", "to": "13:13", "domain": "cfa", "title_src": "CFA BLOK E",
         "badges_src": [], "desc_src": "· Druga Kawa (12:20)", "role": "cfa", "key": "E", "items": coffee, "decision": "D-086"},
        {"id": "slot.1313", "from": "13:13", "to": "13:30", "domain": "diet", "title_src": "Przerwa na lunch",
         "badges_src": long["badges_src"], "desc_src": "· Lunch (13:20) · Siarczan glukozaminy", "role": "meal", "key": "lunch",
         "items": lunch, "decision": "D-086"},
    ]
    cfa = [s for s in slots if s["role"] == "cfa"]
    if len(cfa) != len(LETTERS):
        raise ValueError(f"D-086: oczekiwano 9 slotów CFA, jest {len(cfa)}")
    for n, s in enumerate(cfa):   # litery i znaczniki „n/9” — wszystkie sloty CFA różnią się od PLAN_DNIA („n/8”)
        s["key"], s["title_src"], s["badges_src"] = LETTERS[n], f"CFA BLOK {LETTERS[n]}", [f"CFA Blok {n + 1}/{len(cfa)}"]
        s["decision"] = "D-086"
    return slots
