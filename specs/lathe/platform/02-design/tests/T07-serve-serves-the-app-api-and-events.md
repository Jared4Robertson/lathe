---
id: LA-PLT-T07
kind: test
title: Serve serves the app, the spec API and change events for the product repo
parent: LA-PLT
test_type: acceptance
run_by: lathe/test/serve.test.ts
links:
  proves: [LA-PLT-UC02-R04]
---
Starts `serve` on port 5340 for a copy of a fixture, using the built app (the package's `dist/app`, or else a build into a temporary folder), and expects the app page and its script, client-side routes, `/api/spec` from the engine, and a `spec:changed` event on `/api/events` after a record file changes. Skipped with a message only when the app's packages are not installed.
