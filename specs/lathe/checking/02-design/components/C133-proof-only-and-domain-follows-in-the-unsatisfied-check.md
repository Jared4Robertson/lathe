---
id: LA-CHK-C133
kind: component
title: Proof-only and domain follows in the unsatisfied check
parent: LA-CHK
component_type: sql check
file: lathe/checks/15-unsatisfied.sql
links:
  satisfies: [LA-CHK-UC19-R02, LA-CHK-UC19-R05, LA-CHK-DR131, LA-CHK-DR135]
---
Leaves proof-only kinds out of the `unsatisfied` warning, and finds the domains that owe each pattern rule, itself or through its use cases, by the same rules as the coverage queries.
