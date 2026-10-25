---
id: LA-AUT-C69
kind: component
title: Record actions
parent: LA-AUT-LAY10
component_type: module
file: desktop/src/records.ts
links:
  satisfies: [LA-AUT-UC16-R01, LA-PLT-DR38]
  depends_on: [LA-PLT-C38, LA-AUT-C70]
---
Checks a page's record action (`parseRecordRequest`), finds the record's spec file among the folder's spec files by its front matter ID (`SpecFiles`, read again when a record moves), and builds the native right-click menu (`recordMenuTemplate`). The main process reveals the file with `shell.showItemInFolder` and copies the ID with the clipboard.
