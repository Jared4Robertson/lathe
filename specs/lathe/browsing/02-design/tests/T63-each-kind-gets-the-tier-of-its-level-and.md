---
id: LA-BRW-T63
kind: test
title: Each kind gets the tier of its level, and a trace has its own columns
parent: LA-BRW
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-BRW-UC20-R08]
---
Expects product, domain, aggregate and use case, rule and requirement, design records and tests in tiers 0 to 5, every kind below its parent kinds, a kind a product adds one tier below its parent, and trace columns from the rule to the files.
