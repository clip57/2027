// Typy globalne dla kontroli `tsc --noEmit` (D-115, T3) — tylko deklaracje, nic nie trafia do buildu.
declare const __PLAN_FILES__: Record<string, string> | undefined;   // wstrzykiwane przez tools/build.mjs (wariant web)
interface Navigator { standalone?: boolean }                         // Safari na iOS: aplikacja z ekranu początkowego
interface Window {
  webkitAudioContext?: typeof AudioContext;                          // starsze Safari
  trustedTypes?: { createPolicy?: (name: string, rules: { createScriptURL?: (u: string) => string }) => { createScriptURL: (u: string) => any } };   // Trusted Types (D-115)
}
