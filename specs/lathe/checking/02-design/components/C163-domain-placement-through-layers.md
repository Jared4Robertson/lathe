---
id: LA-CHK-C163
kind: component
title: Domain placement through layers
parent: LA-CHK
component_type: engine module
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC22-R04, LA-CHK-UC22-R05, LA-CHK-DR166]
---
`placeRecords` walks each record's parent chain to its domain and product, so a component under a layer gets the layer's domain in the `records` table, and every check and coverage query that reads `records.domain` judges it there.
