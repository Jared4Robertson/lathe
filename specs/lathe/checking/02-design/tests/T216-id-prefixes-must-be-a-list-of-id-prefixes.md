---
id: LA-CHK-T216
kind: test
title: idPrefixes must be a list of ID prefixes
parent: LA-CHK
test_type: unit
run_by: lathe/test/citations-by-id.test.ts
links:
  proves: [LA-CHK-UC18-R05, LA-CHK-DR124]
---
Expects a config whose `idPrefixes` is a single string to be refused by `loadConfig` and by `loadWorkspace`, with a message naming `idPrefixes`.
