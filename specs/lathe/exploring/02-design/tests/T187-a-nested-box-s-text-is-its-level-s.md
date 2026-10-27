---
id: LA-EXP-T187
kind: test
title: "In the Nested map, every box at one level has one text scale, from the level's typical box size, and every square is sized to hold its label at it"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/nested.test.ts
links:
  proves: [LA-EXP-DR62, LA-EXP-DR58]
---
Expects a leaf's least square holding its label at scale 1 and a square a hundredth smaller not, a level's typical size the median of its boxes' sizes weighted by area and its scale that size over a leaf's, settled with its boxes' least areas, never below the level below's nor more than 3 times it, a leaf with a long title given a bigger box than its short-titled sibling at the same text scale, and in every test map every box at one height level, the product's children set aside (`LA-EXP-T203`), (0 for a leaf, one more than its tallest child for a parent) at one scale, between the level below's and 3 times it, its label's lines no wider than its box and a leaf's within its height, a parent's header its label's height at that scale and above its padding, and the same map object for an index whatever the focus.
