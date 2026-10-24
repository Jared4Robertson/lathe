---
id: LA-CHK-C23
kind: component
title: Coverage assembly and meta columns
parent: LA-CHK
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC07-R01, LA-CHK-UC07-R04, LA-CHK-UC07-R06]
  depends_on: [LA-CHK-C20]
---
The parts of the workspace loader that read the `obligation` and `role` columns (missing columns load as no and empty) and that build each domain's `Coverage` from the coverage queries: `obligations` in meta-model order, the `requirements_*` and `rules_*` fields from it, and the gaps.
