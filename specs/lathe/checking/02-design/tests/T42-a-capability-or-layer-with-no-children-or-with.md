---
id: LA-CHK-T42
kind: test
title: A capability or layer with no children, or with two, is not reported
parent: LA-CHK
test_type: unit
run_by: lathe/test/sizes.test.ts
links:
  proves: [LA-CHK-UC06-R04, LA-CHK-DR21]
---
Expects `lone-child` warnings only for the capability and the layer with one child, and none for an empty capability or ones with two children.
