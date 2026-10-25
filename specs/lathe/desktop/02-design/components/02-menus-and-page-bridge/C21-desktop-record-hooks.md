---
id: LA-DSK-C21
kind: component
title: Desktop record hooks
parent: LA-DSK-LAY02
component_type: react component
file: app/src/shell/desktopRecord.tsx
links:
  satisfies: [LA-DSK-UC05-R03, LA-DSK-UC05-R07]
  depends_on: [LA-DSK-C08]
---
The app's desktop-only hooks, mounted with the title bar: `DesktopRecordActions` in a record's facts, the right-click listener that finds the record under a graph node, a record link or the page title (`recordIdAt`) and asks for the native menu, and the error count sent for the Dock badge. Each shows or listens only when `window.latheDesktop` has the member it needs.
