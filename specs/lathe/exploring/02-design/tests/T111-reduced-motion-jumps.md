---
id: LA-EXP-T111
kind: test
title: Under reduced motion the edges jump with the nodes, with no tween and nothing fading out
parent: LA-EXP
test_type: component
run_by: app/test/graph/motion.test.tsx
links:
  proves: [LA-EXP-UC03-R09, LA-EXP-DR31]
---
With the system asking for reduced motion, re-centers the graph and expects the persisting line already at its new place when the new picture is drawn, staying there, and no line fading out.
