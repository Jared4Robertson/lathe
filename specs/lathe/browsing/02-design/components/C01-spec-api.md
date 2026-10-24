---
id: LA-BRW-C01
kind: component
title: Spec API
parent: LA-BRW
component_type: router
file: lathe/src/server/api.ts
links:
  implements: [LA-BRW-E01]
  satisfies: [LA-BRW-UC05-R01, LA-BRW-UC05-R02]
  depends_on: [LA-CHK-C01]
---
Lathe's HTTP API, serving `GET /api/spec` from the engine. `lathe serve` mounts it directly; in development the app's Vite plugin (`app/server/lathe.ts`) loads it through Vite and serves the sample fixture instead when `LATHE_SPEC_FIXTURE=1` is set. Either way, a `spec:changed` event is sent when the specs folder changes.
