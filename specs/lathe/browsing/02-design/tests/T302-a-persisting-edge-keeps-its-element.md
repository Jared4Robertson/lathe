---
id: LA-BRW-T302
kind: test
title: A persisting edge keeps its element and moves to its new place; edges that leave fade out and are then dropped
parent: LA-BRW
test_type: component
run_by: app/test/graph/motion.test.tsx
links:
  proves: [LA-BRW-UC20-R09, LA-BRW-DR147]
---
Re-centers the graph from a use case on its requirement and expects the line between them to be the same element throughout, to start where it was, to pass through frames in between and to settle at its new place, and the lines that leave to fade out and then be dropped.
