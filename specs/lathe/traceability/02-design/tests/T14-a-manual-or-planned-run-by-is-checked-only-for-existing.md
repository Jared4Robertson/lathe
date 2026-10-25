---
id: LA-TRC-T14
kind: test
title: A manual or planned test's run_by is checked only for existing
parent: LA-TRC
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-TRC-UC03-R03]
---
Loads a manual test naming a missing file and expects `test-file-missing`, and a planned test naming an existing file that does not mention it and expects no error.
