---
id: LA-PLT-T03
kind: test
title: loadWorkspace returns the Workspace contract
parent: LA-PLT
test_type: unit
run_by: lathe/test/engine.test.ts
links:
  proves: [LA-PLT-UC01-R01]
---
Loads a fixture and expects exactly the fields of `Workspace` and its parts in `lathe/src/types.ts`, including the built coverage counts, as plain JSON.
