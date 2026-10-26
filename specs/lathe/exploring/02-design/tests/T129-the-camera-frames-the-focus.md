---
id: LA-EXP-T129
kind: test
title: The camera frames the focus and the levels the depth shows below it, the parent at the left edge
parent: LA-EXP
test_type: unit
run_by: app/test/graph/camera.test.tsx
links:
  proves: [LA-EXP-DR59, LA-EXP-DR60]
---
Frames a domain at depths 1 and 2, a stage at depth 3, a use case and a short group in a wide level, on a canvas of 1000 by 800, and expects the focus within the padding top to bottom and centered on its middle, the framed levels fitting the canvas, the parent in view in a strip at the left edge with the focus right of it, deeper frames never zooming in further, a leaf at its own size at most, and the whole map fitting the overview.
