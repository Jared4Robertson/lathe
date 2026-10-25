---
id: LA-TRC-T80
kind: test
title: A key file that is missing or outside the root is test-file-missing alone; for a planned test a missing one is a warning
parent: LA-TRC
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-TRC-UC03-R05, LA-TRC-DR31]
---
Expects one `test-file-missing` error for a missing key file and one for a key file outside the root, a warning for a planned test's missing key file, no other problem on those tests, and the rule they claim to stay unproved.
