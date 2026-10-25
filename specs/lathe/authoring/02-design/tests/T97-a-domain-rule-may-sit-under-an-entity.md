---
id: LA-AUT-T97
kind: test
title: A domain rule may sit under an entity, and a layer under a layer
parent: LA-AUT
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-AUT-UC13-R05, LA-AUT-DR70, LA-AUT-DR41, LA-AUT-DR49]
---
Expects `domain_rule` to name aggregate, domain and entity as parent kinds, `layer` to name domain and layer, and no `parent-kind-not-allowed` problem in the twin fixture.
