---
id: LA-MOD-T28
kind: test
title: A missing, unknown, disallowed or looping parent is an error, as is a product with a parent
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-DR08]
---
Loads records that break each parent rule and expects one error of the matching check against each.
