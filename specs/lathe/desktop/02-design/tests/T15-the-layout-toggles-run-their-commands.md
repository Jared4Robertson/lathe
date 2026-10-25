---
id: LA-DSK-T15
kind: test
title: The layout toggles run the navigation and inspector commands and show whether each panel shows
parent: LA-DSK
test_type: component
run_by: app/test/desktop-title-bar.test.tsx
links:
  proves: [LA-DSK-UC04-R04]
---
Clicks the navigation toggle twice and the inspector toggle twice, and expects the nav to collapse and expand and the inspector to hide and show, with each toggle's `aria-pressed` following.
