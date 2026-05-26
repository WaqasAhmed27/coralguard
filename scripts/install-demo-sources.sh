#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORAL_BIN="${CORAL_BIN:-$ROOT/.tools/coral/coral.exe}"
DEMO="$(cd "$ROOT/packages/sources/demo_data" && pwd)"
for source in github ci_artifacts sentry slack_incidents support flags osv; do
  TEMPLATE="$ROOT/packages/sources/$source.source.yaml"
  OUT="$ROOT/packages/sources/$source.local.source.yaml"
  sed "s|ABSOLUTE_PATH_TO_DEMO_DATA|$DEMO|g" "$TEMPLATE" > "$OUT"
  "$CORAL_BIN" source lint "$OUT"
  "$CORAL_BIN" source add --file "$OUT"
  "$CORAL_BIN" source test "$source"
done
echo "Installed CoralGuard demo sources with $CORAL_BIN"
