"""D-105 (czytelność arkuszy treningu): zamienia spłaszczone teksty z `training.json` (jedna linijka z HTML-a TRENING.html) na dane ustrukturyzowane, z których widok Trening rysuje
tabele, listy i ostrzeżenia:
- `sheetsData`   — „System kolana” (kryteria × zielone/żółte/czerwone, co robić, alarm, wskazówka) i „Sauna” (zasady, kroki przed / w kabinie / po, dni treningowe, czwartek 2 rundy, notatki);
- `warmupData`, `cooldownData` — numerowane ćwiczenia (nazwa, nazwa angielska, dawka);
- `dayNotes`     — nagłówki i opisy SESJI NASTĘPNEGO DNIA, które ekstrakcja z HTML-a dokleiła na końcu schłodzenia poprzedniego dnia (np. notatka „akcent kolanowy” wtorku siedziała w schłodzeniu
                   poniedziałku); trafiają do właściwego dnia (wt, sr, czw, pt, sob).
Brak utraty treści: każda struktura jest składana z powrotem w jedną linię i musi dać dokładnie oryginał (po zdekodowaniu `&gt;` i normalizacji spacji) — inaczej skrypt przerywa pracę.
Teksty oryginalne (`sheets`, `warmup`, `cooldown`) zostają w pliku bez zmian (źródło prawdy dla generatora). Uruchamiać PO `extract_static.mjs`. Skrypt jest idempotentny.
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
TR = ROOT / "src/data/training.json"
LV = {"green": "🟢", "yellow": "🟡", "red": "🔴"}


def norm(s):
    s = html.unescape(s)
    s = re.sub(r"\s+([.,;:])", r"\1", s)     # spacja przed kropką po tagu HTML („prysznicem . Bez”)
    return re.sub(r"\s+", " ", s).strip()


# ---------------------------------------------------------------- arkusze (struktura ręcznie zweryfikowana z oryginałem, kontrola fidelności niżej)
KNEE = {
    "id": "kolano", "icon": "🦵", "title": "System kolana", "kind": "traffic",
    "levels": [{"id": "green", "label": "Zielone"}, {"id": "yellow", "label": "Żółte"}, {"id": "red", "label": "Czerwone"}],
    "criteria": [
        {"name": "Ból w trakcie", "green": "0–3/10, stabilny", "yellow": "3–5/10", "red": ">5/10 lub rośnie"},
        {"name": "Ból po (24 h)", "green": "wraca do wyjścia", "yellow": "podwyższony, mija do wieczora", "red": "trwa >24 h"},
        {"name": "Obrzęk", "green": "brak", "yellow": "minimalny", "red": "wyraźny / nawrotowy"},
        {"name": "„Luz\" / niestabilność", "green": "brak", "yellow": "rzadkie, bez uginania", "red": "epizod uginania"},
        {"name": "Trend tygodniowy", "green": "stabilny / lepszy", "yellow": "plateau", "red": "gorszy"},
    ],
    "actions": [
        {"level": "green", "text": "Progresuj normalnie — zakres i obciążenie wg planu dnia."},
        {"level": "yellow", "text": "Zatrzymaj obciążenie i zakres. Powtórz sesję identycznie, bez progresji."},
        {"level": "red", "text": "−30–50% obciążenia lub mniejszy zakres. Utrzymuje się >2 sesje → fizjoterapeuta."},
    ],
    "alert": {"title": "Konsultacja natychmiast, bez czekania", "items": ["Obrzęk stawu", "zablokowanie", "rzeczywisty epizod uginania", "ból nocny"]},
    "tip": "Rozgrzewka LOWER: zapisz ból wyjściowy 0–10 przed 1. serią roboczą. To punkt odniesienia na dziś.",
}

SAUNA = {
    "id": "sauna", "icon": "♨️", "title": "Sauna", "kind": "protocol",
    "summary": [
        {"label": "Kiedy", "value": "5×/tydz. Pon·Śr·Cz×2·Sob.", "note": "Zawsze po treningu, nigdy przed"},
        {"label": "Czas", "value": "20 min", "note": "Stała długość, nie zakres"},
        {"label": "Temperatura", "value": "80–100°C", "note": "Ta, którą ma obiekt — bez znaczenia dokładna wartość"},
        {"label": "Koniec", "value": "−1,5 h", "note": "Najpóźniej tyle przed snem"},
    ],
    "phases": [
        {"name": "Przed", "steps": [
            {"label": "30 min przed", "text": "250–500 ml wody. Nie tuż po obfitym posiłku"},
            {"label": "Prysznic przed — z mydłem, całe ciało", "text": "Woda ciepła. Potem wytrzyj się do sucha"},
            {"label": "Przed wejściem", "text": "Zdejmij metal i biżuterię. Ręcznik do siedzenia"}]},
        {"name": "Sauna", "steps": [
            {"label": "W kabinie — 20 min", "text": "Niższa ławka, jeśli za intensywnie"},
            {"label": "Wyjście awaryjne", "text": "Zawroty głowy / nudności / kołatanie serca → wyjdź od razu", "alert": True}]},
        {"name": "Po saunie", "steps": [
            {"label": "Wychłodzenie — 10–15 min", "text": "Chłodne miejsce, spoczynek, 250–500 ml wody. Nie od razu pod prysznic"},
            {"label": "Prysznic po — bez mydła", "text": "Woda letnia do chłodnej"},
            {"label": "Po prysznicu", "text": "500–750 ml wody. Balsam teraz, nie wcześniej"}]},
    ],
    "trainingDays": {"label": "Pon / Śr / Sob — dni treningowe", "lines": [
        "Wychładzaj się chłodnym powietrzem i letnim prysznicem.",
        "Bez zimnej kąpieli / morsowania — tłumi hipertrofię w tym oknie czasowym.",
        "W czwartek (dzień wolny) kontrast jest bez problemu."]},
    "thursday": {"label": "Czwartek, 2 rundy", "steps": [
        "prysznic z mydłem", "20′", "wychłodzenie 10–15′ + 250–500 ml", "20′", "wychłodzenie 10–15′", "prysznic bez mydła", "500–750 ml"],
        "total": "Razem ~70–80 min."},
    "notes": ["Po każdej sesji: uzupełnij płyny i sód.", "Nie mierz BIA po saunie ani treningu."],
}


def flat_knee(s):
    parts = [f"{s['icon']} {s['title']} ✕", " ".join(f"{LV[l['id']]} {l['label']}" for l in s["levels"])]
    parts += [f"{c['name']} {c['green']} {c['yellow']} {c['red']}" for c in s["criteria"]]
    parts += [f"{LV[a['level']]} {a['text']}" for a in s["actions"]]
    parts += [f"{s['alert']['title']} {' · '.join(s['alert']['items'])}.", s["tip"]]
    return " ".join(parts)


def flat_sauna(s):
    parts = [f"{s['icon']} {s['title']} ✕"] + [f"{x['label']} {x['value']} {x['note']}" for x in s["summary"]]
    parts += [f"{st['label']} {st['text']}" for ph in s["phases"] for st in ph["steps"]]
    parts += [f"{s['trainingDays']['label']} {' '.join(s['trainingDays']['lines'])}",
              f"{s['thursday']['label']}: {' → '.join(s['thursday']['steps'])}. {s['thursday']['total']}", " ".join(s["notes"])]
    return " ".join(parts)


# ---------------------------------------------------------------- rozgrzewka i schłodzenie
UP = "A-ZĄĆĘŁŃÓŚŹŻ"
TAIL = re.compile(rf"\s(?=(?:LOWER|UPPER) \d|Rower \+ ABS|😌 )")


def parse_phase(text, kind):
    """„Rozgrzewka 10 min ▾ 1 Nazwa (Name) dawka 2 …” → {title, minutes, items[{n, name, en, dose}]} + ogon (tekst następnego dnia)."""
    s = norm(text)
    m = re.match(r"^(?P<title>[^\d▾]+?) (?P<min>\d+) min ▾ (?P<rest>.*)$", s)
    if not m:
        raise SystemExit(f"{kind}: nie rozpoznano nagłówka: {s[:80]}")
    rest, tail = m["rest"], ""
    if kind == "warmup":
        assert rest.endswith(" Trening"), s[-40:]
        rest = rest[: -len(" Trening")]
    else:
        t = TAIL.search(rest)
        if t:
            rest, tail = rest[: t.start()], rest[t.end():]
    pos, items, n = 0, [], 1
    starts = []
    while True:
        mm = re.compile(rf"(?:^|\s){n} (?=[{UP}])").search(rest, pos)
        if not mm:
            break
        starts.append((n, mm.end())); pos = mm.end(); n += 1
    assert starts and starts[0][0] == 1, s[:90]
    for i, (num, st) in enumerate(starts):
        end = starts[i + 1][1] - len(f"{num + 1} ") - 1 if i + 1 < len(starts) else len(rest)
        chunk = rest[st:end].strip()
        im = re.match(r"^(?P<name>.+?) \((?P<en>[^()]+)\)(?: (?P<dose>.+))?$", chunk)
        items.append({"n": num, "name": im["name"], "en": im["en"], "dose": im["dose"] or ""} if im else {"n": num, "name": chunk, "en": "", "dose": ""})
    return {"title": m["title"], "minutes": int(m["min"]), "items": items}, tail


def flat_phase(p, with_trening):
    body = " ".join(f"{i['n']} {i['name']}" + (f" ({i['en']})" if i["en"] else "") + (f" {i['dose']}" if i["dose"] else "") for i in p["items"])
    return f"{p['title']} {p['minutes']} min ▾ {body}" + (" Trening" if with_trening else "")


# ---------------------------------------------------------------- notatki następnego dnia (ogony schłodzenia) — struktura ręcznie zweryfikowana z oryginałem
DAY_NOTES = {
    "wt": {"label": "Akcent kolanowy", "title": "LOWER 1 18:05–19:35 · akcent kolanowy",
           "note": "Przed pierwszą serią: zapisz wyjściowy ból kolana 0–10. Sprawdzaj światła (🦵 u góry) po każdym ćwiczeniu."},
    "sr": {"label": "Rower — struktura sesji", "title": "Rower + ABS", "meta": "55 min rower · sauna po", "device": "Rower stacjonarny (Stationary Bike)",
           "phases": [{"name": "Rozgrzewka", "minutes": 5, "text": "Niski opór, dochodzenie do strefy"},
                      {"name": "Właściwa część", "minutes": 45, "text": "65–70% HRmax (~125–135 bpm), siodełko wyżej niż intuicyjnie"},
                      {"name": "Schłodzenie", "minutes": 5, "text": "Redukcja oporu"}],
           "heading": "ABS"},
    "czw": {"title": "😌 Dzień wolny od treningu",
            "text": "2 sesje sauny po 20 min, jedna wizyta, dwie rundy z wychłodzeniem między nimi. Szczegóły protokołu: przycisk ♨️ u góry. Kolagen i witamina C — dowolna pora. Tauryna odpada."},
    "pt": {"title": "UPPER 2 18:05–19:35"},
    "sob": {"label": "Biodro / tylny łańcuch", "title": "LOWER 2 18:05–19:35 · biodro/tylny łańcuch · sauna po",
            "note": "Mniejsza dominacja kolanowa niż LOWER 1 — jeśli wtorek sprawił trudność, sobota zwykle nadal będzie tolerowana. Sprawdzaj światła (🦵)."},
}
# który ogon schłodzenia z którego dnia niesie które notatki (kolejność tekstu w ogonie)
TAIL_NOTES = {"pon": ["wt"], "wt": ["sr"], "sr": ["czw", "pt"], "pt": ["sob"]}


def flat_note(k):
    n = DAY_NOTES[k]
    if k == "sr":
        ph = " ".join(f"{p['name']} {p['minutes']} min {p['text']}" for p in n["phases"])
        return f"{n['title']} {n['meta']} {n['device']} {ph} {n['heading']}"
    return " ".join(n[x] for x in ("title", "note", "text") if x in n)


def main():
    t = json.loads(TR.read_text(encoding="utf-8"))
    raw = {s.split("✕")[0].strip(): s for s in t["sheets"] if len(s) > 5}
    src_knee, src_sauna = raw["🦵 System kolana"], raw["♨️ Sauna"]
    assert norm(flat_knee(KNEE)) == norm(src_knee), "System kolana: struktura nie odtwarza oryginału"
    assert norm(flat_sauna(SAUNA)) == norm(src_sauna), "Sauna: struktura nie odtwarza oryginału"

    warm, cool, tails = {}, {}, {}
    for k, kind, dst in (("warmup", "warmup", warm), ("cooldown", "cooldown", cool)):
        for day, text in t[k].items():
            if not text:
                continue
            p, tail = parse_phase(text, kind)
            assert norm(flat_phase(p, kind == "warmup") + (" " + tail if tail else "")) == norm(text), f"{k}/{day}: struktura nie odtwarza oryginału"
            dst[day] = p
            if tail:
                tails[day] = tail
    for day, tail in tails.items():
        assert norm(" ".join(flat_note(k) for k in TAIL_NOTES[day])) == norm(tail), f"ogon schłodzenia {day}: notatki nie odtwarzają oryginału"
    assert set(tails) == set(TAIL_NOTES), (set(tails), set(TAIL_NOTES))

    t["sheetsData"] = [KNEE, SAUNA]
    t["warmupData"] = warm
    t["cooldownData"] = cool
    t["dayNotes"] = DAY_NOTES
    TR.write_text(json.dumps(t, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"training.json: sheetsData {len(t['sheetsData'])}, warmupData {len(warm)}, cooldownData {len(cool)}, dayNotes {len(DAY_NOTES)} — struktura odtwarza oryginał")


if __name__ == "__main__":
    main()
