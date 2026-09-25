// Sekcja „Synchronizacja w chmurze” modułu Dane (D-078, Etap 2; D-081…D-084). Kroki: konfiguracja projektu →
// logowanie → hasło szyfrowania → synchronizacja automatyczna (D-084, przełącznik per urządzenie) i „Synchronizuj teraz”
// (ręczne wymuszenie). Ręczna synchronizacja plikiem 2027-sync.json (sekcja wyżej) działa niezależnie i bez zmian.
import { h, add, plural } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { cloudStatus, saveConfig, signIn, unlock, signOut, resetDevice, syncNow, setAutoEnabled, setPullEnabled, describeError, describeResult } from '../core/sync/cloud-local.js';

// Stan interfejsu w pamięci modułu (przetrwa przerysowanie widoku po zapisie)
const ui = { note: null, needConfirm: false, busy: false, focus: null };
const when = iso => (iso ? new Date(iso).toLocaleString('pl-PL') : 'jeszcze nie');
const maskKey = k => (k.length > 22 ? `${k.slice(0, 18)}…${k.slice(-4)}` : k);

const hhmm = t => new Date(t).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
const unsentText = n => (n ? `Do wysłania do chmury: ${n} ${plural(n, 'zmiana', 'zmiany', 'zmian')} z tego urządzenia.` : 'Wszystkie zmiany z tego urządzenia są w chmurze.');
const every = ms => (ms >= 60000 ? `${Math.round(ms / 60000)} min` : `${Math.round(ms / 1000)} s`);
// Stan synchronizacji automatycznej jednym zdaniem (bez komunikatów przy każdej zmianie — D-084, D-085)
export function autoText(s, on, pull = true) {
  if (!on) return 'Automatyczna synchronizacja wyłączona na tym urządzeniu — synchronizujesz przyciskiem.';
  switch (s?.phase) {
    case 'running': return 'Synchronizacja w toku…';
    case 'retry': return s.error?.code === 'network' ? 'Brak połączenia — zmiany zostaną wysłane automatycznie, gdy wróci internet.' : 'Serwer chmury chwilowo nie odpowiada — ponowienie automatyczne.';
    case 'paused': return `Wstrzymana: ${describeError(s.error)}`;
    default: {
      if (s?.waiting) return 'Zmiany zostaną wysłane za chwilę.';
      const check = !pull ? ' · zmiany z innych urządzeń pobierane przy otwarciu i powrocie do aplikacji'
        : s?.pollEvery ? ` · sprawdzanie zmian co ${every(s.pollEvery)}${s.idle ? ' (bezczynność)' : ''}` : '';
      return `Synchronizacja automatyczna włączona${s?.lastOk ? ` · ostatnio ${hhmm(s.lastOk)}` : ''}${check}.`;
    }
  }
}

function field(label, attrs) {
  const input = h('input', { autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', ...attrs });
  return [h('label', { class: 'field' }, h('span', {}, label), input), input];
}

export async function cloudSection(ctx) {
  const { store } = ctx;
  const st = store ? await cloudStatus(store) : { step: 'config', config: null, pending: 0 };
  const noteBox = h('div', { class: 'dn-cloud-msg', role: 'status', 'aria-live': 'polite' });
  const note = (text, cls = 'warn') => { noteBox.replaceChildren(h('div', { class: `banner ${cls}` }, text)); };
  if (ui.note) { note(ui.note.text, ui.note.cls); ui.note = null; }
  // Wynik akcji: komunikat zachowany na czas przerysowania widoku
  const done = (text, cls = 'info', focus = null) => { ui.note = { text, cls }; ui.focus = focus; ctx.rerender(); };
  // Blokada przycisków na czas operacji sieciowej (bez podwójnych kliknięć)
  async function run(btn, label, fn, during) {
    if (ui.busy) return;
    ui.busy = true;
    noteBox.replaceChildren();   // komunikat poprzedniej akcji nie może wyglądać na wynik bieżącej
    const old = [...btn.childNodes];
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.replaceChildren(h('span', {}, label));
    try { await fn(); }
    catch (e) {
      // Wygasła sesja: widok wraca do logowania; pozostałe błędy — komunikat przy formularzu, wpisane dane zostają
      if (e.code === 'signed-out') { ui.busy = false; done(describeError(e), 'warn'); return; }
      note(describeError(e, during), 'err');
    }
    finally { ui.busy = false; if (btn.isConnected) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.replaceChildren(...old); } }
  }
  const form = (onsubmit, ...kids) => h('form', { class: 'dn-cloud-form', novalidate: true, onsubmit: e => { e.preventDefault(); onsubmit(e.submitter || e.target.querySelector('button[type=submit]')); } }, ...kids);

  const status = {
    config: ['cloud-off', 'Nieskonfigurowana na tym urządzeniu.'],
    login: ['lock', 'Zaloguj się, aby synchronizować.'],
    unlock: ['lock', 'Podaj hasło szyfrowania, aby odblokować dane.'],
    ready: [st.pending ? 'cloud-upload' : 'cloud-check', unsentText(st.pending)],
  }[st.step];
  const sec = h('section', { class: `panel dn-cloud is-${st.step}${st.step === 'ready' && st.pending ? ' has-unsent' : ''}`, 'aria-labelledby': 'h-cloud' },
    h('h2', { id: 'h-cloud' }, icon('cloud', { size: 20 }), 'Synchronizacja w chmurze'),
    h('p', { class: 'dn-sync-s' }, icon(status[0], { size: 20 }), h('span', {}, status[1])),
    st.user && h('p', { class: 'dn-sync-m' }, `Konto: ${st.user.email || '—'} · ostatnia synchronizacja: ${when(st.lastSync)}`));

  let first = null;
  if (!store) add(sec, h('p', { class: 'muted' }, 'Baza danych na tym urządzeniu jest niedostępna — synchronizacja wyłączona.'));
  else if (st.step === 'config') {
    const [fu, url] = field('Project URL', { type: 'url', name: 'cloud-url', inputmode: 'url', autocomplete: 'off', placeholder: 'https://<projekt>.supabase.co' });
    const [fk, key] = field('Publishable Key', { type: 'text', name: 'cloud-key', autocomplete: 'off', placeholder: 'sb_publishable_…' });
    first = url;
    add(sec, h('p', { class: 'muted' }, 'Wpisz dane projektu Supabase (Project Settings → API Keys). Zostają wyłącznie na tym urządzeniu — każde urządzenie i każdy sposób uruchomienia (Safari, aplikacja z ekranu początkowego, plik) konfigurujesz raz.'),
      form(btn => run(btn, 'Zapisywanie…', async () => { await saveConfig(store, { url: url.value, key: key.value }); done('Konfiguracja zapisana. Zaloguj się kontem utworzonym w panelu Supabase.', 'info', 'email'); }, 'config'),
        fu, fk,
        h('p', { class: 'muted dn-cloud-hint' }, 'Publishable Key jest kluczem publicznym. Nigdy nie wklejaj klucza sekretnego (sb_secret_…) ani service_role — aplikacja go odrzuci.'),
        h('div', { class: 'row' }, h('button', { class: 'primary', type: 'submit' }, icon('save', { size: 18 }), h('span', {}, 'Zapisz konfigurację')))));
  } else if (st.step === 'login') {
    const [fe, email] = field('E-mail konta', { type: 'email', name: 'email', autocomplete: 'username', inputmode: 'email' });
    const [fp, pass] = field('Hasło konta', { type: 'password', name: 'password', autocomplete: 'current-password' });
    first = email;
    add(sec, form(btn => run(btn, 'Logowanie…', async () => {
      await signIn(store, { email: email.value, password: pass.value });
      ui.needConfirm = false;
      done('Zalogowano. Podaj hasło szyfrowania.', 'info', 'pass');
    }, 'signin'), fe, fp,
      h('p', { class: 'muted dn-cloud-hint' }, 'Konto tworzysz w panelu Supabase (Authentication → Users). Rejestracja z aplikacji jest wyłączona.'),
      h('div', { class: 'row' }, h('button', { class: 'primary', type: 'submit' }, icon('log-in', { size: 18 }), h('span', {}, 'Zaloguj')))));
  } else if (st.step === 'unlock') {
    const [fp, pass] = field('Hasło szyfrowania', { type: 'password', name: 'passphrase', autocomplete: 'current-password', minlength: 12 });
    const [fc, conf] = field('Powtórz hasło szyfrowania', { type: 'password', name: 'passphrase-2', autocomplete: 'new-password', minlength: 12 });
    // Pierwsze urządzenie: pole powtórzenia odkrywane na miejscu (bez przerysowania — wpisane hasło zostaje)
    const firstInfo = h('div', { class: 'banner info' }, 'W chmurze nie ma jeszcze danych — to pierwsze urządzenie. Hasło zostanie ustawione dla wszystkich urządzeń; powtórz je.');
    const submitLbl = h('span', {}, 'Odblokuj');
    const reveal = () => { ui.needConfirm = true; firstInfo.hidden = false; fc.hidden = false; submitLbl.textContent = 'Ustaw hasło szyfrowania'; pass.autocomplete = 'new-password'; };
    firstInfo.hidden = true; fc.hidden = true;
    if (ui.needConfirm) reveal();
    first = pass;
    add(sec, h('p', { class: 'muted' }, 'Hasło szyfrowania (min. 12 znaków) jest inne niż hasło konta i nigdy nie opuszcza urządzenia — serwer przechowuje wyłącznie zaszyfrowane wpisy. Na każdym urządzeniu podajesz to samo hasło. Bez niego danych w chmurze nie da się odczytać: zapisz je w menedżerze haseł.'),
      firstInfo,
      form(btn => {
        let isFirst = false;
        return run(btn, 'Sprawdzanie…', async () => {
          try {
            const r = await unlock(store, { passphrase: pass.value, confirm: ui.needConfirm ? conf.value : undefined });
            ui.needConfirm = false;
            ctx.cloudAuto?.kick();   // pierwsza synchronizacja automatycznie (gdy włączona na urządzeniu)
            done(`${r.created ? 'Hasło szyfrowania ustawione.' : 'Hasło szyfrowania poprawne.'} ${r.persistent ? '' : 'Ta przeglądarka nie zapamiętuje kluczy — po ponownym uruchomieniu podasz hasło jeszcze raz. '}Możesz synchronizować.`, 'info', 'sync');
          } catch (e) { if (e.code === 'need-confirm') { isFirst = true; return; } throw e; }
        }, 'unlock').then(() => { if (isFirst) { reveal(); conf.focus(); } });
      }, fp, fc,
        h('div', { class: 'row' }, h('button', { class: 'primary', type: 'submit' }, icon('lock', { size: 18 }), submitLbl),
          h('button', { type: 'button', onclick: e => run(e.currentTarget, 'Wylogowywanie…', async () => { await signOut(store); ui.needConfirm = false; ctx.cloudAuto?.kick(); done('Wylogowano z chmury.', 'info'); }) }, icon('log-out', { size: 18 }), h('span', {}, 'Wyloguj')))));
  } else {
    const auto = ctx.cloudAuto;
    // „Synchronizuj teraz” = ręczne wymuszenie pełnej rundy: przejmuje oczekujące zmiany, czeka na trwającą rundę automatyczną
    const syncBtn = h('button', { class: 'primary', type: 'button', onclick: () => run(syncBtn, 'Synchronizuję…', async () => {
      auto?.cancelPending(); await auto?.idle(); auto?.cancelPending();
      const r = await syncNow(store);
      auto?.settled(true);
      done(describeResult(r), r.rejected?.length ? 'warn' : 'info');
    }, 'sync') }, icon('refresh-cw', { size: 18 }), h('span', {}, 'Synchronizuj teraz'));
    const toggle = h('button', { type: 'button', class: 'dn-cloud-auto-b', 'aria-pressed': String(st.auto), onclick: () => run(toggle, 'Zapisywanie…', async () => {
      await setAutoEnabled(store, !st.auto); auto?.kick();
      done(st.auto ? 'Synchronizacja automatyczna wyłączona na tym urządzeniu. Synchronizujesz przyciskiem.' : 'Synchronizacja automatyczna włączona na tym urządzeniu.', 'info');
    }, 'sync') }, icon(st.auto ? 'cloud-check' : 'cloud-off', { size: 18 }), h('span', {}, 'Synchronizuj automatycznie'));
    // D-085: osobny przełącznik pobierania (aktywny tylko przy włączonej synchronizacji automatycznej)
    const pullToggle = st.auto && h('button', { type: 'button', class: 'dn-cloud-auto-b dn-cloud-pull-b', 'aria-pressed': String(st.pull), onclick: () => run(pullToggle, 'Zapisywanie…', async () => {
      await setPullEnabled(store, !st.pull); auto?.kick();
      done(st.pull ? 'Automatyczne pobieranie zmian wyłączone na tym urządzeniu. Zmiany z innych urządzeń pobierane przy otwarciu i powrocie do aplikacji.' : 'Automatyczne pobieranie zmian włączone na tym urządzeniu.', 'info');
    }, 'sync') }, icon(st.pull ? 'cloud-download' : 'cloud-off', { size: 18 }), h('span', {}, 'Automatyczne pobieranie zmian'));
    const line = h('p', { class: 'dn-cloud-auto', role: 'status' }, autoText(auto?.state(), st.auto, st.pull));
    first = syncBtn;
    add(sec, line, h('div', { class: 'row' }, syncBtn, toggle, pullToggle,
      h('button', { type: 'button', onclick: e => run(e.currentTarget, 'Wylogowywanie…', async () => { await signOut(store); auto?.kick(); done('Wylogowano z chmury. Dane na tym urządzeniu pozostają bez zmian.', 'info'); }) }, icon('log-out', { size: 18 }), h('span', {}, 'Wyloguj'))),
      h('p', { class: 'muted' }, st.auto
        ? `Zmiany są wysyłane automatycznie chwilę po zapisie, a zmiany z innych urządzeń pobierane przy otwarciu aplikacji, powrocie do niej i po powrocie internetu${st.pull ? ' oraz — gdy aplikacja jest na ekranie — sprawdzane co 30 s na komputerze i co 60 s na telefonie (po 5 min bezczynności co 5 min)' : ''}. „Synchronizuj teraz” wymusza pełną synchronizację od razu. Konflikty rozstrzyga nowsza zmiana, starsza zostaje w historii. Bez internetu aplikacja działa normalnie.`
        : 'Synchronizacja uruchamia się tylko przyciskiem: pobiera zmiany z innych urządzeń, a potem wysyła zmiany z tego urządzenia. Konflikty rozstrzyga nowsza zmiana, starsza zostaje w historii. Bez internetu aplikacja działa normalnie — zsynchronizujesz później.'));
    // Stan na żywo (bez przerysowania widoku): zdanie o automacie + licznik niewysłanych zmian po każdej rundzie
    const head = sec.querySelector('.dn-sync-s span');
    const unsub = auto?.subscribe(async s => {
      if (!sec.isConnected) { unsub?.(); return; }
      line.textContent = autoText(s, st.auto, st.pull);
      if (s.phase === 'idle' && !s.waiting) {
        const cur = await cloudStatus(store);
        if (!sec.isConnected || cur.step !== 'ready') return;
        head.textContent = unsentText(cur.pending);
        const m = sec.querySelector('.dn-sync-m');
        if (m) m.textContent = `Konto: ${cur.user?.email || '—'} · ostatnia synchronizacja: ${when(cur.lastSync)}`;
        sec.classList.toggle('has-unsent', !!cur.pending);
        sec.querySelector('.dn-sync-s .ico')?.replaceWith(icon(cur.pending ? 'cloud-upload' : 'cloud-check', { size: 20 }));
      }
    });
  }
  add(sec, noteBox);

  if (store && st.config) {
    const reset = h('button', { class: 'danger', type: 'button', onclick: () => run(reset, 'Odłączanie…', async () => {
      if (!confirm('Odłączyć to urządzenie od chmury? Konfiguracja, sesja i klucze zostaną usunięte z tego urządzenia. Dane lokalne i dane w chmurze pozostaną bez zmian.')) return;
      await resetDevice(store); ui.needConfirm = false; ctx.cloudAuto?.kick(); done('Urządzenie odłączone od chmury. Dane lokalne bez zmian.', 'info');
    }, 'config') }, 'Odłącz to urządzenie');
    add(sec, h('details', { class: 'dn-cloud-cfg' }, h('summary', {}, 'Konfiguracja projektu'),
      h('dl', { class: 'kv' }, h('dt', {}, 'Project URL'), h('dd', { class: 'dn-cloud-v' }, st.config.url),
        h('dt', {}, 'Publishable Key'), h('dd', { class: 'dn-cloud-v' }, maskKey(st.config.key)),
        h('dt', {}, 'Klucze szyfrowania'), h('dd', {}, st.unlocked ? (st.persistentKeys ? 'zapamiętane na tym urządzeniu (nie da się ich odczytać ani skopiować)' : 'tylko do zamknięcia karty') : 'nie podano hasła')),
      h('div', { class: 'row' }, reset)));
  }

  // Fokus na następnym kroku po przerysowaniu (zapis konfiguracji → e-mail → hasło szyfrowania → „Synchronizuj teraz”)
  if (ui.focus && first) { const el = first; ui.focus = null; setTimeout(() => { if (el.isConnected) el.focus(); }, 0); }
  return sec;
}
