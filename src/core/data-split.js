// T10 (audyt 10.11.2026): dane widoków doładowywane przy wejściu do modułu (wzorzec U6 — zadania bloków nauki, plan-split.js).
// Do pakietu aplikacji trafia tylko „rdzeń” pliku — to, czego potrzebują inne moduły (wyszukiwanie ⌘K, Zapasy, Diagnostyka); pełny plik
// wczytuje moduł widoku przez `loadModuleData(id)` (module-data.js w Node, module-data.web.js w przeglądarce). Podział robi build
// (tools/build.mjs): wariant web — plik `data-<id>.<skrót>.json` obok aplikacji (lista SHELL, działa offline), 2027.html —
// `<script type="application/json" id="data-<id>">` w stronie. Pliki src/data/*.json bez zmian; w Node (testy, narzędzia) dane są pełne.
import { markersIn } from './private.js';

export const SPLIT_DATA = {
  // Rekompozycja: w pakiecie spis sekcji (⌘K — tytuły) i numery znaczników pakietu prywatnego (Diagnostyka); treść sekcji — osobno
  rekomp: j => ({ sections: j.sections.map(s => ({ id: s.id, num: s.num, title: s.title })), markers: markersIn(j) }),
  // Poradnik Bezpieczeństwa żywności: tylko w widoku „Poradnik”
  guide: () => ({ intro: [], sections: [] }),
  // Tabela bezpieczeństwa: w pakiecie nazwy produktów i działy (⌘K, odnośniki z Zapasów); karty i tabela — osobno
  safety: j => ({ rows: j.rows.map(r => ({ Produkt: r.Produkt, section: r.section })) }),
};
export const DATA_IDS = Object.keys(SPLIT_DATA);
