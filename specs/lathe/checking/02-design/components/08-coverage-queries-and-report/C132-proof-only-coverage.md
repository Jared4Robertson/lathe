---
id: LA-CHK-C132
kind: component
title: Proof-only coverage
parent: LA-CHK-LAY08
component_type: sql queries
file: lathe/src/coverage.ts
links:
  satisfies: [LA-CHK-UC19-R05, LA-CHK-DR135]
---
Carries each obligation kind's `proof_only` into the coverage items, so that a proof-only obligation counts as designed and built and has no `satisfies` gap, while its proof is counted as before.
