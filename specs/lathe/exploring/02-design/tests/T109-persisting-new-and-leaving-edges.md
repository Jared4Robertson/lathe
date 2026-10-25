---
id: LA-EXP-T109
kind: test
title: An edge that persists moves at full strength, a new one fades in and a leaving one fades out
parent: LA-EXP
test_type: unit
run_by: app/test/graph/motion.test.tsx
links:
  proves: [LA-EXP-UC03-R09]
---
Expects a persisting edge to move from where it was drawn at opacity 1, a new edge to go from opacity 0 to 1 at its place, a leaving edge to go from 1 to 0, and an edge in the first picture to be drawn at once.
