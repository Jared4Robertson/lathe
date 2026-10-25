---
id: LA-CHK-C34
kind: component
title: Meta-model merge
parent: LA-CHK-LAY02
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC09-R01, LA-CHK-UC09-R02, LA-CHK-UC09-R03, LA-CHK-DR31]
---
`loadMeta` in the workspace loader: reads `kinds.csv` and `relations.csv` from Lathe's `meta/` and then the product's extension folder, merges rows for the same kind into one (lists unioned, non-empty values replacing), merges relation rows for the same rule in the same way (`LA-CHK-C84`), so a row identical to an earlier one changes nothing, and keeps every kind row with its file in `meta_kind_rows`.
