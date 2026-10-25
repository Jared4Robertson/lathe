---
id: LA-MOD-T13
kind: test
title: A diagrams folder with no registry lists no diagrams
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-UC02-R01]
---
Expects an empty list for a missing diagrams folder and for a `diagrams.csv` holding only its header.
