---
id: LA-CHK-T280
kind: test
title: Tests are never counted, however many a record holds
parent: LA-CHK
test_type: unit
run_by: lathe/test/sizes.test.ts
links:
  proves: [LA-CHK-UC23-R01, LA-CHK-DR174]
---
Expects no warning for a domain holding 5 tests directly, with `maxChildren` 3.
