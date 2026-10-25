---
id: LA-DSK-C04
kind: component
title: App servers
parent: LA-DSK-LAY01
component_type: module
file: desktop/src/servers.ts
links:
  satisfies: [LA-DSK-DR08, LA-DSK-DR10, LA-DSK-UC02-R04]
  depends_on: [LA-DSK-C05, LA-CHK-C08]
---
What a window loads. `startServe` imports `serve()` from the built Lathe package (this repo's `lathe/dist`, or the copy packed into the app's resources) and starts it in-process on a free port for the folder; its server-sent events reload pages when records change. `startDev` picks the development source through `LA-DSK-C05`. Each returns a `stop` the window calls.
