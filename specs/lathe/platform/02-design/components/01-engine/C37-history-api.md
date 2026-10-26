---
id: LA-PLT-C37
kind: component
title: History API
parent: LA-PLT-LAY01
component_type: module
file: lathe/src/server/history.ts
links:
  implements: [LA-EXP-E01]
  satisfies: [LA-EXP-E01-R01, LA-EXP-UC12-R05, LA-EXP-DR56]
  depends_on: [LA-PLT-C06]
  meets: [LA-STD-CODE-R02, LA-STD-CODE-R03]
---
Finds a record's spec file from the specs by its ID, and reads its history with `git log --follow` and `git show`, run by `runGit` with argument arrays inside the product root, a five-second limit and a 512 KB cap. `api.ts` routes `GET /api/history` to it.
