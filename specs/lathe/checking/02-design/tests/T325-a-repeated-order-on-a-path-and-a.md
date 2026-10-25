---
id: LA-CHK-T325
kind: test
title: A repeated order on a path, and a path whose numbering skips, are flow-step-order errors
parent: LA-CHK
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-CHK-UC27-R03, LA-CHK-DR110, LA-CHK-DR208]
---
Expects a `flow-step-order` error on each of two steps of a path with the same order, naming the path, and one error per path whose orders skip numbers, on the first step after the first gap and naming every missing number.
