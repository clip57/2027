// Globalne wyszukiwanie (I4, audyt 25.09.2026): moduły, pozycje Zapasów, suplementy, ćwiczenia, bloki CFA i MPW (temat, źródło,
// strony), wpisy error logu, Bezpieczeństwo (produkty) i sekcje Rekompozycji. Indeks budowany leniwie z danych statycznych
// i stanu; tylko odczyt. Wyszukiwanie bez polskich znaków diakrytycznych („zolty” = „żółty”), wszystkie słowa naraz.
import { SRC, catalogById } from './data.js';
import { dayPlan, PLAN_START } from './resolver.js';
import { addDays, shortDate, dayShort } from './dates.js';
import { MODULES } from '../modules/registry.js';
import rekomp from '../data/rekomp.json' with { type: 'json' };

export const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const KIND = { mod: 'Moduł', inv: 'Zapasy', supp: 'Suplementy', ex: 'Trening', cfa: 'CFA', mpw: 'MPW', err: 'Error log', mpwerr: 'Error log MPW', safe: 'Bezpieczeństwo', rek: 'Rekompozycja', care: 'Pielęgnacja' };
export const kindLabel = k => KIND[k] || k;

export function buildIndex(state, today) {
  const out = [];
  const add = (kind, title, sub, href, extra = '') => out.push({ kind, title, sub, href, text: norm(`${title} ${sub} ${extra}`) });
  for (const m of MODULES) add('mod', m.name, m.group, `#/${m.id}`);
  for (const it of [...Object.values(catalogById), ...(state?.catalogUser || [])]) add('inv', it.name, it.category || '', `#/zapasy?q=${encodeURIComponent(it.name)}`);
  for (const [id, s] of Object.entries(SRC.supplements.supplements)) add('supp', s.name, s.form || '', '#/suplementy', id);
  // Ćwiczenie → najbliższy dzień planu z tą sesją (od dziś, najwyżej 14 dni)
  const from = today < PLAN_START ? PLAN_START : today;
  const nextDay = key => { for (let i = 0; i < 14; i++) { const d = addDays(from, i); if (dayPlan(d).session === key) return d; } return null; };
  const seen = new Set();
  for (const [key, list] of Object.entries(SRC.training.days)) {
    const d = nextDay(key);
    for (const e of list) {
      if (seen.has(e.name)) continue;
      seen.add(e.name);
      add('ex', e.name, d ? `najbliżej ${dayShort(d)} ${shortDate(d)}` : '', d ? `#/trening?d=${d}` : '#/trening', SRC.training.info?.[e.name]?.en || '');
    }
  }
  for (const b of SRC.cfa.D.bloki) add('cfa', b.temat, `${dayShort(b.data)} ${shortDate(b.data)} · blok ${b.blok} · ${b.zrodlo}, ${b.do_przeczytania}`, `#/cfa?v=dzien&d=${b.data}`, `${b.zakres || ''} ${b.kategoria || ''}`);
  for (const e of state?.cfaErrors || []) add('err', e.temat || '(bez tematu)', `${e.rodzaj || ''} · ${e.data || ''}`, '#/cfa?v=log', e.regula || '');
  // Plan MPW (D-095): bloki (temat, źródło, artykuły, punkty KNF) i error log MPW
  for (const b of SRC.mpw.D.bloki) add('mpw', b.temat, `${dayShort(b.data)} ${shortDate(b.data)} · blok ${b.blok} · ${b.zrodlo}, ${b.do_przeczytania}`, `#/mpw?v=dzien&d=${b.data}`, `${b.kategoria || ''} ${b.knf || ''}`);
  for (const e of state?.mpwErrors || []) add('mpwerr', e.temat || '(bez tematu)', `${e.rodzaj || ''} · ${e.data || ''}`, '#/mpw?v=log', e.regula || '');
  const prods = new Set();
  for (const r of SRC.safety.rows) if (!prods.has(r.Produkt)) { prods.add(r.Produkt); add('safe', r.Produkt, r.section || '', `#/bezpieczenstwo?q=${encodeURIComponent(r.Produkt)}`); }
  // Pielęgnacja (D-094): produkty i kroki z danych użytkownika (tylko na tym urządzeniu)
  for (const d of state?.careDefs || []) {
    if (d.kind === 'product' && d.name) add('care', d.name, 'Produkt pielęgnacji', '#/pielegnacja?v=produkty', d.note || '');
    else if (d.kind === 'step' && d.text) add('care', d.text, `Krok pielęgnacji${d.group ? ` · ${d.group}` : ''}`, '#/pielegnacja?v=plan', d.note || '');
  }
  for (const s of rekomp.sections) add('rek', `${s.num}. ${s.title}`, 'Rekompozycja', `#/rekompozycja?s=${s.id}`, JSON.stringify(s.blocks || []).slice(0, 4000));
  return out;
}

export function search(index, q, limit = 40) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits = index.filter(x => words.every(w => x.text.includes(w)));
  // Najpierw trafienia w tytule, potem kolejność indeksu (moduły, zapasy, … CFA wg dat)
  const inTitle = x => words.every(w => norm(x.title).includes(w));
  return [...hits.filter(inTitle), ...hits.filter(x => !inTitle(x))].slice(0, limit);
}
