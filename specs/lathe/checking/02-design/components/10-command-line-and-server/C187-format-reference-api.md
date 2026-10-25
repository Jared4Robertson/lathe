---
id: LA-CHK-C187
kind: component
title: Format reference API
parent: LA-CHK-LAY09
component_type: api
file: lathe/src/server/api.ts
links:
  satisfies: [LA-CHK-UC25-R04]
  depends_on: [LA-CHK-C182]
---
`GET /api/format` answers with the product's `FormatReference` as JSON, for `lathe serve` and the app's Vite dev server alike.
