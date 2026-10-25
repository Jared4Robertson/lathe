---
id: LA-CHK-T330
kind: test
title: Coverage counts a rule under an entity and a component in a sub-layer as one level up
parent: LA-CHK
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-CHK-UC27-R05, LA-CHK-DR210, LA-CHK-DR166]
---
Expects the coverage of a domain that keeps its rule under an entity and a component in a sub-layer to equal, ID for ID, that of a twin domain that keeps both one level up.
