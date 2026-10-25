---
id: LA-BRW-T63
kind: test
title: Columns follow the parent/child tree, and a trace has its own columns
parent: LA-BRW
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-BRW-UC20-R08]
---
Expects a requirement's ancestors in columns 0 to 3, the domain's other children beside the use case whatever their kind, every parent line running from one column to the next, and trace columns from the rule to the files, with a kind a product adds placed with the components.
