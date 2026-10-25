---
id: LA-BRW-T547
kind: test
title: "The camera frames the focus nodes only, so the context ring may run past the canvas"
parent: LA-BRW
test_type: unit
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-BRW-DR303]
---
Lays out a crowded folder and expects the framed positions to be the focus nodes', the framed view never zoomed out further than the whole picture's, some of the ring past the canvas's edges, and the keyboard order and summary of the focus picture.
