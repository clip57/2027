// Strona Ustawienia (D-113, F-G2): wygląd i zachowanie TEGO urządzenia — motyw, akcent, gęstość, rozmiar tekstu, sygnał minutników,
// ekran startowy. Preferencje per urządzenie (localStorage, jak motyw — D-110), poza dziennikiem zdarzeń i synchronizacją.
import { h, add } from './dom.js';
import { segmented } from './components.js';
import { icon } from './icons.js';
import { ACCENTS, DENSITIES, TEXT_SIZES, uiPref, setUiPref, soundOn, setSound, startPref, setStartPref } from './prefs.js';
import { signal, unlockAudio } from './signal.js';

const row = (title, hint, control) => h('div', { class: 'set-row' },
  h('div', { class: 'set-t' }, h('h3', {}, title), hint && h('p', { class: 'muted' }, hint)), h('div', { class: 'set-c' }, control));

export function renderSettings(root, ctx) {
  const opt = list => list.map(([value, label]) => ({ value, label }));
  const pick = (k, list) => segmented(k === 'accent' ? 'Akcent' : k === 'density' ? 'Gęstość' : 'Rozmiar tekstu', opt(list), uiPref(k), v => { setUiPref(k, v); ctx.rerender(); });
  add(root,
    h('header', { class: 'st-head' }, h('h1', {}, 'Ustawienia'),
      h('div', { class: 'topline' }, h('span', { class: 'date' }, 'Wygląd i zachowanie na tym urządzeniu'))),
    h('section', { class: 'panel set-sec', 'aria-labelledby': 'set-look' }, h('h2', { id: 'set-look' }, icon('sun-medium', { size: 18 }), 'Wygląd'),
      row('Motyw', 'Ciemny, jasny albo zgodnie z systemem.', ctx.themeSwitch(false)),
      row('Akcent', 'Kolor przycisków, zaznaczeń i wskaźników.', h('div', { class: 'set-acc' }, pick('accent', ACCENTS),
        h('span', { class: 'set-swatch', 'aria-hidden': 'true' }))),
      row('Gęstość', 'Zwarta — mniejsze odstępy, więcej treści na ekranie.', pick('density', DENSITIES)),
      row('Rozmiar tekstu', 'Większy — cały interfejs o ok. 6 % większy.', pick('text', TEXT_SIZES))),
    h('section', { class: 'panel set-sec', 'aria-labelledby': 'set-beh' }, h('h2', { id: 'set-beh' }, icon('sliders-horizontal', { size: 18 }), 'Zachowanie'),
      row('Sygnał minutników', 'Dźwięk (i wibracja, gdzie działa) na koniec przerwy w Treningu, minutnika Meal Prep i odczekania w Pielęgnacji.',
        h('div', { class: 'row' },
          segmented('Sygnał', [{ value: 'on', label: 'Włączony' }, { value: 'off', label: 'Wyłączony' }], soundOn() ? 'on' : 'off', v => { setSound(v === 'on'); ctx.rerender(); }),
          h('button', { class: 'set-test', disabled: !soundOn() || null, onclick: () => { unlockAudio(); setTimeout(() => signal(), 60); } }, icon('bell', { size: 16 }), h('span', {}, 'Sprawdź')))),
      row('Ekran startowy', 'Moduł otwierany przy uruchomieniu aplikacji (bez adresu).',
        h('select', { 'aria-label': 'Ekran startowy', onchange: e => { setStartPref(e.target.value); ctx.flash('Zapisano ekran startowy.', 'info'); } },
          ctx.modules.map(m => h('option', { value: m.id, selected: m.id === startPref() || null }, m.name))))),
    h('section', { class: 'panel set-sec', 'aria-labelledby': 'set-data' }, h('h2', { id: 'set-data' }, icon('database', { size: 18 }), 'Dane'),
      h('p', { class: 'muted' }, 'Ustawienia dotyczą tylko tego urządzenia i nie są synchronizowane. Dane aplikacji, kopie i synchronizacja — w module Dane.'),
      h('a', { class: 'btn', href: '#/dane' }, icon('database', { size: 18 }), h('span', {}, 'Dane i synchronizacja'))));
}
