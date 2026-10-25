---
id: LA-AUT-C53
kind: component
title: Format reference API
parent: LA-AUT-LAY08
component_type: api
file: lathe/src/server/api.ts
links:
  satisfies: [LA-AUT-UC12-R04]
  depends_on: [LA-AUT-C48]
---
`GET /api/format` answers with the product's `FormatReference` as JSON, for `lathe serve` and the app's Vite dev server alike.
