---
id: LA-CHK-T196
kind: test
title: A step whose flow carries out nothing is not compared, and a missing target is only a dangling link
parent: LA-CHK
test_type: unit
run_by: lathe/test/flow-steps.test.ts
links:
  proves: [LA-CHK-DR113]
---
Expects no step warning for a flow that carries out no use case, and only `dangling-link` for a step target that does not exist.
