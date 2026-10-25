---
id: LA-PLT-T05
kind: test
title: Each load reads the files afresh and writes nothing
parent: LA-PLT
test_type: unit
run_by: lathe/test/engine.test.ts
links:
  proves: [LA-PLT-DR01]
---
Loads a copy of a fixture, edits a record, loads again, and expects the second load to show the edit and the folder to hold no new files.
