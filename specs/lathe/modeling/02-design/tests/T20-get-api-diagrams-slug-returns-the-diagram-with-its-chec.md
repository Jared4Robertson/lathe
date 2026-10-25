---
id: LA-MOD-T20
kind: test
title: GET /api/diagrams/<slug> returns the diagram with its check result, or 404
parent: LA-MOD
test_type: integration
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-UC02-R02, LA-MOD-E03-R01]
---
Gets a clean and a broken diagram and expects their check results, then expects `404` for unregistered, unknown and malformed slugs and `405` for other methods.
