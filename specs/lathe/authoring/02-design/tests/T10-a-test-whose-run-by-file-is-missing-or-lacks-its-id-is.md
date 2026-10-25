---
id: LA-AUT-T10
kind: test
title: A test whose run_by file is missing or lacks its ID is an error; a missing component file is only a warning
parent: LA-AUT
test_type: unit
run_by: lathe/test/records.test.ts
links:
  proves: [LA-AUT-DR07]
---
Loads tests whose files are missing or do not mention their IDs, and a component whose file is not built yet, and expects two errors (`test-file-missing` and `proof-not-in-file`) and one warning.
