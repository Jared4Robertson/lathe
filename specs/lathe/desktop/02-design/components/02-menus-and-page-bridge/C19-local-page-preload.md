---
id: LA-DSK-C19
kind: component
title: Local page preload
parent: LA-DSK-LAY02
component_type: module
file: desktop/src/local-preload.cts
links:
  satisfies: [LA-DSK-DR14]
---
The preload of the shell's own pages: it exposes only `window.latheLocal.act(action)`, which sends a button's action to the main process.
