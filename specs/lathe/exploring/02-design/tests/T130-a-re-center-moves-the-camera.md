---
id: LA-EXP-T130
kind: test
title: A re-center keeps the clicked node in place, glides the camera with the shared duration, and fades records in and out
parent: LA-EXP
test_type: component
run_by: app/test/graph/camera.test.tsx
links:
  proves: [LA-EXP-UC03-R09, LA-EXP-UC03-R13, LA-EXP-DR39, LA-EXP-DR40]
---
Opens a use case's graph, which appears at once, then clicks its requirement and expects the requirement to stay where it was, one viewport move with the shared duration and easing, the newly linked records fading in, and the record that left fading out where it was, the same box marked as leaving, and then dropped.
