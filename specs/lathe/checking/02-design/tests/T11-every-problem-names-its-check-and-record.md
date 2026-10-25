---
id: LA-CHK-T11
kind: test
title: Every problem names its check and, when it has one, its record
parent: LA-CHK
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-CHK-DR02]
---
Expects every problem in every fixture to name its check, to be a sentence, and to name its record's ID in the message; a problem with no record is about a file, the meta-model or a record with no ID.
