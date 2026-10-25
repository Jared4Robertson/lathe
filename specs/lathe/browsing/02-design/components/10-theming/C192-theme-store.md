---
id: LA-BRW-C192
kind: component
title: Theme store
parent: LA-BRW-LAY10
component_type: typescript module
file: app/src/theme/store.ts
links:
  satisfies: [LA-BRW-UC114-R06, LA-BRW-DR204]
  depends_on: [LA-BRW-C190]
---
Keeps the person's themes, the chosen one, the mode and the chosen theme's stylesheet in local storage, dropping stored themes that no longer read; `setThemeStore()` is the seam for the desktop app's user data.
