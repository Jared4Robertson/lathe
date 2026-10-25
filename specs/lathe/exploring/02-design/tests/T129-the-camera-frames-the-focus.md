---
id: LA-EXP-T129
kind: test
title: "The camera frames the focus: the whole picture fits, the focus is centered as far as the picture allows"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/camera.test.tsx
links:
  proves: [LA-EXP-DR40]
---
Expects a picture balanced around its focus framed with the focus in the middle at full size, a focus at the picture's edge moved off center only as far as keeps the picture in view, and a picture wider than the canvas zoomed out.
