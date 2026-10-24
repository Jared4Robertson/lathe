---
id: LA-CHK-T118
kind: test
title: "A manual or planned test's file is not checked for its claims"
parent: LA-CHK
test_type: unit
run_by: lathe/test/proof-claims.test.ts
links:
  proves: [LA-CHK-UC12-R05, LA-CHK-DR63]
---
Loads a manual and a planned test that each prove two rules while their file names one, and expects no error on either.
