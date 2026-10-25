---
id: LA-DSK-C15
kind: component
title: Single instance
parent: LA-DSK-LAY01
component_type: module
file: desktop/src/instance.ts
links:
  satisfies: [LA-DSK-UC05-R09, LA-DSK-DR02]
  depends_on: [LA-DSK-C01]
---
Where a second launch (`second-instance`, after `app.requestSingleInstanceLock()`) and a folder from Finder or the Dock (`open-file`) go: open or focus that folder's window, or bring the app forward. The packed app declares folders as documents it views, so Finder and the Dock hand them over.
