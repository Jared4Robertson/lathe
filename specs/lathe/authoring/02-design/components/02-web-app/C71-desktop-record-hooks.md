---
id: LA-AUT-C71
kind: component
title: Desktop record hooks
parent: LA-AUT-LAY09
component_type: react component
file: app/src/shell/desktopRecord.tsx
links:
  satisfies: [LA-CHK-UC07-R02, LA-AUT-UC16-R01]
  depends_on: [LA-PLT-C45, LA-PLT-C32]
---
The app's desktop-only hooks, mounted with the title bar: `DesktopRecordActions` in a record's facts (three ghost buttons), the right-click listener that finds the record under a graph node, a record link or the page title (`recordIdAt`) and asks for the native menu, and the error count sent for the Dock badge. Each shows or listens only when `window.latheDesktop` has the member it needs.
