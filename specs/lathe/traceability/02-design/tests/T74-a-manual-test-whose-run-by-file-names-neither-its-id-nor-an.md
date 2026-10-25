---
id: LA-TRC-T74
kind: test
title: A manual test whose run_by file names neither its ID, nor an ID it proves, nor its key is reported
parent: LA-TRC
test_type: unit
run_by: lathe/test/owed-and-silent.test.ts
links:
  proves: [LA-TRC-UC08-R03, LA-TRC-DR27]
---
Expects `manual-test-file-silent` on a manual test whose file is silent, and on one with a key the file lacks, naming the key.
