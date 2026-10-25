---
id: LA-MOD-T09
kind: test
title: A people-and-tools term with no links is reported
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-DR15]
---
Loads a diagram with an unlinked term in `people_and_tools` and one in another context, and expects only the first reported.
