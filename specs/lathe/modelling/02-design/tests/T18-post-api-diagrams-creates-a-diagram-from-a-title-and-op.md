---
id: LA-MOD-T18
kind: test
title: POST /api/diagrams creates a diagram from a title and optional description
parent: LA-MOD
test_type: integration
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-UC01-R01]
---
Calls the API handler with a fake request, with and without a description, and expects `201` with the trimmed title, the derived slug and the new diagram in the list.
