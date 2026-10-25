---
id: LA-CHK-T322
kind: test
title: A key file that is missing or outside the root is test-file-missing alone; for a planned test a missing one is a warning
parent: LA-CHK
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-CHK-UC27-R02, LA-CHK-DR206]
---
Expects one `test-file-missing` error for a missing key file and one for a key file outside the root, a warning for a planned test's missing key file, no other problem on those tests, and the rule they claim to stay unproved.
