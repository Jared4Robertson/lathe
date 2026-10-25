---
id: LA-CHK-T37
kind: test
title: maxChildren is read from structure.maxChildren in lathe.config.json
parent: LA-CHK
test_type: unit
run_by: lathe/test/sizes.test.ts
links:
  proves: [LA-CHK-UC06-R02, LA-CHK-DR15]
---
Expects `loadConfig` to return the `maxChildren` the config gives.
