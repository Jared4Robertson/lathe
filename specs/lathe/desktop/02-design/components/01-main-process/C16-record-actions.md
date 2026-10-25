---
id: LA-DSK-C16
kind: component
title: Record actions
parent: LA-DSK-LAY01
component_type: module
file: desktop/src/records.ts
links:
  satisfies: [LA-DSK-UC05-R07, LA-DSK-DR13]
  depends_on: [LA-DSK-C01, LA-DSK-C17]
---
Checks a page's record action (`parseRecordRequest`), finds the record's spec file among the folder's spec files by its front matter ID (`SpecFiles`, read again when a record moves), and builds the native right-click menu (`recordMenuTemplate`). The main process reveals the file with `shell.showItemInFolder` and copies the ID with the clipboard.
