---
id: LA-CHK-T06
kind: test
title: Checks can read every loaded table, with file facts already computed
parent: LA-CHK
test_type: unit
run_by: lathe/test/engine.test.ts
links:
  proves: [LA-CHK-UC02-R02]
---
Runs a check that reads the records, fields, links, kinds, relations and file facts tables, and expects the counts and the file facts (file exists, file contains the test ID) to match the fixture.
