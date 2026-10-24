---
id: LA-CHK-T20
kind: test
title: A meta-model change takes effect on the next load and rechecks every record
parent: LA-CHK
test_type: unit
run_by: lathe/test/engine.test.ts
links:
  proves: [LA-CHK-UC05-R01, LA-CHK-UC05-R02, LA-CHK-DR01]
---
Copies the meta-model, adds a kind by editing only `kinds.csv` and expects a record of that kind to become valid, then removes a kind and expects the existing record of that kind to become an `unknown-kind` error.
