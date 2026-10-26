---
id: LA-AUT-T133
kind: test
title: A technical step's satisfies counts as design, but only a component whose file exists counts as built
parent: LA-AUT
test_type: unit
run_by: lathe/test/apis-and-design-flows.test.ts
links:
  proves: [LA-AUT-UC17-R04, LA-AUT-DR79]
---
Expects obligations designed only by technical steps to count as designed and not built, and no `unsatisfied` warning or satisfies gap.
