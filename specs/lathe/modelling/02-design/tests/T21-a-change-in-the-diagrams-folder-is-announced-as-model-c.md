---
id: LA-MOD-T21
kind: test
title: "A change in the diagrams folder is announced as model:changed"
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-UC02-R03]
---
Expects the server's watch targets to send `model:changed` for the configured diagrams folder, both the default and this repo's `model/`.
