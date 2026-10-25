---
id: LA-CHK-T297
kind: test
title: A child its root does not reach is an entity-unreferenced warning
parent: LA-CHK
test_type: unit
run_by: lathe/test/entities.test.ts
links:
  proves: [LA-CHK-UC24-R07, LA-CHK-DR186, LA-CHK-DR187]
---
Expects warnings for children nothing reaches, reached only from an unreached child, or only referring to the root, and none for a child reached through another child or in an aggregate without one root.
