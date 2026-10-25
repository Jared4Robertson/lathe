---
id: LA-EXP-T144
kind: test
title: The Links switch is off by default, has a tooltip and the shortcut l, draws the center's links dashed, and is kept while walking
parent: LA-EXP
test_type: component
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-EXP-UC03-R01, LA-EXP-DR49]
---
Opens a requirement's graph, expects the Links button unpressed with its shortcut, presses l, expects the linked records and three dashed link lines (and no tree line among them), then walks to the view and expects Links still on.
