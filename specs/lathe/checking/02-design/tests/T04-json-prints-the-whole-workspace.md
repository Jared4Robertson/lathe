---
id: LA-CHK-T04
kind: test
title: With --json the check prints the whole workspace
parent: LA-CHK
test_type: acceptance
run_by: lathe/test/cli.test.ts
links:
  proves: [LA-CHK-UC01-R03]
---
Runs `lathe check --json` and expects its output to parse to the same `Workspace` that `loadWorkspace` returns.
