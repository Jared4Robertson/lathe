---
id: LA-EXP-T167
kind: test
title: A parent line is a short level line at the child's middle
parent: LA-EXP
test_type: unit
run_by: app/test/graph/icicle.test.ts
links:
  proves: [LA-EXP-DR53]
---
Expects a tree connector to run from the parent's right edge to the child's left edge at the child's middle, whatever the parent's height, and to stay level while it tweens; a cross-link still runs between the boxes' edges, their heights included.
