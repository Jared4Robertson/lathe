---
id: LA-CHK-C34
kind: component
title: Meta-model merge
parent: LA-CHK
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC09-R01, LA-CHK-UC09-R02, LA-CHK-UC09-R03, LA-CHK-DR31]
---
`loadMeta` in the workspace loader: reads `kinds.csv` and `relations.csv` from Lathe's `meta/` and then the product's extension folder, merges rows for the same kind into one (lists unioned, non-empty values replacing), drops relation rows identical to one in an earlier folder, and keeps every kind row with its file in `meta_kind_rows`.
