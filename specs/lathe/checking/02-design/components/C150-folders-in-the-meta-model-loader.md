---
id: LA-CHK-C150
kind: component
title: Folders in the meta-model loader
parent: LA-CHK
component_type: engine module
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC21-R01, LA-CHK-UC21-R02, LA-CHK-DR150]
---
`loadMeta` reads each kind's `section` and each folder's row of `sections.csv` from Lathe's `meta/` and a product's extensions, merging later rows into earlier ones as it does for kinds, and builds the `sections` table in stage then order; `loadWorkspace` returns it as `Workspace.sections`.
