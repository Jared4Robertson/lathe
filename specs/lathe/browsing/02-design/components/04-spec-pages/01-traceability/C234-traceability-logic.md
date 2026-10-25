---
id: LA-BRW-C234
kind: component
title: Traceability logic
parent: LA-BRW-LAY11
component_type: module
file: app/src/specs/trace.ts
links:
  satisfies: [LA-BRW-UC118-R01, LA-BRW-UC118-R02, LA-BRW-UC118-R04, LA-BRW-DR244, LA-BRW-DR245]
  depends_on: [LA-BRW-C235, LA-BRW-C70, LA-BRW-C140]
---
`traceOf` groups a record's links by their labels in the order its kind calls for (an obligation's design, proof and support roles first; a component's designs and the tests proving them; a test's proofs and file), and `judge` reads an obligation's standing in a domain from coverage's gaps and the `component-file-missing` check, so the callouts never disagree with coverage. `owingDomains` finds the domains owing a pattern rule. Pure logic, tested directly.
