#!/usr/bin/env bash
# The checks, one definition of each: run them here, in a cloud session, or on any CI runner.
#   scripts/ci.sh            the merge gate: types, knip, every package's unit tests and lathe check.
#   scripts/ci.sh --title "feat(server): ..."  also checks the planned squash commit's title carries a type.
#   scripts/ci.sh --browser  the browser batch: the stability, accessibility and phone suites, run in batches on
#                            main, never as a merge gate.
# It installs what it needs, records each step's real exit code (never through a pipe) and writes a summary
# to $CI_RESULT (default: ci-result.md in the repo root). It exits non-zero if any step failed. The
# performance suites (timing budgets need a quiet machine) and the desktop smoke test (macOS only) run locally.
set -u
cd "$(dirname "$0")/.."
result="${CI_RESULT:-ci-result.md}"
logs="${CI_LOGS:-ci-logs}"
mkdir -p "$logs"
export ELECTRON_SKIP_BINARY_DOWNLOAD=1

failed=0
rows=()
step() {
  local name="$1"; shift
  local log="$logs/$(echo "$name" | tr ' A-Z' '-a-z').log"
  local start=$SECONDS
  bash -c "$*" > "$log" 2>&1
  local code=$?
  rows+=("| $name | $code | $((SECONDS - start))s |")
  if [ $code -ne 0 ]; then
    failed=1
    echo "FAIL $name (exit $code), last lines of $log:"
    tail -20 "$log"
    # A browser suite prints its measures after its summary, so the tests that failed are listed here on their own.
    grep -E '^[[:space:]]+([0-9]+ (failed|flaky)$|\[[^]]+\] › )' "$log" | sort -u | head -80
  else
    echo "ok   $name"
  fi
}

mode=gate
title=""
while [ $# -gt 0 ]; do
  case "$1" in
    --browser) mode=--browser; shift ;;
    --title) title="${2:?--title needs the title}"; shift 2 ;;
    *) echo "Unknown option $1: scripts/ci.sh [--browser] [--title \"type(scope): summary\"]"; exit 2 ;;
  esac
done

step "Node 26" 'node --version | grep -q "^v26\."'
step "Install" 'npm ci --prefix lathe && npm ci --prefix app && npm ci --prefix desktop && npm ci --prefix examples/tool-library'
if [ "$mode" = "--browser" ]; then
step "Install Chromium" 'cd app && npx playwright install --with-deps chromium'
step "Stability suite" 'npm --prefix app run test:stability'
step "Accessibility suite" 'npm --prefix app run test:a11y'
step "Phone suite" 'npm --prefix app run test:mobile'

else
if [ -n "$title" ]; then
  export SQUASH_TITLE="$title"
  step "Squash title" 'node lathe/scripts/check-commits.ts --title "$SQUASH_TITLE"'
else
  echo "note Squash title not checked: pass --title \"type(scope): summary\" to check the title the change lands on main with."
fi
step "Lathe types" 'npm --prefix lathe run typecheck'
step "App types" 'cd app && npx tsc --noEmit'
step "Desktop types" 'npm --prefix desktop run typecheck'
step "Tool Library types" 'npm --prefix examples/tool-library run typecheck'
step "Knip" 'npm --prefix lathe run knip && npm --prefix app run knip && npm --prefix desktop run knip'
step "Lathe tests" 'npm --prefix lathe test'
step "App tests" 'npm --prefix app test'
step "Desktop tests" 'npm --prefix desktop test'
step "Tool Library tests" 'npm --prefix examples/tool-library test'
step "lathe check" 'npm --prefix lathe run check'
fi
{
  echo "# $([ "$mode" = "--browser" ] && echo "Browser batch" || echo "Merge gate") of $(git rev-parse HEAD)"
  echo
  echo "Branch: $(git rev-parse --abbrev-ref HEAD). Result: $([ $failed -eq 0 ] && echo PASSED || echo FAILED)."
  echo
  echo "| Step | Exit | Time |"
  echo "| --- | --- | --- |"
  printf '%s\n' "${rows[@]}"
} > "$result"
cat "$result"
exit $failed
