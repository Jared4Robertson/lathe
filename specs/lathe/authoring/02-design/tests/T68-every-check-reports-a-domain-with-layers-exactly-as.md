---
id: LA-AUT-T68
kind: test
title: Every check reports a domain with layers exactly as the same domain without them
parent: LA-AUT
test_type: unit
run_by: lathe/test/layers.test.ts
links:
  proves: [LA-AUT-UC09-R05, LA-AUT-DR46, LA-AUT-DR47, LA-AUT-DR48]
---
Loads the same two domains and expects the same problems for both, IDs aside, including the component file, unproved, proof-still-owed and proof-counts-nowhere warnings, and no flow step warnings.
