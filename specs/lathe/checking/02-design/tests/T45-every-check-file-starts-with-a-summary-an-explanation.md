---
id: LA-CHK-T45
kind: test
title: Every check file starts with a summary, an explanation and a severity line that matches its SQL
parent: LA-CHK
test_type: unit
run_by: lathe/test/reference.test.ts
links:
  proves: [LA-CHK-DR24, LA-CHK-DR25]
---
Reads every check in `lathe/checks/` and expects a complete header with a one-sentence summary, and a severity line naming exactly the severities its SELECT returns.
