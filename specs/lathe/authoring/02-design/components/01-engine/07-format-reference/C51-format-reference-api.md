---
id: LA-AUT-C51
kind: component
title: Format reference API
parent: LA-AUT-LAY08
component_type: api
file: lathe/src/server/api.ts
links:
  satisfies: [LA-AUT-UC11-R04, LA-AUT-E01-R01]
  implements: [LA-AUT-E01]
  depends_on: [LA-AUT-C46]
---
`GET /api/format` answers with the product's `FormatReference` as JSON, for `lathe serve` and the app's Vite dev server alike.
