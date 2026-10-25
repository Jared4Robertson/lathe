---
id: LA-MOD-T07
kind: test
title: Aggregates raise domain events, and only domain events change things
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-DR13]
---
Loads a diagram with `raises` links from a non-aggregate and to a non-event, and a `changes` link from an aggregate, and expects exactly those three reported.
