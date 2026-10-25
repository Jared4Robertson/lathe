---
id: LA-TRC-C25
kind: component
title: Domain-level follows in coverage
parent: LA-TRC-LAY02
component_type: sql queries
file: lathe/src/coverage.ts
links:
  satisfies: [LA-TRC-UC07-R01, LA-TRC-UC07-R02, LA-TRC-DR19, LA-TRC-DR20, LA-TRC-DR21]
---
The `domain_follows` step of the coverage queries: a domain record that `follows` a pattern owes every rule of it, added to the rules owed through its use cases (where Not applicable still works), each counted once.
