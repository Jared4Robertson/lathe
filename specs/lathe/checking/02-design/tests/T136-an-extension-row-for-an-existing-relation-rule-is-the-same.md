---
id: LA-CHK-T136
kind: test
title: "An extension row for an existing relation rule is the same rule, and its non-empty role or description replaces the default's"
parent: LA-CHK
test_type: unit
run_by: lathe/test/structure.test.ts
links:
  proves: [LA-CHK-UC14-R05, LA-CHK-DR81]
---
Loads an extension that rewords `proves` to domain rules and gives `fulfills` from flow to requirement the role `design`; expects each rule once with the new values, the defaults in order, and the flow's requirement counted as designed.
