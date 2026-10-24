---
id: LA-CHK-T16
kind: test
title: Every check runs, in file-name order, even after one fails
parent: LA-CHK
test_type: unit
run_by: lathe/test/engine.test.ts
links:
  proves: [LA-CHK-DR09]
---
Runs three checks written out of order, one of which fails, and expects their problems in file-name order, with the failing one reported as an error.
