---
id: LA-BRW-T324
kind: test
title: Closing by button, middle-click or Alt+Shift+W activates the right neighbor or else the left, and the last tab stays as the preview
parent: LA-BRW
test_type: component
run_by: app/test/record-tabs.test.tsx
links:
  proves: [LA-BRW-UC112-R03, LA-BRW-DR151, LA-BRW-DR153]
---
Keeps three tabs, activates the middle one and closes it with Alt+Shift+W, expecting the right neighbor and its address; middle-clicks the rightmost and expects the left neighbor; closes the last and expects it still open, as the preview.
