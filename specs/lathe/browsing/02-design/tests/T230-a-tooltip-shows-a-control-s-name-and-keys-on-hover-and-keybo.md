---
id: LA-BRW-T230
kind: test
title: "A tooltip shows a control's name and keys on hover and keyboard focus"
parent: LA-BRW
test_type: acceptance
run_by: app/test/shortcut-hints.test.tsx
links:
  proves: [LA-BRW-UC91-R01, LA-BRW-DR113]
---
Expects no tooltip at once on hover, the tooltip after the delay, one at once on keyboard focus, Escape and leaving closing it, and none on a click.
