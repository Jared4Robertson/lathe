---
id: LA-EXP-T185
kind: test
title: The Nested map holds each box's children below its header band, top-down from the product's fixed square, siblings equal squares
parent: LA-EXP
test_type: unit
run_by: app/test/graph/nested.test.ts
links:
  proves: [LA-EXP-DR62]
---
Lays out the test workspaces, synthetic trees and a product with a busy part and a quiet one, and expects every child inside its parent's padding below the header band, siblings never overlapping, a parent before its children in the keyboard's order, and the same roots and children as the Tree map; every root the product's square, every group of siblings equal squares, and the busy part and the quiet one the same size with the busy one's children smaller.
