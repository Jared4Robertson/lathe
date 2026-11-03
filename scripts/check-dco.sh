#!/usr/bin/env bash
# Checks the Developer Certificate of Origin (https://developercertificate.org) on a range of commits: every commit
# that is not a merge must carry a `Signed-off-by: Name <email>` trailer naming its author. Usage:
#   scripts/check-dco.sh <base> <head>     checks the commits in base..head, such as a pull request's
# It prints each commit that fails and exits 1 if any does.
set -u
base="${1:?scripts/check-dco.sh <base> <head>}"
head="${2:?scripts/check-dco.sh <base> <head>}"
commits=$(git rev-list --no-merges "$base..$head") || { echo "Cannot list the commits in $base..$head"; exit 2; }
failed=0
count=0
for sha in $commits; do
  count=$((count + 1))
  author=$(git log -1 --format='%an <%ae>' "$sha")
  if git log -1 --format='%(trailers:key=Signed-off-by,valueonly)' "$sha" | grep -qxF "$author"; then
    echo "ok   $(git log -1 --format='%h %s' "$sha")"
  else
    failed=1
    echo "FAIL $(git log -1 --format='%h %s' "$sha"): no 'Signed-off-by: $author'"
  fi
done
if [ $failed -ne 0 ]; then
  echo "Sign off each commit with 'git commit -s' (or 'git rebase --signoff $base' for a whole branch). See CONTRIBUTING.md."
  exit 1
fi
echo "All $count commits are signed off."
