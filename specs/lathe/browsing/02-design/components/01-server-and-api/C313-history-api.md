---
id: LA-BRW-C313
kind: component
title: History API
parent: LA-BRW-LAY01
component_type: module
file: lathe/src/server/history.ts
links:
  implements: [LA-BRW-E02]
  satisfies: [LA-BRW-E02-R01, LA-BRW-UC119-R05, LA-BRW-DR341]
  depends_on: [LA-BRW-C01]
---
Finds a record's spec file from the specs by its ID, and reads its history with `git log --follow` and `git show`, run by `runGit` with argument arrays inside the product root, a five-second limit and a 512 KB cap. `api.ts` routes `GET /api/history` to it.
