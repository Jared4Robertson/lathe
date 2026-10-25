---
id: LA-TRC-T44
kind: test
title: A manual or planned test's file is not checked for its claims
parent: LA-TRC
test_type: unit
run_by: lathe/test/proof-claims.test.ts
links:
  proves: [LA-TRC-UC05-R05, LA-TRC-DR14]
---
Loads a manual and a planned test that each prove two rules while their file names one, and expects no error on either.
