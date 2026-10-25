---
id: LA-CHK-T326
kind: test
title: No gap is reported on a path that has an order that is not a whole number, or a step with no order
parent: LA-CHK
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-CHK-UC27-R03, LA-CHK-DR208]
---
Expects a path with an order that is not a whole number, and a path with a step that has no order, to be reported only for those, with no gap error.
