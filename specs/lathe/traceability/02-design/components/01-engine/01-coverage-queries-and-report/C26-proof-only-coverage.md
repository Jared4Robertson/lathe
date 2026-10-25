---
id: LA-TRC-C26
kind: component
title: Proof-only coverage
parent: LA-TRC-LAY02
component_type: sql queries
file: lathe/src/coverage.ts
links:
  satisfies: [LA-TRC-UC07-R05, LA-TRC-DR22]
---
Carries each obligation kind's `proof_only` into the coverage items, so that a proof-only obligation counts as designed and built and has no `satisfies` gap, while its proof is counted as before.
