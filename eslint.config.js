// ESLint (D-115, fundament jakości T3): zalecane reguły + reguły kodujące pułapki z tabeli w docs/PULAPKI.md.
// Uruchomienie: `npm run lint` (także w workflow „Testy 2027”). Wyjątek od reguły — tylko komentarzem `eslint-disable-next-line <reguła> -- <powód>`.
import js from '@eslint/js';
import globals from 'globals';

// Pułapki w kodzie przeglądarki (src/)
const SRC_SYNTAX = [
  { selector: "CallExpression[callee.property.name=/^(append|prepend|after|before|replaceChildren)$/] > LogicalExpression.arguments",
    message: 'el.append(cond && x) wyświetla „false”/„null” — użyj add() z ui/dom.js.' },
  { selector: "CallExpression[callee.property.name=/^(append|prepend|after|before|replaceChildren)$/] > ArrayExpression.arguments",
    message: 'Tablica w append() wstawia jej tekst — użyj add() albo rozwinięcia (...).' },
  { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'Bez insertAdjacentHTML (§3.8) — budowanie przez h().' },
  { selector: "CallExpression[callee.object.name='document'][callee.property.name=/^write(ln)?$/]", message: 'Bez document.write (§3.8).' },
  { selector: "CallExpression[callee.property.name='reload'][callee.object.name='location']",
    message: 'Bez automatycznego location.reload() (D-057) — tylko po zgodzie użytkownika („Nowa wersja — odśwież”).' },
  { selector: "CallExpression[callee.property.name='addEventListener'][arguments.0.value='scroll']",
    message: 'Bez kodu w zdarzeniu scroll (D-112) — IntersectionObserver albo zapis pozycji przy zmianie trasy.' },
  { selector: "CallExpression[callee.property.name='startViewTransition']",
    message: 'View Transitions tylko przy zmianie motywu (D-110) — trasy: animacja CSS main[data-enter].' },
  { selector: "MemberExpression[object.object.name='SRC'][object.property.name='week'][property.name='days']",
    message: 'Typ dnia zawsze przez dayPlan(date) z resolver.js (wyjątki dat, D-087), nie SRC.week.days[…].' },
  { selector: "NewExpression[callee.name='Store']", message: 'Nowe instancje Store tylko przez attachStore() w app.js (D-107/B10).' },
];

export default [
  { ignores: ['dist/**', 'node_modules/**', 'src/ui/icons.js', '**/__pycache__/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { ignoreRestSiblings: true, caughtErrors: 'none' }],
      // stała użyta przed deklaracją w tym samym zakresie = ReferenceError (strefa martwa) — pułapki „const po return <widok>()” i „const show”
      'no-use-before-define': ['error', { functions: false, classes: true, variables: false }],
    },
  },
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-restricted-syntax': ['error', ...SRC_SYNTAX],
      'no-restricted-properties': ['error',
        { property: 'innerHTML', message: 'Bez innerHTML (§3.8) — h() / textContent.' },
        { property: 'outerHTML', message: 'Bez outerHTML (§3.8).' }],
      'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error',
    },
  },
  { files: ['src/sw.js', 'src/**/*.worker.js'], languageOptions: { globals: { ...globals.serviceworker } } },
  {
    files: ['tools/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // build: podstawianie znaczników tylko funkcją — `$&` w kodzie psuło 2027.html (pułapka „String.replace(marker, kod)”)
    files: ['tools/build.mjs'],
    rules: { 'no-restricted-syntax': ['error', { selector: "CallExpression[callee.property.name=/^replace(All)?$/][arguments.length=2] > :not(ArrowFunctionExpression, FunctionExpression, Literal).arguments:nth-child(2)",
      message: 'W buildzie podstawiaj funkcją: text.replace(mark, () => value).' }] },
  },
];
