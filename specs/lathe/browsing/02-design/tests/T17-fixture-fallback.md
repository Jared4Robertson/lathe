---
id: LA-BRW-T17
kind: test
title: "GET /api/spec serves the labelled fixture when asked to or when the engine cannot load"
parent: LA-BRW
test_type: integration
run_by: app/test/server.test.ts
links:
  proves: [LA-BRW-UC05-R02, LA-BRW-E01-R01]
---
Runs the dev API plugin against a stand-in Vite server: with a working engine it serves the engine's answer; with `LATHE_SPEC_FIXTURE=1`, or an engine that fails to load, it serves the sample workspace with `x-lathe-source: fixture` and the reason.
