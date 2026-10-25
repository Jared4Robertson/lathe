---
id: LA-DSK-C08
kind: component
title: Preload
parent: LA-DSK-LAY02
component_type: electron preload
file: desktop/src/preload.cts
links:
  satisfies: [LA-DSK-DR04, LA-DSK-UC03-R02, LA-DSK-UC03-R03]
---
Runs sandboxed and exposes only `window.latheDesktop`: `isDesktop`, `platform` and `onCommand(listener)`, which returns an unsubscribe function. A menu choice goes to the app's listeners by command ID; until the app subscribes, the preload presses the command's default keys in the page, so the app's keymap runs it.
