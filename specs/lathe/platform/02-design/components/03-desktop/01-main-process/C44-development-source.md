---
id: LA-PLT-C44
kind: component
title: Development source
parent: LA-PLT-LAY09
component_type: module
file: desktop/src/devSource.ts
links:
  satisfies: [LA-PLT-UC12-R01, LA-PLT-UC12-R02, LA-PLT-DR33, LA-PLT-DR34]
  depends_on: [LA-PLT-C08]
  meets: [LA-STD-CODE-R03]
---
`chooseDevSource` probes `http://localhost:5199/api/format` and shares that server when it answers for the opened folder (its `x-lathe-root` header, which `LA-PLT-C08` sets); otherwise `startOwnDevServer` runs the app's Vite (`app/node_modules/vite`) on a free port, never 5199, with `LATHE_ROOT` set to the folder, waits for it, and stops it on request. `vite.config.ts` passes `LATHE_ROOT`, or Lathe's repo, to the dev API plugin.
