---
id: LA-EXP-T203
kind: test
title: "In the Nested map, a product's children share one text scale, the largest among them, and a small top-level folder's square holds its header at it"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/nested.test.ts
links:
  proves: [LA-EXP-DR62]
---
Lays out a product holding a deep domain and a small folder of three records, and expects the folder to take the domain's text scale (well above its own height level's), its square to hold its header at that scale above its padding and its records below it, its records to keep the leaf scale, and the domain's children to keep their own level's scale, below the domain's.
