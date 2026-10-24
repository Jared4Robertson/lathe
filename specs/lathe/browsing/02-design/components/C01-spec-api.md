---
id: LA-BRW-C01
kind: component
title: Spec API
parent: LA-BRW
component_type: server plugin
file: app/server/spec.ts
links:
  implements: [LA-BRW-E01]
  satisfies: [LA-BRW-UC05-R01, LA-BRW-UC05-R02]
  depends_on: [LA-CHK-C01]
---
A Vite plugin, registered in `app/vite.config.ts`, serving `GET /api/spec`. It imports the engine dynamically and falls back to the fixture, and sends a `spec:changed` event when watched files change.
