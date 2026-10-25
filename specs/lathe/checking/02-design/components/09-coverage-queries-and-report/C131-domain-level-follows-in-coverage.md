---
id: LA-CHK-C131
kind: component
title: Domain-level follows in coverage
parent: LA-CHK-LAY08
component_type: sql queries
file: lathe/src/coverage.ts
links:
  satisfies: [LA-CHK-UC19-R01, LA-CHK-UC19-R02, LA-CHK-DR130, LA-CHK-DR131, LA-CHK-DR132]
---
The `domain_follows` step of the coverage queries: a domain record that `follows` a pattern owes every rule of it, added to the rules owed through its use cases (where Not applicable still works), each counted once.
