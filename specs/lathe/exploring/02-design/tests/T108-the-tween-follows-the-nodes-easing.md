---
id: LA-EXP-T108
kind: test
title: "The tween follows the nodes' easing: CSS's ease, read from the motion tokens"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/motion.test.tsx
links:
  proves: [LA-EXP-DR30]
---
Expects the JS easing to match CSS's `ease` curve walked point by point, the tween's progress to follow it, and the `--motion-speed` and `--motion-ease` tokens to parse as the stylesheet writes them.
