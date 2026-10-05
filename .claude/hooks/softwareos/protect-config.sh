#!/usr/bin/env bash
# SoftwareOS hook: protect-config (PreToolUse, matcher: Write|Edit)
#
# Blocks edits to linter/formatter/TS/CI config files — fix the code, not the
# linter. Escape hatch: SOFTWAREOS_ALLOW_CONFIG=1.
set -euo pipefail

INPUT="$(cat)"

# Fast path on the RAW payload (before any JSON parsing): no protected config
# name anywhere -> allow.
case "$INPUT" in
  *eslint*|*biome.json*|*prettier*|*ruff.toml*|*.rubocop.yml*|*tsconfig*|*.github/workflows/*) ;;
  *) exit 0 ;;
esac

# --- JSON field extraction (python3, fallback: sed) ------------------------
json_field() {
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print(""); sys.exit(0)
for k in sys.argv[1].split("."):
    d = d.get(k) if isinstance(d, dict) else None
print(d if isinstance(d, str) else "")
' "$1" 2>/dev/null || true
  else
    key="${1##*.}"
    printf '%s' "$INPUT" \
      | sed -nE "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"((\\\\.|[^\"\\\\])*)\".*/\1/p" \
      | head -n 1
  fi
}

FILE="$(json_field tool_input.file_path)"

# Fast path: no file path -> not our concern.
if [ -z "$FILE" ]; then exit 0; fi

if [ "${SOFTWAREOS_ALLOW_CONFIG:-0}" = "1" ]; then
  exit 0
fi

block() {
  printf 'SoftwareOS protect-config BLOCKED an edit to %s.\nFix the code, not the linter/CI. Set SOFTWAREOS_ALLOW_CONFIG=1 to override deliberately.\n' "$FILE" >&2
  exit 2
}

BASE="$(basename "$FILE")"
case "$BASE" in
  .eslintrc*|eslint.config.*|biome.json*|.prettierrc*|prettier.config.*|ruff.toml|.rubocop.yml|tsconfig*.json)
    block
    ;;
esac

case "$FILE" in
  *.github/workflows/*)
    block
    ;;
esac

exit 0
