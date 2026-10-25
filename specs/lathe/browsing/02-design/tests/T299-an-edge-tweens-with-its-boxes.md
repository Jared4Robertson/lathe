---
id: LA-BRW-T299
kind: test
title: An edge tweens its two boxes from where they were to where they go, its ends on the boxes at t = 0, 0.5 and 1
parent: LA-BRW
test_type: unit
run_by: app/test/graph/motion.test.tsx
links:
  proves: [LA-BRW-DR147]
---
Tweens an edge between two pictures and expects its points at t = 0 and t = 1 to be the old and new box exits, its box centers halfway at t = 0.5, and both ends on their boxes at every step.
