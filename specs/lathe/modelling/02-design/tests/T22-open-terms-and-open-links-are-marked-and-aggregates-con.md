---
id: LA-MOD-T22
kind: test
title: Open terms and open links are marked, and aggregates contain their parts
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-UC02-R04]
---
Lays out a fixture diagram with the app's `layout.ts` and expects parts placed inside their aggregate, an open term to keep its `open` status, and open or ambiguous links marked uncertain.
