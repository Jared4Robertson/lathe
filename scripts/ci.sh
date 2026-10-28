#!/usr/bin/env bash
# The full check, the one definition of "this commit passes": run it here, in a cloud session, or on any
# CI runner. It installs every package, runs each step, records each step's real exit code (never through a
# pipe) and writes a summary to $CI_RESULT (default: ci-result.md in the repo root). It exits non-zero if any
# step failed. The performance suites (timing budgets need a quiet machine) and the desktop smoke test (macOS
# only) are not part of it; run those locally.
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
  if [ $code -ne 0 ]; then failed=1; echo "FAIL $name (exit $code), last lines of $log:"; tail -20 "$log"; else echo "ok   $name"; fi
}

step "Node 26" 'node --version | grep -q "^v26\."'
step "Install" 'npm ci --prefix lathe && npm ci --prefix app && npm ci --prefix desktop && npm ci --prefix examples/tool-library'
step "Install Chromium" 'cd app && npx playwright install --with-deps chromium'
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
step "Stability suite" 'npm --prefix app run test:stability'
step "Accessibility suite" 'npm --prefix app run test:a11y'

{
  echo "# Full check of $(git rev-parse HEAD)"
  echo
  echo "Branch: $(git rev-parse --abbrev-ref HEAD). Result: $([ $failed -eq 0 ] && echo PASSED || echo FAILED)."
  echo
  echo "| Step | Exit | Time |"
  echo "| --- | --- | --- |"
  printf '%s\n' "${rows[@]}"
} > "$result"
cat "$result"
exit $failed
