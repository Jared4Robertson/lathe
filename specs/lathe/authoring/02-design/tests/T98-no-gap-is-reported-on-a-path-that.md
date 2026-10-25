---
id: LA-AUT-T98
kind: test
title: No gap is reported on a path that has an order that is not a whole number, or a step with no order
parent: LA-AUT
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-AUT-UC14-R03, LA-AUT-DR69]
---
Expects a path with an order that is not a whole number, and a path with a step that has no order, to be reported only for those, with no gap error.
