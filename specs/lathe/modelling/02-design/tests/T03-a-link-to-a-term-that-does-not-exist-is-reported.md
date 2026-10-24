---
id: LA-MOD-T03
kind: test
title: A link to a term that does not exist is reported
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-DR03]
---
Loads a diagram whose links name missing terms at either end and expects each such link reported, and no other.
