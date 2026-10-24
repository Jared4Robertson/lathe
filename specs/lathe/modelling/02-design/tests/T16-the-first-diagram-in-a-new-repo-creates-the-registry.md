---
id: LA-MOD-T16
kind: test
title: The first diagram in a new repo creates the registry
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-UC01-R02]
---
Creates a diagram where no diagrams folder exists and expects `diagrams.csv` to be created with its header and the new row.
