---
id: LA-PLT-C53
kind: component
title: Dock
parent: LA-PLT-LAY09
component_type: module
file: desktop/src/dock.ts
links:
  satisfies: [LA-CHK-UC07-R02, LA-PLT-UC15-R04, LA-PLT-DR37]
  depends_on: [LA-PLT-C40]
---
The Dock's badge text for an error count (`badgeText`, `badgeFor` the focused or last focused window), the check of a count from the page (`parseErrorCount`), and the Dock menu (`dockMenuTemplate`: New Window). The main process sets them with `app.dock.setBadge` and `app.dock.setMenu`, and adds each folder opened with `app.addRecentDocument`.
