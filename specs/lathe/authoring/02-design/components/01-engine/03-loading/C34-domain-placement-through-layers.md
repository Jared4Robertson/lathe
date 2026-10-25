---
id: LA-AUT-C34
kind: component
title: Domain placement through layers
parent: LA-AUT-LAY04
component_type: engine module
file: lathe/src/index.ts
links:
  satisfies: [LA-AUT-UC09-R04, LA-AUT-UC09-R05, LA-AUT-DR46]
---
`placeRecords` walks each record's parent chain to its domain and product, so a component under a layer gets the layer's domain in the `records` table, and every check and coverage query that reads `records.domain` judges it there.
