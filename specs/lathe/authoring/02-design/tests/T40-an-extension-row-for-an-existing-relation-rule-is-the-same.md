---
id: LA-AUT-T40
kind: test
title: An extension row for an existing relation rule is the same rule, and its non-empty role, description or label replaces the default's
parent: LA-AUT
test_type: unit
run_by: lathe/test/structure.test.ts
links:
  proves: [LA-CHK-UC04-R05, LA-AUT-DR23, LA-AUT-DR62]
---
Loads an extension that rewords `proves` to domain rules and gives `fulfills` from flow to requirement the role `design` and a new reverse label; expects each rule once with the new values, the defaults in order, and the flow's requirement counted as designed.
