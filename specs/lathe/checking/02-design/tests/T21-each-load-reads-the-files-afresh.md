---
id: LA-CHK-T21
kind: test
title: Each load reads the files afresh and writes nothing
parent: LA-CHK
test_type: unit
run_by: lathe/test/engine.test.ts
links:
  proves: [LA-CHK-DR04]
---
Loads a copy of a fixture, edits a record, loads again, and expects the second load to show the edit and the folder to hold no new files.
