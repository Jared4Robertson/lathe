---
id: LA-PLT-UC03-R02
kind: requirement
title: The fixture is served, and labeled, when the engine is unavailable
parent: LA-PLT-UC03
---
When the engine cannot be loaded, or `LATHE_SPEC_FIXTURE=1` is set, `GET /api/spec` MUST serve the sample workspace with the header `x-lathe-source: fixture`, and the page MUST show a short note that the data is the fixture.
