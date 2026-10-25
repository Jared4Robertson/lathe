---
id: LA-BRW-T384
kind: test
title: Under reduced motion a re-center frames the new focus at once, and nothing fades
parent: LA-BRW
test_type: component
run_by: app/test/graph/camera.test.tsx
links:
  proves: [LA-BRW-UC20-R09, LA-BRW-DR148, LA-BRW-DR181]
---
With the system asking for reduced motion, re-centers the graph and expects one viewport move with no duration and no record fading in or out.
