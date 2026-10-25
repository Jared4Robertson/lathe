---
id: LA-PLT-C46
kind: component
title: Development watcher
parent: LA-PLT-LAY11
component_type: script
file: desktop/scripts/dev.ts
links:
  satisfies: [LA-PLT-UC11-R03]
  depends_on: [LA-PLT-C38]
---
Builds the shell, starts Electron with `LATHE_DESKTOP_DEV=1`, and on any change under `desktop/src` rebuilds and restarts it; a failed build keeps the running shell. Arguments go on to Electron, such as a folder to open.
