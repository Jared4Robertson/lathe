---
id: LA-PLT-C52
kind: component
title: Single instance
parent: LA-PLT-LAY09
component_type: module
file: desktop/src/instance.ts
links:
  satisfies: [LA-PLT-UC14-R09, LA-PLT-DR27]
  depends_on: [LA-PLT-C38]
---
Where a second launch (`second-instance`, after `app.requestSingleInstanceLock()`) and a folder from Finder or the Dock (`open-file`) go: open or focus that folder's window, or bring the app forward. The packed app declares folders as documents it views, so Finder and the Dock hand them over.
