---
id: LA-EXP-T116
kind: test
title: Closing by button, middle-click or Alt+Shift+W activates the right neighbor or else the left, and the last tab stays as the preview
parent: LA-EXP
test_type: component
run_by: app/test/record-tabs.test.tsx
links:
  proves: [LA-EXP-UC10-R03, LA-EXP-DR33, LA-EXP-DR35]
---
Keeps three tabs, activates the middle one and closes it with Alt+Shift+W, expecting the right neighbor and its address; middle-clicks the rightmost and expects the left neighbor; closes the last and expects it still open, as the preview.
