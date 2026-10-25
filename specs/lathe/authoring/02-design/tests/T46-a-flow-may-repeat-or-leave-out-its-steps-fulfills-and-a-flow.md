---
id: LA-AUT-T46
kind: test
title: A flow may repeat or leave out its steps' fulfills, and a flow without steps is not compared
parent: LA-AUT
test_type: unit
run_by: lathe/test/flow-steps.test.ts
links:
  proves: [LA-AUT-UC06-R06, LA-AUT-DR26]
---
Expects no warning for a flow repeating one of its steps' links, one naming none, and one without steps.
