---
id: LA-AUT-C08
kind: component
title: Meta-model merge
parent: LA-AUT-LAY04
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-AUT-UC05-R01, LA-AUT-UC05-R02, LA-AUT-UC05-R03, LA-AUT-DR13]
---
`loadMeta` in the workspace loader: reads `kinds.csv` and `relations.csv` from Lathe's `meta/` and then the product's extension folder, merges rows for the same kind into one (lists unioned, non-empty values replacing), merges relation rows for the same rule in the same way (`LA-AUT-C19`), so a row identical to an earlier one changes nothing, and keeps every kind row with its file in `meta_kind_rows`.
