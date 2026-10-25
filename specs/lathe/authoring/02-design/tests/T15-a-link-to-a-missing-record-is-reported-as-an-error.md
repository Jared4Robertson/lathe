---
id: LA-AUT-T15
kind: test
title: A link to a missing record is reported as an error
parent: LA-AUT
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-AUT-DR05, LA-CHK-UC01-R04]
---
Loads a fixture with a link to an ID that no record has and expects a `dangling-link` error on the linking record.
