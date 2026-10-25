---
id: LA-EXP-T131
kind: test
title: Under reduced motion a re-center frames the new focus at once, and nothing fades
parent: LA-EXP
test_type: component
run_by: app/test/graph/camera.test.tsx
links:
  proves: [LA-EXP-UC03-R09, LA-EXP-DR31, LA-EXP-DR40]
---
With the system asking for reduced motion, re-centers the graph and expects one viewport move with no duration and no record fading in or out.
