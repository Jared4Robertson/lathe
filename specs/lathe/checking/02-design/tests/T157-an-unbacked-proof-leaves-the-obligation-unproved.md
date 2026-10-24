---
id: LA-CHK-T157
kind: test
title: "An unbacked automated proof leaves the obligation unproved, as coverage does"
parent: LA-CHK
test_type: unit
run_by: lathe/test/product-checks.test.ts
links:
  proves: [LA-CHK-DR93]
---
Proves three rules with three automated tests: one whose file names nothing, one whose file names its rule, one whose file names its own ID. Expects `unproved` and a coverage gap for the first rule only, with its `proof-not-in-file` error.
