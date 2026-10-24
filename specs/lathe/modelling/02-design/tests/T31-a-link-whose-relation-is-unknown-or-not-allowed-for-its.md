---
id: LA-MOD-T31
kind: test
title: A link whose relation is unknown or not allowed for its kinds is an error
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-DR11]
---
Loads a view with a disallowed `applies` link and an unknown relation and expects one error of each.
