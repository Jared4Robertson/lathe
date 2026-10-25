---
id: LA-AUT-T118
kind: test
title: The record actions take only a known action and a record ID, and find the spec file themselves
parent: LA-AUT
test_type: unit
run_by: desktop/test/records.test.ts
links:
  proves: [LA-AUT-UC15-R01, LA-PLT-DR38]
---
Accepts each action with a record ID; refuses paths, unknown actions, lower-case and malformed IDs, group IDs and extra keys; finds files by front matter ID, skipping hidden folders and other files, and again after a file moves; and builds the native menu, with reveal and open disabled for a record with no file.
