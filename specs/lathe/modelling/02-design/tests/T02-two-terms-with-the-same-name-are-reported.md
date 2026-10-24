---
id: LA-MOD-T02
kind: test
title: Two terms with the same name are reported
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-DR02]
---
Loads a diagram with two terms named `Shelf` and expects a `Duplicate term` problem.
