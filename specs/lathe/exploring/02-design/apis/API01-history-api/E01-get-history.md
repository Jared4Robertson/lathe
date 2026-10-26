---
id: LA-EXP-E01
kind: endpoint
title: Get a record's history
parent: LA-EXP-API01
method: GET
route: /api/history
links:
  fulfills: [LA-EXP-UC12-R05]
---
`GET /api/history?id=<record ID>` (and `&skip=<n>` for older commits) answers with the commits that touched the record's spec file; `&commit=<hash>` answers with that commit's diff of the file, and `&commit=working` with the changes not committed yet. `lathe serve`, the app's Vite plugin and the desktop app (through `serve()`) all serve it.
