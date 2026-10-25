---
id: LA-EXP-T166
kind: test
title: A level is as wide as its tallest node allows, and a node's content scale is the smaller of its width and height over a leaf's
parent: LA-EXP
test_type: unit
run_by: app/test/graph/icicle.test.ts
links:
  proves: [LA-EXP-DR54]
---
Expects a leaf's content scale to be 1, a grown node's to be the smaller of its width and height over a leaf's, never below 1; and, at depth 3 from a domain, no column wider than the cap, leaf columns a leaf's width, and the domain's column at the cap with its content at the cap's scale.
