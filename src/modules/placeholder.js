import { h } from '../ui/dom.js';
export function renderPlaceholder(root, mod) {
  root.append(h('h1', {}, mod.name),
    h('div', { class: 'panel' },
      h('p', {}, `Ten moduł dostanie docelowy widok w Etapie ${mod.stage}.`),
      h('p', { class: 'muted' }, 'Jego dane są już przeniesione ze źródeł i sprawdzone automatycznie. Import plików i synchronizacja działają w module „Dane i synchronizacja”.'),
      h('a', { href: '#/dane' }, 'Przejdź do danych')));
}
