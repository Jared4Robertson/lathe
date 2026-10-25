---
id: LA-EXP-T180
kind: test
title: "A Nested box's text is in proportion to it, fixed by the map"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/nested.test.ts
links:
  proves: [LA-EXP-DR62, LA-EXP-DR58]
---
Expects a leaf as wide as its label at a leaf's height at scale 1, a long label in a narrow box smaller and never wrapped, every header band within a quarter of its box's height, and the same map object for an index whatever the focus.
