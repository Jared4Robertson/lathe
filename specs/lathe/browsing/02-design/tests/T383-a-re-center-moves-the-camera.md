---
id: LA-BRW-T383
kind: test
title: A re-center keeps the clicked node in place, glides the camera with the shared duration, and fades records in and out
parent: LA-BRW
test_type: component
run_by: app/test/graph/camera.test.tsx
links:
  proves: [LA-BRW-UC20-R09, LA-BRW-UC20-R13, LA-BRW-DR180, LA-BRW-DR181]
---
Opens a use case's graph, which appears at once, then clicks its requirement and expects the requirement to stay where it was, one viewport move with the shared duration and easing, the newly linked records fading in, and the record that left fading out under its own ID and then dropped.
