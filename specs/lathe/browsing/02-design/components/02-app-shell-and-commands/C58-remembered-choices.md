---
id: LA-BRW-C58
kind: component
title: Remembered choices and narrow screens
parent: LA-BRW-LAY02
component_type: module
file: app/src/shell/prefs.ts
links:
  satisfies: [LA-BRW-UC50-R02, LA-BRW-UC50-R08, LA-BRW-UC50-R11]
---
Reads and writes remembered choices (view, nav and inspector state, split position, open nav sections) to local or session storage, guarded so the app works when storage is missing; with `app/src/shell/useNarrow.ts`, which follows the under-900-px media query for the drawers.
