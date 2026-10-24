---
id: LA-MOD-T26
kind: test
title: Two records with the same ID are an error, even in different products
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-DR06]
---
Loads a workspace in which two products each hold a record with the same ID and expects one `duplicate-id` error.
