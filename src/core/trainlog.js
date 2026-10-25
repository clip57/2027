// Dziennik szczegółów sesji treningowej (D-106): basen, rower i sauna wg protokołów z Rekompozycji (sekcje Basen, Cardio, Sauna).
// D-111: sekcja „Kolano” usunięta (decyzja użytkownika 25.10.2026) — dawne wpisy `knee` zostają w dzienniku zdarzeń, nie są pokazywane
// ani liczone, a przy kolejnym zapisie dnia przechodzą dalej jak sekcja nieznana (withValue nie usuwa sekcji spoza definicji).
// Jedna definicja pól dla widoku i walidacji zdarzenia `train.detail` (jeden dokument na dzień, „ostatni zapis wygrywa”):
//   { date, swim?: {…}, bike?: {…}, sauna?: {…}, note? }
// Wszystkie pola są opcjonalne. Nic tu nie jest oceną ani metryką — tylko zapis wpisów.

const num = (label, min, max, step, extra = {}) => ({ type: 'num', label, min, max, step, ...extra });
const opts = (label, options, extra = {}) => ({ type: 'enum', label, options, ...extra });
const multi = (label, options, extra = {}) => ({ type: 'multi', label, options, ...extra });
const bool = (label, extra = {}) => ({ type: 'bool', label, ...extra });

export const LOG = {
  swim: {
    title: 'Basen', icon: '🏊',
    fields: {
      main_min: num('Część właściwa', 0, 240, 1, { unit: 'min', hint: 'plan: 45 min (5 rozgrzewka + 45 + 5 schłodzenie)' }),
      dist: num('Dystans', 0, 20000, 25, { unit: 'm' }),
      pool: opts('Długość basenu', [['25', '25 m'], ['50', '50 m']]),
      strokes: multi('Styl', [['kraul', 'Kraul'], ['grzbiet', 'Grzbiet'], ['klasyczny', 'Klasyczny'], ['motylkowy', 'Motylkowy'], ['zmienny', 'Zmienny']], { hint: 'plan: kraul lub grzbiet, bez klasycznego (żabki)' }),
      rpe: num('RPE części właściwej', 0, 10, 0.5, { hint: 'cel RPE 3–4 w skali 0–10' }),
      hr_avg: num('Tętno średnie', 40, 230, 1, { unit: 'bpm', hint: 'opcjonalnie, ~110–125 bpm' }),
      hr_max: num('Tętno maksymalne', 40, 230, 1, { unit: 'bpm' }),
      crit: multi('Jak to rozpoznać w wodzie (wszystkie trzy)', [['oddech3', 'Oddech co 3. ruch ramion, bez głodu powietrza'], ['zdanie', 'Przy ścianie pełne zdanie bez łapania tchu'],
        ['tempo', 'Ostatnie 10 min w tempie pierwszych 10, przerwa przy ścianie ≤15 s']]),
      signals: multi('Kiedy jest za wysoka (którykolwiek)', [['oddech2', 'Oddech co 2. ruch ramion'], ['odpoczynek', 'Ponad 30 s odpoczynku przy ścianie'], ['tempo_spada', 'Tempo spada w drugiej połowie'],
        ['pieczenie', 'Pieczenie w barkach lub przedramionach']]),
      stretch: bool('Rozciąganie barków 2×20 s na stronę'),
    },
  },
  bike: {
    title: 'Rower', icon: '🚴',
    fields: {
      main_min: num('Część właściwa', 0, 240, 1, { unit: 'min', hint: 'plan: 45 min (5 + 45 + 5)' }),
      hr_avg: num('Tętno średnie', 40, 230, 1, { unit: 'bpm', hint: 'cel 65–70% HRmax (~125–135 bpm)' }),
      hr_max: num('Tętno maksymalne', 40, 230, 1, { unit: 'bpm' }),
      dist_km: num('Dystans', 0, 300, 0.1, { unit: 'km' }),
      cadence: num('Kadencja', 0, 200, 1, { unit: 'obr./min', hint: 'plan: wyższa kadencja' }),
      resistance: opts('Opór', [['niski', 'Niski'], ['umiarkowany', 'Umiarkowany'], ['wysoki', 'Wysoki']], { hint: 'plan: niski–umiarkowany' }),
      saddle_high: bool('Siodełko wyżej niż intuicyjnie'),
    },
  },
  sauna: {
    title: 'Sauna', icon: '♨️',
    fields: {
      rounds: num('Liczba rund', 0, 3, 1, { hint: 'plan: 1 po treningu, w czwartek 2' }),
      r1_min: num('Runda 1 — czas', 0, 60, 1, { unit: 'min', hint: 'plan: 20 min' }),
      r2_min: num('Runda 2 — czas', 0, 60, 1, { unit: 'min', hint: 'plan: 20 min' }),
      temp_c: num('Temperatura', 40, 120, 1, { unit: '°C', hint: 'zwykle 80–100°C' }),
      cool_min: num('Wychłodzenie', 0, 60, 1, { unit: 'min', hint: 'plan: 10–15 min' }),
      water_before_ml: num('Woda 30 min przed', 0, 3000, 50, { unit: 'ml', hint: 'plan: 250–500 ml' }),
      water_after_ml: num('Woda po prysznicu', 0, 3000, 50, { unit: 'ml', hint: 'plan: 500–750 ml' }),
      ended_at: { type: 'time', label: 'Koniec sauny (godzina)', hint: 'najpóźniej 1,5 h przed snem' },
      symptoms: multi('Objawy (wyjdź od razu)', [['zawroty', 'Zawroty głowy'], ['nudnosci', 'Nudności'], ['kolatanie', 'Kołatanie serca']]),
    },
  },
};
export const NOTE_MAX = 600;
export const SECTIONS = Object.keys(LOG);

// Rodzaj głównej sesji dnia wg typu dnia z planu (pozostałe dni — tylko sauna dobrowolnie).
export const mainKind = dayType => (dayType === 'swim' ? 'swim' : dayType === 'cardio_sauna' ? 'bike' : /^strength/.test(dayType || '') ? 'strength' : null);

const isDay = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const valueOk = (f, v) => {
  switch (f.type) {
    case 'num': return typeof v === 'number' && Number.isFinite(v) && v >= f.min && v <= f.max;
    case 'bool': return v === true;
    case 'enum': return f.options.some(([k]) => k === v);
    case 'multi': return Array.isArray(v) && v.length > 0 && new Set(v).size === v.length && v.every(x => f.options.some(([k]) => k === x));
    case 'time': return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
    default: return false;
  }
};

// Pole formularza przed zapisem: wartość pusta (usunięcie pola) albo zgodna z definicją. Notatka — tekst do NOTE_MAX.
export function fieldOk(section, key, value) {
  if (section === 'note') return value == null || typeof value === 'string';
  const f = LOG[section]?.fields[key];
  if (!f) return false;
  if (value == null || value === '' || value === false || (Array.isArray(value) && !value.length)) return true;
  return valueOk(f, value);
}

// Zgodność dokumentu z bieżącą definicją pól (testy, kontrola formularza). NIE jest używana przy walidacji zdarzeń w magazynie —
// tam wystarczy data i zwykły JSON (zgodność w przód: dokument z nowszej wersji, z nowym polem, nie może trafić do kwarantanny).
export function validateDetail(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d) || !isDay(d.date)) return false;
  for (const [k, v] of Object.entries(d)) {
    if (k === 'date') continue;
    if (k === 'note') { if (typeof v !== 'string' || v.length === 0 || v.length > NOTE_MAX) return false; continue; }
    const sec = LOG[k];
    if (!sec || !v || typeof v !== 'object' || Array.isArray(v) || !Object.keys(v).length) return false;
    for (const [fk, fv] of Object.entries(v)) if (!sec.fields[fk] || !valueOk(sec.fields[fk], fv)) return false;
  }
  return true;
}

// Dokument po zmianie jednego pola; puste wartości (null, '', brak zaznaczeń, false) usuwają pole, pusta sekcja znika.
export function withValue(doc, section, key, value) {
  const out = { ...doc };
  if (section === 'note') {
    const t = typeof value === 'string' ? value.trim().slice(0, NOTE_MAX) : '';
    if (t) out.note = t; else delete out.note;
    return out;
  }
  const sec = { ...(out[section] || {}) };
  const empty = value == null || value === '' || value === false || (Array.isArray(value) && !value.length) || (typeof value === 'number' && Number.isNaN(value));
  if (empty) delete sec[key]; else sec[key] = value;
  if (Object.keys(sec).length) out[section] = sec; else delete out[section];
  return out;
}

export const hasContent = doc => !!doc && Object.keys(doc).some(k => k !== 'date');

// Tempo pływania [s / 100 m] z części właściwej i dystansu (tylko gdy oba wpisane; przybliżenie — dystans obejmuje cały basen, czas tylko część właściwą).
const pos = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
export const swimPace = doc => (pos(doc?.swim?.main_min) && pos(doc?.swim?.dist) ? Math.round((doc.swim.main_min * 60) / (doc.swim.dist / 100)) : null);
export const paceText = s => (s == null ? null : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /100 m`);

const n1 = v => String(v).replace('.', ',');
// Krótki opis wpisów dnia (Historia): „Basen 1250 m · 45 min · RPE 3,5 · 3:36 /100 m — Sauna 2 rundy · 90°C”.
export function summarize(doc) {
  if (!doc) return '';
  const p = [];
  const s = doc.swim, b = doc.bike, u = doc.sauna;
  const lab = (name, items) => [name, items.filter(Boolean).join(' · ')].filter(Boolean).join(' ');
  if (s) p.push(lab('Basen', [s.dist && `${s.dist} m`, s.main_min && `${s.main_min} min`, s.rpe != null && `RPE ${n1(s.rpe)}`, paceText(swimPace(doc)), s.hr_avg && `${s.hr_avg} bpm`]));
  if (b) p.push(lab('Rower', [b.main_min && `${b.main_min} min`, b.hr_avg && `${b.hr_avg} bpm`, b.dist_km && `${n1(b.dist_km)} km`, b.cadence && `${b.cadence} obr./min`]));
  if (u) p.push(lab('Sauna', [u.rounds != null && `${u.rounds} ${u.rounds === 1 ? 'runda' : u.rounds >= 2 && u.rounds <= 4 ? 'rundy' : 'rund'}`, u.temp_c && `${u.temp_c}°C`, Array.isArray(u.symptoms) && u.symptoms.length && `objawy: ${u.symptoms.length}`]));
  if (doc.note) p.push('notatka');
  return p.join(' — ');
}
