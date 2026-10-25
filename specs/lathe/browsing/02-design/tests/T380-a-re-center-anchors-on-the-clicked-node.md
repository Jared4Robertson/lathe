---
id: LA-BRW-T380
kind: test
title: The new layout is shifted so the clicked node keeps its world position, and is otherwise the layout as laid out
parent: LA-BRW
test_type: unit
run_by: app/test/graph/camera.test.tsx
links:
  proves: [LA-BRW-DR180, LA-BRW-UC20-R09]
---
Lays out a use case's graph and its requirement's, anchors the second on the requirement, and expects the requirement at its old position, every other node moved by the same offset, the same result each time, and the layout kept as it is when there is no last picture or the focus was not in it.
