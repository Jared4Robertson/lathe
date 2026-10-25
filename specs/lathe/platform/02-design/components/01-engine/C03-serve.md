---
id: LA-PLT-C03
kind: component
title: Static server
parent: LA-PLT-LAY01
component_type: server
file: lathe/src/server/serve.ts
links:
  satisfies: [LA-PLT-UC02-R04, LA-AUT-DR11]
  depends_on: [LA-PLT-C06, LA-AUT-C05]
---
`serve({root, port})` serves the prebuilt app from the package's `dist/app`, routes `/api/*` to the shared API, falls back to `index.html` for client-side routes, and streams `spec:changed` events from `/api/events` when the product's folders change. It only reads the meta-model: no route writes it. `appDir` can point it at another build of the app (the tests use a temporary one).
