---
id: LA-TRC-C27
kind: component
title: Proof-only and domain follows in the unsatisfied check
parent: LA-TRC-LAY03
component_type: sql check
file: lathe/checks/15-unsatisfied.sql
links:
  satisfies: [LA-TRC-UC07-R02, LA-TRC-UC07-R05, LA-TRC-DR20, LA-TRC-DR22]
---
Leaves proof-only kinds out of the `unsatisfied` warning, and finds the domains that owe each pattern rule, itself or through its use cases, by the same rules as the coverage queries.
