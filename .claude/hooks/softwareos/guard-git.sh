#!/usr/bin/env bash
# SoftwareOS hook: guard-git (PreToolUse, matcher: Bash)
#
# Blocks: `git commit --no-verify` · force-push to the default branch ·
# `git commit` while on the default branch.
# Warns (non-blocking): new branch name off the SoftwareOS convention.
# Escape hatch: SOFTWAREOS_ALLOW_GIT=1 skips every check.
#
# Flags are matched as words ANYWHERE in the command, so a commit message
# containing "--no-verify" will trip the check — that is deliberate; use the
# escape hatch for the rare false positive.
set -euo pipefail

INPUT="$(cat)"

# Fast path on the RAW payload (before any JSON parsing — keeps irrelevant
# commands under a few ms): no "git" anywhere -> allow.
case "$INPUT" in
  *git*) ;;
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

CMD="$(json_field tool_input.command)"

# Fast path: not a git command -> allow immediately.
case "$CMD" in
  *git*) ;;
  *) exit 0 ;;
esac

if [ "${SOFTWAREOS_ALLOW_GIT:-0}" = "1" ]; then
  exit 0
fi

block() {
  printf 'SoftwareOS guard-git BLOCKED this command.\n%s\nDeliberate override: rerun with SOFTWAREOS_ALLOW_GIT=1.\n' "$1" >&2
  exit 2
}

# Word match anywhere in the command (BSD/GNU-safe ERE, no \b).
has_word() {
  printf '%s' "$CMD" | grep -Eq -e "(^|[^[:alnum:]_-])$1(\$|[^[:alnum:]_-])"
}

# `git <flags...> <sub>` within one shell command segment (handles `git -C x push`).
is_git_sub() {
  printf '%s' "$CMD" | grep -Eq -e "(^|[;&|[:space:]])git[[:space:]]+([^|;&]*[[:space:]])?$1([[:space:];&|]|\$)"
}

# --- context: cwd + default branch from softwareos/config.yml --------------
CWD="$(json_field cwd)"
if [ -z "$CWD" ]; then CWD="${CLAUDE_PROJECT_DIR:-$PWD}"; fi

DEFAULT_BRANCH="main"
for cfg in "${CLAUDE_PROJECT_DIR:-$CWD}/softwareos/config.yml" "$CWD/softwareos/config.yml"; do
  if [ -f "$cfg" ]; then
    b="$(sed -nE 's/^default_branch:[[:space:]]*([^[:space:]#]+).*/\1/p' "$cfg" | head -n 1)"
    if [ -n "$b" ]; then DEFAULT_BRANCH="$b"; fi
    break
  fi
done

current_branch() { git -C "$CWD" symbolic-ref --short HEAD 2>/dev/null || git -C "$CWD" rev-parse --abbrev-ref HEAD 2>/dev/null || true; }

# --- check 1+2: git commit ---------------------------------------------------
if is_git_sub commit; then
  if has_word '[-][-]no-verify'; then
    block "Reason: --no-verify skips the repo's verification hooks. Fix the failing check instead of bypassing it. (If --no-verify only appears inside quoted text such as a commit message, this is a false positive — use the override.)"
  fi
  if [ "$(current_branch)" = "$DEFAULT_BRANCH" ]; then
    block "Reason: committing directly on '$DEFAULT_BRANCH' is not allowed. Create a work branch first, per the SoftwareOS convention: feat/<epic-slug>/<spec-slug> · hotfix/<epic-slug>/<bug-slug> · chore/<slug>."
  fi
fi

# --- check 3: force push to the default branch -----------------------------
if is_git_sub push; then
  if has_word '[-][-]force' || has_word '[-][-]force-with-lease' || has_word '[-]f'; then
    if has_word "$DEFAULT_BRANCH" || [ "$(current_branch)" = "$DEFAULT_BRANCH" ]; then
      block "Reason: force-pushing to '$DEFAULT_BRANCH' rewrites shared history. If you must rewrite a feature branch, name it explicitly and make sure '$DEFAULT_BRANCH' is not the target."
    fi
  fi
fi

# --- check 4 (warn only): off-convention branch names -----------------------
NEW_BRANCH="$(printf '%s' "$CMD" \
  | sed -nE 's/.*(checkout[[:space:]]+-b|switch[[:space:]]+-c)[[:space:]]+([^[:space:];&|"'"'"']+).*/\2/p' \
  | head -n 1)"
if [ -n "$NEW_BRANCH" ]; then
  case "$NEW_BRANCH" in
    feat/*/*|hotfix/*/*|chore/*) ;;
    *)
      printf '{"systemMessage":"SoftwareOS guard-git: branch \\"%s\\" does not match the convention (feat/<epic>/<spec>, hotfix/<epic>/<bug>, chore/<slug>) — /project-status will not track it."}' "$NEW_BRANCH"
      exit 0
      ;;
  esac
fi

exit 0
