---
id: LA-EXP-T130
kind: test
title: Focusing a child glides the camera on the shared motion, and no box moves or changes size
parent: LA-EXP
test_type: component
run_by: app/test/graph/camera.test.tsx
links:
  proves: [LA-EXP-UC03-R09, LA-EXP-DR57, LA-EXP-DR59]
---
Opens a use case's graph, framed at once, clicks its requirement and expects the camera to glide there over several frames and end framing it, every box drawn before and after at the same place and size, and Back gliding back.
