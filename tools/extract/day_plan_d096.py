"""D-096 (decyzje użytkownika 29.09.2026): weekendy w planie dnia, święta i przesunięty tydzień treningowy.

1. Weekendowe bloki 8:00–15:23 (sloty CFA A–G, system blokowy CFA z przerwami i posiłkami) — `week["blocks"][data]`:
   - studia podyplomowe (zjazdy 1–5): „Wycena przedsiębiorstwa i modelowanie finansowe - studia”; w soboty zjazdów bez zakupów 12:13–13:13;
   - 21–22.11 i 28–29.11.2026: „Przygotowywanie do rozmowy kwalifikacyjnej”;
   - pozostałe weekendy 12.12.2026–28.03.2027: „Pisanie pracy magisterskiej” — z wyjątkiem zjazdów, świąt (26–27.12, 27–28.03),
     dni z blokami P1–P7 planu MPW (6–7.03, 13–14.03, 20.03 — plan MPW ma pierwszeństwo) i dnia egzaminu MPW (21.03);
   - 21.03.2027: dzień egzaminu MPW (start 11:00).
2. Święta 26–27.12.2026 i 27–28.03.2027 — całkowicie wolne: bez bloków, bez treningu, sauny i basenu, dieta NT (`exceptions`).
3. Tydzień 28.09–04.10.2026 (tylko ten tydzień; od 05.10 plan tygodnia bez zmian): 28–29.09 bez treningu (dieta NT),
   30.09 UPPER 1 + sauna, 01.10 LOWER 1, 02.10 Rower + ABS, 03.10 2 × sauna (dieta NT), 04.10 basen bez zmian.
   UPPER 2 i LOWER 2 w tym tygodniu nie występują. Recall CFA i suplementacja bez zmian (dawki wg dni tygodnia).
Funkcja działa na danych po D-087 i D-094 (extract_schedule_safety.py)."""

from datetime import date, timedelta

STUDIA = "Wycena przedsiębiorstwa i modelowanie finansowe - studia"
ROZMOWA = "Przygotowywanie do rozmowy kwalifikacyjnej"
PRACA = "Pisanie pracy magisterskiej"

ZJAZDY = {1: ("2026-11-14", "2026-11-15"), 2: ("2026-12-05", "2026-12-06"), 3: ("2027-01-09", "2027-01-10"),
          4: ("2027-02-06", "2027-02-07"), 5: ("2027-02-20", "2027-02-21")}
ROZMOWA_DNI = ["2026-11-21", "2026-11-22", "2026-11-28", "2026-11-29"]
SWIETA = {"2026-12-26": "Boże Narodzenie", "2026-12-27": "Boże Narodzenie", "2027-03-27": "Wielkanoc", "2027-03-28": "Wielkanoc"}
MPW_P = ["2027-03-06", "2027-03-07", "2027-03-13", "2027-03-14", "2027-03-20"]   # plan MPW v8: P1–P7 8:00–15:23 (pierwszeństwo)
EGZAMIN_MPW = "2027-03-21"
PRACA_OD, PRACA_DO = "2026-12-12", "2027-03-28"

FREE = {"dayType": "free", "session": None, "sessionName": "Bez treningu", "sauna": 0, "diet": "NT"}
SESSIONS = {  # sesje z planu tygodnia (week.json → days) przeniesione na inne dni
    "pon": {"dayType": "strength_sauna", "session": "pon", "sessionName": "UPPER 1", "sauna": 1, "diet": "T"},
    "wt": {"dayType": "strength", "session": "wt", "sessionName": "LOWER 1", "sauna": 0, "diet": "T"},
    "sr": {"dayType": "cardio_sauna", "session": "sr", "sessionName": "Rower + ABS", "sauna": 1, "diet": "T"},
    "sauna2": {"dayType": "rest_sauna2", "session": None, "sessionName": "Bez treningu, 2 × sauna", "sauna": 2, "diet": "NT"},
}
TYDZIEN = {  # 28.09–03.10.2026; 04.10 (basen) bez zmian
    "2026-09-28": (FREE, "Wyjątek 28.09.2026: bez treningu (dieta NT); tydzień przesunięty — UPPER 1 + sauna w środę 30.09"),
    "2026-09-29": (FREE, "Wyjątek 29.09.2026: bez treningu (dieta NT); LOWER 1 w czwartek 01.10"),
    "2026-09-30": (SESSIONS["pon"], "Wyjątek 30.09.2026: UPPER 1 + sauna (przesunięte z poniedziałku)"),
    "2026-10-01": (SESSIONS["wt"], "Wyjątek 01.10.2026: LOWER 1 (przesunięte z wtorku)"),
    "2026-10-02": (SESSIONS["sr"], "Wyjątek 02.10.2026: Rower + ABS (przesunięte ze środy)"),
    "2026-10-03": (SESSIONS["sauna2"], "Wyjątek 03.10.2026: 2 × sauna bez treningu (dieta NT; przesunięte z czwartku)"),
}


def _weekends(start, end):
    d, last = date.fromisoformat(start), date.fromisoformat(end)
    while d <= last:
        if d.isoweekday() >= 6:
            yield d.isoformat()
        d += timedelta(days=1)


def blocks():
    """Bloki weekendowe 8:00–15:23 wg daty (sloty CFA A–G)."""
    out = {}
    for n, days in ZJAZDY.items():
        for d in days:
            out[d] = {"kind": "studia", "title": STUDIA, "short": "Studia 8:00–15:23", "desc": f"Studia podyplomowe — zjazd {n}", "decision": "D-096"}
    for d in ROZMOWA_DNI:
        out[d] = {"kind": "rozmowa", "title": ROZMOWA, "short": "Rozmowa kwalifikacyjna 8:00–15:23", "desc": "", "decision": "D-096"}
    for d in _weekends(PRACA_OD, PRACA_DO):
        if d in out or d in SWIETA or d in MPW_P or d == EGZAMIN_MPW:
            continue
        out[d] = {"kind": "praca", "title": PRACA, "short": "Praca magisterska 8:00–15:23", "desc": "", "decision": "D-096"}
    for d, name in SWIETA.items():
        out[d] = {"kind": "wolne", "title": "Wolne", "short": f"{name} — wolne", "desc": f"{name} — dzień całkowicie wolny", "decision": "D-096"}
    out[EGZAMIN_MPW] = {"kind": "egzamin", "title": "Egzamin MPW", "short": "Egzamin MPW 11:00",
                        "desc": "Egzamin na Maklera Papierów Wartościowych — start 11:00 (120 pytań, 180 minut)", "decision": "D-096"}
    return dict(sorted(out.items()))


def apply_week_d096(week):
    exc = week.setdefault("exceptions", {})
    for d, (plan, note) in TYDZIEN.items():
        exc[d] = {"decision": "D-096", **plan, "note": note}
    for d, name in SWIETA.items():
        exc[d] = {"decision": "D-096", **FREE, "note": f"{name}: dzień całkowicie wolny — bez bloków i treningu (dieta NT)", "variant": None}
    week["exceptions"] = dict(sorted(exc.items()))
    week["blocks"] = blocks()
    week["blocks_decision"] = ("D-096: weekendy 8:00–15:23 w slotach A–G — studia (zjazdy, bez zakupów w sobotę), przygotowanie do rozmowy, "
                               "praca magisterska; święta wolne; dni z blokami P1–P7 planu MPW i egzamin MPW bez pracy magisterskiej")
    return week
