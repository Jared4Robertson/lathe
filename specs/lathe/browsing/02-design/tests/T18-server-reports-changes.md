---
id: LA-BRW-T18
kind: test
title: "The server sends spec:changed when records or the engine's checks or meta-model change"
parent: LA-BRW
test_type: integration
run_by: app/test/server.test.ts
links:
  proves: [LA-BRW-UC05-R01]
---
Runs the dev API plugin against a stand-in Vite server and checks which event each changed file sends: spec records, checks and meta-model send `spec:changed`, other files nothing.
