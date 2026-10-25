---
id: LA-CHK-T278
kind: test
title: A record with exactly maxChildren children of a kind is not reported
parent: LA-CHK
test_type: unit
run_by: lathe/test/sizes.test.ts
links:
  proves: [LA-CHK-UC23-R01, LA-CHK-DR170]
---
With `maxChildren` 3, expects no warning for an aggregate with 3 domain rules.
