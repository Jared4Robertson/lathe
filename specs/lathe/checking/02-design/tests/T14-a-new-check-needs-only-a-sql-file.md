---
id: LA-CHK-T14
kind: test
title: A new check needs only a new SQL file
parent: LA-CHK
test_type: unit
run_by: lathe/test/engine.test.ts
links:
  proves: [LA-CHK-UC03-R01]
---
Copies the checks folder, adds one numbered SQL file, and expects its rows as problems named after the file, with no change to the engine.
