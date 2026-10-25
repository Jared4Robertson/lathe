---
id: LA-DSK-C05
kind: component
title: Development source
parent: LA-DSK-LAY01
component_type: module
file: desktop/src/devSource.ts
links:
  satisfies: [LA-DSK-UC02-R01, LA-DSK-UC02-R02, LA-DSK-DR08, LA-DSK-DR09]
  depends_on: [LA-BRW-C05]
---
`chooseDevSource` probes `http://localhost:5199/api/diagrams` and shares that server when it answers for the opened folder (its `x-lathe-root` header, which `LA-BRW-C05` sets); otherwise `startOwnDevServer` runs the app's Vite (`app/node_modules/vite`) on a free port, never 5199, with `LATHE_ROOT` set to the folder, waits for it, and stops it on request. `vite.config.ts` passes `LATHE_ROOT`, or Lathe's repo, to the dev API plugin.
