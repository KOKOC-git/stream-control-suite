#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/android"

grep -R "discovery.scan" -n app/src/main/java >/dev/null
grep -R "private val discovery = ServerDiscovery" -n app/src/main/java >/dev/null
! grep -R "quality.title" -n app/src/main/java

grep -R "@OptIn(ExperimentalMaterial3Api::class)" -n app/src/main/java >/dev/null

echo "Статические проверки Android пройдены."
