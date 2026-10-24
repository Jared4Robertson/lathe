---
id: LA-CHK-T110
kind: test
title: "A file that names the test's own ID accepts all its claims"
parent: LA-CHK
test_type: unit
run_by: lathe/test/proof-claims.test.ts
links:
  proves: [LA-CHK-UC12-R01, LA-CHK-DR60]
---
Loads a test that proves two rules while its file names only the test's ID, and expects no error on it.
