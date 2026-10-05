#!/usr/bin/env bash
# SoftwareOS hook: context-banner (SessionStart)
#
# If softwareos/ exists, prints up to 3 lines of context (customer + mode · branch ->
# epic/spec mapping · open task count). Silent otherwise. Never blocks.
set -euo pipefail
trap 'exit 0' ERR   # banner must never break a session

INPUT="$(cat || true)"

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

CWD="$(json_field cwd)"
if [ -z "$CWD" ]; then CWD="${CLAUDE_PROJECT_DIR:-$PWD}"; fi

ROOT=""
for d in "${CLAUDE_PROJECT_DIR:-}" "$CWD"; do
  if [ -n "$d" ] && [ -d "$d/softwareos" ]; then ROOT="$d"; break; fi
done
if [ -z "$ROOT" ]; then exit 0; fi   # not a SoftwareOS project -> silent

# --- line 1: brand + customer + mode ----------------------------------------
CUSTOMER="$(sed -nE 's/^customer:[[:space:]]*([^[:space:]#]+).*/\1/p' "$ROOT/softwareos/config.yml" 2>/dev/null | head -n 1 || true)"

# Project mode: setup | production, matched case-insensitively.
#
#   absent            -> setup, silently (the compatibility floor)
#   case variant      -> that mode, with a nudge toward canonical lowercase
#   anything else     -> setup, LOUDLY — a typo must never quietly disable the
#                        production gates while the team believes they are on
MODE="$(sed -nE 's/^mode:[[:space:]]*([^[:space:]#]+).*/\1/p' "$ROOT/softwareos/config.yml" 2>/dev/null | head -n 1 || true)"
MODE_LC="$(printf '%s' "$MODE" | tr '[:upper:]' '[:lower:]')"

# A `mode:` key with no value is a half-written config, not an absent key — it
# warns. Only a genuinely missing key is silent.
MODE_KEY_PRESENT=0
if grep -Eq '^mode:' "$ROOT/softwareos/config.yml" 2>/dev/null; then MODE_KEY_PRESENT=1; fi

case "$MODE_LC" in
  production|setup)
    MODE_TXT=" · mode: $MODE_LC"
    if [ "$MODE" != "$MODE_LC" ]; then
      MODE_TXT="$MODE_TXT (config says '$MODE' — canonical form is lowercase)"
    fi
    ;;
  "")
    if [ "$MODE_KEY_PRESENT" = "1" ]; then
      MODE_TXT=" · mode: setup — WARNING: 'mode:' is empty, so production gates are OFF. Valid values: setup, production"
    else
      MODE_TXT=" · mode: setup"
    fi
    ;;
  *)
    MODE_TXT=" · mode: setup — WARNING: '$MODE' is not a valid mode, so production gates are OFF. Valid values: setup, production"
    ;;
esac

if [ -n "$CUSTOMER" ]; then
  echo "SoftwareOS · customer: $CUSTOMER$MODE_TXT"
else
  echo "SoftwareOS$MODE_TXT"
fi

# --- line 2: branch -> epic/spec via branch convention -----------------------
BRANCH="$(git -C "$CWD" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
EPIC=""; SLUG=""; KIND="spec"
case "$BRANCH" in
  feat/*/*)
    REST="${BRANCH#feat/}"; EPIC="${REST%%/*}"
    SLUG="${REST#*/}"; SLUG="${SLUG%%--t*}"   # strip parallel-work suffix --t<id>
    ;;
  hotfix/*/*)
    REST="${BRANCH#hotfix/}"; EPIC="${REST%%/*}"
    SLUG="${REST#*/}"; KIND="bug"
    ;;
esac
if [ -z "$EPIC" ]; then exit 0; fi
echo "branch: $BRANCH → epic: $EPIC · $KIND: $SLUG"

# --- line 3: open tasks from the mapped spec's tasks.md ----------------------
if [ "$KIND" = "spec" ]; then
  TASKS=""
  for t in "$ROOT"/softwareos/products/*/epics/"$EPIC"/specs/*-"$SLUG"/tasks.md "$ROOT/softwareos/epics/$EPIC/specs/"*"-$SLUG/tasks.md"; do
    if [ -f "$t" ]; then TASKS="$t"; break; fi
  done
  if [ -n "$TASKS" ]; then
    TOTAL="$(grep -Ec '^- \[[ x~]\] T' "$TASKS" || true)"   # cancelled excluded
    DONE="$(grep -Ec '^- \[x\] T' "$TASKS" || true)"
    TOTAL="${TOTAL:-0}"; DONE="${DONE:-0}"
    echo "open tasks: $((TOTAL - DONE)) (of $TOTAL)"
  fi
fi

exit 0
