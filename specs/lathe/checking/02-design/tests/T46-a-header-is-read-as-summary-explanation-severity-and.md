---
id: LA-CHK-T46
kind: test
title: A header is read as summary, explanation, severity and kinds
parent: LA-CHK
test_type: unit
run_by: lathe/test/reference.test.ts
links:
  proves: [LA-CHK-DR24]
---
Reads a header with a list in its explanation and both severities, and headers lacking each part, and expects what each holds and lacks.
