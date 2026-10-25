---
id: LA-CHK-T282
kind: test
title: maxChildren is read from structure.maxChildren in lathe.config.json
parent: LA-CHK
test_type: unit
run_by: lathe/test/sizes.test.ts
links:
  proves: [LA-CHK-UC23-R02, LA-CHK-DR171]
---
Expects `loadConfig` to return the `maxChildren` the config gives.
