---
id: LA-PLT-C04
kind: component
title: Spec API
parent: LA-PLT-LAY01
component_type: router
file: lathe/src/server/api.ts
links:
  implements: [LA-PLT-E01]
  satisfies: [LA-PLT-UC02-R01, LA-PLT-UC02-R02, LA-PLT-E01-R01]
  depends_on: [LA-AUT-C03]
---
Lathe's HTTP API, serving `GET /api/spec` from the engine. `lathe serve` mounts it directly; in development the app's Vite plugin (`app/server/lathe.ts`) loads it through Vite and serves the sample fixture instead when `LATHE_SPEC_FIXTURE=1` is set. Either way, a `spec:changed` event is sent when the specs folder changes.
