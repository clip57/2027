#!/usr/bin/env bash
# Strażnik wizualny w CI (D-115, T5 audytu 10.11): zrzuty wszystkich widoków (390 i 1280 px, motyw ciemny i jasny) dla commitu bazowego
# i bieżącego, zbudowanych na tej samej maszynie, i porównanie piksel w piksel (tools/visual/compare.py, z tolerancją szumu krawędzi).
# Użycie: tools/visual/ci.sh <commit bazowy> <katalog wyników>   (katalog: przed/, po/, roznice/ + podsumowanie.md)
# Kod wyjścia jak compare.py: 0 — bez zmian wyglądu, 1 — zmiany, 2 — brakujące zrzuty. O tym, czy zmiana to błąd, decyduje workflow
# (osobna linia „[wygląd bez zmian]” w opisie commitu = każda różnica jest błędem).
set -euo pipefail
BASE="$1"; OUT="${2:-${TMPDIR:-/tmp}/wizualny}"
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
WT="$(mktemp -d)/baza"
git worktree add --detach "$WT" "$BASE" >/dev/null
trap 'git -C "$ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || true' EXIT
echo "Baza: $(git -C "$WT" log -1 --format='%h %s')"
(cd "$WT" && npm ci --silent --no-audit --no-fund && npm run -s build)
rm -rf "$OUT"; mkdir -p "$OUT"
APP_ROOT="$WT" python3 tools/visual/snap.py "$OUT/przed" 390,1280 dark,light
npm run -s build
python3 tools/visual/snap.py "$OUT/po" 390,1280 dark,light
set +e; python3 tools/visual/compare.py "$OUT/przed" "$OUT/po" "$OUT/roznice"; rc=$?; set -e
exit $rc
