---
id: LA-EXP-T176
kind: test
title: "A label reads on screen whenever its box has room for it, its text keeping its on-screen size as the camera zooms out"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/map.test.ts
links:
  proves: [LA-EXP-DR60]
---
Checks the text scale of a leaf at its own size, of a folder 110 by 100 pixels on screen that its content scale alone would leave unreadable (labeled, its text at 0.9 of a leaf's on screen), of a narrow box (never more text than it has room for), of boxes too small (plain), and that a small zoom keeps the same text on screen.
