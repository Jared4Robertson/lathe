---
id: LA-TRC-T45
kind: test
title: An unbacked automated proof leaves the obligation unproved, as coverage does
parent: LA-TRC
test_type: unit
run_by: lathe/test/product-checks.test.ts
links:
  proves: [LA-TRC-DR15]
---
Proves three rules with three automated tests: one whose file names nothing, one whose file names its rule, one whose file names its own ID. Expects `unproved` and a coverage gap for the first rule only, with its `proof-not-in-file` error.
