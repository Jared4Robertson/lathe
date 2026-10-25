---
id: LA-CHK-T284
kind: test
title: A capability with exactly one child is a warning naming the child
parent: LA-CHK
test_type: unit
run_by: lathe/test/sizes.test.ts
links:
  proves: [LA-CHK-UC23-R03, LA-CHK-DR175]
---
Expects a `lone-child` warning for a capability holding one use case, naming both and saying to merge it into a neighboring capability or give it more.
