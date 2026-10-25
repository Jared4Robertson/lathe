---
id: LA-BRW-T641
kind: test
title: "A tall node's content scale grows with its height as far as the column allows"
parent: LA-BRW
test_type: unit
run_by: app/test/graph/icicle.test.ts
links:
  proves: [LA-BRW-DR331]
---
Expects a leaf's scale to be 1, a taller node's to grow with its height, and the growth to stop where a long kind-and-ID line, a long title or a long word would no longer fit the column's width, never below 1.
