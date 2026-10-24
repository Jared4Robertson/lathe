---
id: LA-CHK-C08
kind: component
title: Static server
parent: LA-CHK
component_type: server
file: lathe/src/server/serve.ts
links:
  satisfies: [LA-CHK-UC06-R04]
  depends_on: [LA-BRW-C01, LA-CHK-C07]
---
`serve({root, port})` serves the prebuilt app from the package's `dist/app`, routes `/api/*` to the shared API, falls back to `index.html` for client-side routes, and streams `spec:changed` and `model:changed` events from `/api/events` when the product's folders change.
