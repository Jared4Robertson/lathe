---
id: LA-AUT-T54
kind: test
title: idPrefixes must be a list of ID prefixes
parent: LA-AUT
test_type: unit
run_by: lathe/test/citations-by-id.test.ts
links:
  proves: [LA-AUT-UC07-R05, LA-AUT-DR31]
---
Expects a config whose `idPrefixes` is a single string to be refused by `loadConfig` and by `loadWorkspace`, with a message naming `idPrefixes`.
