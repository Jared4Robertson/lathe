---
id: LA-CHK-T55
kind: test
title: A manual or planned test's run_by is checked only for existing
parent: LA-CHK
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-CHK-UC08-R03]
---
Loads a manual test naming a missing file and expects `test-file-missing`, and a planned test naming an existing file that does not mention it and expects no error.
