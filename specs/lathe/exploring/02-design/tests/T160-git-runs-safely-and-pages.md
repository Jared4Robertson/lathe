---
id: LA-EXP-T160
kind: test
title: git runs with an argument array inside the product root, capped and time-limited, and the list pages by skip
parent: LA-EXP
test_type: integration
run_by: lathe/test/history.test.ts
links:
  proves: [LA-EXP-E01-R01, LA-EXP-DR56]
---
Expects shell text in an argument to stay text, git to run at the product root, output past the cap to be cut and marked, a zero time limit to stop it, and a file with twenty-two commits to list twenty with `more`, then the rest.
