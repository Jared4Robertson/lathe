---
id: LA-PLT-C54
kind: component
title: Local page preload
parent: LA-PLT-LAY10
component_type: module
file: desktop/src/local-preload.cts
links:
  satisfies: [LA-PLT-DR39]
---
The preload of the shell's own pages: it exposes only `window.latheLocal.act(action)`, which sends a button's action to the main process.
