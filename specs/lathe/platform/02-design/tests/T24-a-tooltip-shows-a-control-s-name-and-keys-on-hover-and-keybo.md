---
id: LA-PLT-T24
kind: test
title: A tooltip shows a control's name and keys on hover and keyboard focus
parent: LA-PLT
test_type: acceptance
run_by: app/test/shortcut-hints.test.tsx
links:
  proves: [LA-PLT-UC04-R01, LA-PLT-DR10]
---
Expects no tooltip at once on hover, the tooltip after the delay, one at once on keyboard focus, Escape and leaving closing it, and none on a click.
