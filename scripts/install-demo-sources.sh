#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$ROOT/packages/sources/ci_artifacts.source.yaml"
OUT="$ROOT/packages/sources/ci_artifacts.local.source.yaml"
DEMO="$(cd "$ROOT/packages/sources/demo_data" && pwd)"
sed "s|ABSOLUTE_PATH_TO_DEMO_DATA|$DEMO|g" "$TEMPLATE" > "$OUT"
coral source lint "$OUT"
coral source add --file "$OUT"
coral source test ci_artifacts
echo "Installed ci_artifacts from $OUT"
