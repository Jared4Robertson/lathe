---
id: LA-AUT-C19
kind: component
title: Relation rule merge
parent: LA-AUT-LAY04
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC04-R05, LA-AUT-DR23]
---
`loadMeta` in the workspace loader: merges relation rows with the same relation, source kind and target kind into one rule, a later non-empty role or description replacing the earlier one, and keeps every row with its file in `meta_relation_rows`.
