---
id: LA-PLT-C41
kind: component
title: App servers
parent: LA-PLT-LAY09
component_type: module
file: desktop/src/servers.ts
links:
  satisfies: [LA-PLT-DR33, LA-PLT-DR35, LA-PLT-UC11-R04]
  depends_on: [LA-PLT-C42, LA-PLT-C01]
---
What a window loads. `startServe` imports `serve()` from the built Lathe package (this repo's `lathe/dist`, or the copy packed into the app's resources) and starts it in-process on a free port for the folder; its server-sent events reload pages when records change. `startDev` picks the development source through `LA-PLT-C42`. Each returns a `stop` the window calls.
