---
id: LA-AUT-T78
kind: test
title: A child its root does not reach is an entity-unreferenced warning
parent: LA-AUT
test_type: unit
run_by: lathe/test/entities.test.ts
links:
  proves: [LA-AUT-UC11-R07, LA-AUT-DR56, LA-AUT-DR57]
---
Expects warnings for children nothing reaches, reached only from an unreached child, or only referring to the root, and none for a child reached through another child or in an aggregate without one root.
