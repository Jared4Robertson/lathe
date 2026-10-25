---
id: LA-DSK-C14
kind: component
title: Dock
parent: LA-DSK-LAY01
component_type: module
file: desktop/src/dock.ts
links:
  satisfies: [LA-DSK-UC05-R03, LA-DSK-UC05-R04, LA-DSK-DR12]
  depends_on: [LA-DSK-C01]
---
The Dock's badge text for an error count (`badgeText`, `badgeFor` the focused or last focused window), the check of a count from the page (`parseErrorCount`), and the Dock menu (`dockMenuTemplate`: New Window). The main process sets them with `app.dock.setBadge` and `app.dock.setMenu`, and adds each folder opened with `app.addRecentDocument`.
