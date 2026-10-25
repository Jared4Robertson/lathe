---
id: LA-DSK-C09
kind: component
title: Development watcher
parent: LA-DSK-LAY03
component_type: script
file: desktop/scripts/dev.ts
links:
  satisfies: [LA-DSK-UC02-R03]
  depends_on: [LA-DSK-C01]
---
Builds the shell, starts Electron with `LATHE_DESKTOP_DEV=1`, and on any change under `desktop/src` rebuilds and restarts it; a failed build keeps the running shell. Arguments go on to Electron, such as a folder to open.
