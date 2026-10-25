---
id: LA-BRW-C05
kind: component
title: Dev API plugin
parent: LA-BRW-LAY01
component_type: vite plugin
file: app/server/lathe.ts
links:
  implements: [LA-BRW-E01]
  satisfies: [LA-BRW-UC05-R01, LA-BRW-UC05-R02, LA-BRW-E01-R01]
  depends_on: [LA-BRW-C01]
---
Serves Lathe's API inside the app's Vite dev server by loading `LA-BRW-C01` through Vite. `GET /api/spec` serves the sample fixture, with `x-lathe-source: fixture` and the reason in `x-lathe-source-reason`, when `LATHE_SPEC_FIXTURE=1` is set or the engine cannot be loaded. It watches the specs folder and the engine's checks and meta-model, and sends `spec:changed`.
