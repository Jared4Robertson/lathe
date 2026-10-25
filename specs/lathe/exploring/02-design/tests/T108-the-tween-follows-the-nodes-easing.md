---
id: LA-EXP-T108
kind: test
title: "The glide follows the shared easing: CSS's ease, read from the motion tokens"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/motion.test.tsx
links:
  proves: [LA-EXP-DR59, LA-PAT-APP-UX-R04]
---
Checks the easing curve against CSS's ease walked finely, a pan halfway through the time most of the way there, and the motion tokens parsed as the stylesheet writes them.
