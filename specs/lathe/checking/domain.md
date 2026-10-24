---
id: LA-CHK
kind: domain
title: Checking
parent: LA
---
The engine that turns a folder of record files into a checked database. It loads the meta-model and every record under `specs/`, rebuilds an in-memory DuckDB from them, runs each check in `lathe/checks/`, and computes traceability coverage per domain. The web app and the command line both call it through `loadWorkspace(root)`.
