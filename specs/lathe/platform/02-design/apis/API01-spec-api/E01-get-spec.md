---
id: LA-PLT-E01
kind: endpoint
title: Get the whole workspace
parent: LA-PLT-API01
method: GET
route: /api/spec
links:
  fulfills: [LA-PLT-UC03-R02]
---
Returns the `Workspace` JSON from `loadWorkspace(repoRoot)`. One call returns everything; the client does all navigation. When the fixture is served, the response carries `x-lathe-source: fixture`.
