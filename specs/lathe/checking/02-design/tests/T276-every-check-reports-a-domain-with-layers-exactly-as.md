---
id: LA-CHK-T276
kind: test
title: Every check reports a domain with layers exactly as the same domain without them
parent: LA-CHK
test_type: unit
run_by: lathe/test/layers.test.ts
links:
  proves: [LA-CHK-UC22-R05, LA-CHK-DR166, LA-CHK-DR167, LA-CHK-DR168]
---
Loads the same two domains and expects the same problems for both, IDs aside, including the component file, unproved, proof-still-owed and proof-counts-nowhere warnings, and no flow step warnings.
