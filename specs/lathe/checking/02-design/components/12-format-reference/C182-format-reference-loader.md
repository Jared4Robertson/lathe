---
id: LA-CHK-C182
kind: component
title: Format reference loader
parent: LA-CHK-LAY12
component_type: module
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC25-R02, LA-CHK-UC25-R03]
  depends_on: [LA-CHK-C34, LA-CHK-C91, LA-CHK-C180, LA-CHK-C181]
---
`formatReference(root)` merges the product's meta-model as the workspace loader does, reads `ids.csv`, works out each kind's children, and reads the header of every check that runs: Lathe's in file order, the engine's own, then the product's. It reads no records.
