---
id: LA-CHK-T58
kind: test
title: A relation row identical to a default one changes nothing
parent: LA-CHK
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-CHK-UC09-R03]
---
Loads an extension that repeats a default relation row and adds one new one, and expects one more relation than the defaults and no `meta-duplicate-relation` error.
