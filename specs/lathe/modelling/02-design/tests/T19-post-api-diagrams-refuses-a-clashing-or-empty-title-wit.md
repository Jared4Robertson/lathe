---
id: LA-MOD-T19
kind: test
title: POST /api/diagrams refuses a clashing or empty title with 400 and writes nothing
parent: LA-MOD
test_type: integration
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-UC01-R03]
---
Posts a clashing title, no title and a title with no letters or numbers, and expects `400` with the reason and no file changed.
