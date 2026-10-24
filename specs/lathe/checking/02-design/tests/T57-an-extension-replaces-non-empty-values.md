---
id: LA-CHK-T57
kind: test
title: An extension's non-empty values replace the default's and empty ones keep it
parent: LA-CHK
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-CHK-UC09-R02, LA-CHK-DR31]
---
Checks that the widened kind takes the extension's label and keeps the default's stage, obligation and description, and that a new kind is added after Lathe's own.
