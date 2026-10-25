---
id: LA-CHK-T327
kind: test
title: A domain rule may sit under an entity, and a layer under a layer
parent: LA-CHK
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-CHK-UC27-R05, LA-CHK-DR210, LA-CHK-DR161, LA-CHK-DR169]
---
Expects `domain_rule` to name aggregate, domain and entity as parent kinds, `layer` to name domain and layer, and no `parent-kind-not-allowed` problem in the twin fixture.
