---
id: LA-EXP-T169
kind: test
title: The glide is one smooth zoom and pan, from the view as it is to the framed one
parent: LA-EXP
test_type: unit
run_by: app/test/graph/camera.test.tsx
links:
  proves: [LA-EXP-DR59]
---
Expects the zoom path between a domain's frame and a requirement's to start and end at those views, its zoom changing smoothly between frames, and its duration the shared speed for a short path and at most twice it for a long one.
