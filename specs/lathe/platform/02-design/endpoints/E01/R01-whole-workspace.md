---
id: LA-PLT-E01-R01
kind: interaction_requirement
title: GET /api/spec answers with the whole workspace, labeled when it is the fixture
parent: LA-PLT-E01
links:
  fulfills: [LA-PLT-UC02-R02]
---
The response MUST be 200 with the `Workspace` JSON that `loadWorkspace` returns for the repo root, with `x-lathe-source: engine`. When the sample fixture is served instead, because `LATHE_SPEC_FIXTURE=1` is set or the engine cannot load, the response MUST carry `x-lathe-source: fixture` and the reason in `x-lathe-source-reason`.
