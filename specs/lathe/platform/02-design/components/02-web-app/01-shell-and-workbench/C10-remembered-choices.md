---
id: LA-PLT-C10
kind: component
title: Remembered choices and narrow screens
parent: LA-PLT-LAY03
component_type: module
file: app/src/shell/prefs.ts
links:
  satisfies: [LA-EXP-UC05-R02, LA-EXP-UC05-R08, LA-EXP-UC05-R11]
---
Reads and writes remembered choices (open views, nav and side bar state, pane sizes, open nav sections) to local or session storage, guarded so the app works when storage is missing; with `app/src/shell/useNarrow.ts`, which follows the under-900-px media query for the phone layout and the coarse-pointer query for touch, and keeps Tab inside a sheet.
