---
id: LA-PLT-T129
kind: test
title: knip finds no unused file, export or dependency in the app, the engine or the desktop app
parent: LA-PLT
test_type: unit
run_by: app/test/knip.test.ts
links:
  proves: [LA-PAT-APP-CODE-R21]
---
Runs knip in `app/`, `lathe/` and `desktop/`, each with its own `knip.json`, and expects it to report nothing.
