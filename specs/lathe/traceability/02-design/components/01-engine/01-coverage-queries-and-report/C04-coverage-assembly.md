---
id: LA-TRC-C04
kind: component
title: Coverage assembly and meta columns
parent: LA-TRC-LAY02
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-TRC-UC02-R01, LA-TRC-UC02-R06]
  depends_on: [LA-TRC-C01]
---
The parts of the workspace loader that read the `obligation` and `role` columns (missing columns load as no and empty) and that build each domain's `Coverage` from the coverage queries: `obligations` in meta-model order, the tests by state, and the gaps.
