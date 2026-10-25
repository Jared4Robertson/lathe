---
id: LA-CHK-C84
kind: component
title: Relation rule merge
parent: LA-CHK-LAY02
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC14-R05, LA-CHK-DR81]
---
`loadMeta` in the workspace loader: merges relation rows with the same relation, source kind and target kind into one rule, a later non-empty role or description replacing the earlier one, and keeps every row with its file in `meta_relation_rows`.
