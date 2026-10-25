---
id: LA-CHK-C168
kind: component
title: Settings table in the workspace loader
parent: LA-CHK-LAY02
component_type: engine module
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC23-R02, LA-CHK-DR179]
---
`loadWorkspace` writes the settings checks read into a `settings` table of `name` and `value` rows, starting with `structure.maxChildren`, before it runs Lathe's checks and the product's own.
