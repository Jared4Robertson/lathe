---
id: LA-CHK-T35
kind: test
title: Tests are never counted, however many a record holds
parent: LA-CHK
test_type: unit
run_by: lathe/test/sizes.test.ts
links:
  proves: [LA-CHK-UC06-R01, LA-CHK-DR18]
---
Expects no warning for a domain holding 5 tests directly, with `maxChildren` 3.
