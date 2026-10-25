---
id: LA-PLT-C06
kind: component
title: Dev API plugin
parent: LA-PLT-LAY06
component_type: vite plugin
file: app/server/lathe.ts
links:
  implements: [LA-PLT-E01]
  satisfies: [LA-PLT-UC02-R01, LA-PLT-UC02-R02, LA-PLT-E01-R01]
  depends_on: [LA-PLT-C04]
---
Serves Lathe's API inside the app's Vite dev server by loading `LA-PLT-C04` through Vite. `GET /api/spec` serves the sample fixture, with `x-lathe-source: fixture` and the reason in `x-lathe-source-reason`, when `LATHE_SPEC_FIXTURE=1` is set or the engine cannot be loaded. It watches the specs folder and the engine's checks and meta-model, and sends `spec:changed`.
