---
id: LA-AUT-T63
kind: test
title: A meta-model without sections.csv has no folders
parent: LA-AUT
test_type: unit
run_by: lathe/test/sections.test.ts
links:
  proves: [LA-AUT-UC09-R01]
---
Expects no folders, no kind in a folder, and no folder problems when the meta-model folder has no `sections.csv` and its `kinds.csv` no `section` column.
