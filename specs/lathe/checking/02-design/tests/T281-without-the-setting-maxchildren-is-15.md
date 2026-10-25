---
id: LA-CHK-T281
kind: test
title: Without the setting, maxChildren is 15
parent: LA-CHK
test_type: unit
run_by: lathe/test/sizes.test.ts
links:
  proves: [LA-CHK-UC23-R02, LA-CHK-DR171]
---
With no config, expects `maxChildren` 15, a warning for a domain with 16 components, and none for one with 15.
