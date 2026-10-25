---
id: LA-EXP-T187
kind: test
title: "A Nested box's text is in proportion to it, fixed by the map"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/nested.test.ts
links:
  proves: [LA-EXP-DR62, LA-EXP-DR58]
---
Expects a leaf as wide as its label at a leaf's height at scale 1, a long label in a narrow box smaller and never wrapped, a parent's label within 0.6 of its width, every header band within its share of its box's height (0.4 over one leaf, falling with the square root of the leaves to an eighth), and the same map object for an index whatever the focus.
