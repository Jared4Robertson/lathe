---
id: LA-CHK-T198
kind: test
title: "A flow may repeat or leave out its steps' fulfills, and a flow without steps is not compared"
parent: LA-CHK
test_type: unit
run_by: lathe/test/flow-steps.test.ts
links:
  proves: [LA-CHK-UC17-R06, LA-CHK-DR112]
---
Expects no warning for a flow repeating one of its steps' links, one naming none, and one without steps.
