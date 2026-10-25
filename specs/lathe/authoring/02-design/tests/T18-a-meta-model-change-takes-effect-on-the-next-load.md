---
id: LA-AUT-T18
kind: test
title: A meta-model change takes effect on the next load and rechecks every record
parent: LA-AUT
test_type: unit
run_by: lathe/test/engine.test.ts
links:
  proves: [LA-AUT-UC03-R01, LA-AUT-UC03-R02, LA-AUT-DR08]
---
Copies the meta-model, adds a kind by editing only `kinds.csv` and expects a record of that kind to become valid, then removes a kind and expects the existing record of that kind to become an `unknown-kind` error.
