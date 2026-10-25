---
id: LA-BRW-T545
kind: test
title: "The Links switch is off by default, has a tooltip and the shortcut l, draws the center's links dashed, and is kept while walking"
parent: LA-BRW
test_type: component
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-BRW-UC20-R01, LA-BRW-DR304]
---
Opens a requirement's graph, expects the Links button unpressed with its shortcut, presses l, expects the linked records and three dashed link lines (and no tree line among them), then walks to the view and expects Links still on.
