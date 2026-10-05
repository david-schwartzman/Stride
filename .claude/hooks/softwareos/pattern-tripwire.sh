#!/usr/bin/env bash
# pattern-tripwire.sh — SessionStart nudge to run /curate when enough has changed.
# Cheap and heuristic: it does NOT do semantic detection (that's the curator agent
# behind /curate). It just tells you WHEN a sweep is worthwhile. Never blocks.
set -euo pipefail
trap 'exit 0' ERR

THRESHOLD="${SOFTWAREOS_CURATE_THRESHOLD:-20}"

# Find the softwareos/ root (project dir first, then cwd); silent if not onboarded.
root=""
for base in "${CLAUDE_PROJECT_DIR:-}" "$PWD"; do
  [ -n "$base" ] || continue
  if [ -d "$base/softwareos" ]; then root="$base"; break; fi
done
[ -n "$root" ] || exit 0

# Must be a git repo to count changes.
git -C "$root" rev-parse --git-dir >/dev/null 2>&1 || exit 0

state="$root/softwareos/.curate.yml"
sha=""
if [ -f "$state" ]; then
  sha="$(grep -oE 'sha:[[:space:]]*[0-9a-f]{7,40}' "$state" 2>/dev/null | head -1 | sed -E 's/sha:[[:space:]]*//')"
fi

if [ -n "$sha" ] && git -C "$root" cat-file -e "$sha" 2>/dev/null; then
  n="$(git -C "$root" rev-list --count "$sha"..HEAD 2>/dev/null || echo 0)"
  if [ "${n:-0}" -ge "$THRESHOLD" ]; then
    echo "SoftwareOS · $n changes since your last /curate — run /curate to codify recurring patterns as standards or skills."
  fi
elif [ ! -f "$state" ]; then
  # Never curated. Only nudge on an actively-developed repo.
  total="$(git -C "$root" rev-list --count HEAD 2>/dev/null || echo 0)"
  if [ "${total:-0}" -ge "$THRESHOLD" ]; then
    echo "SoftwareOS · this project hasn't had a /curate sweep yet — run /curate to codify recurring patterns as standards or skills."
  fi
fi

exit 0
