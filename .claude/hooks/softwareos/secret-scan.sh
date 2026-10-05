#!/usr/bin/env bash
# SoftwareOS hook: secret-scan (PreToolUse, matcher: Bash)
#
# Runs only when the command is a `git commit`. Scans STAGED changes for
# secrets: gitleaks if installed, otherwise a regex scan of `git diff --staged`.
# Blocks on a hit and lists the offending files.
# Escape hatch: SOFTWAREOS_ALLOW_GIT=1 (rotate the secret first if it is real).
set -euo pipefail

INPUT="$(cat)"

# Fast path on the RAW payload (before any JSON parsing): not a git commit
# anywhere in sight -> allow.
case "$INPUT" in
  *git*commit*|*commit*git*) ;;
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

# Fast path: only act on git commit commands (handles `git -C x commit` too).
if ! printf '%s' "$CMD" | grep -Eq -e '(^|[;&|[:space:]])git[[:space:]]+([^|;&]*[[:space:]])?commit([[:space:];&|]|$)'; then
  exit 0
fi

if [ "${SOFTWAREOS_ALLOW_GIT:-0}" = "1" ]; then
  exit 0
fi

CWD="$(json_field cwd)"
if [ -z "$CWD" ]; then CWD="${CLAUDE_PROJECT_DIR:-$PWD}"; fi

# Not a git repo (or git missing) -> nothing to scan.
if ! git -C "$CWD" rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

# --- preferred path: gitleaks ----------------------------------------------
if command -v gitleaks >/dev/null 2>&1; then
  if out="$(cd "$CWD" && gitleaks protect --staged --no-banner --redact 2>&1)"; then
    exit 0
  else
    printf 'SoftwareOS secret-scan BLOCKED this commit: gitleaks found secrets in staged changes.\n%s\nRemove the secret (git restore --staged <file>, scrub, rotate if it ever was real), then commit again. Confirmed false positive: rerun with SOFTWAREOS_ALLOW_GIT=1.\n' "$out" >&2
    exit 2
  fi
fi

# --- fallback: regex scan of staged additions -------------------------------
PAT_CS='AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
PAT_CI="(api[_-]?key|secret|token)[[:space:]]*[:=][[:space:]]*['\"][A-Za-z0-9_-]{16,}"

OFFENDERS=""
while IFS= read -r -d '' f; do
  if [ -z "$f" ]; then continue; fi
  added="$(git -C "$CWD" diff --staged -- "$f" | grep -E '^\+' | grep -Ev '^\+\+\+' || true)"
  if [ -z "$added" ]; then continue; fi
  if printf '%s\n' "$added" | grep -Eq -e "$PAT_CS" \
     || printf '%s\n' "$added" | grep -Eiq -e "$PAT_CI"; then
    OFFENDERS="${OFFENDERS}  - ${f}"$'\n'
  fi
done < <(git -C "$CWD" diff --staged --name-only -z 2>/dev/null || true)

if [ -n "$OFFENDERS" ]; then
  printf 'SoftwareOS secret-scan BLOCKED this commit: possible secrets in staged changes:\n%sRemove the secret (git restore --staged <file>, scrub, rotate if it ever was real), then commit again. Confirmed false positive: rerun with SOFTWAREOS_ALLOW_GIT=1.\n' "$OFFENDERS" >&2
  exit 2
fi

exit 0
